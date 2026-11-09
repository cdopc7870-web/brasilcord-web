'use strict';
// Contagem de mensagens privadas não lidas. Fonte de verdade: backend autenticado.
(() => {
  const $=id=>document.getElementById(id);
  const API='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  let token=null,initialized=false,lastTotal=0,counts=new Map(),inFlight=false,activeDM=null,presenceMode='online';
  const nav=document.querySelector('#page-app [data-bc-view="dms"]');
  const friendNav=document.querySelector('#page-app [data-bc-view="friends"]');
  if(!nav)return;
  function badge(target,number){
    if(!target)return;
    let el=target.querySelector(':scope > .bc-unread-badge');
    if(!number){el?.remove();target.classList.remove('bc-has-unread');return;}
    if(!el){el=document.createElement('span');el.className='bc-unread-badge';el.setAttribute('aria-label','Mensagens não lidas');target.append(el);}
    el.textContent=number>99?'99+':String(number);target.classList.add('bc-has-unread');
  }
  function render(){
    const total=[...counts.values()].reduce((a,b)=>a+b,0);
    badge(nav,total);
    badge(friendNav,total);
    for(const contact of document.querySelectorAll('#bc-dm-friends [data-bc-user-id], #bc-platform-friends [data-bc-user-id]')){
      badge(contact,counts.get(contact.dataset.bcUserId)||0);
    }
    nav.title=total?total+' mensagens privadas não lidas':'Mensagens privadas';
    if(total>0 && (!document.title.startsWith('(')||document.title.includes(') ')))
      document.title='('+total+') BrasilCord';
    else if(!total && /^\(\d+\) BrasilCord$/.test(document.title))document.title='BrasilCord';
  }
  function softPing(){
    if(presenceMode==='dnd')return;
    try{
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
      const ctx=new Context(),t=ctx.currentTime,o=ctx.createOscillator(),gain=ctx.createGain();
      o.type='sine';o.frequency.setValueAtTime(830,t);o.frequency.exponentialRampToValueAtTime(1050,t+.12);
      gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.045,t+.02);gain.gain.exponentialRampToValueAtTime(.0001,t+.24);
      o.connect(gain);gain.connect(ctx.destination);o.start(t);o.stop(t+.25);
      o.onended=()=>{void ctx.close().catch(()=>{});};
    }catch{}
  }
  async function refresh(){
    if(!token||inFlight)return;
    inFlight=true;
    try{
      const res=await fetch(API+'/dms/unread',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},cache:'no-store'});
      if(!res.ok)return;
      const data=await res.json(),next=new Map();
      for(const row of data.unread||[])if(typeof row.peer_id==='string')next.set(row.peer_id,Math.max(0,Number(row.unread)||0));
      const total=[...next.values()].reduce((a,b)=>a+b,0);
      if(initialized && total>lastTotal)softPing();
      lastTotal=total;initialized=true;counts=next;render();
    }catch{}finally{inFlight=false;}
  }
  document.addEventListener('bc:presence-updated',event=>{presenceMode=event.detail?.mode||'online';});
  document.addEventListener('bc:platform-state',event=>{
    const e=event.detail||{};
    if(e.type==='voice-session'){
      if(token!==e.token){token=e.token||null;initialized=false;lastTotal=0;presenceMode='online';counts.clear();render();}
      if(token)void refresh();
    }
    if(e.type==='logout'){token=null;counts.clear();initialized=false;lastTotal=0;render();}
  });
  document.addEventListener('bc:dm-open',event=>{
    activeDM=event.detail?.id||null;
    if(activeDM){counts.delete(activeDM);render();setTimeout(()=>void refresh(),800);}
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('#bc-dm-friends .bc-dm-friend'))setTimeout(()=>void refresh(),900);
  });
  const observer=new MutationObserver(render);
  for(const id of ['bc-dm-friends','bc-platform-friends']){const el=$(id);if(el)observer.observe(el,{childList:true});}
  const timer=setInterval(()=>{if(token&&!document.hidden)void refresh();},8000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  window.addEventListener('pagehide',()=>{clearInterval(timer);observer.disconnect();},{once:true});
})();