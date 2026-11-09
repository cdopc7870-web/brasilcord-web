'use strict';

// Interface da plataforma própria do BrasilCord. Não utiliza credenciais do Discord.
// O token permanece apenas em memoria durante o uso e e salvo criptografado pelo Electron no Windows.
(() => {
  const API = 'https://brasilcord-sinalizacao-dkx157.onrender.com';
  const $ = id => document.getElementById(id);
  const auth = $('bc-platform-auth');
  const app = $('bc-platform-app');
  const status = $('bc-platform-status');
  const connection = $('bc-platform-connection');
  const form = $('bc-platform-auth-form');
  const messages = $('bc-platform-messages');
  const compose = $('bc-platform-message-form');
  let token = '';
  let user = null;
  let registering = false;
  let challengeId = null;
  let communities = [];
  let selectedCommunity = null;
  let selectedChannel = null;
  let channelRows = [];
  let socket = null;
  let pingTimer = null;
  let reconnectTimer = null;
  let refreshTimer = null;
  let destroyed = false;
  function notifyState(detail) {
    document.dispatchEvent(new CustomEvent('bc:platform-state', {detail}));
  }

  function feedback(message, isError = false) {
    status.textContent = message || '';
    status.dataset.error = String(Boolean(isError));
  }
  function make(tag, text, className = '') {
    const el = document.createElement(tag);
    if (text != null) el.textContent = String(text);
    if (className) el.className = className;
    return el;
  }
  async function request(path, {method = 'GET', data} = {}) {
    const headers = {'Accept': 'application/json'};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 13000);
    try {
      const res = await fetch(API + '/api/platform' + path, {
        method, headers, body: data === undefined ? undefined : JSON.stringify(data),
        signal: abort.signal, cache: 'no-store'
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && token) logout(false);
        throw new Error(body.error || 'Erro HTTP ' + res.status);
      }
      return body;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('O servidor demorou a responder. Tente novamente.');
      if (err instanceof TypeError) throw new Error('Não foi possível conectar ao servidor do BrasilCord.');
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function checkService() {
    connection.textContent='Verificando serviço…';
    connection.dataset.state='connecting';
    try {
      await request('/health');
      connection.textContent = 'Serviço conectado';
      connection.dataset.state = 'online';
      return true;
    } catch (err) {
      connection.textContent = 'Serviço indisponível · tentar novamente';
      connection.dataset.state = 'offline';
      feedback(err.message, true);
      return false;
    }
  }

  connection.title='Clique para verificar a conexão novamente';
  connection.style.cursor='pointer';
  connection.addEventListener('click',()=>void checkService());
  const serviceMonitor=setInterval(()=>{if(!destroyed&&connection.dataset.state!=='online')void checkService();},30000);
  function cleanupConnections() {
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    if (socket) {
      const old = socket;
      socket = null;
      old.onclose = null;
      old.close();
    }
  }
  function logout(clearFeedback = true) {
    challengeId=null;
    $('bc-platform-otp-form').hidden=true;
    form.hidden=false;
    void window.brasilcord.clearPlatformSession().catch(() => {});
    const previousToken = token;
    cleanupConnections();
    token = '';
    user = null;
    communities = [];
    selectedCommunity = null;
    selectedChannel = null;
    notifyState({type:'logout'});
    notifyState({type:'voice-session',token:null});
    app.hidden = true;
    auth.hidden = false;
    form.reset();
    if (clearFeedback) feedback('Você saiu da sua conta.');
    if (previousToken) void fetch(API + '/api/platform/logout', {
      method: 'POST',
      headers: {Authorization: 'Bearer ' + previousToken}
    }).catch(() => {});
  }
  function loginScreen() {
    $('bc-platform-auth-title').textContent = registering ? 'Crie sua conta' : 'Entre na sua conta';
    $('bc-platform-auth-description').textContent = registering
      ? 'Sua conta será independente do Discord.'
      : 'Acesse suas comunidades do BrasilCord.';
    $('bc-platform-username-wrap').hidden = !registering;
    $('bc-platform-username').required = registering;
    $('bc-platform-password').autocomplete = registering ? 'new-password' : 'current-password';
    $('bc-platform-toggle-auth').textContent = registering ? 'Já tenho conta' : 'Criar conta';
    $('bc-platform-submit').textContent = registering ? 'Criar conta BrasilCord' : 'Entrar no BrasilCord';
  }
  $('bc-platform-toggle-auth').addEventListener('click', () => {
    registering = !registering;
    challengeId=null;
    $('bc-platform-otp-form').hidden=true;
    form.hidden=false;
    loginScreen();
    feedback('');
  });
  async function enterAccount(result, {persist = false} = {}) {
    if(!result?.token || !result?.user)throw new Error('Sessão inválida.');
    token=result.token;
    user=result.user;
    challengeId=null;
    $('bc-platform-otp-form').hidden=true;
    form.hidden=false;
    $('bc-platform-password').value='';
    auth.hidden=true;
    app.hidden=false;
    $('bc-platform-user-label').textContent=user.displayName+' · @'+user.username;
    notifyState({type:'user',user});
    $('bc-platform-profile-form').elements.displayName.value=user.displayName;
    $('bc-platform-profile-form').elements.bio.value=user.bio || '';
    notifyState({type:'voice-session',token});
    if(persist) {
      const stored=await window.brasilcord.savePlatformSession(token);
      if(!stored?.ok) feedback(stored?.message||'Entrou, mas não foi possível salvar a sessão.',true);
    }
    await Promise.all([loadCommunities(),loadFriends()]);
    connectLive();
    feedback(persist?'Conectado ao BrasilCord. Login salvo neste computador.':'Bem-vindo de volta ao BrasilCord.');
  }

  async function restoreLogin() {
    let saved;
    try {
      saved=await window.brasilcord.restorePlatformSession();
      if(!saved?.token)return;
    }catch{return;}
    feedback('Restaurando sua sessão salva…');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),13000);
    try {
      const res=await fetch(API+'/api/platform/me',{
        headers:{Authorization:'Bearer '+saved.token,Accept:'application/json'},
        cache:'no-store',signal:controller.signal
      });
      if(res.status===401 || res.status===403) {
        await window.brasilcord.clearPlatformSession();
        feedback('Sua sessão expirou. Entre novamente.',true);
        return;
      }
      if(!res.ok)throw new Error('Servidor temporariamente indisponível.');
      const result=await res.json();
      await enterAccount({token:saved.token,user:result.user},{persist:false});
    }catch(err){
      // Falhas temporarias de conexao nao apagam a sessao local valida.
      if(!token)feedback('Não foi possível restaurar o login agora. Tente novamente quando o serviço estiver disponível.',true);
    }finally{clearTimeout(timeout);}
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = $('bc-platform-submit');
    button.disabled = true;
    feedback('Conectando à sua conta…');
    try {
      const payload = {
        email: $('bc-platform-email').value.trim(),
        password: $('bc-platform-password').value
      };
      if (registering) payload.username = $('bc-platform-username').value.trim();
      const result = await request(registering ? '/register' : '/login', {
        method: 'POST', data: payload
      });
      if(result.verificationRequired && typeof result.challengeId==='string'){
        challengeId=result.challengeId;
        $('bc-platform-password').value='';
        form.hidden=true;
        $('bc-platform-otp-form').hidden=false;
        $('bc-platform-otp-code').value='';
        $('bc-platform-otp-code').focus();
        feedback('Código enviado ao seu e-mail. Confirme para entrar na conta.');
      }else{
        await enterAccount(result,{persist:true});
      }
    } catch (err) {
      feedback(err.message, true);
    } finally {
      button.disabled = false;
    }
  });

  $('bc-platform-otp-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!challengeId)return;
    const submit=$('bc-platform-otp-submit');
    submit.disabled=true;
    try{
      const code=$('bc-platform-otp-code').value.trim();
      if(!/^\d{6}$/.test(code))throw new Error('Digite exatamente 6 números.');
      const verified=await request('/login/verify',{
        method:'POST',data:{challengeId,code}
      });
      await enterAccount(verified,{persist:true});
    }catch(err){feedback(err.message,true);}
    finally{submit.disabled=false;}
  });
  $('bc-platform-otp-back').addEventListener('click',()=>{
    challengeId=null;
    $('bc-platform-otp-code').value='';
    $('bc-platform-otp-form').hidden=true;
    form.hidden=false;
    feedback('Você pode entrar novamente para solicitar um novo código após 60 segundos.');
  });
  document.addEventListener('bc:profile-media',event=>{
    if(user && event.detail?.id===user.id)user={...user,...event.detail};
  });
  $('bc-platform-logout').addEventListener('click', () => logout());
  document.addEventListener('bc:community-joined',async event=>{
    try{
      await loadCommunities();
      if(event.detail?.id)await selectCommunity(event.detail.id);
    }catch(err){feedback(err.message,true);}
  });
  document.addEventListener('bc:refresh-friends',()=>void loadFriends());
  document.addEventListener('bc:refresh-communities',()=>void loadCommunities());
  document.addEventListener('bc:community-deleted',event=>{
    if(selectedCommunity?.id!==event.detail?.id)return;
    selectedCommunity=null;selectedChannel=null;channelRows=[];
    $('bc-platform-community-name').textContent='Escolha uma comunidade';
    $('bc-platform-channel-name').textContent='Selecione um canal';
    $('bc-platform-channel-list').replaceChildren();
    $('bc-platform-voice-list').replaceChildren();
    $('bc-platform-messages').replaceChildren();
    notifyState({type:'community',community:null});
    notifyState({type:'channels-list',channels:[]});
    notifyState({type:'voice-channels',channels:[]});
    compose.querySelector('input').disabled=true;compose.querySelector('button').disabled=true;
    $('bc-server-settings-button').hidden=true;
  });
  document.addEventListener('bc:refresh-current-community',event=>{
    if(event.detail?.id===selectedCommunity?.id)void selectCommunity(selectedCommunity.id);
  });
  async function loadCommunities() {
    if (!token) return;
    const result = await request('/communities');
    communities = result.communities;
    const list = $('bc-platform-communities');
    list.replaceChildren();
    if (!communities.length) list.append(make('p', 'Crie sua primeira comunidade ou use um convite.', 'bc-empty'));
    for (const community of communities) {
      const item = make('button', null, 'bc-community-item');
      const icon = make('span',
        community.is_official ? '🇧🇷' : community.name.trim().slice(0,2).toLocaleUpperCase('pt-BR'),
        'bc-community-symbol');
      item.dataset.official=String(community.is_official===true);
      if(community.is_official){
        item.title='🇧🇷 BrasilCord • Oficial · Comunidade permanente';
        const marker=make('span','✓','bc-official-rail-verified');
        marker.setAttribute('aria-label','Oficial');
        item.append(marker);
      }
      item.append(icon);
      item.type = 'button';
      item.title = community.is_official ? '🇧🇷 BrasilCord • Oficial · comunidade permanente' : community.name;
      item.setAttribute('aria-label', 'Abrir comunidade ' + community.name);
      item.dataset.active = String(community.id === selectedCommunity?.id);
      item.addEventListener('click', () => void selectCommunity(community.id));
      list.append(item);
    }
    if (selectedCommunity && !communities.some(c => c.id === selectedCommunity.id)) {
      selectedCommunity = null;
      selectedChannel = null;
    }
    notifyState({type:'communities',communities:communities.map(c=>({id:c.id,name:c.name,role:c.role,has_image:c.has_image,is_official:c.is_official}))});
    if (!selectedCommunity && communities.length) await selectCommunity(communities[0].id);
  }
  async function selectCommunity(id) {
    try {
      const result = await request('/communities/' + encodeURIComponent(id));
      selectedCommunity = result.community;
      selectedChannel = null;
      $('bc-official-banner').hidden=true;
      $('bc-platform-community-name').textContent = selectedCommunity.name;
      const official=selectedCommunity.is_official===true;
      $('bc-official-banner').hidden=!official;
      $('bc-official-readonly-badge').hidden=!official||selectedCommunity.role==='owner';
      $('bc-platform-community-name').title=official?'Comunidade oficial e permanente do BrasilCord':'Comunidade';
      $('bc-server-settings-button').hidden=!(
        selectedCommunity.role==='owner'||
        selectedCommunity.permissions?.manage_channels||
        selectedCommunity.permissions?.manage_roles||
        selectedCommunity.permissions?.create_invites
      );
      $('bc-platform-channel-form').hidden = !selectedCommunity.permissions?.manage_channels;
      $('bc-platform-voice-form').hidden = !selectedCommunity.permissions?.manage_channels;
      $('bc-platform-invite').hidden = !selectedCommunity.permissions?.create_invites;
      notifyState({type:'community',community:{...selectedCommunity}});
      notifyState({type:'channels-list',channels:result.channels});
      $('bc-platform-channel-list').replaceChildren();
      $('bc-platform-voice-list').replaceChildren();
      notifyState({type:'voice-channels',channels:result.channels.filter(c=>c.kind==='voice').map(c=>({id:c.id,name:c.name}))});
      for (const channel of result.channels) {
        if (channel.kind === 'voice') {
          const voiceButton = make('button', null, 'bc-voice-channel-item');
          voiceButton.type='button';
          voiceButton.dataset.voiceId=channel.id;
          voiceButton.dataset.bcContextType='channel';
          voiceButton.dataset.bcContextId=channel.id;
          voiceButton.dataset.bcContextName=channel.name;
          voiceButton.append(make('span','◉','bc-voice-channel-icon'),make('span',channel.name,'bc-voice-channel-name'));
          voiceButton.setAttribute('aria-label','Entrar na call '+channel.name);
          voiceButton.addEventListener('click',()=>notifyState({type:'voice-join-request',channel:{id:channel.id,name:channel.name}}));
          $('bc-platform-voice-list').append(voiceButton);
          continue;
        }
        const button = make('button', null, 'bc-channel-item');
        button.append(make('span','#','bc-channel-icon'),make('span',channel.name,'bc-channel-name'));
        button.type = 'button';
        button.dataset.channelId = channel.id;
        button.dataset.bcContextType='channel';
        button.dataset.bcContextId=channel.id;
        button.dataset.bcContextName=channel.name;
        button.addEventListener('click', () => void selectChannel(channel));
        $('bc-platform-channel-list').append(button);
      }
      void loadMembers();
      $('bc-platform-messages').replaceChildren();
      $('bc-platform-channel-name').textContent = 'Selecione um canal';
      compose.querySelector('input').disabled = true;
      compose.querySelector('button').disabled = true;
      [...$('bc-platform-communities').children].forEach((node,i) => {
        if (node.tagName === 'BUTTON') node.dataset.active = String(communities[i]?.id === id);
      });
      if (result.channels.some(c=>c.kind!=='voice')) await selectChannel(result.channels.find(c=>c.kind!=='voice'));
    } catch (err) {feedback(err.message,true);}
  }
  async function selectChannel(channel) {
    selectedChannel = channel;
    channelRows = [];
    clearReply();
    $('bc-platform-channel-name').textContent = channel.name;
    document.querySelectorAll('#bc-platform-channel-list [data-channel-id]').forEach(button => {
      button.dataset.active = String(button.dataset.channelId === channel.id);
      button.setAttribute('aria-current', button.dataset.channelId === channel.id ? 'page' : 'false');
    });
    notifyState({type:'channel',channel:{id:channel.id,name:channel.name}});
    const readOnly=selectedCommunity?.is_official===true && selectedCommunity.role!=='owner';
    compose.querySelector('input').disabled=readOnly;
    compose.querySelector('input').placeholder=readOnly?'🔒 Canal oficial · Apenas dkx157 publica aqui.':'Escreva uma mensagem…';
    compose.querySelector('button').disabled=readOnly;
    compose.dataset.readOnly=String(readOnly);
    try { await loadMessages(); }
    catch(err) { feedback(err.message,true); }
  }
  let replyTarget=null;
  const replyBar=$('bc-message-reply-bar'),replyLabel=$('bc-message-reply-label');
  function clearReply(){replyTarget=null;replyBar.hidden=true;}
  function setReply(message){
    if(!message||!selectedChannel)return;
    replyTarget={id:message.id,channelId:selectedChannel.id};
    replyLabel.textContent='↩ Respondendo a '+(message.author?.displayName||message.author?.username||'membro')+
      ': '+String(message.content||'').slice(0,110);
    replyBar.hidden=false;$('bc-platform-message-input').focus();
  }
  $('bc-message-reply-cancel').addEventListener('click',clearReply);
  function renderMessage(message) {
    const row = make('div', '', 'bc-platform-message');
    row.dataset.bcMessageId=message.id;
    if(message.author?.id){
      row.dataset.bcUserId=message.author.id;
      row.dataset.bcUsername=message.author.username||'';
    }
    const head = make('div', '', 'bc-platform-message-head');
    head.append(make('strong', message.author?.displayName || message.author?.username || 'Usuário'));
    if(message.author?.username)head.append(make('small','@'+message.author.username,'bc-platform-message-handle'));
    head.append(make('time', new Date(message.createdAt).toLocaleString('pt-BR')));
    const avatar=make('span',(message.author?.displayName||message.author?.username||'B').slice(0,2).toLocaleUpperCase('pt-BR'),'bc-message-avatar');
    if(message.author?.avatarUrl){
      const photo=make('img',null,'bc-channel-message-avatar-photo');
      photo.src=message.author.avatarUrl;photo.alt='';photo.loading='lazy';
      photo.addEventListener('error',()=>photo.remove());
      avatar.append(photo);
    }
    const body = make('div', '', 'bc-message-body');
    if(message.replyToId){
      const ref=make('div',null,'bc-reply-preview');
      ref.append(make('strong','↩ '+(message.replyPreview?.author||'Mensagem anterior')));
      ref.append(make('span',message.replyPreview?.content?.slice(0,150)||'Mensagem removida'));
      ref.addEventListener('click',()=>{
        const target=messages.querySelector('[data-bc-message-id="'+message.replyToId+'"]');
        target?.scrollIntoView({behavior:'smooth',block:'center'});
      });
      body.append(ref);
    }
    body.append(head,make('p',message.content));
    if(message.pinnedAt)body.append(make('span','📌 Fixada','bc-message-pinned'));
    const reactions=make('div',null,'bc-message-reactions');
    for(const reaction of message.reactions||[]){
      const chip=make('button',reaction.emoji+' '+reaction.count,'bc-reaction-chip');
      chip.type='button';chip.dataset.mine=String(reaction.mine);
      chip.title=reaction.mine?'Clique para remover sua reação':'Clique para reagir';
      chip.addEventListener('click',()=>void toggleReaction(message.id,reaction.emoji));
      reactions.append(chip);
    }
    body.append(reactions);
    row.append(avatar,body);
    return row;
  }
  // Menu próprio de mensagens; os controles são verificados novamente pelo backend.
  const emojiPicker=make('div',null,'bc-emoji-picker');emojiPicker.hidden=true;
  document.body.append(emojiPicker);
  function hideEmojiPicker(){emojiPicker.hidden=true;emojiPicker.replaceChildren();}
  function showEmojiPicker(message){
    hideEmojiPicker();
    for(const emoji of ['👍','❤️','😂','🔥','🎉','😮','😢','👏','💚','🇧🇷']){
      const button=make('button',emoji);button.type='button';button.title='Reagir com '+emoji;
      button.addEventListener('click',()=>{hideEmojiPicker();void toggleReaction(message.id,emoji);});
      emojiPicker.append(button);
    }
    emojiPicker.hidden=false;
    const row=messages.querySelector('[data-bc-message-id="'+message.id+'"]');
    const rect=row?.getBoundingClientRect();
    emojiPicker.style.left=Math.max(8,Math.min((rect?.left||20),innerWidth-290))+'px';
    emojiPicker.style.top=Math.max(8,Math.min((rect?.bottom||80)+4,innerHeight-100))+'px';
  }
  async function toggleReaction(id,emoji){
    try{
      await request('/messages/'+encodeURIComponent(id)+'/reactions',{method:'POST',data:{emoji}});
      channelRows=[];await loadMessages();
    }catch(err){feedback(err.message,true);}
  }
  const messageMenu=make('div',null,'bc-message-context-menu');
  messageMenu.setAttribute('role','menu');messageMenu.hidden=true;
  document.body.append(messageMenu);
  function hideMessageMenu(){messageMenu.hidden=true;messageMenu.replaceChildren();}
  function messageMenuAction(label,fn){
    const button=make('button',label);
    button.type='button';button.setAttribute('role','menuitem');
    button.addEventListener('click',()=>{
      hideMessageMenu();
      void Promise.resolve().then(fn).catch(err=>feedback(err.message,true));
    });
    messageMenu.append(button);
  }
  document.addEventListener('contextmenu',event=>{
    const target=event.target.closest?.('#bc-platform-messages .bc-platform-message[data-bc-message-id]');
    if(!target||!token)return;
    const message=channelRows.find(row=>row.id===target.dataset.bcMessageId);
    if(!message)return;
    event.preventDefault();event.stopImmediatePropagation();
    hideMessageMenu();
    const self=message.author?.id===user?.id;
    messageMenuAction('👤 Ver perfil',()=>document.dispatchEvent(new CustomEvent('bc:show-user-profile',{detail:{id:message.author?.id}})));
    messageMenuAction('↩ Responder',()=>setReply(message));
    messageMenuAction('😊 Reagir',()=>showEmojiPicker(message));
    if(self)messageMenuAction('✎ Editar mensagem',async()=>{
      const text=window.prompt('Editar mensagem:',message.content);
      if(text===null)return;
      if(!text.trim()||text.length>2000)throw Error('Mensagem inválida.');
      await request('/messages/'+encodeURIComponent(message.id),{method:'PATCH',data:{content:text.trim()}});
      channelRows=[];await loadMessages();
    });
    if(selectedCommunity?.role==='owner'||selectedCommunity?.role==='admin'||selectedCommunity?.permissions?.manage_channels){
      messageMenuAction(message.pinnedAt?'📌 Desafixar':'📌 Fixar mensagem',async()=>{
        await request('/messages/'+encodeURIComponent(message.id)+'/pin',{method:message.pinnedAt?'DELETE':'POST'});
        channelRows=[];await loadMessages();
      });
    }

    const canDelete=self||selectedCommunity?.role==='owner'||selectedCommunity?.role==='admin';
    if(canDelete){
      messageMenuAction('🗑 Excluir mensagem',async()=>{
        if(!window.confirm('Excluir esta mensagem permanentemente?'))return;
        await request('/messages/'+encodeURIComponent(message.id),{method:'DELETE'});
        channelRows=[];
        await loadMessages();
        feedback('Mensagem excluída.');
      });
    }
    if(!self)messageMenuAction('⚑ Denunciar mensagem',async()=>{
      const reason=window.prompt('Motivo da denúncia (3 a 500 caracteres):','');
      if(reason===null)return;
      if(reason.trim().length<3||reason.trim().length>500)throw Error('Informe um motivo entre 3 e 500 caracteres.');
      const result=await request('/messages/'+encodeURIComponent(message.id)+'/report',{
        method:'POST',data:{reason:reason.trim()}
      });
      feedback(result.message||'Denúncia enviada à moderação.');
    });
    messageMenu.hidden=false;
    const rect=messageMenu.getBoundingClientRect();
    messageMenu.style.left=Math.max(8,Math.min(event.clientX,window.innerWidth-rect.width-8))+'px';
    messageMenu.style.top=Math.max(8,Math.min(event.clientY,window.innerHeight-rect.height-8))+'px';
  },true);
  document.addEventListener('click',event=>{if(!messageMenu.contains(event.target))hideMessageMenu();if(!emojiPicker.contains(event.target))hideEmojiPicker();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){hideMessageMenu();hideEmojiPicker();clearReply();}});
  window.addEventListener('resize',hideMessageMenu);

  async function loadMessages() {
    if (!selectedChannel || !token) return;
    const channelId = selectedChannel.id;
    const result = await request('/channels/' + encodeURIComponent(channelId) + '/messages');
    if (selectedChannel?.id !== channelId) return;
    const fingerprint=m=>m.id+':'+m.content+':'+m.pinnedAt+':'+JSON.stringify(m.reactions||[])+':'+m.replyToId;
    const previousIds = channelRows.map(fingerprint).join(',');
    const newIds = result.messages.map(fingerprint).join(',');
    if (previousIds === newIds) return;
    channelRows = result.messages;
    const nodes = channelRows.map(renderMessage);
    messages.replaceChildren(...nodes);
    messages.scrollTop = messages.scrollHeight;
  }
  compose.addEventListener('submit',async e=>{
    e.preventDefault();
    if (!selectedChannel || compose.dataset.readOnly==='true') return;
    const input = $('bc-platform-message-input');
    const value = input.value.trim();
    if (!value) return;
    const button = compose.querySelector('button');
    button.disabled = true;
    try {
      await request('/channels/' + encodeURIComponent(selectedChannel.id) + '/messages', {
        method:'POST',data:{content:value,replyToId:replyTarget?.channelId===selectedChannel.id?replyTarget.id:null}
      });
      input.value = '';
      clearReply();
      await loadMessages();
      input.focus();
    } catch(err) {feedback(err.message,true);}
    finally {button.disabled = false;}
  });
  const serverModalStatus=(message,error=false)=>document.dispatchEvent(new CustomEvent('bc:server-modal-status',{detail:{message,error}}));
  const serverModalDone=()=>document.dispatchEvent(new CustomEvent('bc:server-modal-complete'));
  $('bc-platform-create-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget,button=form.querySelector('[type="submit"]');
    if(button.disabled)return;
    const formData=new FormData(form);
    button.disabled=true;
    serverModalStatus('Criando seu servidor…');
    try {
      const created=await request('/communities',{method:'POST',data:{name:formData.get('name')}});
      form.reset();
      selectedCommunity=null;
      await loadCommunities();
      await selectCommunity(created.community.id);
      feedback('Servidor criado com sucesso.');
      serverModalDone();
    } catch(err) {feedback(err.message,true);serverModalStatus(err.message,true);}
    finally {button.disabled=false;}
  });
  document.addEventListener('bc:join-invite-code',async event=>{
    const code=String(event.detail?.code||'').toUpperCase();
    if(!/^[A-F0-9]{12}$/.test(code))return;
    if(!token){
      feedback('Faça login na sua conta para entrar por convite.');
      document.querySelector('#page-app [data-bc-view="chat"]')?.click();
      $('bc-platform-auth').hidden=false;
      $('bc-platform-app').hidden=true;
      return;
    }
    try{
      feedback('Verificando convite e entrando na comunidade…');
      const joined=await request('/join',{method:'POST',data:{code}});
      await loadCommunities();
      await selectCommunity(joined.community.id);
      document.querySelector('#page-app [data-bc-view="chat"]')?.click();
      feedback('Você entrou na comunidade com sucesso.');
    }catch(err){
      if(/já (participa|é membro)|already/i.test(err.message)){
        await loadCommunities();
        feedback('Você já faz parte desta comunidade. Abra-a na lista lateral.');
      }else feedback('Não foi possível entrar: '+err.message,true);
    }
  });
  $('bc-platform-join-form').addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget,button=form.querySelector('[type="submit"]');
    if(button.disabled)return;
    button.disabled=true;
    serverModalStatus('Entrando no servidor…');
    try {
      const joined=await request('/join',{method:'POST',data:{code:String(new FormData(form).get('code')||'').trim()}});
      form.reset();
      selectedCommunity=null;
      await loadCommunities();
      await selectCommunity(joined.community.id);
      feedback('Você entrou no servidor.');
      serverModalDone();
    } catch(err) {feedback(err.message,true);serverModalStatus(err.message,true);}
    finally {button.disabled=false;}
  });
  $('bc-platform-channel-form').addEventListener('submit',async e=>{
    e.preventDefault();
    if (!selectedCommunity) return;
    try {
      await request('/communities/'+selectedCommunity.id+'/channels',{
        method:'POST',data:{name:new FormData(e.currentTarget).get('name')}
      });
      e.currentTarget.reset();
      await selectCommunity(selectedCommunity.id);
      feedback('Canal criado com sucesso.');
    } catch(err) {feedback(err.message,true);}
  });
  $('bc-platform-voice-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!selectedCommunity || !['owner','admin'].includes(selectedCommunity.role)) return;
    const form=event.currentTarget;
    try {
      await request('/communities/'+selectedCommunity.id+'/channels',{
        method:'POST',data:{name:new FormData(form).get('name'),kind:'voice'}
      });
      form.reset();
      await selectCommunity(selectedCommunity.id);
      feedback('Canal de voz criado.');
    }catch(err){feedback(err.message,true);}
  });

  $('bc-platform-invite').addEventListener('click',async ()=>{
    if(!selectedCommunity) return;
    try {
      const data=await request('/communities/'+selectedCommunity.id+'/invite');
      await navigator.clipboard.writeText('https://brasilcord-sinalizacao-dkx157.onrender.com/invite/'+data.code);
      feedback('Link de convite copiado para a área de transferência.');
    } catch(err) {feedback('Não foi possível copiar: '+err.message,true);}
  });

  async function loadFriends() {
    if (!token) return;
    const result = await request('/friends');
    const list = $('bc-platform-friends');
    list.replaceChildren();
    if (!result.friends.length) {
      list.append(make('p','Nenhum amigo ou solicitação pendente.','bc-empty'));
      return;
    }
    const accepted=result.friends.filter(f=>f.status==='accepted');
    const received=result.friends.filter(f=>f.status==='pending'&&f.direction==='received');
    const sent=result.friends.filter(f=>f.status==='pending'&&f.direction!=='received');
    function heading(title,items){
      if(items.length)list.append(make('h4',title+' ('+items.length+')','bc-friends-section-label'));
    }
    for (const [section,group] of [['Seus amigos',accepted],['Pedidos recebidos · você pode aceitar',received],['Pedidos enviados · aguardando resposta',sent]]) {
      heading(section,group);
      for (const friend of group) {
      const row = make('div','','bc-platform-friend');
      row.dataset.bcUserId=friend.id;
      row.dataset.bcUsername=friend.username;
      const label = friend.displayName + ' · @' + friend.username +
        (friend.status === 'accepted' ? ' · Amigo' : friend.direction === 'received' ? ' · Solicitou amizade' : ' · Aguardando');
      row.append(make('span',label));
      if(friend.status==='accepted'){
        const messageBtn=make('button','Mensagem');
        messageBtn.type='button';
        messageBtn.addEventListener('click',()=>{
          document.dispatchEvent(new CustomEvent('bc:dm-open',{detail:{id:friend.id,name:friend.displayName}}));
          document.querySelector('#page-app [data-bc-view="dms"]')?.click();
        });
        row.append(messageBtn);
      }
      if (friend.status === 'pending' && friend.direction === 'received') {
        const accept=make('button','Aceitar');
        accept.type='button';
        accept.addEventListener('click',async()=>{
          try {
            await request('/friends/'+friend.id+'/accept',{method:'POST'});
            await loadFriends();
            feedback('Pedido de amizade aceito.');
            document.dispatchEvent(new CustomEvent('bc:refresh-friends'));
          } catch(err){feedback(err.message,true);}
        });
        row.append(accept);
      }
      const remove=make('button',friend.status === 'accepted' ? 'Remover amigo' : friend.direction === 'received' ? 'Recusar pedido' : 'Cancelar pedido enviado');
      remove.type='button';
      remove.addEventListener('click',async()=>{
        try {
          await request('/friends/'+friend.id,{method:'DELETE'});
          await loadFriends();
          document.dispatchEvent(new CustomEvent('bc:refresh-friends'));
        }catch(err){feedback(err.message,true);}
      });
      row.append(remove);
      list.append(row);
      }
    }
  }

  $('bc-platform-friend-form').addEventListener('submit',async e=>{
    e.preventDefault();
    try {
      const username=new FormData(e.currentTarget).get('username');
      await request('/friends/request',{method:'POST',data:{username}});
      e.currentTarget.reset();
      feedback('Pedido enviado ou amizade aceita, se a pessoa já tinha solicitado você.');
      await loadFriends();
      document.dispatchEvent(new CustomEvent('bc:refresh-friends'));
    } catch(err){feedback(err.message,true);}
  });

  $('bc-platform-profile-form').addEventListener('submit',async e=>{
    e.preventDefault();
    try {
      const data=new FormData(e.currentTarget);
      const result=await request('/me',{
        method:'PATCH',
        data:{displayName:data.get('displayName'),bio:data.get('bio')}
      });
      user=result.user;
      $('bc-platform-user-label').textContent=user.displayName+' · @'+user.username;
      feedback('Perfil atualizado.');
      notifyState({type:'user',user});
    } catch(err){feedback(err.message,true);}
  });

  async function loadMembers() {
    if(!selectedCommunity||!token)return;
    const communityId=selectedCommunity.id;
    try {
      const result=await request('/communities/'+communityId+'/members');
      if(selectedCommunity?.id!==communityId)return;
      const members=result.members||[];
      notifyState({
        type:'members',members:members.map(m=>({
          id:m.id,username:m.username,displayName:m.display_name||m.username,
          avatarUpdatedAt:m.avatar_updated_at,role:m.role,customRoleId:m.custom_role_id,
          displayRoleKey:m.display_role_key,online:m.online===true
        })),
        roles:result.roles||[],roleOrder:result.roleOrder||[],
        onlineScope:result.onlineScope,canReorder:result.canReorder
      });
    }catch(err){feedback(err.message,true);}
  }

  let platformLiveAuthenticated=false;
  function connectLive() {
    if (!token || destroyed || socket) return;
    try {
      platformLiveAuthenticated=false;
      const connection = new WebSocket('wss://brasilcord-sinalizacao-dkx157.onrender.com/platform/ws');
      socket = connection;
      connection.addEventListener('open',()=>{
        if(socket===connection) connection.send(JSON.stringify({type:'authenticate',token}));
      });
      connection.addEventListener('message',evt=>{
        if(socket!==connection) return;
        let data;
        try{data=JSON.parse(evt.data);}catch{return;}
        if(data.type==='authenticated')platformLiveAuthenticated=true;
        if(data.type==='message' && data.channelId===selectedChannel?.id) {
          void loadMessages().catch(err=>feedback(err.message,true));
        }
        if(data.type==='community-moderation'){
          if(selectedCommunity?.id===data.communityId){
            feedback('Ação da moderação: '+(data.reason||data.action),data.action==='kick'||data.action==='ban');
            if(['kick','ban'].includes(data.action))void loadCommunities().catch(err=>feedback(err.message,true));
            if(data.action==='timeout')document.dispatchEvent(new CustomEvent('bc:refresh-current-community',{detail:{id:data.communityId}}));
          }
        }
        if(data.type==='dm-call-delivery-status')
          document.dispatchEvent(new CustomEvent('bc:dm-call-delivery',{detail:{
            ok:data.delivered===true,
            to:data.to,
            message:data.delivered===true?'Chamada entregue ao contato.':'O contato está offline. A conversa permanece disponível, mas a chamada não tocou.'
          }}));
        if(['dm-call-invite','dm-call-reject','dm-call-accept'].includes(data.type))
          document.dispatchEvent(new CustomEvent('bc:dm-call-signal',{detail:data}));
      });
      connection.addEventListener('close',()=>{
        if(socket!==connection) return;
        socket=null;platformLiveAuthenticated=false;
        if(!destroyed && token) reconnectTimer=setTimeout(connectLive,5000);
      });
    }catch(err) {feedback('Tempo real indisponível: '+err.message,true);}
  }
  document.addEventListener('bc:dm-call-send',event=>{
    const detail=event.detail||{};
    if(!['dm-call-invite','dm-call-reject','dm-call-accept'].includes(detail.type)||!detail.to)return;
    if(!socket||socket.readyState!==WebSocket.OPEN||!platformLiveAuthenticated){
      document.dispatchEvent(new CustomEvent('bc:dm-call-delivery',{detail:{ok:false,message:'Sinalização da chamada desconectada. Tente novamente.'}}));
      return;
    }
    socket.send(JSON.stringify({type:detail.type,to:detail.to}));
    document.dispatchEvent(new CustomEvent('bc:dm-call-delivery',{detail:{ok:true}}));
  });
  async function refresh() {
    if(!token || destroyed) return;
    try {await loadMessages();}
    catch(err) {if(token) feedback(err.message,true);}
  }
  refreshTimer=setInterval(refresh,12000);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && token && !socket) connectLive();
  });
  window.addEventListener('pagehide',()=>{destroyed=true;cleanupConnections();clearInterval(refreshTimer);clearInterval(serviceMonitor);messageMenu.remove();emojiPicker.remove();},{once:true});
  loginScreen();
  void checkService();
  void restoreLogin();
})();