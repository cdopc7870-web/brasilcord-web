'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const dialog=$('bc-server-settings-dialog');
  if(!dialog)return;
  const API='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  let token=null,community=null,people=[],roleDefs=[],orderedKeys=[],onlineScope='this-server';
  let currentRoleChange=false;
  let busy=false;
  const sections={
    overview:$('bc-settings-overview'),
    roles:$('bc-settings-roles'),
    channels:$('bc-settings-channels')
  };
  function el(tag,text,cls){
    const node=document.createElement(tag);
    if(text!==undefined && text!==null)node.textContent=String(text);
    if(cls)node.className=cls;
    return node;
  }
  async function request(path,method='GET',body){
    if(!token)throw new Error('Entre na sua conta.');
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),13000);
    try{
      const res=await fetch(API+path,{
        method,cache:'no-store',signal:abort.signal,
        headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})
      });
      const payload=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(payload.error||'Erro HTTP '+res.status);
      return payload;
    }finally{clearTimeout(timeout);}
  }
  function mountOriginalSettings(){
    // Reaproveita os formularios ja conectados ao backend, sem duplicar IDs.
    const publicSettings=$('bc-community-public-settings');
    const management=$('bc-community-manage');
    const createText=$('bc-platform-channel-form');
    const createVoice=$('bc-platform-voice-form');
    const invite=$('bc-platform-invite');
    if(publicSettings){
      sections.overview.append(publicSettings);
      publicSettings.open=true;
    }
    if(management){
      const summary=management.querySelector('summary');
      if(summary)summary.hidden=true;
      management.open=true;
      // Os mesmos controles mantem seus eventos do modulo community-features.js.
      const form=$('bc-role-create'),rolesList=$('bc-role-list'),memberList=$('bc-role-members');
      if(form)sections.roles.append(form);
      if(rolesList)sections.roles.append(rolesList);
      if(memberList)sections.roles.append(memberList);
      sections.channels.append(management);
    }
    if(createText)sections.channels.prepend(createText);
    if(createVoice)sections.channels.prepend(createVoice);
    if(invite)sections.overview.append(invite);
    // O botão + da barra lateral permanece acessível para criar a primeira comunidade.
  }
  mountOriginalSettings();

  function setTab(name){
    for(const button of dialog.querySelectorAll('[data-bc-settings-tab]'))
      button.setAttribute('aria-selected',String(button.dataset.bcSettingsTab===name));
    for(const section of dialog.querySelectorAll('[data-bc-settings-content]'))
      section.hidden=section.dataset.bcSettingsContent!==name;
  }
  dialog.querySelectorAll('[data-bc-settings-tab]').forEach(button=>
    button.addEventListener('click',()=>setTab(button.dataset.bcSettingsTab)));
  const danger=$('bc-community-danger-zone'),deleteStart=$('bc-delete-community-start'),
    deleteForm=$('bc-delete-community-confirm'),deleteName=$('bc-delete-community-name'),
    deleteFinal=$('bc-delete-community-final'),deleteStatus=$('bc-delete-community-status');
  function refreshDanger(){
    const isOwner=community?.role==='owner'&&community?.is_official!==true;
    danger.hidden=!isOwner;deleteForm.hidden=true;deleteName.value='';
    deleteFinal.disabled=true;deleteStatus.textContent='';
  }
  deleteStart.addEventListener('click',()=>{
    if(!community||community.role!=='owner'||community.is_official)return;
    deleteForm.hidden=false;deleteName.value='';deleteFinal.disabled=true;
    deleteName.placeholder=community.name;deleteName.focus();
  });
  deleteName.addEventListener('input',()=>{
    deleteFinal.disabled=busy||!community||deleteName.value!==community.name;
  });
  $('bc-delete-community-cancel').addEventListener('click',()=>{
    deleteForm.hidden=true;deleteName.value='';deleteFinal.disabled=true;deleteStatus.textContent='';
  });
  deleteFinal.addEventListener('click',async()=>{
    const target=community;
    if(busy||!target||target.role!=='owner'||target.is_official||deleteName.value!==target.name)return;
    if(!window.confirm('EXCLUIR DEFINITIVAMENTE "'+target.name+'"? Os canais, mensagens e cargos serão apagados para todos os membros.'))return;
    busy=true;deleteFinal.disabled=true;deleteStatus.textContent='Excluindo comunidade…';
    try{
      await request('/communities/'+encodeURIComponent(target.id),'DELETE',{confirmName:target.name});
      if(community?.id===target.id){dialog.close();community=null;refreshDanger();}
      document.dispatchEvent(new CustomEvent('bc:community-deleted',{detail:{id:target.id}}));
      document.dispatchEvent(new CustomEvent('bc:refresh-communities'));
    }catch(err){deleteStatus.textContent=err.message;}
    finally{busy=false;deleteFinal.disabled=true;}
  });
  const gear=$('bc-server-settings-button');
  function canManage(){return Boolean(community &&
    (community.role==='owner'||community.permissions?.manage_channels||community.permissions?.manage_roles||community.permissions?.create_invites));}
  function openSettings(tab='overview'){
    if(!canManage())return;
    $('bc-server-settings-title').textContent=community.name;
    setTab(tab);
    if(!dialog.open)dialog.showModal();
    renderOrder();
    renderLegacyRoles();
    refreshDanger();
  }
  gear.addEventListener('click',()=>openSettings('overview'));
  $('bc-platform-community-name').addEventListener('contextmenu',event=>{
    if(!canManage())return;
    event.preventDefault();openSettings('overview');
  });
  $('bc-server-settings-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});

  const memberList=$('bc-platform-members');
  function buildMember(person){
    const row=el('div',null,'bc-platform-member bc-ranked-member');
    row.dataset.bcUserId=person.id;
    row.dataset.bcUsername=person.username||'';
    row.title='Clique com o botão direito para abrir o perfil de '+person.displayName;
    const avatar=el('span',(person.displayName||person.username||'BC').slice(0,2).toLocaleUpperCase('pt-BR'),'bc-member-avatar');
    if(person.avatarUpdatedAt) {
      const image=el('img');image.alt='';
      image.src=API+'/media/'+person.id+'/avatar?v='+new Date(person.avatarUpdatedAt).getTime();
      avatar.replaceChildren(image);
    }
    const name=el('span',null,'bc-member-name');
    name.append(el('strong',person.displayName||person.username),
      el('small',person.online?'● Online agora':'Offline'));
    const online=el('span',null,'bc-member-presence');
    online.dataset.online=String(person.online);
    online.title=person.online?'Online neste servidor':'Desconectado';
    row.append(avatar,name,online);
    return row;
  }
  function groupTitle(name,count,color){
    const row=el('div',null,'bc-role-group-heading');
    const label=el('strong',name.toLocaleUpperCase('pt-BR')+' — '+count+' ONLINE');
    if(/^#[0-9a-fA-F]{6}$/.test(color||''))label.style.color=color;
    const number=el('span',String(count));
    row.append(label,number);
    return row;
  }
  function renderMembers(){
    memberList.replaceChildren();
    const online=people.filter(p=>p.online===true),offline=people.filter(p=>!p.online);
    $('bc-member-count').textContent=String(people.length);
    $('bc-online-member-count').textContent=String(online.length);
    if(!community){
      memberList.append(el('p','Selecione uma comunidade para ver os membros.','bc-empty'));return;
    }
    const lookup=new Map(roleDefs.map(role=>[role.key,role]));
    for(const key of orderedKeys){
      const group=online.filter(p=>p.displayRoleKey===key);
      if(!group.length)continue;
      const role=lookup.get(key);
      memberList.append(groupTitle(role?.name||'Membro',group.length,role?.color));
      for(const person of group.sort((a,b)=>(a.displayName||'').localeCompare(b.displayName||'','pt-BR')))
        memberList.append(buildMember(person));
    }
    if(offline.length){
      const header=el('div','OFFLINE — '+offline.length,'bc-role-group-heading bc-offline-heading');
      memberList.append(header);
      for(const person of offline.sort((a,b)=>(a.displayName||'').localeCompare(b.displayName||'','pt-BR')))
        memberList.append(buildMember(person));
    }
    if(!people.length)memberList.append(el('p','Nenhum membro nesta comunidade.','bc-empty'));
  }
  function renderOrder(){
    const list=$('bc-role-order-list');list.replaceChildren();
    const lookup=new Map(roleDefs.map(r=>[r.key,r]));
    const editable=Boolean(community?.role==='owner');
    $('bc-role-order-save').disabled=!editable||!orderedKeys.length;
    for(let index=0;index<orderedKeys.length;index++){
      const key=orderedKeys[index],role=lookup.get(key);
      const row=el('div',null,'bc-role-order-item');
      const mark=el('span','⠿','bc-role-order-handle');
      const label=el('strong',role?.name||key);
      if(/^#[0-9a-fA-F]{6}$/.test(role?.color||''))label.style.color=role.color;
      const up=el('button','↑'),down=el('button','↓');
      up.type='button';down.type='button';
      up.title='Mover '+(role?.name||key)+' para cima';
      down.title='Mover '+(role?.name||key)+' para baixo';
      up.disabled=!editable||index===0;
      down.disabled=!editable||index===orderedKeys.length-1;
      up.addEventListener('click',()=>{
        [orderedKeys[index-1],orderedKeys[index]]=[orderedKeys[index],orderedKeys[index-1]];
        renderOrder();renderMembers();
      });
      down.addEventListener('click',()=>{
        [orderedKeys[index+1],orderedKeys[index]]=[orderedKeys[index],orderedKeys[index+1]];
        renderOrder();renderMembers();
      });
      row.append(mark,label,up,down);list.append(row);
    }
    $('bc-role-order-feedback').textContent=editable?
      'Apenas o proprietário pode salvar esta ordem.':'Somente o dono pode alterar a ordem dos cargos.';
  }
  $('bc-role-order-save').addEventListener('click',async()=>{
    if(busy||!community||community.role!=='owner')return;
    busy=true;$('bc-role-order-save').disabled=true;
    const id=community.id;
    try{
      const result=await request('/communities/'+id+'/role-order','PATCH',{order:orderedKeys});
      if(community?.id!==id)return;
      orderedKeys=result.roleOrder;
      $('bc-role-order-feedback').textContent='Ordem salva para todos os membros.';
      renderOrder();renderMembers();
      document.dispatchEvent(new CustomEvent('bc:refresh-members'));
    }catch(err){
      $('bc-role-order-feedback').textContent=err.message;
    }finally{busy=false;$('bc-role-order-save').disabled=false;}
  });
  function renderLegacyRoles(){
    let box=$('bc-legacy-member-role-list');
    if(!box){box=el('div',null,'bc-legacy-member-roles');box.id='bc-legacy-member-role-list';sections.roles.append(box);}
    box.replaceChildren();
    if(!community||community.role!=='owner')return;
    box.append(el('h3','Administrador ou membro (cargo principal)'));
    for(const person of people){
      if(person.role==='owner')continue;
      const row=el('div',null,'bc-management-row');
      row.append(el('span',person.displayName||person.username));
      const select=el('select');
      for(const value of ['member','admin']){
        const opt=el('option',value==='admin'?'Administrador':'Membro');
        opt.value=value;opt.selected=person.role===value;select.append(opt);
      }
      select.setAttribute('aria-label','Cargo principal de '+person.username);
      select.addEventListener('change',async()=>{
        select.disabled=true;
        try{
          await request('/communities/'+community.id+'/members/'+person.id+'/role','PATCH',{role:select.value});
          document.dispatchEvent(new CustomEvent('bc:refresh-members'));
        }catch(err){$('bc-role-order-feedback').textContent=err.message;select.value=person.role;}
        finally{select.disabled=false;}
      });
      row.append(select);box.append(row);
    }
  }
  async function updateMembers(){
    if(!token||!community)return;
    const id=community.id;
    try{
      const result=await request('/communities/'+id+'/members');
      if(community?.id!==id)return;
      document.dispatchEvent(new CustomEvent('bc:platform-state',{detail:{
        type:'members',members:(result.members||[]).map(m=>({
          id:m.id,username:m.username,displayName:m.display_name||m.username,
          avatarUpdatedAt:m.avatar_updated_at,role:m.role,customRoleId:m.custom_role_id,
          displayRoleKey:m.display_role_key,online:m.online===true
        })),
        roles:result.roles||[],roleOrder:result.roleOrder||[],
        onlineScope:result.onlineScope,canReorder:result.canReorder
      }}));
    }catch{/* Falhas temporárias preservam a última presença conhecida. */}
  }
  const refresh=setInterval(()=>{
    if(token&&community&&!document.hidden)void updateMembers();
  },15000);
  window.addEventListener('pagehide',()=>clearInterval(refresh),{once:true});
  document.addEventListener('bc:refresh-members',()=>void updateMembers());
  document.addEventListener('bc:platform-state',event=>{
    const e=event.detail||{};
    if(e.type==='voice-session')token=e.token||null;
    if(e.type==='community'){
      community=e.community||null;
      people=[];roleDefs=[];orderedKeys=[];
      if(dialog.open)dialog.close();
      $('bc-server-settings-title').textContent=community?.name||'Comunidade';
      gear.hidden=!canManage();
      refreshDanger();
      renderMembers();renderOrder();
      if(community&&token)void updateMembers();
    }
    if(e.type==='members'){
      people=e.members||[];
      roleDefs=e.roles||[];
      orderedKeys=e.roleOrder||[];
      onlineScope=e.onlineScope||'this-server';
      renderMembers();renderOrder();renderLegacyRoles();
    }
    if(e.type==='logout'){
      token=null;community=null;people=[];roleDefs=[];orderedKeys=[];
      gear.hidden=true;refreshDanger();if(dialog.open)dialog.close();
      renderMembers();renderOrder();
    }
  });
})();
