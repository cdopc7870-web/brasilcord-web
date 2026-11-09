'use strict';
(function(){
  const root=document.body;
  const themeButtons=[...document.querySelectorAll('[data-set-theme]')];
  const menuButton=document.querySelector('.mobile-menu-toggle');
  const menu=document.getElementById('header-menu');
  const systemDark=window.matchMedia('(prefers-color-scheme: dark)');
  function readTheme(){try{return localStorage.getItem('brasilcord-landing-theme')||'dark'}catch{return'dark'}}
  function applyTheme(mode){
    if(!['auto','light','dark'].includes(mode))mode='auto';
    root.dataset.theme=mode==='auto'?(systemDark.matches?'dark':'light'):mode;
    themeButtons.forEach(button=>{const selected=button.dataset.setTheme===mode;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected))});
  }
  applyTheme(readTheme());
  themeButtons.forEach(button=>button.addEventListener('click',()=>{
    const mode=button.dataset.setTheme;
    try{localStorage.setItem('brasilcord-landing-theme',mode)}catch{}
    applyTheme(mode);
  }));
  if(typeof systemDark.addEventListener==='function')systemDark.addEventListener('change',()=>{if(readTheme()==='auto')applyTheme('auto')});
  if(menuButton&&menu){
    menuButton.addEventListener('click',()=>{const opened=menu.classList.toggle('open');menuButton.setAttribute('aria-expanded',String(opened));menuButton.setAttribute('aria-label',opened?'Fechar menu':'Abrir menu')});
    menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{menu.classList.remove('open');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Abrir menu')}));
  }
  const year=document.getElementById('footer-year');if(year)year.textContent=String(new Date().getFullYear());
})();
