'use strict';
// Modal de criação/entrada em servidor da plataforma própria BrasilCord.
(() => {
  const $=id=>document.getElementById(id);
  const dialog=$('bc-server-create-dialog');
  const trigger=$('bc-add-server-button');
  if(!dialog||!trigger)return;
  const panels={
    choose:$('bc-server-modal-choose'),
    create:$('bc-server-modal-create'),
    join:$('bc-server-modal-join')
  };
  const title=$('bc-server-modal-title');
  const description=$('bc-server-modal-description');
  const status=$('bc-server-modal-status');
  const texts={
    choose:['Criar seu servidor','Seu servidor é onde você e seus amigos se reúnem. Crie o seu e comece a interagir.'],
    create:['Crie seu servidor','Dê um nome ao seu espaço para começar a reunir sua comunidade.'],
    join:['Entrar em um servidor','Use um convite válido de uma comunidade do BrasilCord.']
  };
  function showPanel(name){
    if(!Object.hasOwn(panels,name))return;
    for(const [key,panel] of Object.entries(panels))panel.hidden=key!==name;
    title.textContent=texts[name][0];description.textContent=texts[name][1];
    status.textContent='';status.dataset.error='false';
    dialog.dataset.step=name;
    const focusTarget=name==='create' ? $('bc-server-new-name') :
      name==='join' ? $('bc-server-invite-code') : $('bc-server-modal-start-create');
    focusTarget?.focus({preventScroll:true});
  }
  function close(){
    if(dialog.open)dialog.close();
  }
  trigger.addEventListener('click',()=>{
    showPanel('choose');
    if(!dialog.open)dialog.showModal();
    $('bc-server-modal-start-create')?.focus({preventScroll:true});
  });
  $('bc-server-modal-close').addEventListener('click',close);
  $('bc-server-modal-start-create').addEventListener('click',()=>showPanel('create'));
  $('bc-server-modal-start-join').addEventListener('click',()=>showPanel('join'));
  for(const back of dialog.querySelectorAll('[data-server-modal-back]'))
    back.addEventListener('click',()=>showPanel('choose'));
  dialog.addEventListener('click',event=>{
    if(event.target===dialog)close();
  });
  dialog.addEventListener('close',()=>{
    trigger.focus({preventScroll:true});
    // Never discard user inputs on a failed request: only successful submissions reset forms.
    status.textContent='';
  });
  document.addEventListener('bc:server-modal-status',event=>{
    const detail=event.detail||{};
    status.textContent=detail.message||'';
    status.dataset.error=String(detail.error===true);
  });
  document.addEventListener('bc:server-modal-complete',()=>{
    close();
    showPanel('choose');
  });
})();
