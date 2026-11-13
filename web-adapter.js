'use strict';
// Camada de compatibilidade para executar a interface Electron diretamente no navegador.
(() => {
  const ok=(extra={})=>Promise.resolve({ok:true,...extra});
  const unsupported=(name)=>Promise.resolve({ok:false,message:name+' requer o aplicativo Windows.'});
  const invite='https://discord.gg/XaHwEDse99';
  const open=url=>{window.open(url,'_blank','noopener,noreferrer');return ok();};
  const sessionKey='brasilcord:web:session';
  const sessionDbName='brasilcord-session-store';
  const sessionStoreName='sessions';
  const prefKey='brasilcord:web:invite-confirmed';
  // IndexedDB funciona como cópia persistente caso o navegador limpe/bloqueie o localStorage.
  function openSessionDb(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB indisponível'));return;}
      const request=indexedDB.open(sessionDbName,1);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(sessionStoreName))db.createObjectStore(sessionStoreName);};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Falha ao abrir armazenamento seguro'));
    });
  }
  async function writePersistentSession(token){
    const db=await openSessionDb();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction(sessionStoreName,'readwrite');
      tx.objectStore(sessionStoreName).put(token,sessionKey);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Gravação cancelada'));
    });}finally{db.close();}
  }
  async function readPersistentSession(){
    const db=await openSessionDb();
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(sessionStoreName,'readonly');
      const request=tx.objectStore(sessionStoreName).get(sessionKey);
      request.onsuccess=()=>resolve(typeof request.result==='string'?request.result:null);
      request.onerror=()=>reject(request.error);
    });}finally{db.close();}
  }
  async function clearPersistentSession(){
    const db=await openSessionDb();
    try{await new Promise((resolve,reject)=>{
      const tx=db.transaction(sessionStoreName,'readwrite');
      tx.objectStore(sessionStoreName).delete(sessionKey);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });}finally{db.close();}
  }
  const noEvent=()=>()=>{};
  window.brasilcord={
    isWeb:true,
    getCommunityInviteConfirmed:()=>Promise.resolve(localStorage.getItem(prefKey)==='1'),
    setCommunityInviteConfirmed:v=>{localStorage.setItem(prefKey,v?'1':'0');return ok();},
    getLocalPluginState:()=>ok({active:null}),
    onLocalPluginState:noEvent,
    onDiscordLoad:noEvent,
    onUpdateStatus:noEvent,
    onDiscordTheme:noEvent,
    getAppVersion:()=>Promise.resolve('Web'),
    checkForUpdates:()=>ok({message:'A versão web é atualizada pelo site.'}),
    getDiscordZoom:()=>ok({zoom:1}),
    adjustDiscordZoom:()=>ok({zoom:1}),
    resetDiscordZoom:()=>ok({zoom:1}),
    setDiscordToolsMenu:()=>ok(),
    getDiscordTheme:()=>ok({id:null,name:'Original'}),
    setDiscordTheme:()=>ok({id:null,name:'Original'}),
    openPluginsManager:()=>unsupported('Plugins locais'),
    openDiscord:()=>open('https://discord.com/app'),
    joinOfficialServer:()=>open(invite),
    openSocialLink:()=>open(invite),
    openSupportPayment:url=>open(url),
    openBrasilCordSupportPage:()=>ok(),
    copySupportLink:()=>navigator.clipboard.writeText(location.origin).then(()=>({ok:true})),
    copyBrasilCordInvite:()=>navigator.clipboard.writeText(location.origin).then(()=>({ok:true})),
    copySupportPix:value=>navigator.clipboard.writeText(value).then(()=>({ok:true})),
    returnHome:()=>{document.querySelector('[data-page-target="inicio"]')?.click();return ok();},
    verifyPreviewAccess:()=>ok(),
    savePlatformSession:async(token,remember=true)=>{
      if(typeof token!=='string'||!token){return {ok:false,message:'Token de sessão inválido.'};}
      try{
        if(remember){
          localStorage.setItem(sessionKey,token);
          sessionStorage.removeItem(sessionKey);
          await writePersistentSession(token);
          const saved=await readPersistentSession();
          if(saved!==token)throw new Error('Não foi possível confirmar a gravação da sessão.');
          if(navigator.storage?.persist)void navigator.storage.persist().catch(()=>{});
        }else{
          sessionStorage.setItem(sessionKey,token);
          localStorage.removeItem(sessionKey);
          await clearPersistentSession().catch(()=>{});
        }
        return {ok:true};
      }catch(error){
        return {ok:false,message:'Não foi possível manter o login salvo neste navegador. Verifique as permissões de armazenamento.'};
      }
    },
    restorePlatformSession:async()=>{
      let token=null;
      try{token=localStorage.getItem(sessionKey);}catch{}
      if(!token){try{token=await readPersistentSession();}catch{}}
      if(!token){try{token=sessionStorage.getItem(sessionKey);}catch{}}
      return {token:token||null};
    },
    clearPlatformSession:async()=>{
      try{localStorage.removeItem(sessionKey);}catch{}
      try{sessionStorage.removeItem(sessionKey);}catch{}
      await clearPersistentSession().catch(()=>{});
      return ok();
    },
    setVoiceMicrophoneAllowed:()=>ok(),
    requestInlineCallCamera:()=>ok(),
    releaseInlineCallCamera:()=>ok(),
    listInlineCallSources:()=>ok({sources:[]}),
    selectInlineCallSource:()=>ok(),
    clearInlineCallSource:()=>ok(),
    openStream:()=>unsupported('Janela separada de transmissão'),
    getStreamConfig:()=>unsupported('Configuração Electron'),
    getCaptureSources:()=>ok({sources:[]}),
    selectCaptureSource:()=>unsupported('Captura Electron'),
    requestCameraAccess:()=>ok(),
    copyText:value=>navigator.clipboard.writeText(value).then(()=>ok()),
    saveStreamSnapshot:()=>unsupported('Salvar captura pelo Electron'),
  };
  window.addEventListener('DOMContentLoaded',()=>{
    const params=new URLSearchParams(location.search);
    if(params.get('app')==='1'){
      // A rota web abre diretamente a mesma interface do PC, sem barreira visual do Electron.
      document.getElementById('enter-brasilcord')?.click();
      if(params.get('cadastro')==='1'){
        document.getElementById('bc-platform-toggle-auth')?.click();
      }
      if(params.get('install')==='1'){
        document.getElementById('bc-install-button')?.click();
      }
    }
    if('serviceWorker' in navigator && location.protocol==='https:'){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  });
})();