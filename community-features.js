'use strict';
// Gerenciamento de comunidade e mensagens privadas da plataforma BrasilCord.
(() => {
  const $=id=>document.getElementById(id);
  if(!$('bc-role-create'))return;
  const BASE='https://brasilcord-sinalizacao-dkx157.onrender.com/api/platform';
  const RIGHTS=['view_channels','send_messages','connect_voice','create_invites','manage_channels','manage_roles','server_mute','server_deafen','disconnect_voice','timeout_members','kick_members','ban_members'];
  let token=null,community=null,channels=[],roles=[],categories=[],members=[];
  let editRoleId=null,peer=null,friendList=[],imageRequests=new Map();
  const status=msg=>{$('bc-platform-status').textContent=msg;};
  const node=(tag,content,cls)=>{
    const el=document.createElement(tag);
    if(content!=null)el.textContent=String(content);
    if(cls)el.className=cls;
    return el;
  };
  async function request(path,method='GET',data) {
    if(!token)throw new Error('Faça login para usar este recurso.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const resp=await fetch(BASE+path,{method,signal:controller.signal,cache:'no-store',
        headers:{Accept:'application/json',Authorization:'Bearer '+token,...(data===undefined?{}:{'Content-Type':'application/json'})},
        ...(data===undefined?{}:{body:JSON.stringify(data)})});
      const payload=await resp.json().catch(()=>({}));
      if(!resp.ok)throw new Error(payload.error||'Erro HTTP '+resp.status);
      return payload;
    }finally{clearTimeout(timer);}
  }
  function menu(select,items,placeholder,selected) {
    select.replaceChildren();
    const blank=node('option',placeholder||'Nenhuma');
    blank.value='';
    select.append(blank);
    for(const item of items){
      const opt=node('option',item.name);
      opt.value=item.id;
      select.append(opt);
    }
    select.value=selected||'';
  }
  function rolePermissions(form) {
    return Object.fromEntries(RIGHTS.map(id=>[id,Boolean(form.elements[id]?.checked)]));
  }
  function setRoleForm(role){
    editRoleId=role?.id||null;
    const form=$('bc-role-create');
    form.elements.name.value=role?.name||'';
    form.elements.color.value=role?.color||'#00c853';
    for(const right of RIGHTS) form.elements[right].checked=role?Boolean(role.permissions?.[right]):['view_channels','send_messages','connect_voice'].includes(right);
    form.querySelector('button[type=submit]').textContent=role?'Salvar alterações':'Criar cargo';
  }
  async function loadManagement(){
    const box=$('bc-community-manage');
    box.hidden=!(community?.permissions?.manage_channels||community?.permissions?.manage_roles||community?.role==='owner');
    if(!community||!token)return;
    if(box.hidden)return;
    const id=community.id;
    try{
      const [rr,cc,mm]=await Promise.all([
        request('/communities/'+id+'/roles'),
        request('/communities/'+id+'/categories'),
        request('/communities/'+id+'/members')
      ]);
      if(community?.id!==id)return;
      roles=rr.roles||[];categories=cc.categories||[];members=mm.members||[];
      const owner=Boolean(community.permissions?.manage_roles);
      const channelManager=Boolean(community.permissions?.manage_channels);
      $('bc-category-create').hidden=!channelManager;
      $('bc-channel-config').hidden=!channelManager;
      $('bc-community-image').hidden=!channelManager;
      $('bc-community-image-remove').hidden=!channelManager;
      $('bc-role-create').hidden=!owner;
      $('bc-role-list').replaceChildren();
      for(const role of roles){
        const row=node('div',null,'bc-management-row');
        const badge=node('span',role.name,'bc-custom-role-pill');
        badge.style.color=role.color;
        row.dataset.bcContextType='role';row.dataset.bcContextId=role.id;row.dataset.bcContextName=role.name;
        row.append(badge);
        if(owner){
          const edit=node('button','Editar');edit.type='button';
          edit.addEventListener('click',()=>{setRoleForm(role);$('bc-role-create').scrollIntoView({block:'nearest'});});
          const remove=node('button','Excluir');remove.type='button';
          remove.addEventListener('click',async()=>{
            if(!confirm('Excluir o cargo '+role.name+'? Os membros perderão esse cargo.'))return;
            try{await request('/communities/'+id+'/roles/'+role.id,'DELETE');setRoleForm(null);await loadManagement();status('Cargo excluído.');}
            catch(e){status(e.message);}
          });
          row.append(edit,remove);
        }
        $('bc-role-list').append(row);
      }
      if(!roles.length)$('bc-role-list').append(node('p','Nenhum cargo personalizado criado. Use o formulário acima para criar seu primeiro cargo, escolher uma cor e definir as permissões.','bc-empty'));
      const everyone=$('bc-role-members');everyone.replaceChildren();
      if(owner){
        for(const m of members){
          if(m.role==='owner')continue;
          const row=node('div',null,'bc-management-row');
          row.dataset.bcUserId=m.id;
          row.append(node('span',m.display_name||m.username));
          const select=node('select');
          menu(select,roles,'Sem cargo personalizado',m.custom_role_id);
          select.setAttribute('aria-label','Cargo de '+(m.display_name||m.username));
          select.addEventListener('change',async()=>{
            try{await request('/communities/'+id+'/members/'+m.id+'/custom-role','PATCH',{roleId:select.value||null});status('Cargo atribuído.');}
            catch(e){status(e.message);select.value=m.custom_role_id||'';}
          });
          row.append(select);everyone.append(row);
        }
      }else everyone.append(node('p','Apenas o dono da comunidade pode atribuir cargos.','bc-empty'));

      const categoryOptions=categories.map(c=>({id:c.id,name:c.name}));
      const channelOptions=channels.map(c=>({id:c.id,name:(c.kind==='voice'?'◉ ':'# ')+c.name}));
      document.dispatchEvent(new CustomEvent('bc:management-data',{detail:{communityId:id,roles:roles.map(r=>({...r})),categories:categories.map(cat=>({...cat})),channels:channels.map(ch=>({...ch})),members:members.map(m=>({...m}))}}));
      for(const idSelect of ['bc-category-role','bc-config-role'])
        menu($(idSelect),roles,'Todos os membros');
      menu($('bc-config-category'),categoryOptions,'Sem categoria');
      menu($('bc-config-channel'),channelOptions,'Selecione um canal');
      $('bc-category-list').replaceChildren();
      for(const cat of categories){
        const row=node('div',null,'bc-management-row');
        const restriction=roles.find(r=>r.id===cat.min_role_id);
        row.dataset.bcContextType='category';row.dataset.bcContextId=cat.id;row.dataset.bcContextName=cat.name;
        row.append(node('span',cat.name+(restriction?' · '+restriction.name:'')));
        if(channelManager){
          const edit=node('button','Editar');edit.type='button';
          edit.addEventListener('click',async()=>{
            const name=window.prompt('Novo nome da categoria:',cat.name);
            if(name===null)return;
            if(name.trim().length<2||name.trim().length>40){status('Nome da categoria deve ter de 2 a 40 caracteres.');return;}
            try{
              await request('/communities/'+id+'/categories/'+cat.id,'PATCH',{name:name.trim(),minRoleId:cat.min_role_id||null});
              await loadManagement();status('Categoria atualizada.');
              document.dispatchEvent(new CustomEvent('bc:refresh-current-community',{detail:{id}}));
            }catch(e){status(e.message);}
          });
          row.append(edit);
        }
        const remove=node('button','Excluir');remove.type='button';
        remove.addEventListener('click',async()=>{
          if(!confirm('Excluir a categoria '+cat.name+'? Os canais não serão excluídos.'))return;
          try{await request('/communities/'+id+'/categories/'+cat.id,'DELETE');await loadManagement();status('Categoria excluída.');}
          catch(e){status(e.message);}
        });
        row.append(remove);$('bc-category-list').append(row);
      }
    }catch(e){status(e.message);}
  }
  $('bc-role-create').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!community||community.role!=='owner')return;
    const form=event.currentTarget;
    const data={name:form.elements.name.value.trim(),color:form.elements.color.value,permissions:rolePermissions(form)};
    try{
      const id=community.id;
      await request('/communities/'+id+'/roles'+(editRoleId?'/'+editRoleId:''),editRoleId?'PATCH':'POST',data);
      setRoleForm(null);await loadManagement();status('Cargo salvo com sucesso.');
    }catch(e){status(e.message);}
  });
  $('bc-category-create').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!community)return;
    const form=event.currentTarget;
    try{
      await request('/communities/'+community.id+'/categories','POST',{
        name:form.elements.name.value.trim(),minRoleId:form.elements.minRoleId.value||null});
      form.reset();await loadManagement();status('Categoria criada.');
    }catch(e){status(e.message);}
  });
  $('bc-channel-config').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!community)return;
    const form=event.currentTarget,channelId=form.elements.channelId.value;
    if(!channelId){status('Escolha um canal.');return;}
    try{
      await request('/communities/'+community.id+'/channels/'+channelId+'/settings','PATCH',{
        categoryId:form.elements.categoryId.value||null,minRoleId:form.elements.minRoleId.value||null});
      status('Permissões do canal salvas. Os membros verão somente os canais permitidos.');
      document.dispatchEvent(new CustomEvent('bc:refresh-current-community',{detail:{id:community.id}}));
    }catch(e){status(e.message);}
  });
  async function dataUrlFromBytes(bytes,mime){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);
      reader.onerror=reject;reader.readAsDataURL(new Blob([bytes],{type:mime}));
    });
  }
  async function showCommunityImage(id,button){
    if(!token||!button)return;
    const key=id+':'+token.slice(0,8);
    try{
      let data=imageRequests.get(key);
      if(!data){
        const res=await fetch(BASE+'/community-images/'+id,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
        if(!res.ok)return;
        const mime=res.headers.get('Content-Type')||'image/png';
        data=await dataUrlFromBytes(await res.arrayBuffer(),mime);
        imageRequests.set(key,data);
      }
      if(button.isConnected){
        const image=node('img');image.alt='';
        image.className='bc-community-photo';image.src=data;
        button.replaceChildren(image);
      }
    }catch{}
  }
  async function putImage(file){
    if(!community||!file)return;
    if(file.size>1500000||!['image/png','image/jpeg','image/webp'].includes(file.type)){
      status('Use JPG, PNG ou WebP de até 1,5 MB.');return;
    }
    const uint=new Uint8Array(await file.arrayBuffer());
    let binary='';for(let i=0;i<uint.length;i+=8192)binary+=String.fromCharCode(...uint.subarray(i,i+8192));
    try{
      await request('/communities/'+community.id+'/media','PUT',{data:btoa(binary)});
      imageRequests.clear();
      document.dispatchEvent(new CustomEvent('bc:refresh-communities'));
      status('Foto da comunidade atualizada.');
    }catch(e){status(e.message);}
  }
  $('bc-community-image').addEventListener('change',event=>{
    void putImage(event.target.files?.[0]);event.target.value='';
  });
  $('bc-community-image-remove').addEventListener('click',async()=>{
    if(!community)return;
    try{
      await request('/communities/'+community.id+'/media','DELETE');
      imageRequests.clear();document.dispatchEvent(new CustomEvent('bc:refresh-communities'));
      status('Foto da comunidade removida.');
    }catch(e){status(e.message);}
  });

  // Mensagens privadas com identidade real e notas de voz autenticadas.
  let me=null,recorder=null,recordStream=null,recordTimer=null,recordStarted=0;
  let recorderChunks=[],discardRecording=false,recordedFor=null;
  let latestDMRequest=0;
  const audioObjectUrls=new Set();
  const dmStatus=(message,isError=false)=>{
    const target=$('bc-dm-status');target.textContent=message||'';target.dataset.error=String(isError);
  };
  function setAvatar(container,person){
    container.replaceChildren();
    const title=person?.displayName||person?.name||person?.username||'BC';
    container.textContent=title.trim().slice(0,2).toLocaleUpperCase('pt-BR');
    if(person?.avatarUrl){
      const img=node('img');img.src=person.avatarUrl;img.alt='';img.loading='lazy';
      img.onerror=()=>{img.remove();container.textContent=title.trim().slice(0,2).toLocaleUpperCase('pt-BR');};
      container.replaceChildren(img);
    }
  }
  function clearAudioUrls(){
    for(const url of audioObjectUrls)URL.revokeObjectURL(url);
    audioObjectUrls.clear();
  }
  async function fillPrivateAudio(audio,message,peerId,serial){
    let attempts=0;
    while(attempts<2){
      attempts++;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
      try{
        const response=await fetch(BASE+'/dms/'+encodeURIComponent(peerId)+'/audio/'+encodeURIComponent(message.id),{
          headers:{Authorization:'Bearer '+token,Accept:'audio/webm,audio/ogg,*/*'},signal:controller.signal,cache:'no-store'
        });
        if(!response.ok){
          const errorData=await response.json().catch(()=>({}));
          throw Error(errorData.error||'Falha HTTP '+response.status);
        }
        const mime=response.headers.get('Content-Type')||'audio/webm';
        if(!/^audio\/(webm|ogg)(?:;|$)/i.test(mime))throw Error('O servidor não retornou um áudio válido.');
        const blob=await response.blob();
        if(!blob.size)throw Error('O áudio foi recebido vazio.');
        if(!token||peer?.id!==peerId||latestDMRequest!==serial)return;
        const url=URL.createObjectURL(new Blob([blob],{type:mime}));
        audioObjectUrls.add(url);audio.src=url;audio.hidden=false;audio.preload='metadata';
        audio.parentElement?.querySelector('.bc-dm-audio-error')?.remove();
        audio.setAttribute('aria-label','Áudio de '+(message.sender_id===peerId?peer.name:(me?.displayName||'Você')));
        audio.addEventListener('error',()=>{
          if(!audio.isConnected)return;
          audio.parentElement?.querySelector('.bc-dm-audio-error')?.remove();
          const errorCode=audio.error?.code;
          const cause=errorCode===4?'O formato de áudio não é reconhecido por esta versão do aplicativo.':
            errorCode===3?'O áudio não pôde ser decodificado.':
            errorCode===2?'Ocorreu um erro de carregamento do áudio.':
            'Não foi possível carregar este áudio.';
          const detail=node('span',cause+' ','bc-dm-audio-error');
          const retry=node('button','Tentar novamente');retry.type='button';
          retry.addEventListener('click',()=>{detail.remove();void fillPrivateAudio(audio,message,peerId,serial);});
          const save=node('a','Salvar áudio');save.href=url;
          save.download='brasilcord-voz-'+message.id+(mime.startsWith('audio/ogg')?'.ogg':'.webm');
          save.className='bc-dm-save-audio';
          detail.append(retry,save);audio.after(detail);
        },{once:true});
        // Aguarda a inserção no DOM. O CSP permite somente blob: para arquivos de mídia.
        requestAnimationFrame(()=>{if(audio.isConnected)audio.load();});
        return;
      }catch(err){
        if(!audio.isConnected||peer?.id!==peerId||latestDMRequest!==serial)return;
        if(attempts===2){
          const box=node('span',null,'bc-dm-audio-error');
          box.append(node('span','Áudio indisponível: '+err.message+' '));
          const retry=node('button','Tentar novamente');
          retry.type='button';
          retry.addEventListener('click',()=>{box.remove();void fillPrivateAudio(audio,message,peerId,serial);});
          box.append(retry);audio.after(box);audio.hidden=true;
        }
      }finally{clearTimeout(timer);}
    }
  }
  async function fillPrivatePhoto(image,message,peerId,serial){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
    try{
      const response=await fetch(BASE+'/dms/'+encodeURIComponent(peerId)+'/photos/'+encodeURIComponent(message.id),{
        cache:'no-store',headers:{Authorization:'Bearer '+token,Accept:'image/png,image/jpeg,image/webp,image/gif'},signal:controller.signal
      });
      if(!response.ok)throw Error('Não foi possível carregar a foto ('+response.status+').');
      const mime=(response.headers.get('Content-Type')||'').split(';')[0];
      if(!['image/png','image/jpeg','image/gif','image/webp'].includes(mime))throw Error('Formato de imagem inválido.');
      const blob=await response.blob();
      if(!blob.size||blob.size>1_000_000)throw Error('Arquivo vazio ou muito grande.');
      if(!token||peer?.id!==peerId||serial!==latestDMRequest||!image.isConnected)return;
      const url=URL.createObjectURL(new Blob([blob],{type:mime}));
      audioObjectUrls.add(url);image.src=url;image.hidden=false;
      image.addEventListener('click',()=>{
        const preview=document.createElement('dialog');preview.className='bc-dm-photo-dialog';
        const large=document.createElement('img');large.src=url;large.alt='Foto da conversa';
        const close=node('button','✕ Fechar');close.type='button';close.addEventListener('click',()=>preview.close());
        preview.append(close,large);document.body.append(preview);
        preview.addEventListener('close',()=>preview.remove(),{once:true});preview.showModal();
      });
    }catch(err){
      if(!image.isConnected)return;
      image.replaceWith(node('span','Foto indisponível: '+err.message,'bc-dm-photo-error'));
    }finally{clearTimeout(timer);}
  }
  const imagePicker=$('bc-dm-image-file'),imageButton=$('bc-dm-image-select');
  imageButton.addEventListener('click',()=>{if(token&&peer)imagePicker.click();});
  imagePicker.addEventListener('change',async()=>{
    const file=imagePicker.files?.[0];imagePicker.value='';
    if(!file||!token||!peer)return;
    const types=['image/png','image/jpeg','image/gif','image/webp'];
    if(!types.includes(file.type)){dmStatus('Escolha uma imagem JPG, PNG, GIF ou WebP.',true);return;}
    if(file.size>1_000_000||file.size<50){dmStatus('A imagem deve ter até 1 MB.',true);return;}
    if(!window.confirm('Enviar a foto "'+file.name+'" para '+peer.name+'?'))return;
    const peerId=peer.id;
    imageButton.disabled=true;
    dmStatus('Enviando foto…');
    try{
      const array=new Uint8Array(await file.arrayBuffer());
      let binary='';
      for(let i=0;i<array.length;i+=8192)binary+=String.fromCharCode(...array.subarray(i,i+8192));
      const encoded=btoa(binary);
      await request('/dms/'+peerId+'/photos','POST',{image:encoded,mime:file.type});
      dmStatus('Foto enviada com sucesso.');
      if(peer?.id===peerId)await refreshDM(true);
    }catch(err){dmStatus(err.message,true);}
    finally{imageButton.disabled=!token||!peer;}
  });
  function stopRecording(cancel=false){
    if(!recorder)return;
    discardRecording=cancel;
    if(recorder.state!=='inactive')recorder.stop();
  }
  function releaseMicrophone(){
    if(recordTimer){clearInterval(recordTimer);recordTimer=null;}
    recordStream?.getTracks().forEach(track=>track.stop());
    recordStream=null;recorder=null;
    $('bc-dm-recorder').hidden=true;
    $('bc-dm-record').disabled=!peer||!token;
  }
  async function startRecording(){
    if(!peer||!token||recorder)return;
    if(!window.MediaRecorder||!navigator.mediaDevices?.getUserMedia){
      dmStatus('A gravação de voz não está disponível neste computador.',true);return;
    }
    const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg']
      .find(m=>MediaRecorder.isTypeSupported(m));
    if(!mime){dmStatus('Formato de gravação incompatível com esta versão.',true);return;}
    const target=peer.id;
    try{
      const allowed=await window.brasilcord.setVoiceMicrophoneAllowed(true);
      if(!allowed)throw Error('A permissão local do microfone foi negada.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{
        echoCancellation:true,noiseSuppression:true,autoGainControl:true
      },video:false});
      if(!token||peer?.id!==target){stream.getTracks().forEach(track=>track.stop());return;}
      recordStream=stream;recordedFor=target;recorderChunks=[];discardRecording=false;
      recorder=new MediaRecorder(stream,{mimeType:mime,audioBitsPerSecond:48000});
      recorder.ondataavailable=event=>{if(event.data.size)recorderChunks.push(event.data);};
      recorder.onerror=()=>{dmStatus('Falha ao gravar o áudio.',true);stopRecording(true);};
      recorder.onstop=async()=>{
        const cancelled=discardRecording,forPeer=recordedFor;
        const duration=Math.max(1,Math.min(45,Math.ceil((Date.now()-recordStarted)/1000)));
        const blob=new Blob(recorderChunks,{type:mime});recorderChunks=[];
        releaseMicrophone();
        if(cancelled||!token||!peer||peer.id!==forPeer)return;
        if(blob.size>300000){dmStatus('Áudio muito grande. Grave uma mensagem mais curta.',true);return;}
        if(blob.size<50){dmStatus('Gravação muito curta.',true);return;}
        $('bc-dm-record').disabled=true;
        dmStatus('Enviando mensagem de voz…');
        try{
          const base64=await new Promise((resolve,reject)=>{
            const file=new FileReader();
            file.onload=()=>resolve(String(file.result).split(',')[1]||'');
            file.onerror=reject;file.readAsDataURL(blob);
          });
          if(peer?.id!==forPeer||!token)return;
          await request('/dms/'+forPeer+'/audio','POST',{audio:base64,mime,durationSeconds:duration});
          if(peer?.id===forPeer)await refreshDM(true);
          dmStatus('Mensagem de voz enviada.');
        }catch(e){dmStatus(e.message,true);}
        finally{$('bc-dm-record').disabled=!peer||!token;}
      };
      recorder.start(250);recordStarted=Date.now();
      $('bc-dm-recorder').hidden=false;
      $('bc-dm-record').disabled=true;
      dmStatus('Gravando áudio. Você pode cancelar antes de enviar.');
      $('bc-dm-record-time').textContent='00:00';
      recordTimer=setInterval(()=>{
        const seconds=Math.floor((Date.now()-recordStarted)/1000);
        $('bc-dm-record-time').textContent='00:'+String(Math.min(seconds,45)).padStart(2,'0');
        if(seconds>=45)stopRecording();
      },250);
    }catch(e){
      releaseMicrophone();
      dmStatus(e.name==='NotAllowedError'?'Autorize o microfone nas configurações do Windows.':e.message,true);
    }
  }
  async function listFriends(){
    if(!token)return;
    try{
      const result=await request('/friends');
      friendList=(result.friends||[]).filter(f=>f.status==='accepted');
      try{
        const requests=await request('/dm-requests');
        const accepted=(requests.accepted||[]).map(x=>({
          id:x.peerId,displayName:x.displayName,username:x.username,
          avatarUrl:x.avatarUpdatedAt?BASE+'/media/'+x.peerId+'/avatar?v='+new Date(x.avatarUpdatedAt).getTime():null,
          status:'accepted',viaRequest:true
        }));
        const known=new Set(friendList.map(x=>x.id));
        for(const contact of accepted)if(!known.has(contact.id)){known.add(contact.id);friendList.push(contact);}
      }catch{/* Amigos continuam disponíveis se a caixa de solicitações falhar. */}

      const pane=$('bc-dm-friends');pane.replaceChildren();
      if(!friendList.length)pane.append(node('p','Você ainda não tem amigos adicionados.','bc-empty'));
      for(const friend of friendList){
        const b=node('button',null,'bc-dm-friend');
        b.type='button';b.dataset.active=String(peer?.id===friend.id);
        b.dataset.bcUserId=friend.id;b.dataset.bcUsername=friend.username;
        const avatar=node('span',null,'bc-dm-contact-avatar');setAvatar(avatar,friend);
        const identity=node('span',null,'bc-dm-contact-name');
        identity.append(node('strong',friend.displayName),node('small','@'+friend.username));
        b.append(avatar,identity);
        b.addEventListener('click',()=>{
          if(recorder)stopRecording(true);
          peer={id:friend.id,name:friend.displayName,username:friend.username,avatarUrl:friend.avatarUrl};
          clearAudioUrls();$('bc-dm-messages').dataset.lastSignature='';
          void refreshDM();
        });
        pane.append(b);
      }
      if(peer){
        const found=friendList.find(f=>f.id===peer.id);
        if(found)peer={id:found.id,name:found.displayName,username:found.username,avatarUrl:found.avatarUrl};
      }
    }catch(e){dmStatus(e.message,true);}
  }
  async function refreshDM(force=false){
    if(!peer||!token)return;
    const id=peer.id,serial=++latestDMRequest;
    $('bc-dm-name').textContent=peer.name;
    $('bc-dm-handle').textContent=peer.username?'@'+peer.username:'Conversa privada';
    setAvatar($('bc-dm-peer-avatar'),peer);
    $('bc-dm-call').disabled=false;
    imageButton.disabled=false;
    $('bc-dm-input').disabled=false;
    $('bc-dm-record').disabled=Boolean(recorder);
    $('bc-dm-compose').querySelector('button[type=submit]').disabled=false;
    document.querySelectorAll('.bc-dm-friend').forEach(b=>b.dataset.active=String(b.dataset.bcUserId===id));
    try{
      const result=await request('/dms/'+id);
      if(peer?.id!==id||!token||serial!==latestDMRequest)return;
      const list=$('bc-dm-messages');
      const atBottom=list.scrollTop+list.clientHeight>=list.scrollHeight-70;
      const signature=(result.messages||[]).map(m=>m.id+':'+m.content+':'+(m.audio_duration_seconds||'')+':'+Boolean(m.has_photo)).join(',');
      if(!force&&signature===list.dataset.lastSignature)return;
      list.dataset.lastSignature=signature;
      clearAudioUrls();list.replaceChildren();
      if(!result.messages.length)list.append(node('p','Comece uma conversa privada com seu amigo.','bc-empty'));
      for(const message of result.messages){
        const outgoing=message.sender_id!==id;
        const person=outgoing?me:peer;
        const row=node('article',null,'bc-dm-message');
        row.dataset.self=String(outgoing);
        row.dataset.bcUserId=message.sender_id;
        row.dataset.bcMessageId=message.id;
        const avatar=node('span',null,'bc-dm-msg-avatar');setAvatar(avatar,person);
        const body=node('div',null,'bc-dm-message-content');
        const heading=node('div',null,'bc-dm-msg-heading');
        heading.append(node('strong',outgoing?(me?.displayName||me?.username||'Você'):peer.name));
        heading.append(node('small','@'+(outgoing?(me?.username||'voce'):(peer.username||'contato'))));
        heading.append(node('time',new Date(message.created_at).toLocaleString('pt-BR')));
        body.append(heading);
        if(message.has_photo){
          const image=node('img');image.className='bc-dm-photo';image.alt='Foto enviada na conversa';image.hidden=true;
          body.append(node('span','🖼️ Foto','bc-dm-photo-label'),image);
          void fillPrivatePhoto(image,message,id,serial);
        }else if(message.audio_duration_seconds){
          const audio=node('audio');audio.controls=true;audio.preload='none';
          body.append(node('span','🎤 Áudio · '+message.audio_duration_seconds+'s','bc-dm-audio-label'),audio);
          void fillPrivateAudio(audio,message,id,serial);
        }else body.append(node('p',message.content));
        row.append(avatar,body);list.append(row);
      }
      if(atBottom)list.scrollTop=list.scrollHeight;
    }catch(e){dmStatus(e.message,true);}
  }
  let pendingOutgoing=null,pendingIncoming=null,ringInterval=null,ringAudio=null,outgoingTimer=null;
  function clearOutgoing(){clearTimeout(outgoingTimer);outgoingTimer=null;pendingOutgoing=null;}
  const callOverlay=node('div',null,'bc-incoming-call');callOverlay.hidden=true;callOverlay.setAttribute('role','dialog');callOverlay.setAttribute('aria-label','Chamada recebida');
  const callCard=node('div',null,'bc-incoming-call-card'),callName=node('h3','Chamada recebida'),callText=node('p','Deseja atender?'),callActions=node('div',null,'bc-incoming-call-actions');
  const accept=node('button','☎ Atender','bc-call-accept'),reject=node('button','✕ Recusar','bc-call-reject');
  accept.type='button';reject.type='button';callActions.append(accept,reject);callCard.append(node('div','☎','bc-incoming-call-icon'),callName,callText,callActions);callOverlay.append(callCard);document.body.append(callOverlay);
  function stopRinging(){clearInterval(ringInterval);ringInterval=null;}
  function ding(){
    try{
      const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
      ringAudio||=new Context();if(ringAudio.state==='suspended')void ringAudio.resume().catch(()=>{});
      const o=ringAudio.createOscillator(),g=ringAudio.createGain(),t=ringAudio.currentTime;
      o.type='sine';o.frequency.value=680;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.03);g.gain.exponentialRampToValueAtTime(.0001,t+.34);
      o.connect(g);g.connect(ringAudio.destination);o.start(t);o.stop(t+.36);
    }catch{}
  }
  function closeIncoming(){stopRinging();pendingIncoming=null;callOverlay.hidden=true;}
  function signal(type,to){document.dispatchEvent(new CustomEvent('bc:dm-call-send',{detail:{type,to}}));}
  async function joinAcceptedCall(other){
    const data=await request('/dms/'+other.id+'/call');
    document.dispatchEvent(new CustomEvent('bc:platform-state',{detail:{type:'voice-join-request',channel:{...data.room,name:'☎ '+(other.name||'Chamada privada'),private:true}}}));
  }
  function beginPrivateCall(other){
    if(!token||!other?.id||pendingOutgoing)return;
    pendingOutgoing={...other};
    signal('dm-call-invite',other.id);
    dmStatus('Chamando '+(other.name||'contato')+'… aguardando atendimento.');
    clearTimeout(outgoingTimer);
    outgoingTimer=setTimeout(()=>{
      if(pendingOutgoing?.id===other.id){clearOutgoing();dmStatus('Ligação não atendida. Você pode tentar novamente.');}
    },45000);
  }
  $('bc-dm-call').addEventListener('click',()=>{if(peer)beginPrivateCall(peer);});
  document.addEventListener('bc:dm-start-call',event=>{
    const data=event.detail||{};
    if(!token||!data.id||!/^[-a-f0-9]{36}$/i.test(data.id))return;
    // Ligação real via sinalização existente: o contato recebe janela de atender/recusar.
    beginPrivateCall({id:data.id,name:data.name||data.username||'Contato',username:data.username||''});
  });
  accept.addEventListener('click',()=>{
    const call=pendingIncoming;if(!call)return;closeIncoming();
    signal('dm-call-accept',call.from);
    void joinAcceptedCall({id:call.from,name:call.displayName||call.username}).catch(e=>dmStatus(e.message,true));
  });
  reject.addEventListener('click',()=>{const call=pendingIncoming;closeIncoming();if(call)signal('dm-call-reject',call.from);});
  $('bc-dm-record').addEventListener('click',()=>void startRecording());
  $('bc-dm-cancel-audio').addEventListener('click',()=>stopRecording(true));
  $('bc-dm-send-audio').addEventListener('click',()=>stopRecording(false));
  $('bc-dm-compose').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!peer)return;
    const input=$('bc-dm-input'),content=input.value.trim();
    if(!content)return;
    const submit=event.currentTarget.querySelector('button[type=submit]');
    submit.disabled=true;
    try{
      await request('/dms/'+peer.id,'POST',{content});
      input.value='';await refreshDM(true);dmStatus('');
    }catch(e){dmStatus(e.message,true);}
    finally{submit.disabled=false;}
  });
  document.querySelectorAll('#page-app [data-bc-view="dms"]').forEach(b=>b.addEventListener('click',()=>void listFriends()));
  document.addEventListener('bc:dm-requests-updated',()=>void listFriends());
  document.addEventListener('bc:dm-open',event=>{
    if(!event.detail)return;
    if(recorder)stopRecording(true);
    const friend=friendList.find(f=>f.id===event.detail.id);
    peer={id:event.detail.id,name:friend?.displayName||event.detail.name||'Amigo',
      username:friend?.username||'',avatarUrl:friend?.avatarUrl||null};
    $('bc-dm-messages').dataset.lastSignature='';
    void listFriends().then(()=>refreshDM(true));
  });
  document.addEventListener('bc:dm-call-signal',event=>{
    const data=event.detail||{};if(!token||!data.from)return;
    if(data.type==='dm-call-accept'){
      if(pendingOutgoing?.id!==data.from)return;
      const other=pendingOutgoing;clearOutgoing();dmStatus('Chamada atendida.');
      void joinAcceptedCall(other).catch(e=>dmStatus(e.message,true));return;
    }
    if(data.type==='dm-call-reject'){
      if(pendingOutgoing?.id===data.from){clearOutgoing();dmStatus('Chamada recusada ou não atendida.');}
      return;
    }
    if(data.type!=='dm-call-invite')return;
    if(pendingIncoming||pendingOutgoing){signal('dm-call-reject',data.from);return;}
    pendingIncoming=data;callName.textContent=data.displayName||data.username||'Contato';
    callText.textContent='Está ligando para você no BrasilCord.';
    callOverlay.hidden=false;ding();stopRinging();
    let rings=0;ringInterval=setInterval(()=>{
      if(!pendingIncoming)return stopRinging();
      if(++rings>=25){const unanswered=pendingIncoming;closeIncoming();signal('dm-call-reject',unanswered.from);}else ding();
    },1800);
  });
  document.addEventListener('bc:dm-call-delivery',event=>{
    if(event.detail?.ok===false){
      if(!event.detail.to||pendingOutgoing?.id===event.detail.to)clearOutgoing();
      dmStatus(event.detail.message,true);
    }
  });
  const poll=setInterval(()=>{
    if(!token||!peer||$('bc-platform-app').hidden||document.querySelector('[data-bc-view-panel="dms"]').hidden)return;
    void refreshDM();
  },10000);
  window.addEventListener('pagehide',()=>{
    clearOutgoing();clearInterval(poll);closeIncoming();callOverlay.remove();if(ringAudio)void ringAudio.close().catch(()=>{});if(recorder)stopRecording(true);clearAudioUrls();
  },{once:true});

  document.addEventListener('bc:platform-state',event=>{
    const detail=event.detail||{};
    if(detail.type==='voice-session'){
      token=detail.token||null;
      if(!token){clearOutgoing();closeIncoming();imageButton.disabled=true;peer=null;community=null;imageRequests.clear();if(recorder)stopRecording(true);clearAudioUrls();}
    }
    if(detail.type==='user'){me=detail.user||null;}
    if(detail.type==='community'){
      community=detail.community;roles=[];categories=[];editRoleId=null;
      setRoleForm(null);
      void loadManagement();
    }
    if(detail.type==='channels-list'){channels=detail.channels||[];void loadManagement();}
    if(detail.type==='communities'){
      for(const c of detail.communities||[]){
        if(!c.has_image)continue;
        const matching=[...$('bc-platform-communities').querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Abrir comunidade '+c.name);
        void showCommunityImage(c.id,matching);
      }
    }
    if(detail.type==='logout'){
      imageButton.disabled=true;token=null;clearOutgoing();closeIncoming();peer=null;community=null;me=null;imageRequests.clear();if(recorder)stopRecording(true);clearAudioUrls();$('bc-dm-messages').replaceChildren();
      $('bc-dm-name').textContent='Selecione um amigo';$('bc-dm-handle').textContent='';$('bc-dm-call').disabled=true;$('bc-dm-record').disabled=true;
    }
  });
})();
