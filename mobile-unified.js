'use strict';
// Adaptação responsiva da interface compartilhada, sem duplicar login, chamadas ou mensagens.
(() => {
  const root=document.querySelector('#page-app .bc-community-desktop');
  const workarea=document.getElementById('bc-platform-app');
  const header=document.querySelector('#page-app .bc-stage-topbar');
  if(!root||!workarea||!header)return;
  const mobile=window.matchMedia('(max-width:700px)');
  const railLabels={chat:'Chats',dms:'Privado',friends:'Amigos',discover:'Explorar',calls:'Calls',profile:'Perfil',tools:'Ajustes'};
  root.querySelectorAll('.bc-global-rail [data-bc-view]').forEach(button=>{
    button.dataset.mobileLabel=railLabels[button.dataset.bcView]||button.dataset.bcView;
  });
  const actions=document.createElement('div');
  actions.className='bc-mobile-top-actions';
  actions.setAttribute('role','group');
  actions.setAttribute('aria-label','Opções do aplicativo no celular');
  const channels=document.createElement('button');
  channels.type='button';channels.textContent='☰';channels.title='Ver canais e chamadas';
  channels.setAttribute('aria-label','Abrir lista de canais e chamadas');
  channels.setAttribute('aria-expanded','false');
  const communities=document.createElement('button');
  communities.type='button';communities.textContent='⌂';communities.title='Suas comunidades';
  communities.setAttribute('aria-label','Ver comunidades');
  actions.append(channels,communities);
  const status=header.querySelector('#bc-platform-connection');
  if(status)header.insertBefore(actions,status);else header.append(actions);
  function closeChannels(){
    workarea.classList.remove('bc-mobile-channels-open');
    channels.setAttribute('aria-expanded','false');
    channels.setAttribute('aria-label','Abrir lista de canais e chamadas');
    channels.textContent='☰';
  }
  channels.addEventListener('click',()=>{
    if(!mobile.matches)return;
    const opening=!workarea.classList.contains('bc-mobile-channels-open');
    workarea.classList.toggle('bc-mobile-channels-open',opening);
    channels.setAttribute('aria-expanded',String(opening));
    channels.setAttribute('aria-label',opening?'Fechar lista de canais':'Abrir lista de canais e chamadas');
    channels.textContent=opening?'✕':'☰';
  });
  communities.addEventListener('click',()=>{
    closeChannels();
    document.querySelector('#bc-platform-communities')?.scrollIntoView({behavior:'smooth',block:'nearest'});
    root.querySelector('[data-bc-view="chat"]')?.click();
  });
  workarea.addEventListener('click',event=>{
    if(!mobile.matches)return;
    if(event.target.closest('#bc-platform-channel-list button, #bc-platform-voice-list button, .bc-channel-list button'))closeChannels();
  });
  root.querySelectorAll('.bc-global-rail [data-bc-view]').forEach(button=>button.addEventListener('click',closeChannels));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mobile.matches)closeChannels()});
  mobile.addEventListener?.('change',()=>closeChannels());
  document.addEventListener('bc:platform-state',event=>{
    if(event.detail?.type==='logout')closeChannels();
  });
  // Botão voltar do Android/navegador não altera sessão.
})();
