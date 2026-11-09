'use strict';
/* Administração visual BrasilCord: canais, calls, convites e moderação do proprietário. */
(()=>{
  const $=id=>document.getElementById(id);
  if(!$('bc-advanced-invite-link'))return;
  const BASE='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  let token=null,user=null,community=null,roles=[],categories=[],channels=[],members=[],listening=false;
  let catOrder=[],channelOrder=[];
  const el=(tag,label,cls)=>{const x=document.createElement(tag);if(label!=null)x.textContent=label;if(cls)x.className=cls;return x;};
  const status=(id,msg)=>{$(id).textContent=msg||'';};
  async function request(path,method='GET',data){
    if(!token)throw Error('Entre na conta BrasilCord.');
    const c=new AbortController(),timeout=setTimeout(()=>c.abort(),15000);
    try{
      const res=await fetch(BASE+path,{method,cache:'no-store',signal:c.signal,
        headers:{Accept:'application/json',Authorization:'Bearer '+token,...(data===undefined?{}:{'Content-Type':'application/json'})},
        ...(data===undefined?{}:{body:JSON.stringify(data)})});
      const json=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(json.error||'Falha na operação ('+res.status+').');
      return json;
    }finally{clearTimeout(timeout);}
  }
  function canChannels(){return Boolean(community&&(community.role==='owner'||community.permissions?.manage_channels));}
  function canInvite(){return Boolean(community&&(community.role==='owner'||community.permissions?.create_invites));}
  function opt(select,id,label){
    const o=el('option',label);o.value=id;select.append(o);
  }
  function configureCall(){
    const selected=channels.find(x=>x.id===$('bc-config-channel').value);
    const isVoice=selected?.kind==='voice',mode=isVoice?(selected.access_mode||'everyone'):'everyone';
    const wrap=document.querySelector('.bc-call-access-options');
    wrap.hidden=!isVoice;
    $('bc-call-access-mode').value=mode;
    $('bc-call-role-wrap').hidden=!isVoice||mode!=='role';
    $('bc-call-users-wrap').hidden=!isVoice||mode!=='users';
    const select=$('bc-call-access-role');select.replaceChildren();opt(select,'','Escolha um cargo');
    for(const role of roles)opt(select,role.id,role.name);
    select.value=selected?.min_role_id||'';
    const list=$('bc-call-users-checks');list.replaceChildren();
    const granted=new Set(selected?.access_user_ids||[]);
    for(const person of members.filter(m=>m.role!=='owner')){
      const label=el('label',null,'bc-member-permission');
      const input=document.createElement('input');input.type='checkbox';input.value=person.id;input.checked=granted.has(person.id);
      label.append(input,el('span',person.display_name||person.displayName||person.username));list.append(label);
    }
    if(!members.length)list.append(el('p','Não há membros para selecionar.'));
  }
  $('bc-config-channel').addEventListener('change',configureCall);
  $('bc-call-access-mode').addEventListener('change',configureCallMode);
  function configureCallMode(){
    const mode=$('bc-call-access-mode').value;
    $('bc-call-role-wrap').hidden=mode!=='role';
    $('bc-call-users-wrap').hidden=mode!=='users';
  }
  $('bc-channel-config').addEventListener('submit',event=>{
    // O módulo original já processa o formulário; interceptamos antes, sem registrar dupla atualização.
    if(!canChannels())return;
    const selected=channels.find(x=>x.id===$('bc-config-channel').value);
    if(!selected||selected.kind!=='voice')return;
    event.preventDefault();event.stopImmediatePropagation();
    const mode=$('bc-call-access-mode').value;
    const minRoleId=mode==='role' ? $('bc-call-access-role').value||null : null;
    if(mode==='role'&&!minRoleId){status('bc-advanced-order-status','Escolha um cargo antes de salvar a call.');return;}
    const data={categoryId:$('bc-config-category').value||null,minRoleId,accessMode:mode,
      allowedUserIds:mode==='users'?[...$('bc-call-users-checks').querySelectorAll('input:checked')].map(x=>x.value):[]};
    void request('/communities/'+community.id+'/channels/'+selected.id+'/settings','PATCH',data)
      .then(async()=>{status('bc-advanced-order-status','Permissões da call salvas com sucesso.');await reload();document.dispatchEvent(new CustomEvent('bc:refresh-current-community',{detail:{id:community.id}}));})
      .catch(err=>status('bc-advanced-order-status',err.message));
  },true);
  function orderedRows(containerId,ids,lookup){
    const box=$(containerId);box.replaceChildren();
    if(!ids.length){box.append(el('p','Nenhum item criado.','bc-empty'));return;}
    for(const [i,id] of ids.entries()){
      const info=lookup.find(c=>c.id===id);if(!info)continue;
      const row=el('div',null,'bc-order-item');row.append(el('span',info.kind?(info.kind==='voice'?'◉ ':'# ')+info.name:info.name));
      for(const [direction,label] of [[-1,'↑'],[1,'↓']]){
        const button=el('button',label);button.type='button';button.disabled=i+direction<0||i+direction>=ids.length;
        button.title=direction===-1?'Mover para cima':'Mover para baixo';
        button.addEventListener('click',()=>{
          const next=i+direction;[ids[i],ids[next]]=[ids[next],ids[i]];
          renderOrdering();
        });row.append(button);
      }
      box.append(row);
    }
  }
  function renderOrdering(){
    orderedRows('bc-advanced-category-order',catOrder,categories);
    orderedRows('bc-advanced-channel-order',channelOrder,channels);
  }
  $('bc-save-advanced-order').addEventListener('click',async()=>{
    if(!canChannels())return;
    const button=$('bc-save-advanced-order');button.disabled=true;
    try{
      await request('/communities/'+community.id+'/categories/order','PATCH',{order:catOrder});
      await request('/communities/'+community.id+'/channels/order','PATCH',{order:channelOrder});
      status('bc-advanced-order-status','Organização salva para todos os membros.');
      document.dispatchEvent(new CustomEvent('bc:refresh-current-community',{detail:{id:community.id}}));
    }catch(err){status('bc-advanced-order-status',err.message);}
    finally{button.disabled=false;}
  });
  async function reload(){
    if(!token||!community)return;
    const id=community.id;
    try{
      const [cr,rr,mr,detail]=await Promise.all([
        request('/communities/'+id+'/categories'),request('/communities/'+id+'/roles'),
        request('/communities/'+id+'/members'),request('/communities/'+id)
      ]);
      if(!community||community.id!==id)return;
      categories=cr.categories||[];roles=rr.roles||[];members=mr.members||[];
      channels=detail.channels||[];
      catOrder=categories.map(x=>x.id);channelOrder=channels.map(x=>x.id);
      renderOrdering();configureCall();
    }catch(err){status('bc-advanced-order-status',err.message);}
  }
  function inviteUrl(code){return 'https://brasilcord-sinalizacao-dkx157.onrender.com/invite/'+code;}
  async function loadInvites(){
    if(!canInvite())return;
    const id=community.id;
    try{
      const data=await request('/communities/'+id+'/invite');
      if(!community||community.id!==id)return;
      $('bc-advanced-invite-link').value=inviteUrl(data.code);
      $('bc-advanced-invite-community').textContent='🇧🇷 '+(data.communityName||community.name);
      const list=$('bc-advanced-invite-friends');list.replaceChildren();
      const friendships=await request('/friends');
      const friends=(friendships.friends||[]).filter(x=>x.status==='accepted');
      if(!friends.length)list.append(el('p','Adicione amigos para enviar convites diretamente.','bc-empty'));
      for(const friend of friends){
        const b=el('button','✉ '+(friend.displayName||friend.username)+' · @'+friend.username);b.type='button';
        b.addEventListener('click',async()=>{
          b.disabled=true;
          try{
            await request('/dms/'+friend.id,'POST',{content:'🇧🇷 Convite para '+(data.communityName||community.name)+': '+inviteUrl(data.code)});
            status('bc-advanced-invite-status','Convite enviado para @'+friend.username+'.');
          }catch(err){status('bc-advanced-invite-status',err.message);}
          finally{b.disabled=false;}
        });list.append(b);
      }
    }catch(err){status('bc-advanced-invite-status',err.message);}
  }
  $('bc-advanced-invite-copy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('bc-advanced-invite-link').value);status('bc-advanced-invite-status','Link copiado.');}
    catch{const input=$('bc-advanced-invite-link');input.select();status('bc-advanced-invite-status','Selecione e copie o link com Ctrl+C.');}
  });
  function openInvite(){
    if(!canInvite())return;
    $('bc-server-settings-button').click();
    document.querySelector('[data-bc-settings-tab="invites"]')?.click();
    void loadInvites();
  }
  $('bc-quick-invite-button').addEventListener('click',openInvite);
  document.querySelector('[data-bc-settings-tab="invites"]')?.addEventListener('click',()=>void loadInvites());
  document.querySelector('[data-bc-settings-tab="ordering"]')?.addEventListener('click',()=>void reload());
  async function loadReports(){
    if(!user?.isAppOwner||user.username!=='dkx157')return;
    const list=$('bc-owner-reports-list');list.replaceChildren(el('p','Carregando denúncias…'));
    try{
      const data=await request('/owner/reports');
      list.replaceChildren();
      if(!data.reports?.length){list.append(el('p','Nenhuma denúncia registrada.','bc-empty'));return;}
      for(const r of data.reports){
        const card=el('article',null,'bc-owner-report');
        const kind={message:'Mensagem',profile:'Perfil',photo:'Foto',audio:'Áudio',community:'Comunidade'}[r.kind]||r.kind;
        card.append(el('strong',kind+' · '+new Date(r.created_at).toLocaleString('pt-BR')));
        card.append(el('p','Denunciante: @'+r.reporter+' | Denunciado: '+(r.target?'@'+r.target:'Comunidade')+' | Comunidade: '+(r.community||'—')));
        card.append(el('p','Motivo: '+r.reason));
        card.append(el('pre',r.details||'Sem trecho armazenado.'));
        if(r.kind==='photo'&&r.targetUserId){
          const image=document.createElement('img');
          image.className='bc-reported-photo';
          image.alt='Foto de perfil denunciada';
          image.src=BASE+'/media/'+encodeURIComponent(r.targetUserId)+'/avatar';
          image.loading='lazy';
          image.onerror=()=>image.remove();
          card.append(image);
        }
        if(r.kind==='audio'&&r.referenceId){
          const play=el('button','▶ Ouvir áudio denunciado','bc-reported-audio-button');
          play.type='button';card.append(play);
          play.addEventListener('click',async()=>{
            play.disabled=true;
            try{
              const resp=await fetch(BASE+'/owner/reports/'+encodeURIComponent(r.id)+'/audio',{
                headers:{Authorization:'Bearer '+token,Accept:'audio/*'},cache:'no-store'});
              if(!resp.ok)throw Error((await resp.json().catch(()=>({}))).error||'Áudio não disponível.');
              const blob=await resp.blob(),url=URL.createObjectURL(blob);
              const audio=document.createElement('audio');audio.controls=true;audio.src=url;
              audio.addEventListener('emptied',()=>URL.revokeObjectURL(url),{once:true});
              card.append(audio);play.remove();
            }catch(e){play.disabled=false;status('bc-owner-reports-feedback',e.message);}
          });
        }
        list.append(card);
      }
    }catch(err){list.replaceChildren();status('bc-owner-reports-feedback',err.message);}
  }
  $('bc-owner-reports-channel').addEventListener('click',()=>{
    if(!user?.isAppOwner||user.username!=='dkx157')return;
    const modal=$('bc-advanced-owner-reports');if(!modal.open)modal.showModal();void loadReports();
  });
  $('bc-owner-reports-close').addEventListener('click',()=>$('bc-advanced-owner-reports').close());
  async function report(kind,payload){
    if(!token)return;
    const reason=prompt('Motivo da denúncia (5 a 500 caracteres):');
    if(reason===null)return;
    if(reason.trim().length<5||reason.trim().length>500){alert('Descreva o motivo em 5 a 500 caracteres.');return;}
    try{
      await request('/reports','POST',{kind,reason:reason.trim(),...payload});
      alert('Denúncia encaminhada à moderação do BrasilCord.');
    }catch(err){alert(err.message);}
  }
  const profile=$('bc-user-profile-dialog'),pActions=profile?.querySelector('.bc-user-profile-actions');
  if(pActions){
    for(const [kind,label] of [['profile','⚑ Denunciar perfil'],['photo','⚑ Denunciar foto do perfil']]){
      const b=el('button',label,'bc-report-profile-button');b.type='button';
      b.addEventListener('click',()=>{
        const id=profile.dataset.bcPeerId;
        if(id&&id!==user?.id)void report(kind,{targetUserId:id});
      });
      pActions.append(b);
    }
  }
  const communityReport=el('button','⚑ Denunciar esta comunidade','bc-report-community');communityReport.type='button';
  communityReport.addEventListener('click',()=>{
    if(community)void report('community',{communityId:community.id});
  });
  $('bc-settings-overview')?.append(communityReport);
  $('bc-report-current-community')?.addEventListener('click',()=>{
    if(!community){alert('Selecione uma comunidade primeiro.');return;}
    void report('community',{communityId:community.id});
  });
  const msgPane=$('bc-dm-messages');
  msgPane?.addEventListener('contextmenu',event=>{
    const article=event.target.closest('.bc-dm-message');if(!article)return;
    const id=article.dataset.bcMessageId,author=article.dataset.bcUserId;
    if(!id||!author||author===user?.id||!article.querySelector('audio'))return;
    event.preventDefault();
    if(confirm('Denunciar este áudio à moderação do BrasilCord?'))void report('audio',{referenceId:id,targetUserId:author});
  });
  document.addEventListener('bc:platform-state',event=>{
    const data=event.detail||{};
    if(data.type==='voice-session'){token=data.token||null;if(token)void reload();}
    if(data.type==='user'){user=data.user||null;}
    if(data.type==='community'){
      community=data.community||null;
      $('bc-quick-invite-button').hidden=!canInvite();
      $('bc-owner-reports-channel').hidden=!Boolean(user?.isAppOwner&&user.username==='dkx157'&&community?.is_official);
      if(community)void reload();
    }
    if(data.type==='channels-list'){channels=data.channels||[];channelOrder=channels.map(x=>x.id);renderOrdering();}
    if(data.type==='logout'){token=null;user=null;community=null;$('bc-quick-invite-button').hidden=true;$('bc-owner-reports-channel').hidden=true;$('bc-advanced-owner-reports').close();}
  });
  document.addEventListener('bc:management-data',event=>{
    const d=event.detail;if(!community||community.id!==d?.communityId)return;
    roles=d.roles||roles;categories=d.categories||categories;members=d.members||members;
    renderOrdering();configureCall();
  });
})();
