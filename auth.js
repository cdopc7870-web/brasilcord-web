'use strict';
(function(){
  const page=document.querySelector('[data-auth-view]');
  if(!page)return;
  const view=page.dataset.authView;
  const API='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  const form=document.getElementById('auth-form');
  const otpForm=document.getElementById('auth-otp-form');
  const msg=document.getElementById('auth-message');
  const otpMsg=document.getElementById('auth-otp-message');
  let challengeId=null;
  const showMessage=(node,message,ok=false)=>{
    if(!node)return;
    node.textContent=message||'';
    node.dataset.state=ok?'ok':'error';
  };
  const errorMessage=error=>error?.name==='AbortError'
    ?'O servidor demorou para responder. Tente novamente.'
    :error instanceof TypeError?'Não foi possível conectar ao serviço do BrasilCord.':error?.message||'Não foi possível concluir a operação.';
  async function request(path,payload){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const res=await fetch(API+path,{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(payload),cache:'no-store',signal:controller.signal
      });
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(typeof body.error==='string'?body.error:'Erro no servidor ('+res.status+').');
      return body;
    }finally{clearTimeout(timer)}
  }
  document.querySelectorAll('[data-toggle-password]').forEach(button=>{
    button.addEventListener('click',()=>{
      const input=document.getElementById(button.dataset.togglePassword);
      if(!input)return;
      const show=input.type==='password';
      input.type=show?'text':'password';
      button.setAttribute('aria-pressed',String(show));
      button.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
    });
  });
  function finish(result){
    if(!result?.token||!result?.user)throw Error('O servidor não retornou uma sessão válida.');
    // O mesmo token é utilizado pela versão normal, guardado somente na sessão da aba.
    sessionStorage.setItem('brasilcord:web:session',result.token);
    location.replace('app.html?app=1');
  }
  if(otpForm){
    otpForm.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!challengeId)return;
      const button=otpForm.querySelector('[type=submit]');
      button.disabled=true;
      showMessage(otpMsg,'Confirmando código...');
      try{
        const code=otpForm.elements.otp.value.trim();
        if(!/^\d{6}$/.test(code))throw Error('Digite exatamente seis números.');
        finish(await request('/login/verify',{challengeId,code}));
      }catch(error){showMessage(otpMsg,errorMessage(error))}
      finally{button.disabled=false}
    });
    document.getElementById('auth-otp-back')?.addEventListener('click',()=>{
      challengeId=null;otpForm.hidden=true;form.hidden=false;
      showMessage(msg,'Você pode solicitar um novo código tentando entrar novamente.');
      form?.querySelector('input[type=email]')?.focus();
    });
  }
  if(!form)return;
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity())return;
    const submit=form.querySelector('[type=submit]');
    submit.disabled=true;
    showMessage(msg,view==='register'?'Criando sua conta...':'Entrando na sua conta...');
    try{
      const data=new FormData(form);
      const payload={email:String(data.get('email')||'').trim().toLowerCase(),password:String(data.get('password')||'')};
      if(view==='register'){
        payload.username=String(data.get('username')||'').trim();
        const confirm=String(data.get('confirmPassword')||'');
        if(payload.password!==confirm)throw Error('As senhas não são iguais.');
        if(!/^[a-zA-Z0-9_]{3,28}$/.test(payload.username))throw Error('Use entre 3 e 28 letras, números ou _ no nome de usuário.');
        // O backend registra apenas username, email e password atualmente.
      }
      const response=await request(view==='register'?'/register':'/login',payload);
      form.elements.password.value='';
      if(view==='register')form.elements.confirmPassword.value='';
      if(response.verificationRequired&&response.challengeId){
        challengeId=response.challengeId;
        form.hidden=true;otpForm.hidden=false;
        otpForm.elements.otp.value='';
        showMessage(otpMsg,'Código enviado por e-mail. Digite-o para continuar.',true);
        otpForm.elements.otp.focus();
        return;
      }
      finish(response);
    }catch(error){showMessage(msg,errorMessage(error))}
    finally{submit.disabled=false}
  });
})();
