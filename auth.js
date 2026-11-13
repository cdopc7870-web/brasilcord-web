'use strict';
(function(){
  const page=document.querySelector('[data-auth-view]');
  if(!page)return;
  const view=page.dataset.authView;
  const API='https://brasilcord-backend.onrender.com/api/platform';
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
    const timer=setTimeout(()=>controller.abort(),20000);
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
  async function restoreExistingSession(){
    if(view!=='login')return false;
    let token='';
    try{
      token=localStorage.getItem('brasilcord:web:session')||sessionStorage.getItem('brasilcord:web:session')||'';
    }catch{}
    if(!token)return false;
    showMessage(msg,'Verificando sua sessão salva...',true);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(API+'/me',{
        headers:{'Authorization':'Bearer '+token,'Accept':'application/json'},
        cache:'no-store',signal:controller.signal
      });
      if(response.ok){
        location.replace('app.html?app=1');
        return true;
      }
      if(response.status===401||response.status===403){
        try{localStorage.removeItem('brasilcord:web:session');sessionStorage.removeItem('brasilcord:web:session');}catch{}
        showMessage(msg,'Sua sessão expirou. Entre novamente.');
        return false;
      }
      showMessage(msg,'Não foi possível validar a sessão salva. Entre novamente.');
    }catch(error){
      showMessage(msg,error?.name==='AbortError'
        ?'A verificação da sessão demorou. Entre novamente.'
        :'Não foi possível verificar a sessão salva. Entre novamente.');
    }finally{clearTimeout(timer);}
    return false;
  }
  const restoreSessionPromise=restoreExistingSession();
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
  let pendingDisplayName='';
  async function finish(result){
    if(!result?.token||!result?.user)throw Error('O servidor não retornou uma sessão válida.');
    // Opcional: aplicar o nome de exibição após a criação da conta ou confirmação por e-mail.
    // Se não for possível salvar o nome, preserve o cadastro e a sessão principal.
    if(pendingDisplayName){
      try{
        const controller=new AbortController();
        const timeout=setTimeout(()=>controller.abort(),8000);
        try{
          await fetch(API+'/me',{
            method:'PATCH',
            headers:{'Content-Type':'application/json','Authorization':'Bearer '+result.token},
            body:JSON.stringify({displayName:pendingDisplayName,bio:''}),
            cache:'no-store',signal:controller.signal
          }).then(async response=>{
            if(!response.ok)throw Error('Falha ao salvar nome de exibição.');
          });
        }finally{clearTimeout(timeout)}
      }catch(error){console.warn('Nome de exibição não foi atualizado:',error.message)}
      pendingDisplayName='';
    }
    const remember=view!=='login'||document.getElementById('remember-login')?.checked===true;
    try{
      if(remember){
        localStorage.setItem('brasilcord:web:session',result.token);
        sessionStorage.removeItem('brasilcord:web:session');
      }else{
        sessionStorage.setItem('brasilcord:web:session',result.token);
        localStorage.removeItem('brasilcord:web:session');
      }
    }catch{throw Error('Não foi possível salvar a sessão neste navegador. Verifique as configurações de privacidade.');}
    location.replace('app.html?app=1');
  }
  if(view==='recover'){
    const requestForm=document.getElementById('recovery-request-form');
    const confirmForm=document.getElementById('recovery-confirm-form');
    const requestStatus=document.getElementById('recovery-request-status');
    const confirmStatus=document.getElementById('recovery-confirm-status');
    const retryButton=document.getElementById('recovery-request-retry');
    const report=(el,s,ok)=>{el.textContent=s;el.dataset.state=ok?'ok':'error';};
    const recoveryError=error=>{
      const text=errorMessage(error);
      if(error instanceof TypeError||/indisponível|não foi possível conectar/i.test(text))
        return 'O serviço de recuperação está temporariamente indisponível. O problema está no servidor, não no seu e-mail. Tente novamente em alguns minutos.';
      return text;
    };
    requestForm?.addEventListener('submit',async e=>{
      e.preventDefault();if(!requestForm.reportValidity())return;
      const button=requestForm.querySelector('[type=submit]');button.disabled=true;
      if(retryButton)retryButton.hidden=true;
      report(requestStatus,'Enviando solicitação...',true);
      try{
        const email=document.getElementById('recovery-email').value.trim().toLowerCase();
        const result=await request('/password-reset/request',{email});
        report(requestStatus,result.message||'Confira seu e-mail.',true);
        confirmForm.hidden=false;
      }catch(err){report(requestStatus,recoveryError(err),false);if(retryButton)retryButton.hidden=false;}
      finally{button.disabled=false;}
    });
    retryButton?.addEventListener('click',()=>requestForm?.requestSubmit());
    confirmForm?.addEventListener('submit',async e=>{
      e.preventDefault();if(!confirmForm.reportValidity())return;
      const email=document.getElementById('recovery-email').value.trim().toLowerCase();
      const code=document.getElementById('recovery-code').value.trim();
      const password=document.getElementById('recovery-password').value;
      if(password!==document.getElementById('recovery-confirm-password').value){
        report(confirmStatus,'As senhas não coincidem.',false);return;
      }
      const button=confirmForm.querySelector('[type=submit]');button.disabled=true;
      report(confirmStatus,'Verificando código...',true);
      try{
        const result=await request('/password-reset/confirm',{email,code,password});
        report(confirmStatus,result.message||'Senha atualizada. Entre novamente.',true);
        confirmForm.hidden=true;requestForm.hidden=true;
        document.getElementById('recovery-password').value='';
        document.getElementById('recovery-confirm-password').value='';
      }catch(err){report(confirmStatus,errorMessage(err),false);}
      finally{button.disabled=false;}
    });
    return;
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
        await finish(await request('/login/verify',{challengeId,code}));
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
        if(data.get('beta')!=='on'||data.get('privacy')!=='on')throw Error('Leia e aceite as condições de uso e informações de privacidade.');
        pendingDisplayName=String(data.get('displayName')||'').trim();
        if(pendingDisplayName && (pendingDisplayName.length<2||pendingDisplayName.length>40))throw Error('O nome de exibição deve ter de 2 a 40 caracteres.');
        // A data de nascimento e o código Beta não são coletados pelo formulário até o backend oferecer suporte.
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
      await finish(response);
    }catch(error){showMessage(msg,errorMessage(error))}
    finally{submit.disabled=false}
  });
})();
