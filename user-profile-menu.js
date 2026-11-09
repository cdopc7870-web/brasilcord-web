'use strict';

// Menu de contexto de perfis. Todas as ações são validadas no servidor BrasilCord.
(() => {
  const $=id=>document.getElementById(id);
  const menu=$('bc-user-context-menu');
  const dialog=$('bc-user-profile-dialog');
  if(!menu||!dialog)return;
  const API='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  let token=null,selfId=null,selected=null,profile=null,serial=0,community=null,members=[],roles=[];
  const friendAction=$('bc-user-friend-action'),blockAction=$('bc-user-block-action'),status=$('bc-user-dialog-status');
  async function request(path,method='GET',body){
    if(!token)throw new Error('Entre na sua conta do BrasilCord.');
    const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
    try{
      const res=await fetch(API+path,{
        method,cache:'no-store',signal:ctrl.signal,
        headers:{Accept:'application/json',Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||'Ação indisponível ('+res.status+').');
      return data;
    }finally{clearTimeout(timeout);}
  }
  function hideMenu(){menu.hidden=true;menu.replaceChildren();}
  function imageInto(container,url,alt){
    container.replaceChildren();
    if(url){
      const image=document.createElement('img');
      image.src=url;image.alt=alt||'';
      container.append(image);
    }
  }
  function updateActions(){
    const p=profile;
    friendAction.hidden=Boolean(!p||p.isSelf||p.blockedByMe);
    blockAction.hidden=Boolean(!p||p.isSelf);
    if(!p)return;
    const friendship=p.friendshipStatus;
    friendAction.disabled=Boolean(friendship);
    friendAction.textContent=friendship==='accepted'?'Já são amigos':
      friendship==='pending'?(p.friendshipDirection==='sent'?'Pedido enviado':'Pedido recebido · veja Amigos'):'Enviar pedido de amizade';
    blockAction.textContent=p.blockedByMe?'Desbloquear usuário':'Bloquear usuário';
  }
  async function loadProfile(id){
    const requestSerial=++serial;
    status.textContent='Carregando perfil…';
    const result=await request('/users/'+encodeURIComponent(id));
    if(requestSerial!==serial)return;
    profile=result.profile;
    dialog.dataset.bcPeerId=id;
    document.dispatchEvent(new CustomEvent('bc:public-profile-ready',{detail:{profile}}));
    const p=profile;
    $('bc-user-public-name').textContent=p.displayName;
    $('bc-user-public-handle').textContent='@'+p.username;
    $('bc-user-public-bio').textContent=p.bio||'Sem biografia.';
    imageInto($('bc-user-public-banner'),p.bannerUrl,'Banner de '+p.displayName);
    imageInto($('bc-user-public-avatar'),p.avatarUrl,'Foto de '+p.displayName);
    $('bc-user-public-avatar').classList.toggle('bc-user-avatar-placeholder',!p.avatarUrl);
    if(!p.avatarUrl)$('bc-user-public-avatar').textContent=p.displayName.slice(0,2).toUpperCase();
    const badge=$('bc-user-public-badge');badge.replaceChildren();
    if(p.selectedBadge&&/^(criador_app|tester|bug_hunter|beta)$/.test(p.selectedBadge)){
      const img=document.createElement('img');
      img.src='assets/badges/'+p.selectedBadge+'.svg';img.alt='Insígnia '+p.selectedBadge;
      badge.append(img);
    }
    try{
      const awarded=await request('/users/'+encodeURIComponent(id)+'/badges');
      if(requestSerial!==serial||selected!==id)return;
      badge.replaceChildren();
      for(const item of awarded.badges||[]){
        if(!/^[a-z0-9_-]+\.svg$/.test(item.asset))continue;
        const image=document.createElement('img');
        image.src='assets/badges/'+item.asset;image.alt=item.name;image.title=item.name+' · '+item.description;
        badge.append(image);
      }
    }catch{/* O perfil continua visível mesmo sem o catálogo de insígnias. */}
    renderProfileRoles(id);
    status.textContent='';
    updateActions();
    let presenceLine=$('bc-user-public-presence');
    if(!presenceLine){
      presenceLine=document.createElement('p');
      presenceLine.id='bc-user-public-presence';presenceLine.className='bc-public-presence';
      $('bc-user-public-roles')?.before(presenceLine);
    }
    presenceLine.textContent='';
    try{
      const presenceResponse=await request('/presence/'+encodeURIComponent(id));
      if(requestSerial===serial&&selected===id){
        const info=presenceResponse.presence||{};
        const names={online:'🟢 Disponível',away:'🌙 Ausente',dnd:'🔴 Não perturbar',offline:'⚫ Offline'};
        presenceLine.textContent=(names[info.mode]||'⚫ Offline')+(info.customStatus?' · '+info.customStatus:'');
      }
    }catch{/* Ausência de presença pública não impede a visualização do perfil. */}

  }
  function userRoleData(id){
    const person=members.find(m=>m.id===id);
    if(!person)return null;
    return {person,custom:roles.find(r=>(r.id||r.key?.slice(5))===(person.customRoleId||person.custom_role_id))||null};
  }
  function renderProfileRoles(id){
    const area=$('bc-user-public-roles');if(!area)return;
    area.replaceChildren();
    const data=userRoleData(id);
    if(!data)return;
    const top=data.person.role==='owner'?'👑 Dono':data.person.role==='admin'?'🛡️ Administrador':'👤 Membro';
    const base=document.createElement('span');base.className='bc-profile-role-chip';
    base.textContent=top;area.append(base);
    if(data.custom){
      const chip=document.createElement('span');chip.className='bc-profile-role-chip bc-profile-custom-role';
      chip.textContent='✦ '+data.custom.name;
      if(/^#[0-9a-f]{6}$/i.test(data.custom.color||''))chip.style.borderColor=data.custom.color;
      area.append(chip);
    }
  }
  async function changeCustomRole(id,roleId){
    if(!community||community.role!=='owner'||id===selfId)return;
    await request('/communities/'+community.id+'/members/'+id+'/custom-role','PATCH',{roleId});
    const person=members.find(m=>m.id===id);
    if(person)person.customRoleId=roleId;
    document.dispatchEvent(new CustomEvent('bc:refresh-members'));
    if(dialog.open&&selected===id)renderProfileRoles(id);
    status.textContent='Cargo do membro atualizado.';
  }
  async function changeBaseRole(id,role){
    if(!community||community.role!=='owner'||id===selfId)return;
    await request('/communities/'+community.id+'/members/'+id+'/role','PATCH',{role});
    const person=members.find(m=>m.id===id);
    if(person)person.role=role;
    document.dispatchEvent(new CustomEvent('bc:refresh-members'));
    if(dialog.open&&selected===id)renderProfileRoles(id);
    status.textContent='Permissão principal atualizada.';
  }
  async function showProfile(id){
    hideMenu();
    selected=id;
    dialog.dataset.bcPeerId=id;
    profile=null;
    updateActions();
    $('bc-user-public-name').textContent='Perfil de usuário';
    $('bc-user-public-handle').textContent='';
    $('bc-user-public-bio').textContent='';
    imageInto($('bc-user-public-banner'),null);
    imageInto($('bc-user-public-avatar'),null);
    renderProfileRoles(id);
    if(!dialog.open)dialog.showModal();
    try{await loadProfile(id);}
    catch(err){status.textContent=err.message;}
  }
  function action(label,fn){
    const button=document.createElement('button');
    button.type='button';button.setAttribute('role','menuitem');
    button.textContent=label;
    button.addEventListener('click',()=>{hideMenu();void Promise.resolve().then(fn).catch(err=>{status.textContent=err.message;});});
    menu.append(button);
  }
  async function quickAction(id,type){
    try{
      const result=await request('/users/'+id);
      const p=result.profile;
      if(p.isSelf)return showProfile(id);
      if(type==='friend'){
        if(p.blockedByMe)return showProfile(id);
        if(!p.friendshipStatus){
          await request('/friends/request','POST',{username:p.username});
          document.dispatchEvent(new CustomEvent('bc:refresh-friends'));
        }
      }else if(type==='block'){
        if(p.blockedByMe){
          await request('/blocks/'+p.id,'DELETE');
        }else {
          if(!window.confirm('Bloquear @'+p.username+'? Essa pessoa será removida dos seus amigos.'))return;
          await request('/blocks','POST',{username:p.username});
        }
        document.dispatchEvent(new CustomEvent('bc:refresh-friends'));
      }
      await showProfile(id);
      status.textContent=type==='friend'?'Pedido de amizade enviado.':'Bloqueio atualizado.';
    }catch(err){await showProfile(id);status.textContent=err.message;}
  }
  document.addEventListener('bc:show-user-profile',event=>{const id=event.detail?.id;if(token&&/^[0-9a-f-]{36}$/i.test(id||''))void showProfile(id);});
  document.addEventListener('contextmenu',event=>{
    const target=event.target.closest?.('[data-bc-user-id]');
    if(!target || !token || !document.getElementById('page-app')?.contains(target))return;
    const id=target.dataset.bcUserId;
    if(!/^[0-9a-f-]{36}$/i.test(id))return;
    event.preventDefault();
    selected=id;
    hideMenu();
    action('👤 Ver perfil completo',()=>showProfile(id));
    const roleInfo=userRoleData(id);
    if(roleInfo){
      const heading=document.createElement('div');
      heading.className='bc-context-role-heading';
      heading.textContent='CARGOS DE '+(roleInfo.person.displayName||roleInfo.person.username||'MEMBRO').toUpperCase();
      menu.append(heading);
      const base=roleInfo.person.role==='owner'?'👑 Dono':roleInfo.person.role==='admin'?'🛡️ Administrador':'👤 Membro';
      const roleLine=document.createElement('div');roleLine.className='bc-context-role-line';
      roleLine.textContent=base;menu.append(roleLine);
      if(roleInfo.custom){
        const badge=document.createElement('div');
        badge.className='bc-context-role-line';
        badge.textContent='✦ '+roleInfo.custom.name;
        if(/^#[0-9a-f]{6}$/i.test(roleInfo.custom.color||''))badge.style.color=roleInfo.custom.color;
        menu.append(badge);
      }
    }
    if(id!==selfId){
      for(const [kind,label] of [['message','✉ Mensagem'],['call','☎ Ligar'],['photo','🖼️ Enviar foto']]){
        action(label,()=>{
          document.dispatchEvent(new CustomEvent('bc:show-user-profile',{detail:{id}}));
          document.dispatchEvent(new CustomEvent('bc:dm-profile-action',{detail:{id,kind}}));
        });
      }
      action('➕ Enviar pedido de amizade',()=>quickAction(id,'friend'));
      action('🛡 Bloquear / desbloquear',()=>quickAction(id,'block'));
    }
    if(roleInfo&&id!==selfId&&roleInfo.person.role!=='owner'&&
      (community?.role==='owner'||['server_mute','server_deafen','disconnect_voice','timeout_members','kick_members','ban_members'].some(k=>community?.permissions?.[k]))){
      action('🛡 Moderação de '+(roleInfo.person.displayName||roleInfo.person.username||'membro'),()=>{
        document.dispatchEvent(new CustomEvent('bc:moderate-member',{detail:{
          id,name:roleInfo.person.displayName||roleInfo.person.username
        }}));
      });
    }
    if(roleInfo&&community?.role==='owner'&&id!==selfId&&roleInfo.person.role!=='owner'){
      const divider=document.createElement('div');divider.className='bc-context-role-heading';
      divider.textContent='GERENCIAR CARGOS · DONO';menu.append(divider);
      const title=document.createElement('div');title.className='bc-context-role-line';
      title.textContent='Clique no cargo para adicionar; clique novamente para remover.';
      menu.append(title);
      for(const role of roles){
        const assigned=(roleInfo.person.customRoleId||roleInfo.person.custom_role_id)===role.id;
        const button=document.createElement('button');
        button.type='button';button.setAttribute('role','menuitemcheckbox');
        button.setAttribute('aria-checked',String(assigned));
        button.textContent=(assigned?'☑ ':'☐ ')+role.name;
        if(/^#[0-9a-f]{6}$/i.test(role.color||''))button.style.color=role.color;
        button.addEventListener('click',async()=>{
          button.disabled=true;
          try{await changeCustomRole(id,assigned?null:role.id);hideMenu();}
          catch(err){button.disabled=false;status.textContent=err.message;}
        });
        menu.append(button);
      }
      if(!roles.length)action('Nenhum cargo criado · abrir configurações',()=>{
        document.getElementById('bc-server-settings-button')?.click();
        document.querySelector('[data-bc-settings-tab="roles"]')?.click();
      });
      action(roleInfo.person.role==='admin'?'↓ Remover administrador':'↑ Tornar administrador',async()=>{
        const next=roleInfo.person.role==='admin'?'member':'admin';
        if(!window.confirm('Alterar o cargo principal de '+roleInfo.person.username+' para '+(next==='admin'?'Administrador':'Membro')+'?'))return;
        try{await changeBaseRole(id,next);}catch(err){status.textContent=err.message;}
      });
    }
    menu.hidden=false;
    const width=menu.getBoundingClientRect().width||270,height=menu.getBoundingClientRect().height||152;
    menu.style.left=Math.max(6,Math.min(event.clientX,window.innerWidth-width-8))+'px';
    menu.style.top=Math.max(6,Math.min(event.clientY,window.innerHeight-height-8))+'px';
  });
  document.addEventListener('click',event=>{if(!menu.contains(event.target))hideMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hideMenu();});
  window.addEventListener('resize',hideMenu);
  document.addEventListener('scroll',hideMenu,true);
  $('bc-user-dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{serial++;profile=null;});
  friendAction.addEventListener('click',()=>{
    if(!profile||profile.friendshipStatus||profile.blockedByMe||profile.isSelf)return;
    void quickAction(profile.id,'friend');
  });
  blockAction.addEventListener('click',()=>{
    if(profile&&!profile.isSelf)void quickAction(profile.id,'block');
  });
  document.addEventListener('bc:platform-state',event=>{
    const e=event.detail||{};
    if(e.type==='user')selfId=e.user?.id||null;
    if(e.type==='community'){community=e.community||null;members=[];roles=[];hideMenu();}
    if(e.type==='members'){members=e.members||[];roles=(e.roles||[]).filter(r=>r.key?.startsWith('role:')).map(r=>({...r,id:r.key.slice(5)}));if(dialog.open&&selected)renderProfileRoles(selected);}
    if(e.type==='voice-session'){token=e.token||null;if(!token){hideMenu();dialog.close();}else document.dispatchEvent(new CustomEvent('bc:refresh-members'));}
    if(e.type==='logout'){token=null;selfId=null;community=null;members=[];roles=[];hideMenu();dialog.close();}
  });
})();
