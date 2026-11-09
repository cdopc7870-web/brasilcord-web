'use strict';
// BrasilCord: ferramentas de moderação com autorização revalidada no servidor.
(()=>{
  const $=id=>document.getElementById(id),dlg=$('bc-moderation-dialog');
  if(!dlg)return;
  const API='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  const ACTIONS=[
    ['server-mute','server_mute','🔇 Silenciar voz no servidor'],
    ['server-deafen','server_deafen','🔕 Desativar áudio no servidor'],
    ['disconnect','disconnect_voice','☎ Desconectar da call'],
    ['timeout','timeout_members','⏱ Castigar (timeout)'],
    ['kick','kick_members','⛔ Expulsar da comunidade'],
    ['ban','ban_members','🚫 Banir da comunidade']
  ];
  let token=null,community=null,target=null,busy=false,current=null;
  function can(permission){return !!community&&(community.role==='owner'||community.permissions?.[permission]===true);}
  function msg(text){$('bc-moderation-feedback').textContent=text;}
  async function api(path,method='GET',data){
    if(!token)throw Error('Faça login primeiro.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
    try{
      const response=await fetch(API+path,{method,cache:'no-store',signal:controller.signal,
        headers:{Accept:'application/json',Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},
        ...(data?{body:JSON.stringify(data)}:{})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.error||'Erro HTTP '+response.status);
      return result;
    }finally{clearTimeout(timer);}
  }
  function endpoint(action){return '/communities/'+encodeURIComponent(community.id)+'/moderation/'+encodeURIComponent(target.id)+'/'+action;}
  function render(){
    const box=$('bc-moderation-actions');box.replaceChildren();
    if(!target||!community)return;
    $('bc-moderation-member').textContent=(target.name||target.username||'Membro')+' · '+community.name;
    for(const [action,permission,label] of ACTIONS){
      if(!can(permission))continue;
      const enabled=action==='server-mute'?current?.server_muted===true:action==='server-deafen'?current?.server_deafened===true:null;
      const button=document.createElement('button');button.type='button';button.dataset.action=action;
      button.textContent=enabled!==null&&enabled?'✓ Reverter: '+label:label;
      if(['kick','ban'].includes(action))button.className='danger';
      button.disabled=busy;
      button.addEventListener('click',()=>void execute(action,enabled));
      box.append(button);
    }
    if(!box.childElementCount)msg('Você não possui permissão de moderação nesta comunidade.');
  }
  async function execute(action,enabled){
    if(busy||!target||!community)return;
    const selected={...target},cid=community.id;
    let reason=$('bc-moderation-reason').value.trim();
    if(reason.length<3){msg('O motivo deve ter pelo menos 3 caracteres.');return;}
    const payload={reason};
    if(action==='server-mute'||action==='server-deafen')payload.enabled=!enabled;
    if(action==='timeout')payload.durationMinutes=Number($('bc-moderation-time').value);
    if(['kick','ban'].includes(action)&&!window.confirm((action==='ban'?'Banir':'Expulsar')+' '+selected.name+' da comunidade '+community.name+'?'))return;
    busy=true;render();msg('Aplicando ação…');
    try{
      const result=await api(endpoint(action),'POST',payload);
      if(!community||community.id!==cid)return;
      msg('Ação aplicada: '+action+'.');
      if(['kick','ban'].includes(action)){
        dlg.close();document.dispatchEvent(new CustomEvent('bc:refresh-members'));
      }else{
        if(['server-mute','server-deafen'].includes(action))current=result.details||current;
        render();
      }
    }catch(e){msg(e.message);}finally{busy=false;render();}
  }
  async function open(targetId,name){
    if(!token||!community||!ACTIONS.some(([,p])=>can(p))||!targetId)return;
    target={id:targetId,name:name||'Membro'};current=null;busy=false;
    msg('Carregando estado do membro…');
    if(!dlg.open)dlg.showModal();render();
    try{
      const state=await api(endpoint('status'));current=state.sanctions||{};msg('Escolha uma ação para moderar esse membro.');
    }catch(e){msg(e.message);}
    render();
  }
  document.addEventListener('bc:moderate-member',e=>void open(e.detail?.id,e.detail?.name));
  $('bc-moderation-close').addEventListener('click',()=>dlg.close());
  document.addEventListener('bc:platform-state',event=>{
    const e=event.detail||{};
    if(e.type==='voice-session')token=e.token||null;
    if(e.type==='community'){community=e.community||null;dlg.close();}
    if(e.type==='logout'){token=null;community=null;target=null;dlg.close();}
  });
})();