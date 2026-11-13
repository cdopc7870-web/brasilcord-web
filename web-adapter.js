'use strict';
// Camada de compatibilidade para executar a interface Electron diretamente no navegador.
(() => {
  const ok=(extra={})=>Promise.resolve({ok:true,...extra});
  const unsupported=(name)=>Promise.resolve({ok:false,message:name+' requer o aplicativo Windows.'});
  const invite='https://discord.gg/XaHwEDse99';
  const open=url=>{window.open(url,'_blank','noopener,noreferrer');return ok();};
  const sessionKey='brasilcord:web:session';
  const prefKey='brasilcord:web:invite-confirmed';
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
    savePlatformSession:(token,remember=true)=>{
      // Sessão persistente só quando a pessoa marca "Manter conectado".
      if(remember){localStorage.setItem(sessionKey,token);sessionStorage.removeItem(sessionKey);}
      else{sessionStorage.setItem(sessionKey,token);localStorage.removeItem(sessionKey);}
      return ok();
    },
    restorePlatformSession:()=>Promise.resolve({token:localStorage.getItem(sessionKey)||sessionStorage.getItem(sessionKey)||null}),
    clearPlatformSession:()=>{localStorage.removeItem(sessionKey);sessionStorage.removeItem(sessionKey);return ok();},
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