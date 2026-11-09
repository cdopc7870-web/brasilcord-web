'use strict';
// O BrasilCord não coleta pagamentos: direciona para a página oficial RedeArk.
(()=>{
  const button=document.getElementById('bc-support-rail');
  const dialog=document.getElementById('bc-support-dialog');
  const message=document.getElementById('bc-support-status');
  const url='https://www.redeark.com/produtos?categoria=brasilcord';
  if(!button)return;
  button.title='Doe aqui · ajude a manter o BrasilCord online';
  button.setAttribute('aria-label','Apoiar o BrasilCord pela RedeArk');
  async function openSupport(){
    button.disabled=true;
    try{
      const result=await window.brasilcord.openBrasilCordSupportPage();
      if(!result?.ok)throw Error(result?.message||'Não foi possível abrir o navegador.');
      if(dialog?.open)dialog.close();
    }catch(error){
      if(dialog&&!dialog.open)dialog.showModal();
      if(message)message.textContent=error.message+' Use o link oficial abaixo.';
    }finally{button.disabled=false;}
  }
  button.addEventListener('click',()=>void openSupport());
  document.getElementById('bc-support-close')?.addEventListener('click',()=>dialog?.close());
  document.getElementById('bc-support-open')?.addEventListener('click',()=>void openSupport());
  document.getElementById('bc-support-copy-link')?.addEventListener('click',async()=>{
    const result=await window.brasilcord.copySupportLink(url);
    if(message)message.textContent=result?.ok?'Link da página RedeArk copiado.':result?.message||'Não foi possível copiar.';
  });
})();