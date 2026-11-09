'use strict';
(function(){
  const root=document.body;
  const themeButtons=[...document.querySelectorAll('[data-set-theme]')];
  const menuButton=document.querySelector('.mobile-menu-toggle');
  const menu=document.getElementById('header-menu');
  const systemDark=window.matchMedia('(prefers-color-scheme: dark)');
  function readTheme(){const fallback=root.dataset.theme==='light'?'light':'dark';try{return localStorage.getItem('brasilcord-landing-theme')||fallback}catch{return fallback}}
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

  // Motion effects are progressive enhancement: content remains visible without JS or observers.
  (function setupMotion(){
    if (!document.querySelector('link[href="motion.css"]')) {
      const stylesheet=document.createElement('link');
      stylesheet.rel='stylesheet';
      stylesheet.href='motion.css';
      document.head.appendChild(stylesheet);
    }
    const prefersReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion || !('IntersectionObserver' in window))return;
    const selectors=[
      '.features-section .section-head',
      '.feature-card',
      '.safety-grid > *',
      '.how-heading > *',
      '.step',
      '.join-strip',
      '.partner-hero > *',
      '.partner-heading',
      '.partner-card',
      '.partner-cta',
      '.download-hero > *',
      '.download-card',
      '.download-trust',
      '.download-guide > *',
      '.download-steps > *',
      '.social-download > *',
      '.download-faq > *'
    ];
    const nodes=[...document.querySelectorAll(selectors.join(','))];
    if(!nodes.length)return;
    const observer=new IntersectionObserver((entries)=>{
      for(const entry of entries){
        if(entry.isIntersecting){
          entry.target.classList.add('bc-visible');
          observer.unobserve(entry.target);
        }
      }
    },{threshold:.08,rootMargin:'0px 0px 45px 0px'});
    nodes.forEach((el,index)=>{
      el.setAttribute('data-bc-reveal','');
      el.dataset.bcRevealDelay=String(index%3);
      // Initial viewport content is never temporarily hidden.
      if(el.getBoundingClientRect().top<window.innerHeight+45)el.classList.add('bc-visible');
      else observer.observe(el);
    });
    document.body.classList.add('motion-ready');
  })();
})();
