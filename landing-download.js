'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const button=document.getElementById('bc-home-install');
 if(!button)return;
 button.addEventListener('click',()=>{
   const install=document.getElementById('bc-install-button');
   const help=document.getElementById('bc-install-help');
   if(install){install.click();return;}
   if(help&&typeof help.showModal==='function')help.showModal();
 });
});
