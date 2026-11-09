'use strict';
// Menus de contexto administrativos da plataforma própria BrasilCord.
// O frontend só apresenta atalhos; o servidor valida todas as permissões.
(() => {
  const $=id=>document.getElementById(id);
  const menu=$('bc-admin-context-menu');
  if(!menu)return;
  const API='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  let token=null,community=null,roles=[],categories=[],channels=[];
  const status=text=>{$('bc-platform-status').textContent=text;};
  const el=(tag,text,cls)=>{
    const node=document.createElement(tag);if(text!==null&&text!==undefined)node.textContent=String(text);
    if(cls)node.className=cls;return node;
  };
  async function request(path,method='GET',body){
    if(!token)throw Error('Entre na sua conta.');
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),13000);
    try{
      const r=await fetch(API+path,{method,signal:ctrl.signal,cache:'no-store',
        headers:{Accept:'application/json',Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},
        ...(body===undefined?{}:{body:JSON.stringify(body)})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(data.error||'Erro HTTP '+r.status);
      return data;
    }finally{clearTimeout(timer);}
  }
  function hide(){menu.hidden=true;menu.replaceChildren();}
  function item(label,fn,options={}){
    const b=el('button',label,options.danger?'bc-context-danger':'');
    b.type='button';b.setAttribute('role','menuitem');b.disabled=Boolean(options.disabled);
    b.addEventListener('click',()=>{hide();void Promise.resolve().then(fn).catch(e=>status(e.message));});
    menu.append(b);return b;
  }
  function caption(text){menu.append(el('div',text,'bc-context-caption'));}
  function separator(){menu.append(el('div',null,'bc-context-separator'));}
  function present(event){
    menu.hidden=false;
    const bounds=menu.getBoundingClientRect();
    const left=Math.max(8,Math.min(event.clientX,window.innerWidth-bounds.width-9));
    const top=Math.max(8,Math.min(event.clientY,window.innerHeight-bounds.height-9));
    menu.style.left=left+'px';menu.style.top=top+'px';
    const b=menu.querySelector('button:not([disabled])');b?.focus({preventScroll:true});
  }
  function canChannels(){return community&&(community.role==='owner'||community.permissions?.manage_channels);}
  function canRoles(){return community&&(community.role==='owner'||community.permissions?.manage_roles);}
  function openSettings(tab,focusId){
    if(!community)return;
    const gear=$('bc-server-settings-button');
    if(!gear||gear.hidden)return;
    gear.click();
    const tabButton=document.querySelector('[data-bc-settings-tab="'+tab+'"]');
    tabButton?.click();
    if(focusId){
      const target=$(focusId);
      target?.scrollIntoView({block:'nearest'});
      if(target instanceof HTMLSelectElement)target.focus({preventScroll:true});
      else target?.querySelector('input,select,button')?.focus({preventScroll:true});
    }
  }
  async function refresh(){
    if(!community)return;
    const id=community.id;
    const [r,c]=await Promise.all([request('/communities/'+id+'/roles'),request('/communities/'+id+'/categories')]);
    if(community?.id!==id)return;
    roles=r.roles||[];categories=c.categories||[];
    document.dispatchEvent(new CustomEvent('bc:refresh-current-community',{detail:{id}}));
    document.dispatchEvent(new CustomEvent('bc:refresh-members'));
  }
  function heading(type,data){
    if(type==='channel')return (data.kind==='voice'?'◉ CALL DE VOZ':'# CANAL DE TEXTO');
    return type==='role'?'✦ CARGO':'▤ CATEGORIA';
  }
  function channelMenu(target){
    const id=target.dataset.bcContextId;
    const data=channels.find(ch=>ch.id===id)||{
      id,name:target.dataset.bcContextName,kind:target.classList.contains('bc-voice-channel-item')?'voice':'text',
      category_id:null,min_role_id:null
    };
    caption(heading('channel',data)+' · '+data.name);
    item('ℹ Informações do canal',()=>{
      const category=categories.find(c=>c.id===data.category_id);
      const gate=roles.find(r=>r.id===data.min_role_id);
      status((data.kind==='voice'?'Call':'Chat')+' '+data.name+' · Categoria: '+(category?.name||'Nenhuma')+' · Cargo de acesso: '+(gate?.name||'Todos os membros'));
    });
    if(!canChannels())return;
    separator();
    item('⚙ Configurar permissões',()=>{
      openSettings('channels','bc-channel-config');
      const select=$('bc-config-channel');
      if(select){select.value=id;select.dispatchEvent(new Event('change',{bubbles:true}));}
      $('bc-config-category').value=data.category_id||'';
      $('bc-config-role').value=data.min_role_id||'';
    });
    item('✎ Renomear canal / call',async()=>{
      const name=window.prompt('Novo nome para '+data.name+':',data.name);
      if(name===null)return;
      if(!name.trim()||name.trim()===data.name)return;
      await request('/communities/'+community.id+'/channels/'+id,'PATCH',{name:name.trim()});
      status('Canal renomeado.');await refresh();
    });
    separator();
    item('🗑 Excluir canal / call',async()=>{
      if(!window.confirm('Excluir definitivamente '+data.name+'? As mensagens deste canal serão apagadas e participantes da call poderão ser desconectados.'))return;
      await request('/communities/'+community.id+'/channels/'+id,'DELETE');
      status('Canal excluído.');await refresh();
    },{danger:true});
  }
  function categoryMenu(target){
    const id=target.dataset.bcContextId,data=categories.find(c=>c.id===id);
    if(!data)return;
    caption('▤ CATEGORIA · '+data.name);
    const restriction=roles.find(r=>r.id===data.min_role_id);
    item('ℹ Acesso: '+(restriction?.name||'Todos os membros'),()=>status('Categoria '+data.name+' · '+(restriction?'Visível para '+restriction.name:'Visível para todos')));
    if(!canChannels())return;
    separator();
    item('⚙ Configurar categoria',async()=>{
      const name=window.prompt('Nome da categoria:',data.name);
      if(name===null)return;
      const choices=['Todos os membros',...roles.map(r=>r.name)];
      const selected=window.prompt('Cargo com acesso (digite o número):\n'+choices.map((n,i)=>i+' · '+n).join('\n'),String(Math.max(0,roles.findIndex(r=>r.id===data.min_role_id)+1)));
      if(selected===null)return;
      if(!/^\d+$/.test(selected)||Number(selected)>=choices.length)throw Error('Seleção de cargo inválida.');
      await request('/communities/'+community.id+'/categories/'+id,'PATCH',{
        name:name.trim(),minRoleId:Number(selected)===0?null:roles[Number(selected)-1].id
      });
      status('Categoria atualizada.');await refresh();
    });
    item('＋ Criar novo canal',()=>openSettings('channels','bc-platform-channel-form'));
    separator();
    item('🗑 Excluir categoria',async()=>{
      if(!window.confirm('Excluir a categoria '+data.name+'? Os canais serão mantidos e ficarão sem categoria.'))return;
      await request('/communities/'+community.id+'/categories/'+id,'DELETE');
      status('Categoria excluída.');await refresh();
    },{danger:true});
  }
  function roleMenu(target){
    const id=target.dataset.bcContextId,data=roles.find(r=>r.id===id);
    if(!data)return;
    caption('✦ CARGO · '+data.name);
    item('ℹ Ver permissões',()=>{
      const p=Object.entries(data.permissions||{}).filter(([,enabled])=>enabled).map(([name])=>({
        view_channels:'Ver canais',send_messages:'Enviar mensagens',connect_voice:'Entrar em calls',
        create_invites:'Criar convites',manage_channels:'Gerenciar canais',manage_roles:'Gerenciar cargos'
      })[name]||name);
      status('Permissões de '+data.name+': '+(p.join(', ')||'Nenhuma'));
    });
    if(!canRoles())return;
    separator();
    item('⚙ Editar nome, cor e permissões',()=>{
      openSettings('roles','bc-role-create');
      const form=$('bc-role-create');
      const row=[...$('bc-role-list').querySelectorAll('[data-bc-context-id]')].find(x=>x.dataset.bcContextId===id);
      const edit=[...row?.querySelectorAll('button')||[]].find(b=>b.textContent==='Editar');
      edit?.click();form?.scrollIntoView({block:'nearest'});
    });
    item('👥 Gerenciar membros com este cargo',()=>openSettings('roles','bc-role-members'));
    item('↕ Organizar posição na lista',()=>openSettings('roles','bc-role-order-list'));
    separator();
    item('🗑 Excluir cargo',async()=>{
      if(!window.confirm('Excluir o cargo '+data.name+'? Os membros que o possuem perderão o cargo.'))return;
      await request('/communities/'+community.id+'/roles/'+id,'DELETE');
      status('Cargo excluído.');await refresh();
    },{danger:true});
  }
  function renderCategoryNavigation(){
    const categoryLookup=new Map(categories.map(c=>[c.id,c]));
    const channelLookup=new Map(channels.map(c=>[c.id,c]));
    for(const listId of ['bc-platform-channel-list','bc-platform-voice-list']){
      const list=$(listId);if(!list)return;
      const current=[...list.querySelectorAll('[data-bc-context-type="channel"]')];
      if(!current.length)continue;
      for(const heading of list.querySelectorAll('.bc-nav-category-heading'))heading.remove();
      const ordered=[];
      for(const cat of categories){
        const subset=current.filter(element=>channelLookup.get(element.dataset.bcContextId)?.category_id===cat.id);
        if(!subset.length)continue;
        const label=el('div',null,'bc-nav-category-heading');
        label.dataset.bcContextType='category';label.dataset.bcContextId=cat.id;label.dataset.bcContextName=cat.name;
        label.setAttribute('role','heading');label.setAttribute('aria-level','3');
        label.setAttribute('title','Botão direito para configurar a categoria '+cat.name);
        label.append(el('span','⌄ '+cat.name),el('span','⚙','bc-nav-category-gear'));
        ordered.push(label,...subset);
      }
      const orphan=current.filter(element=>!categoryLookup.has(channelLookup.get(element.dataset.bcContextId)?.category_id));
      ordered.push(...orphan);
      list.append(...ordered);
    }
  }
  document.addEventListener('contextmenu',event=>{
    const target=event.target.closest?.('[data-bc-context-type]');
    if(!target||!token||!community||!target.closest('#page-app, #bc-server-settings-dialog'))return;
    const type=target.dataset.bcContextType;
    if(!['channel','category','role'].includes(type))return;
    if(type==='role'&&!$('bc-server-settings-dialog')?.open)return;
    event.preventDefault();
    hide();
    if(type==='channel')channelMenu(target);
    if(type==='category')categoryMenu(target);
    if(type==='role')roleMenu(target);
    if(!menu.childElementCount)return;
    if(target.closest('#bc-server-settings-dialog')&&$('bc-server-settings-dialog')?.open)$('bc-server-settings-dialog').close();
    present(event);
  });
  document.addEventListener('click',event=>{if(!menu.contains(event.target))hide();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  document.addEventListener('scroll',hide,true);
  window.addEventListener('resize',hide);
  document.addEventListener('bc:platform-state',event=>{
    const data=event.detail||{};
    if(data.type==='voice-session')token=data.token||null;
    if(data.type==='community'){community=data.community||null;channels=[];roles=[];categories=[];hide();}
    if(data.type==='channels-list')channels=data.channels||[];
    if(data.type==='logout'){token=null;community=null;channels=[];roles=[];categories=[];hide();}
  });
  document.addEventListener('bc:management-data',event=>{
    const data=event.detail||{};
    if(!community||community.id!==data.communityId)return;
    roles=data.roles||[];categories=data.categories||[];
    if(data.channels)channels=data.channels;
    renderCategoryNavigation();
  });
})();
