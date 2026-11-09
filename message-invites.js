'use strict';
// Somente convites BrasilCord legítimos viram cartões clicáveis; nunca executar HTML de mensagens.
(()=>{
  const HOST='brasilcord-sinalizacao-dkx157.onrender.com';
  const INVITE=/\b(?:https:\/\/brasilcord-sinalizacao-dkx157\.onrender\.com\/invite\/|brasilcord:\/\/invite\/)([a-f0-9]{12})\b/ig;
  const panels=['bc-platform-messages','bc-dm-messages'];
  const $=id=>document.getElementById(id);
  function inviteCards(text){
    const result=[],seen=new Set();
    for(const m of String(text||'').matchAll(INVITE)){
      const code=m[1].toUpperCase();
      if(!seen.has(code)){seen.add(code);result.push(code);}
    }
    return result.slice(0,5);
  }
  function decorate(message){
    const content=message.querySelector('.bc-message-body>p,.bc-dm-message-content>p');
    if(!content||content.dataset.bcInviteProcessed==='true')return;
    content.dataset.bcInviteProcessed='true';
    const codes=inviteCards(content.textContent);
    if(!codes.length)return;
    const group=document.createElement('div');group.className='bc-invite-message-actions';
    for(const code of codes){
      const card=document.createElement('div');card.className='bc-invite-message-card';
      const top=document.createElement('div');top.className='bc-invite-message-header';
      const title=document.createElement('strong');title.textContent='🇧🇷 Convite BrasilCord';
      const sub=document.createElement('small');sub.textContent='Convite para uma comunidade · '+code;
      top.append(title,sub);
      const btn=document.createElement('button');btn.type='button';btn.textContent='Entrar na comunidade';
      btn.addEventListener('click',()=>{
        document.dispatchEvent(new CustomEvent('bc:join-invite-code',{detail:{code}}));
      });
      card.append(top,btn);group.append(card);
    }
    content.after(group);
  }
  function scan(){
    for(const id of panels){
      const panel=$(id);if(!panel)continue;
      for(const message of panel.querySelectorAll('.bc-platform-message,.bc-dm-message'))decorate(message);
    }
  }
  const observer=new MutationObserver(scan);
  for(const id of panels){const panel=$(id);if(panel)observer.observe(panel,{childList:true,subtree:true});}
  scan();
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
