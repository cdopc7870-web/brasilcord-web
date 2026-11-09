'use strict';
/* Bem-vindo Fundador Beta + formulários protegidos da comunidade BrasilCord. */
(()=>{
 const $=id=>document.getElementById(id),API='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
 const ownerInbox='b76c0d04-2a6f-47a5-95d1-bc0fdc000017';
 const entries={'b76c0d04-2a6f-47a5-95d1-bc0fdc000015':'suggestion','b76c0d04-2a6f-47a5-95d1-bc0fdc000016':'bug'};
 const beta=$('bc-beta-congrats'),formDialog=$('bc-feedback-dialog'),form=$('bc-feedback-form');
 if(!beta||!formDialog||!form)return;
 let token=null,checkedToken=null,currentType='suggestion',pendingRequest=false,ackBusy=false;
 async function request(path,method='GET',body){
   if(!token)throw Error('Entre na sua conta para continuar.');
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
   try{
     const res=await fetch(API+path,{method,cache:'no-store',signal:ctl.signal,credentials:'omit',
       headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},
       ...(body===undefined?{}:{body:JSON.stringify(body)})});
     const result=await res.json().catch(()=>({}));
     if(!res.ok)throw Error(result.error||'Erro HTTP '+res.status);
     return result;
   }finally{clearTimeout(timer);}
 }
 function notice(message){$('bc-feedback-status').textContent=message;}
 async function checkWelcome(){
   if(!token||checkedToken===token)return;
   const thisToken=token;checkedToken=thisToken;
   try{
     const result=await request('/beta');
     if(token!==thisToken||!result.hasBadge||!result.celebrationPending||!Number.isInteger(Number(result.slot)))return;
     const position=Number(result.slot);
     if(position<1||position>100)return;
     $('bc-beta-congrats-copy').textContent='Parabéns! Você foi a pessoa nº '+position+
       ' a entrar em nosso aplicativo e ganhou a insígnia Beta • Fundador!';
     $('bc-beta-congrats-error').textContent='';
     if(!beta.open)beta.showModal();
   }catch{if(token===thisToken)checkedToken=null;}
 }
 $('bc-beta-congrats-confirm').addEventListener('click',async()=>{
   if(ackBusy)return;
   ackBusy=true;const btn=$('bc-beta-congrats-confirm');btn.disabled=true;
   try{
     await request('/beta/ack','POST',{});
     beta.close();
   }catch(e){$('bc-beta-congrats-error').textContent='Não foi possível confirmar: '+e.message;}
   finally{ackBusy=false;btn.disabled=false;}
 });
 // A celebração não é marcada como vista ao fechar/acidentalmente recarregar.
 beta.addEventListener('cancel',e=>e.preventDefault());
 function openFeedback(kind){
   currentType=kind==='bug'?'bug':'suggestion';
   $('bc-feedback-title').textContent=currentType==='bug'?'🐛 Reportar um erro':'💡 Enviar sugestão';
   $('bc-feedback-submit').textContent=currentType==='bug'?'Enviar erro em privado para DKX157':'Enviar sugestão em privado para DKX157';
   form.reset();notice('');
   if(!formDialog.open)formDialog.showModal();
   $('bc-feedback-subject').focus();
 }
 document.addEventListener('click',e=>{
   const button=e.target.closest('#bc-platform-channel-list [data-channel-id]');
   if(!button||!token||!entries[button.dataset.channelId])return;
   // Na lista de canais estes IDs são entradas de formulários, não chats públicos.
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   openFeedback(entries[button.dataset.channelId]);
 },true);
 $('bc-feedback-close').addEventListener('click',()=>formDialog.close());
 form.addEventListener('submit',async e=>{
   e.preventDefault();if(pendingRequest)return;
   const title=$('bc-feedback-subject').value.trim(),details=$('bc-feedback-details').value.trim();
   if(title.length<5||title.length>100||details.length<10||details.length>1500){
     notice('Assunto: 5 a 100 caracteres. Descrição: 10 a 1500 caracteres.');return;
   }
   const button=$('bc-feedback-submit');pendingRequest=true;button.disabled=true;
   notice('Enviando com privacidade…');
   try{
     await request('/feedback','POST',{kind:currentType,title,details});
     notice('✓ Enviado! Somente DKX157 pode ler o conteúdo na central privada.');
     form.reset();button.textContent='✓ Enviado';
   }catch(err){notice(err.message);}
   finally{pendingRequest=false;button.disabled=false;}
 });
 document.addEventListener('bc:platform-state',e=>{
   const detail=e.detail||{};
   if(detail.type==='voice-session'){
     const next=detail.token||null;
     if(token!==next){token=next;checkedToken=null;formDialog.close();beta.close();}
     if(token)void checkWelcome();
   }
   if(detail.type==='logout'){token=null;checkedToken=null;beta.close();formDialog.close();}
 });
})();
