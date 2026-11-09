'use strict';
(function(){
  const links=[...document.querySelectorAll('.docs-toc a')];
  if(!links.length || !('IntersectionObserver' in window)) return;
  const map=new Map(links.map(link=>[decodeURIComponent(link.hash.slice(1)),link]));
  const sections=[...document.querySelectorAll('.docs-chapter[id]')];
  let current=sections[0]?.id||'';
  function select(id){
    current=id;
    links.forEach(link=>{
      const selected=link===map.get(id);
      link.classList.toggle('active',selected);
      if(selected)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }
  const observer=new IntersectionObserver(()=>{
    const visible=sections.filter(s=>s.getBoundingClientRect().top<innerHeight*.45);
    select(visible.length?visible[visible.length-1].id:sections[0]?.id||current);
  },{rootMargin:'-15% 0px -60% 0px',threshold:0});
  sections.forEach(section=>observer.observe(section));
  links.forEach(link=>link.addEventListener('click',()=>select(decodeURIComponent(link.hash.slice(1)))));
  if(location.hash && map.has(decodeURIComponent(location.hash.slice(1))))select(decodeURIComponent(location.hash.slice(1)));
  else select(current);
})();
