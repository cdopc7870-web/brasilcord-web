'use strict';
// Programa Beta: dados e posições são calculados exclusivamente no servidor.
(()=>{
  const $=id=>document.getElementById(id);
  const dialog=$('bc-beta-invite-dialog'),rail=$('bc-beta-invite-rail');
  if(!dialog||!rail)return;
  const API='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  const SHARE_URL='https://cdopc7870-web.github.io/brasilcord-updates/';
  let token=null,user=null,lastSend=0,loading=false;
  const status=$('bc-beta-invite-status');
  const message=(text,error=false)=>{status.textContent=text;status.dataset.error=String(error);};
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=String(text);if(cls)node.className=cls;return node;};
  async function api(path,method='GET',data){
    if(!token)throw Error('Entre na sua conta BrasilCord para acessar o programa Beta.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
    try{
      const response=await fetch(API+path,{
        method,signal:controller.signal,cache:'no-store',credentials:'omit',
        headers:{Accept:'application/json',Authorization:'Bearer '+token,...(data===undefined?{}:{'Content-Type':'application/json'})},
        ...(data===undefined?{}:{body:JSON.stringify(data)})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(result.error||'Erro HTTP '+response.status);
      return result;
    }finally{clearTimeout(timer);}
  }
  const invitationText=beta=>{
    const offer=beta?.remaining>0?'As primeiras 100 contas ganham a insígnia Beta • Fundador! ':'';
    return '🇧🇷 Convite BrasilCord! '+offer+'Entre para conversar, criar comunidades e fazer chamadas: '+SHARE_URL;
  };
  async function copy(){
    const result=await window.brasilcord.copyBrasilCordInvite();
    if(!result?.ok)throw Error(result?.message||'Não foi possível copiar o convite.');
    message('Link oficial do BrasilCord copiado! Envie aos seus amigos.');
  }
  async function load(){
    if(!token||loading)return;
    loading=true;
    const host=$('bc-beta-invite-friends');host.replaceChildren();
    $('bc-beta-invite-count').textContent='Buscando vagas Beta…';
    try{
      const [beta,friendData]=await Promise.all([api('/beta'),api('/friends')]);
      if(!token)return;
      const open=Math.max(0,Number(beta.remaining)||0),filled=Math.max(0,Number(beta.claimed)||0);
      $('bc-beta-invite-count').textContent=open?open+' vagas restantes • '+filled+'/100 fundadores':'100/100 vagas preenchidas';
      $('bc-beta-invite-my-status').textContent=beta.hasBadge
        ?'🏅 Você é Fundador Beta #'+beta.slot+'!'
        :open?'Você ainda não está entre os 100 primeiros cadastrados.':'A campanha Beta já atingiu 100 fundadores.';
      const friends=(friendData.friends||[]).filter(person=>person.status==='accepted');
      if(!friends.length)host.append(el('p','Adicione um amigo para enviar o convite diretamente pelo chat.'));
      for(const p of friends.slice(0,100)){
        const row=el('div',null,'bc-beta-friend'),name=el('span',(p.displayName||p.username)+' · @'+p.username);
        const send=el('button','Enviar convite');send.type='button';
        send.addEventListener('click',async()=>{
          if(Date.now()-lastSend<2500){message('Aguarde antes de enviar outro convite.',true);return;}
          lastSend=Date.now();send.disabled=true;message('Enviando para @'+p.username+'…');
          try{
            await api('/dms/'+encodeURIComponent(p.id),'POST',{content:invitationText(beta)});
            send.textContent='✓ Enviado';
            message('Convite enviado por mensagem privada para @'+p.username+'.');
          }catch(err){message(err.message,true);send.disabled=false;}
        });
        row.append(name,send);host.append(row);
      }
    }catch(err){
      $('bc-beta-invite-count').textContent='Vagas indisponíveis no momento';
      host.replaceChildren(el('p','Não foi possível carregar a lista de amigos.'));
      message(err.message,true);
    }finally{loading=false;}
  }
  rail.addEventListener('click',()=>{
    if(!dialog.open)dialog.showModal();
    message('');
    if(token)void load();
    else{
      $('bc-beta-invite-count').textContent='Insígnia Beta • 100 fundadores';
      $('bc-beta-invite-my-status').textContent='Entre com sua conta para consultar a sua posição.';
      $('bc-beta-invite-friends').replaceChildren(el('p','Entre na sua conta para compartilhar diretamente com amigos.'));
    }
  });
  $('bc-beta-invite-close').addEventListener('click',()=>dialog.close());
  for(const id of ['bc-beta-invite-copy','bc-beta-invite-share'])$(id).addEventListener('click',()=>void copy().catch(e=>message(e.message,true)));
  document.addEventListener('bc:platform-state',event=>{
    const e=event.detail||{};
    if(e.type==='user')user=e.user||null;
    if(e.type==='voice-session'){
      token=e.token||null;
      if(token&&dialog.open)void load();
    }
    if(e.type==='logout'){token=null;user=null;if(dialog.open)dialog.close();}
  });
})();
