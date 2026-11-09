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
    savePlatformSession:token=>{
      // Armazenamento por aba: evita colocar token de autenticação em localStorage persistente.
      sessionStorage.setItem(sessionKey,token);return ok();
    },
    restorePlatformSession:()=>Promise.resolve({token:sessionStorage.getItem(sessionKey)||null}),
    clearPlatformSession:()=>{sessionStorage.removeItem(sessionKey);return ok();},
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
      const button=document.querySelector('[data-page-target="app"]');
      if(button)button.click();
      else document.querySelector('[data-bc-view="chat"]')?.click();
    }
    if('serviceWorker' in navigator && location.protocol==='https:'){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  });
})();