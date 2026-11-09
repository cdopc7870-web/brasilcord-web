'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const buttons=[document.getElementById('bc-home-install'),document.getElementById('bc-hero-install')].filter(Boolean);
 for(const button of buttons)button.addEventListener('click',()=>{
   const install=document.getElementById('bc-install-button');
   const help=document.getElementById('bc-install-help');
   if(install){install.click();return;}
   if(help&&typeof help.showModal==='function')help.showModal();
 });
 document.getElementById('bc-top-download')?.addEventListener('click',event=>{
   const destination=document.getElementById('baixar');
   if(!destination)return;
   event.preventDefault();
   document.querySelector('[data-page-target="inicio"]')?.click();
   destination.scrollIntoView({behavior:'smooth',block:'start'});
 });
});
