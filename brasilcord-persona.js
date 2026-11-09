'use strict';
// BrasilCord: presença, recado, coleção de insígnias e controles da call.
(()=>{
  const $=id=>document.getElementById(id);
  if(!$('bc-presence-dialog')||!$('bc-badge-gallery-dialog'))return;
  const BASE='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  const MODES={online:'🟢 Disponível',away:'🌙 Ausente',dnd:'🔴 Não perturbar',invisible:'⚫ Invisível'};
  let token=null,user=null,presence={mode:'online',customStatus:'',expiresAt:null},badges=[],equippedBadges=[],activeBadge=null;
  let badgeBusy=false,presenceBusy=false;
  async function api(path,method='GET',data){
    if(!token)throw Error('Entre na sua conta BrasilCord.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const res=await fetch(BASE+path,{method,cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',Authorization:'Bearer '+token,...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});
      const payload=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(payload.error||'Serviço temporariamente indisponível.');
      return payload;
    }finally{clearTimeout(timer);}
  }
  function safeDialog(dialog){
    if(!dialog.open)dialog.showModal();
  }
  function updatePresence(){
    const label=MODES[presence.mode]||MODES.online;
    const recado=presence.customStatus||'Sua vibe no BrasilCord.';
    $('bc-dock-personal-status').textContent=presence.customStatus||label;
    $('bc-profile-status-preview').textContent=label+(presence.customStatus?' · '+presence.customStatus:'');
    $('bc-persona-live').textContent=label;
    $('bc-persona-recado').textContent=recado;
    $('bc-persona-name').textContent=user?.displayName||user?.username||'Minha conta';
    $('bc-persona-avatar').textContent=(user?.displayName||user?.username||'BC').slice(0,2).toUpperCase();
    if(user?.avatarUrl){
      $('bc-persona-avatar').style.backgroundImage='url("'+user.avatarUrl.replaceAll('"','%22')+'")';
      $('bc-persona-avatar').style.backgroundSize='cover';
      $('bc-persona-avatar').textContent='';
    }else $('bc-persona-avatar').style.backgroundImage='';
    const input=document.querySelector('#bc-presence-form [name="mode"][value="'+presence.mode+'"]');
    if(input)input.checked=true;
    $('bc-persona-message').value=presence.customStatus||'';
    $('bc-persona-duration').value='0';
    document.dispatchEvent(new CustomEvent('bc:presence-updated',{detail:{mode:presence.mode}}));
  }
  async function loadPresence(){
    if(!token)return;
    try{const data=await api('/me/presence');presence=data.presence||presence;updatePresence();}
    catch(e){$('bc-presence-feedback').textContent=e.message;}
  }
  $('bc-user-profile-shortcut')?.addEventListener('contextmenu',event=>{
    if(!token)return;event.preventDefault();safeDialog($('bc-presence-dialog'));void loadPresence();
  });
  $('bc-open-status').addEventListener('click',()=>{
    if(!token)return;safeDialog($('bc-presence-dialog'));void loadPresence();
  });
  $('bc-presence-close').addEventListener('click',()=>$('bc-presence-dialog').close());
  const form=$('bc-presence-form');
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(presenceBusy)return;
    const mode=form.querySelector('[name="mode"]:checked')?.value||'online';
    const customStatus=$('bc-persona-message').value.trim();
    const durationSeconds=Number($('bc-persona-duration').value);
    presenceBusy=true;const save=form.querySelector('[type="submit"]');save.disabled=true;
    $('bc-presence-feedback').textContent='Salvando…';
    try{
      const data=await api('/me/presence','PATCH',{mode,customStatus,durationSeconds});
      presence=data.presence;updatePresence();$('bc-presence-feedback').textContent='Presença atualizada.';
      $('bc-presence-dialog').close();
    }catch(e){$('bc-presence-feedback').textContent=e.message;}
    finally{presenceBusy=false;save.disabled=false;}
  });
  const upcoming=[
    {id:'flora',name:'Raízes do Brasil',emoji:'🌿',description:'Conquista especial planejada para futuras temporadas.'},
    {id:'onca',name:'Guardião da Mata',emoji:'🐆',description:'Insígnia comemorativa em desenvolvimento.'},
    {id:'estrela',name:'Estrela Verde',emoji:'🌟',description:'Recompensa de evento especial ainda não disponível.'},
    {id:'onda',name:'Onda Azul',emoji:'🌊',description:'Conquista de comunidade em preparação.'}
  ];
  const list=$('bc-gallery-items');
  function galleryRow(badge,unlocked){
    const b=document.createElement('button');b.type='button';b.className='bc-gallery-item';
    b.title=badge.name+(unlocked?' · clique para ver e equipar':' · ainda bloqueada');b.dataset.selected=String(activeBadge?.id===badge.id);
    b.dataset.equipped=String(equippedBadges.includes(badge.id));
    if(badge.asset){
      const img=document.createElement('img');img.src='assets/badges/'+badge.asset;img.alt='';b.append(img);
    }else{const icon=document.createElement('span');icon.textContent=badge.emoji||'✦';b.append(icon);}
    const label=document.createElement('small');label.textContent=badge.name;b.append(label);
    if(!unlocked){const lock=document.createElement('i');lock.textContent='🔒';lock.setAttribute('aria-label','Bloqueada');b.append(lock);}
    b.addEventListener('click',()=>{activeBadge=badge;updateGallery();});
    return b;
  }
  function updateGallery(){
    list.replaceChildren();
    for(const b of badges)list.append(galleryRow(b,b.unlocked));
    for(const b of upcoming)list.append(galleryRow(b,false));
    const b=activeBadge||badges[0]||upcoming[0],unlocked=Boolean(b.unlocked);
    $('bc-gallery-name').textContent=b.name;
    $('bc-gallery-description').textContent=b.description||'Insígnia oficial do BrasilCord.';
    $('bc-gallery-state').textContent=unlocked?'✓ DESBLOQUEADA':b.asset?'🔒 AINDA BLOQUEADA':'EM BREVE';
    const emblem=$('bc-gallery-icon');emblem.replaceChildren();
    if(b.asset){const img=document.createElement('img');img.alt='';img.src='assets/badges/'+b.asset;emblem.append(img);}
    else emblem.textContent=b.emoji||'✦';
    const equip=$('bc-gallery-equip');
    const chosen=equippedBadges.includes(b.id);
    equip.disabled=!unlocked||badgeBusy;
    equip.textContent=!unlocked?'Ainda não disponível':chosen?'✓ Desequipar insígnia':'✦ Equipar insígnia';
  }
  async function openGallery(){
    safeDialog($('bc-badge-gallery-dialog'));list.textContent='Carregando coleção…';
    try{
      const data=await api('/me/badges');
      badges=data.badges||[];equippedBadges=data.equipped||[];
      activeBadge=badges.find(x=>x.id===equippedBadges[0])||badges[0]||upcoming[0];
      updateGallery();
    }catch(e){list.textContent=e.message;}
  }
  $('bc-open-badge-gallery').addEventListener('click',()=>void openGallery());
  $('bc-gallery-close').addEventListener('click',()=>$('bc-badge-gallery-dialog').close());
  $('bc-gallery-equip').addEventListener('click',async()=>{
    if(!activeBadge?.unlocked||badgeBusy)return;
    badgeBusy=true;updateGallery();
    try{
      const next=equippedBadges.includes(activeBadge.id)?equippedBadges.filter(x=>x!==activeBadge.id):[...equippedBadges,activeBadge.id];
      const result=await api('/me/badges','PATCH',{equippedIds:next});
      equippedBadges=result.equipped||[];
      const nextUser={...user,selectedBadge:equippedBadges[0]||null,equippedBadges};
      document.dispatchEvent(new CustomEvent('bc:profile-media',{detail:nextUser}));
      document.dispatchEvent(new CustomEvent('bc:platform-state',{detail:{type:'user',user:nextUser}}));
      user=nextUser;updateGallery();
    }catch(e){$('bc-gallery-description').textContent=e.message;}
    finally{badgeBusy=false;updateGallery();}
  });
  const forwards={'bc-dock-audio':'bc-call-deafen','bc-dock-camera':'bc-call-camera','bc-dock-screen':'bc-call-screen'};
  for(const [from,to] of Object.entries(forwards)){
    $(from)?.addEventListener('click',()=>{
      const button=$(to);
      if(!button?.disabled){document.querySelector('#page-app [data-bc-view="calls"]')?.click();button.click();}
    });
  }
  function updateDockControls(){
    for(const [from,to] of Object.entries(forwards)){
      const b=$(from),target=$(to);
      if(!b||!target)continue;
      b.disabled=Boolean(target.disabled);
      b.dataset.active=target.getAttribute('aria-pressed')||'false';
      b.title=target.textContent.trim();
    }
  }
  // Menu de identidade acessível pelo painel inferior, sem substituir o botão de perfil existente.
  const dock=$('bc-user-profile-shortcut');
  if(dock?.parentElement){
    const toggle=document.createElement('button');
    toggle.type='button';toggle.id='bc-persona-menu-toggle';toggle.textContent='⌄';
    toggle.title='Status e identidade BrasilCord';toggle.setAttribute('aria-label','Abrir menu de status e insígnias');
    toggle.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');menu.className='bc-persona-popover';menu.hidden=true;
    function menuAction(label,fn){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.addEventListener('click',()=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');fn();});
      menu.append(button);
    }
    menuAction('👤 Meu perfil',()=>dock.click());
    menuAction('🟢 Alterar presença',()=>{safeDialog($('bc-presence-dialog'));void loadPresence();});
    menuAction('✎ Definir recado',()=>{safeDialog($('bc-presence-dialog'));void loadPresence().then(()=>$('bc-persona-message').focus());});
    menuAction('✦ Minhas insígnias',()=>void openGallery());
    dock.after(toggle);toggle.after(menu);
    toggle.addEventListener('click',()=>{
      menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));
    });
    document.addEventListener('click',event=>{
      if(!menu.hidden&&!menu.contains(event.target)&&event.target!==toggle){
        menu.hidden=true;toggle.setAttribute('aria-expanded','false');
      }
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'){menu.hidden=true;toggle.setAttribute('aria-expanded','false');}
    });
  }
  const observer=new MutationObserver(updateDockControls);
  for(const to of Object.values(forwards)){
    const element=$(to);if(element)observer.observe(element,{attributes:true,attributeFilter:['disabled','aria-pressed'],childList:true,characterData:true,subtree:true});
  }
  updateDockControls();
  document.addEventListener('bc:platform-state',e=>{
    const d=e.detail||{};
    if(d.type==='voice-session'){
      token=d.token||null;
      if(token)void loadPresence();
      else{badges=[];presence={mode:'online',customStatus:'',expiresAt:null};updatePresence();}
    }
    if(d.type==='user'){user=d.user||null;updatePresence();}
    if(d.type==='logout'){token=null;user=null;updatePresence();$('bc-presence-dialog').close();$('bc-badge-gallery-dialog').close();}
  });
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
