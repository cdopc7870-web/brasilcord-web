'use strict';
// Extras da plataforma BrasilCord. Token apenas em memoria; nunca em localStorage.
(() => {
  const $=id=>document.getElementById(id);
  const BASE='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  let token=null,user=null,community=null;
  const feedback=message=>{$('bc-platform-status').textContent=message;};
  const node=(tag,text,cls)=>{
    const el=document.createElement(tag);
    if(text!=null)el.textContent=text;
    if(cls)el.className=cls;
    return el;
  };
  async function req(path,method='GET',data){
    if(!token)throw new Error('Entre com sua conta primeiro.');
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),16000);
    try{
      const response=await fetch(BASE+path,{
        method,cache:'no-store',signal:abort.signal,
        headers:{Accept:'application/json',Authorization:'Bearer '+token,...(data===undefined?{}:{'Content-Type':'application/json'})},
        ...(data===undefined?{}:{body:JSON.stringify(data)})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||'Falha no serviço ('+response.status+').');
      return payload;
    }finally{clearTimeout(timeout);}
  }
  function showImage(img,url){
    img.hidden=!url;
    if(url){img.src=url;}
    else{img.removeAttribute('src');}
  }
  function showProfile(p){
    user=p||null;
    showImage($('bc-profile-avatar-photo'),p?.avatarUrl);
    showImage($('bc-profile-cover-photo'),p?.bannerUrl);
    $('bc-profile-avatar').style.opacity=p?.avatarUrl?'0':'1';
    const preview=$('bc-badge-preview');
    preview.replaceChildren();
    const equipped=p?.equippedBadges||[];
    if(equipped.length){
      for(const badge of equipped.filter(id=>/^(criador_app|tester|bug_hunter|beta)$/.test(id))){
        const img=node('img');img.src='assets/badges/'+badge+'.svg';img.alt='Insígnia '+badge;img.width=46;img.height=46;
        preview.append(img);
      }
      preview.append(node('span','Insígnias equipadas: '+equipped.length));
    }else preview.append(node('span','Nenhuma insígnia equipada.'));

    const dock=$('bc-user-avatar');
    const previous=dock.querySelector('img');
    if(previous)previous.remove();
    if(p?.avatarUrl){
      const image=node('img');image.src=p.avatarUrl;image.alt='';
      dock.append(image);
    }
  }
  async function discover(){
    if(!token)return;
    const category=$('bc-discover-category').value,sort=$('bc-discover-sort').value;
    const list=$('bc-discover-list');list.replaceChildren();
    $('bc-discover-info').textContent='Carregando comunidades públicas…';
    try{
      const result=await req('/discover?category='+encodeURIComponent(category)+'&sort='+encodeURIComponent(sort));
      $('bc-discover-info').textContent='Ativos agora considera usuários conectados a este servidor e não representa uma contagem global.';
      if(!result.communities.length){
        list.append(node('p','Nenhuma comunidade pública nesta categoria. Você pode publicar uma comunidade própria.','bc-empty'));
        return;
      }
      for(const c of result.communities){
        const card=node('article',null,'bc-discover-card');
        const avatar=node('span',c.name.slice(0,2).toUpperCase(),'bc-discover-avatar');
        const text=node('div',null,'bc-discover-card-body');
        text.append(node('strong',c.name),node('p',c.description||'Comunidade do BrasilCord'),
          node('small',String(c.member_count)+' membros · '+String(c.active_count)+' conectados · '+c.category));
        const btn=node('button',c.joined?'Já participo':'Entrar');
        btn.type='button';btn.disabled=Boolean(c.joined);
        btn.addEventListener('click',async()=>{
          btn.disabled=true;
          try{
            await req('/discover/'+c.id+'/join','POST',{});
            btn.textContent='Participando';
            feedback('Você entrou na comunidade '+c.name+'.');
            document.dispatchEvent(new CustomEvent('bc:community-joined',{detail:{id:c.id}}));
          }catch(e){feedback(e.message);btn.disabled=false;}
        });
        card.append(avatar,text,btn);list.append(card);
      }
    }catch(e){list.replaceChildren();$('bc-discover-info').textContent=e.message;}
  }
  $('bc-discover-category').addEventListener('change',()=>void discover());
  $('bc-discover-sort').addEventListener('change',()=>void discover());
  $('bc-discover-refresh').addEventListener('click',()=>void discover());
  document.querySelectorAll('#page-app [data-bc-view="discover"]').forEach(btn=>{
    btn.addEventListener('click',()=>void discover());
  });

  async function loadBlocks(){
    if(!token)return;
    const list=$('bc-block-list');list.replaceChildren();
    try{
      const result=await req('/blocks');
      if(!result.blocked.length){list.append(node('p','Nenhuma pessoa bloqueada.','bc-empty'));return;}
      for(const p of result.blocked){
        const row=node('div',null,'bc-block-person');
        row.append(node('span',p.displayName+' · @'+p.username));
        const btn=node('button','Desbloquear');btn.type='button';
        btn.addEventListener('click',async()=>{
          btn.disabled=true;
          try{
            await req('/blocks/'+p.id,'DELETE');
            await loadBlocks();
            feedback('Usuário desbloqueado.');
          }catch(e){feedback(e.message);btn.disabled=false;}
        });
        row.append(btn);list.append(row);
      }
    }catch(e){list.append(node('p',e.message,'bc-empty'));}
  }
  $('bc-block-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const username=new FormData(form).get('username');
    if(!window.confirm('Bloquear @'+username+'? Ele será removido dos amigos e as mensagens dele serão ocultadas para você.'))return;
    try{
      await req('/blocks','POST',{username});
      form.reset();feedback('Usuário bloqueado.');
      await loadBlocks();
      document.dispatchEvent(new CustomEvent('bc:refresh-friends'));
    }catch(e){feedback(e.message);}
  });
  document.querySelectorAll('#page-app [data-bc-view="friends"]').forEach(btn=>btn.addEventListener('click',()=>void loadBlocks()));

  async function loadBadges(){
    if(!token)return;
    const list=$('bc-badge-list');list.replaceChildren();
    try{
      const payload=await req('/me/badges');
      for(const badge of payload.badges){
        const box=node('button',null,'bc-badge-choice');
        box.type='button';box.disabled=!badge.unlocked;
        box.title=badge.description;
        const equipped=(payload.equipped||[]).includes(badge.id);
        box.setAttribute('aria-pressed',String(equipped));
        const img=node('img');img.src='assets/badges/'+badge.asset;img.alt='';
        box.append(img,node('span',(equipped?'✓ ':'')+badge.name+(badge.unlocked?'':' · bloqueada')));
        box.addEventListener('click',async()=>{
          try{
            const next=equipped?(payload.equipped||[]).filter(id=>id!==badge.id):[...(payload.equipped||[]),badge.id];
            const result=await req('/me/badges','PATCH',{equippedIds:next});
            if(user){
              const updated={...user,selectedBadge:result.selected,equippedBadges:result.equipped};
              showProfile(updated);
              document.dispatchEvent(new CustomEvent('bc:profile-media',{detail:updated}));
            }
            feedback(equipped?'Insígnia removida do perfil.':'Insígnia equipada.');
            await loadBadges();
          }catch(e){feedback(e.message);}
        });
        list.append(box);
      }
    }catch(e){list.append(node('p',e.message,'bc-empty'));}
  }
  document.querySelectorAll('#page-app [data-bc-view="profile"]').forEach(btn=>btn.addEventListener('click',()=>void loadBadges()));

  async function upload(kind,file){
    const max=kind==='avatar'?1500000:3000000;
    if(!file)return;
    const label=kind==='avatar'?'Foto':'Banner';
    if(file.size>max){$('bc-media-status').textContent='Arquivo muito grande. Reduza o tamanho.';return;}
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){$('bc-media-status').textContent='Use PNG, JPG, WebP ou GIF.';return;}
    $('bc-media-status').textContent='Enviando '+label.toLowerCase()+'…';
    const bytes=await file.arrayBuffer();
    const uint=new Uint8Array(bytes);
    let binary='';
    for(let offset=0;offset<uint.length;offset+=8192)binary+=String.fromCharCode(...uint.subarray(offset,offset+8192));
    try{
      const result=await req('/me/media/'+kind,'PUT',{data:btoa(binary)});
      if(user){
        const next={...user,[kind==='avatar'?'avatarUrl':'bannerUrl']:result.url};
        showProfile(next);
        document.dispatchEvent(new CustomEvent('bc:profile-media',{detail:next}));
      }
      $('bc-media-status').textContent=label+' atualizado(a). GIFs animados são aceitos.';
    }catch(e){$('bc-media-status').textContent=e.message;}
  }
  $('bc-avatar-file').addEventListener('change',e=>{void upload('avatar',e.target.files?.[0]);e.target.value='';});
  $('bc-banner-file').addEventListener('change',e=>{void upload('banner',e.target.files?.[0]);e.target.value='';});
  for(const kind of ['avatar','banner']){
    $('bc-'+kind+'-remove').addEventListener('click',async()=>{
      try{
        await req('/me/media/'+kind,'DELETE');
        if(user){
          const next={...user,[kind==='avatar'?'avatarUrl':'bannerUrl']:null};
          showProfile(next);
          document.dispatchEvent(new CustomEvent('bc:profile-media',{detail:next}));
        }
        $('bc-media-status').textContent='Imagem removida.';
      }catch(e){$('bc-media-status').textContent=e.message;}
    });
  }
  function loadSettings(){
    const details=$('bc-community-public-settings');
    details.hidden=community?.role!=='owner';
    if(!community)return;
    const form=$('bc-community-settings-form');
    form.elements.visibility.value=community.visibility||'private';
    form.elements.category.value=community.category||'outros';
    form.elements.description.value=community.description||'';
  }
  $('bc-community-settings-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!community)return;
    const form=event.currentTarget,body=Object.fromEntries(new FormData(form));
    try{
      const result=await req('/communities/'+community.id+'/settings','PATCH',body);
      community={...community,...result.community};
      loadSettings();
      feedback('Divulgação atualizada. '+(community.visibility==='public'?'Comunidade visível em Explorar.':'Comunidade privada.'));
    }catch(e){feedback(e.message);}
  });
  const ownerPanel=$('bc-owner-badge-panel');
  async function manageBadge(method){
    if(!user?.isAppOwner)return;
    const username=$('bc-owner-badge-username').value.trim().toLowerCase();
    const badgeId=$('bc-owner-badge-type').value;
    const output=$('bc-owner-badge-status');
    if(!/^[a-z0-9_]{3,28}$/.test(username)){output.textContent='Informe um usuário válido.';return;}
    if(method==='DELETE' && !window.confirm('Retirar a insígnia '+badgeId+' de @'+username+'?'))return;
    try {
      const result=await req('/admin/badges',method,{username,badgeId});
      output.textContent=method==='POST'?'Insígnia concedida a @'+result.username+'.':'Insígnia retirada de @'+result.username+'.';
      if(username===user.username)await loadBadges();
    }catch(err){output.textContent=err.message;}
  }
  $('bc-owner-badge-grant').addEventListener('click',()=>void manageBadge('POST'));
  $('bc-owner-badge-revoke').addEventListener('click',()=>void manageBadge('DELETE'));

  document.addEventListener('bc:platform-state',event=>{
    const e=event.detail||{};
    if(e.type==='voice-session'){token=e.token||null;if(!token){$('bc-block-list').replaceChildren();$('bc-badge-list').replaceChildren();}}
    if(e.type==='user'){showProfile(e.user);ownerPanel.hidden=!e.user?.isAppOwner;}
    if(e.type==='logout'){token=null;community=null;showProfile(null);ownerPanel.hidden=true;loadSettings();}
    if(e.type==='community'){community=e.community;loadSettings();}
  });
})();
