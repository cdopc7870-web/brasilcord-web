'use strict';
// Caixa de solicitações de mensagens e chamadas de pessoas não adicionadas.
(()=>{
  const $=id=>document.getElementById(id);
  const inbox=$('bc-dm-request-inbox'),list=$('bc-dm-request-list'),toggle=$('bc-dm-request-toggle');
  const profile=$('bc-user-profile-dialog');
  if(!inbox||!list||!profile)return;
  const BASE='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  let token=null,incoming=[],lastIds=new Set(),seenInitial=false,loading=false,currentProfile=null;
  const status=$('bc-dm-request-status'),counter=$('bc-dm-request-count');
  const floating=$('bc-dm-request-float'),floatingCount=$('bc-dm-request-float-count');
  const requestHub=document.querySelector('.bc-dm-request-hub');
  function closePanel(){requestHub.hidden=true;inbox.hidden=true;toggle.setAttribute('aria-expanded','false');floating.setAttribute('aria-expanded','false');}
  floating.addEventListener('click',()=>{
    if(!requestHub.hidden){closePanel();return;}
    requestHub.hidden=false;inbox.hidden=false;toggle.setAttribute('aria-expanded','true');floating.setAttribute('aria-expanded','true');
    void refresh();
  });
  document.addEventListener('pointerdown',event=>{
    if(!requestHub.hidden&&!requestHub.contains(event.target)&&!floating.contains(event.target))closePanel();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closePanel();});

  const photoUrls=new Set();
  const photoSelect=document.createElement('input');
  photoSelect.type='file';photoSelect.accept='image/png,image/jpeg,image/gif,image/webp';photoSelect.hidden=true;
  document.body.append(photoSelect);
  const composeDialog=document.createElement('dialog');
  composeDialog.className='bc-first-message-dialog';
  composeDialog.innerHTML='<form method="dialog"><header><h3>✉ Mensagem privada</h3><button type="button" class="bc-compose-close" aria-label="Fechar">✕</button></header><p class="bc-compose-target"></p><label>Escreva sua mensagem<textarea class="bc-compose-text" maxlength="500" rows="5" required placeholder="Escreva sua primeira mensagem…"></textarea></label><p class="bc-compose-info">Se a pessoa ainda não autorizou a conversa, esta mensagem ficará na caixa de pedidos até que aceite.</p><p class="bc-compose-error" role="status"></p><div class="bc-compose-actions"><button type="button" class="bc-compose-cancel">Cancelar</button><button type="submit" class="bc-compose-send">✉ Enviar mensagem</button></div></form>';
  document.body.append(composeDialog);
  composeDialog.querySelector('.bc-compose-close').addEventListener('click',()=>composeDialog.close());
  composeDialog.querySelector('.bc-compose-cancel').addEventListener('click',()=>composeDialog.close());
  let composeFor=null;
  function openMessageComposer(person){
    composeFor=person;
    composeDialog.querySelector('.bc-compose-target').textContent='Para: '+(person.displayName||person.username);
    composeDialog.querySelector('.bc-compose-text').value='';
    composeDialog.querySelector('.bc-compose-error').textContent='';
    if(!composeDialog.open)composeDialog.showModal();
    composeDialog.querySelector('.bc-compose-text').focus();
  }
  composeDialog.querySelector('form').addEventListener('submit',event=>{
    event.preventDefault();void (async()=>{
      const person=composeFor,message=composeDialog.querySelector('.bc-compose-text').value.trim();
      if(!person||!message||message.length>500)return;
      const submit=composeDialog.querySelector('.bc-compose-send');submit.disabled=true;
      try{
        const result=await api('/dm-requests','POST',{recipientId:person.id,kind:'message',message});
        if(result.alreadyAccepted)await api('/dms/'+person.id,'POST',{content:message});
        composeDialog.close();
        $('bc-user-dialog-status').textContent=result.alreadyAccepted?'Mensagem enviada para a conversa.':'Mensagem entregue à caixa de pedidos. Aguarde a pessoa aceitar.';
        if(result.alreadyAccepted)openDM(person);
      }catch(err){composeDialog.querySelector('.bc-compose-error').textContent=err.message;}
      finally{submit.disabled=false;}
    })();
  });
  async function encodeImage(file){
    if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type))throw Error('Use fotos JPG, PNG, GIF ou WebP.');
    if(file.size<50||file.size>1_000_000)throw Error('A imagem deve ter até 1 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return {image:btoa(binary),mime:file.type};
  }
  let photoFor=null;
  photoSelect.addEventListener('change',()=>{
    const file=photoSelect.files?.[0];photoSelect.value='';
    if(!file||!photoFor)return;
    const person=photoFor;photoFor=null;
    void (async()=>{
      try{
        const image=await encodeImage(file);
        const result=await api('/dm-requests','POST',{recipientId:person.id,kind:'photo',...image});
        if(result.alreadyAccepted){
          // O contato já permitiu conversa: envio direto pela rota de fotos existente.
          await api('/dms/'+person.id+'/photos','POST',image);
          openDM(person);
          $('bc-user-dialog-status').textContent='Foto enviada no chat privado.';
        }else $('bc-user-dialog-status').textContent='Foto enviada à caixa de pedidos. Será entregue ao aceitar.';
      }catch(err){$('bc-user-dialog-status').textContent=err.message;}
    })();
  });
  function openDM(person){
    profile.close();
    nav?.click();
    document.dispatchEvent(new CustomEvent('bc:dm-open',{detail:{id:person.id,name:person.displayName||person.username,username:person.username}}));
  }
    const nav=document.querySelector('#page-app [data-bc-view="dms"]');
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined&&text!==null)el.textContent=String(text);if(cls)el.className=cls;return el;};
  async function api(path,method='GET',body){
    if(!token)throw Error('Entre na sua conta BrasilCord.');
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{
      const response=await fetch(BASE+path,{method,signal:ctl.signal,cache:'no-store',headers:{Accept:'application/json',Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'Não foi possível concluir a operação.');
      return data;
    }finally{clearTimeout(timer);}
  }
  function openInbox(){nav?.click();requestHub.hidden=false;inbox.hidden=false;toggle.setAttribute('aria-expanded','true');floating.setAttribute('aria-expanded','true');list.querySelector('button')?.focus({preventScroll:true});}
  toggle.addEventListener('click',()=>{
    inbox.hidden=!inbox.hidden;toggle.setAttribute('aria-expanded',String(!inbox.hidden));
    if(!inbox.hidden)void refresh();
  });
  const toast=node('button','', 'bc-dm-request-toast');toast.type='button';toast.hidden=true;
  toast.setAttribute('aria-label','Abrir solicitação de conversa');document.body.append(toast);
  let toastTimer;
  toast.addEventListener('click',()=>{toast.hidden=true;openInbox();});
  function announce(item){
    toast.textContent=(item.kind==='call'?'☎ Ligação de ':item.kind==='photo'?'🖼️ Foto de ':'✉ Mensagem de ')+(item.displayName||item.username)+'. Toque para aceitar ou recusar.';
    toast.hidden=false;clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.hidden=true,9500);
  }
  function render(){
    for(const url of photoUrls)URL.revokeObjectURL(url);
    photoUrls.clear();
    list.replaceChildren();
    counter.textContent=String(incoming.length);counter.hidden=!incoming.length;
    floatingCount.textContent=String(incoming.length);floatingCount.hidden=!incoming.length;
    floating.classList.toggle('bc-has-requests',Boolean(incoming.length));
    toggle.classList.toggle('bc-has-requests',Boolean(incoming.length));
    if(!incoming.length){
      list.append(node('p','Nenhuma solicitação pendente.','bc-dm-request-empty'));
      return;
    }
    for(const item of incoming){
      const card=node('article',null,'bc-dm-request-card');
      const heading=node('div',null,'bc-dm-request-sender');
      const avatar=node('span',(item.displayName||item.username||'BC').slice(0,2).toUpperCase(),'bc-dm-request-avatar');
      if(item.avatarUpdatedAt){
        const img=node('img');img.alt='';
        img.src=BASE+'/media/'+item.peerId+'/avatar?v='+new Date(item.avatarUpdatedAt).getTime();
        avatar.replaceChildren(img);
      }
      const info=node('div');info.append(node('strong',item.displayName||item.username),node('small','@'+item.username));
      heading.append(avatar,info);
      const summary=node('button',item.kind==='call'?'☎ Está ligando para você':item.kind==='photo'?'🖼️ Enviou uma foto':'✉ Enviou uma mensagem','bc-dm-request-summary');
      summary.type='button';
      const details=node('div',null,'bc-dm-request-details');details.hidden=false;
      const preview=node('p',item.kind==='call'?'Aceite para iniciar uma chamada de verdade. O contato receberá a ligação para atender.':item.kind==='photo'?'Foto privada recebida. Aceite para incluir a foto na conversa, ou recuse para descartá-la.':item.intro||'Nova mensagem recebida.');
      if(item.kind==='photo'&&item.hasPhoto){
        const image=node('img');image.className='bc-request-photo-preview';image.alt='Prévia da foto recebida';image.loading='lazy';
        preview.append(image);
        void (async()=>{
          try{
            const response=await fetch(BASE+'/dm-requests/'+encodeURIComponent(item.id)+'/photo',{
              headers:{Authorization:'Bearer '+token},cache:'no-store'});
            if(!response.ok)throw Error('Foto indisponível');
            const mime=(response.headers.get('Content-Type')||'').split(';')[0];
            if(!['image/png','image/jpeg','image/gif','image/webp'].includes(mime))throw Error('Formato inválido');
            const blob=await response.blob();
            if(blob.size>1_000_000)throw Error('Arquivo muito grande');
            if(!image.isConnected)return;
            const url=URL.createObjectURL(blob);photoUrls.add(url);image.src=url;
          }catch{if(image.isConnected)image.replaceWith(node('span','Prévia indisponível.','bc-dm-request-empty'));}
        })();
      }
      const actions=node('div',null,'bc-dm-request-actions');
      const accept=node('button',item.kind==='call'?'☎ Aceitar e ligar':'✓ Aceitar conversa','bc-dm-request-accept');
      const close=node('button','✕ Recusar','bc-dm-request-dismiss');
      for(const b of [accept,close])b.type='button';
      summary.addEventListener('click',()=>{details.hidden=!details.hidden;});
      async function decide(action){
        accept.disabled=true;close.disabled=true;
        try{
          const result=await api('/dm-requests/'+encodeURIComponent(item.id)+'/'+action,'POST');
          status.textContent=action==='accept'?(item.kind==='call'?'Ligação aceita. Chamando o contato…':'Conversa aceita e conteúdo entregue ao chat.'):'Solicitação recusada.';
          await refresh();
          document.dispatchEvent(new CustomEvent('bc:dm-requests-updated'));
          if(action==='accept'){
            const person={id:result.peerId||item.peerId,displayName:item.displayName,username:item.username};
            openDM(person);
            if(item.kind==='call')document.dispatchEvent(new CustomEvent('bc:dm-start-call',{detail:{id:person.id,name:person.displayName||person.username}}));
          }
        }catch(err){status.textContent=err.message;accept.disabled=false;close.disabled=false;}
      }
      accept.addEventListener('click',()=>void decide('accept'));
      close.addEventListener('click',()=>void decide('close'));
      actions.append(accept,close);details.append(preview,actions);
      card.append(heading,summary,details);list.append(card);
    }
  }
  async function refresh(){
    if(!token||loading)return;
    loading=true;
    try{
      const data=await api('/dm-requests');
      incoming=data.incoming||[];
      const ids=new Set(incoming.map(x=>x.id));
      if(seenInitial){const fresh=incoming.find(x=>!lastIds.has(x.id));if(fresh)announce(fresh);}
      lastIds=ids;seenInitial=true;render();
    }catch(err){status.textContent=err.message;}
    finally{loading=false;}
  }
  async function send(kind,person){
    const p=person||currentProfile;
    if(!token||!p||p.isSelf)return;
    if(p.blockedByMe){$('bc-user-dialog-status').textContent='Este contato está bloqueado.';return;}
    if(kind==='message'){openMessageComposer(p);return;}
    if(kind==='photo'){photoFor=p;photoSelect.click();return;}
    if(kind!=='call')return;
    try{
      const result=await api('/dm-requests','POST',{recipientId:p.id,kind:'call',message:''});
      if(result.alreadyAccepted){
        openDM(p);
        document.dispatchEvent(new CustomEvent('bc:dm-start-call',{detail:{id:p.id,name:p.displayName||p.username}}));
      }else $('bc-user-dialog-status').textContent='☎ Ligação enviada à caixa de pedidos. A pessoa poderá aceitar ou recusar.';
    }catch(err){$('bc-user-dialog-status').textContent=err.message;}
  }
  $('bc-dm-stranger-form')?.addEventListener('submit',async event=>{
    event.preventDefault();
    const kind=event.submitter?.dataset.requestKind==='call'?'call':'message';
    const form=event.currentTarget,username=form.elements.username.value.trim().replace(/^@/,'');
    const message=form.elements.message.value.trim();
    if(!/^[A-Za-z0-9_]{3,28}$/.test(username)){status.textContent='Informe um nome de usuário válido.';return;}
    if(kind==='message'&&(!message||message.length>500)){status.textContent='Escreva uma mensagem de 1 a 500 caracteres.';return;}
    const buttons=[...form.querySelectorAll('button')];buttons.forEach(x=>x.disabled=true);
    status.textContent='Enviando solicitação…';
    try{
      const response=await api('/dm-requests','POST',{username,kind,message:kind==='message'?message:''});
      status.textContent=response.alreadyAccepted?'A conversa já está autorizada. Abra o contato para conversar.':'Solicitação enviada. Aguarde a outra pessoa aceitar.';
      if(!response.alreadyAccepted)form.reset();
      await refresh();
    }catch(err){status.textContent=err.message;}
    finally{buttons.forEach(x=>x.disabled=false);}
  });
  document.addEventListener('bc:dm-profile-action',event=>{
    const {id,kind}=event.detail||{};
    if(!token||!/^[-a-f0-9]{36}$/i.test(id||'')||!['message','call','photo'].includes(kind))return;
    void (async()=>{
      try{
        const info=await api('/users/'+encodeURIComponent(id));
        await send(kind,info.profile);
      }catch(err){status.textContent=err.message;}
    })();
  });
  $('bc-user-message-action')?.addEventListener('click',()=>void send('message'));
  $('bc-user-call-request')?.addEventListener('click',()=>void send('call'));
  $('bc-user-photo-action')?.addEventListener('click',()=>void send('photo'));
  document.addEventListener('bc:public-profile-ready',event=>{
    currentProfile=event.detail?.profile||null;
    $('bc-user-message-action').hidden=!currentProfile||currentProfile.isSelf||currentProfile.blockedByMe;
    $('bc-user-call-request').hidden=!currentProfile||currentProfile.isSelf||currentProfile.blockedByMe;
    $('bc-user-message-action').textContent='✉ Mensagem';
    $('bc-user-call-request').textContent='☎ Ligar';
    $('bc-user-photo-action').hidden=!currentProfile||currentProfile.isSelf||currentProfile.blockedByMe;
  });
  document.addEventListener('bc:platform-state',event=>{
    const e=event.detail||{};
    if(e.type==='voice-session'){
      if(token!==e.token){token=e.token||null;incoming=[];seenInitial=false;lastIds.clear();render();}
      if(token)void refresh();
    }
    if(e.type==='logout'){
      token=null;incoming=[];currentProfile=null;lastIds.clear();seenInitial=false;render();toast.hidden=true;
    }
  });
  document.querySelectorAll('#page-app [data-bc-view="dms"]').forEach(x=>x.addEventListener('click',()=>void refresh()));
  const poll=setInterval(()=>{if(token&&!document.hidden)void refresh();},10000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  window.addEventListener('pagehide',()=>{clearInterval(poll);clearTimeout(toastTimer);toast.remove();photoSelect.remove();composeDialog.remove();for(const url of photoUrls)URL.revokeObjectURL(url);},{once:true});
  render();
})();
