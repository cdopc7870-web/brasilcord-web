'use strict';

// WebRTC P2P para canais de voz da plataforma propria BrasilCord.
// A sinalizacao autentica cada conta e checa membro/canal no backend.
// Audio, camera e compartilhamento de tela sao transmitidos diretamente entre peers autorizados.
(() => {
  const $ = id => document.getElementById(id);
  const app = $('bc-platform-app');
  if (!app) return;
  const roomLabel = $('bc-call-room-name');
  const status = $('bc-call-status');
  const participants = $('bc-call-participants');
  const joinButton = $('bc-call-join');
  const muteButton = $('bc-call-mute');
  const deafenButton = $('bc-call-deafen');
  const cameraButton = $('bc-call-camera');
  const screenButton = $('bc-call-screen');
  const leaveButton = $('bc-call-leave');
  const dock = $('bc-call-dock');
  const dockName = $('bc-call-dock-name');
  const dockMute = $('bc-call-dock-mute');
  const dockLeave = $('bc-call-dock-leave');
  const audioHost = $('bc-call-remote-audio');
  const videoStage = $('bc-call-videos');
  const picker = $('bc-call-screen-picker');
  const sourcesGrid = $('bc-call-screen-sources');
  const qualitySelect = $('bc-call-quality');
  const fpsSelect = $('bc-call-fps');
  const noiseSuppressionSelect = $('bc-call-noise-suppression');
  const audioProcessingStatus = $('bc-call-audio-processing-status');
  const voiceAudioSettingsKey = 'brasilcord-voice-audio-settings';
  const audioProfiles = {
    off: {noiseSuppression:false, echoCancellation:false, autoGainControl:false, label:'Supressão desligada'},
    standard: {noiseSuppression:true, echoCancellation:true, autoGainControl:true, label:'Supressão padrão ativa'},
    strong: {noiseSuppression:true, echoCancellation:true, autoGainControl:false, label:'Supressão forte solicitada'}
  };
  function readNoiseMode(){
    try{
      const stored=localStorage.getItem(voiceAudioSettingsKey);
      return audioProfiles[stored]?stored:'standard';
    }catch{return 'standard';}
  }
  function saveNoiseMode(mode){
    try{localStorage.setItem(voiceAudioSettingsKey,mode);}catch{}
  }
  let noiseMode=readNoiseMode();
  if(noiseSuppressionSelect)noiseSuppressionSelect.value=noiseMode;
  const qualityPresets={480:{height:480,bitrate:550000},720:{height:720,bitrate:1600000},1080:{height:1080,bitrate:3200000}};
  const localVideo={camera:null,screen:null};
  const remoteVideos=new Map();
  const videoSenders=new Map();
  let ICE_SERVERS = [{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}];
  async function refreshIceServers(){
    // Coturn TURN opcional é provisionado somente pelo backend, sem credenciais no código.
    try{
      const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),7000);
      let response;
      try{response=await fetch('https://brasilcord-sinalizacao-dkx157.onrender.com/api/ice-config',{signal:ctl.signal,cache:'no-store'});}
      finally{clearTimeout(timer);}
      if(!response.ok)return;
      const config=await response.json();
      if(Array.isArray(config.iceServers)&&config.iceServers.length&&config.iceServers.length<=8)
        ICE_SERVERS=config.iceServers;
    }catch{/* Fallback aos servidores STUN públicos. */}
  }
  const connections = new Map();
  const pendingCandidates = new Map();
  const peerTasks = new Map();
  const ignoredOffers=new Set();
  const presence = new Map();
  const peerVolume=new Map(),localPeerMute=new Set(),meters=new Map();
  let voiceContext=null,speakingTimer=null,selfMeter=null,menuPeer=null;
  const peerMenu=document.createElement('div');
  peerMenu.className='bc-voice-peer-menu';peerMenu.hidden=true;peerMenu.setAttribute('role','menu');
  const menuName=document.createElement('strong'),volumeLabel=document.createElement('label'),
    slider=document.createElement('input'),mutePeer=document.createElement('button');
  slider.type='range';slider.min='0';slider.max='100';slider.step='5';
  slider.setAttribute('aria-label','Volume individual');
  mutePeer.type='button';peerMenu.append(menuName,volumeLabel,slider,mutePeer);document.body.append(peerMenu);
  const volumeFor=id=>peerVolume.get(id)??100;
  function applyVolume(id){
    const audio=document.getElementById('bc-audio-'+id);
    if(!audio)return;
    audio.volume=volumeFor(id)/100;
    audio.muted=deafened||serverDeafened||localPeerMute.has(id);
  }
  function updateAudioProcessingStatus(track){
    if(!audioProcessingStatus)return;
    const profile=audioProfiles[noiseMode];
    const actual=track?.getSettings?.()||{};
    const native=actual.noiseSuppression===false?'nativa indisponível ou desligada':'nativa aplicada quando suportada';
    audioProcessingStatus.textContent=profile.label+' · '+native+'.';
  }
  async function applyAudioProcessing(track,announce=false){
    if(!track||track.readyState!=='live'){
      if(audioProcessingStatus)audioProcessingStatus.textContent=audioProfiles[noiseMode].label+' · será aplicada ao entrar na call.';
      return false;
    }
    const profile=audioProfiles[noiseMode];
    const capabilities=track.getCapabilities?.()||null;
    const constraints={};
    for(const key of ['noiseSuppression','echoCancellation','autoGainControl']){
      if(!capabilities||key in capabilities)constraints[key]=profile[key];
    }
    try{
      await track.applyConstraints(constraints);
      updateAudioProcessingStatus(track);
      if(announce)message(profile.label+'.');
      return true;
    }catch{
      if(audioProcessingStatus)audioProcessingStatus.textContent=profile.label+' · este navegador não permite alterar durante a call; será usado na próxima entrada.';
      if(announce)message('O navegador recusou a alteração durante a call. Ela será aplicada na próxima entrada.');
      return false;
    }
  }
  function closePeerMenu(){peerMenu.hidden=true;menuPeer=null;}
  function updatePeerMenu(){
    if(!menuPeer)return;
    const member=presence.get(menuPeer);
    if(!member){closePeerMenu();return;}
    menuName.textContent='🔊 '+labelOf(member);
    slider.value=String(volumeFor(menuPeer));
    volumeLabel.textContent='Volume: '+volumeFor(menuPeer)+'%';
    mutePeer.textContent=localPeerMute.has(menuPeer)?'🔊 Voltar a ouvir':'🔇 Silenciar só para mim';
  }
  slider.addEventListener('input',()=>{if(!menuPeer)return;peerVolume.set(menuPeer,Number(slider.value));applyVolume(menuPeer);updatePeerMenu();});
  mutePeer.addEventListener('click',()=>{if(!menuPeer)return;localPeerMute.has(menuPeer)?localPeerMute.delete(menuPeer):localPeerMute.add(menuPeer);applyVolume(menuPeer);updatePeerMenu();});
  document.addEventListener('contextmenu',event=>{
    const el=event.target.closest?.('#bc-call-participants [data-bc-voice-user],#bc-call-sidebar-presence [data-bc-voice-user]');
    if(!el||!activeRoom||!presence.has(el.dataset.bcVoiceUser))return;
    event.preventDefault();event.stopImmediatePropagation();
    menuPeer=el.dataset.bcVoiceUser;updatePeerMenu();peerMenu.hidden=false;
    const size=peerMenu.getBoundingClientRect();
    peerMenu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-size.width-8))+'px';
    peerMenu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-size.height-8))+'px';
  },true);
  document.addEventListener('pointerdown',event=>{if(!peerMenu.contains(event.target))closePeerMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closePeerMenu();});
  function newMeter(stream){
    if(!stream?.getAudioTracks().length)return null;
    try{
      const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
      voiceContext||=new C();
      if(voiceContext.state==='suspended')void voiceContext.resume().catch(()=>{});
      const source=voiceContext.createMediaStreamSource(stream),analyser=voiceContext.createAnalyser();
      analyser.fftSize=512;source.connect(analyser);
      return {source,analyser,buffer:new Uint8Array(512),talking:false};
    }catch{return null;}
  }
  function destroyMeter(m){if(m){try{m.source.disconnect();m.analyser.disconnect();}catch{}}}
  function rms(m){
    if(!m)return 0;
    m.analyser.getByteTimeDomainData(m.buffer);
    let total=0;for(const value of m.buffer){const a=(value-128)/128;total+=a*a;}
    return Math.sqrt(total/m.buffer.length);
  }
  function markSpeaking(id,on){
    const selector=id==='self'?'[data-bc-voice-self="true"]':'[data-bc-voice-user="'+id+'"]';
    for(const el of document.querySelectorAll('#bc-call-participants '+selector+',#bc-call-sidebar-presence '+selector))
      el.classList.toggle('bc-is-speaking',on);
  }
  function updateMeters(){
    if(!activeRoom)return;
    if(selfMeter){
      const active=!muted&&!serverMuted&&rms(selfMeter)>.026;
      if(active!==selfMeter.talking){selfMeter.talking=active;markSpeaking('self',active);}
    }
    for(const [id,m] of meters){
      const active=!presence.get(id)?.muted&&rms(m)>.026;
      if(active!==m.talking){m.talking=active;markSpeaking(id,active);}
    }
  }
  function cleanupMeters(){
    clearInterval(speakingTimer);speakingTimer=null;
    destroyMeter(selfMeter);selfMeter=null;
    for(const m of meters.values())destroyMeter(m);meters.clear();
    if(voiceContext){void voiceContext.close().catch(()=>{});voiceContext=null;}
  }

  let token = null;
  let myUser = null;
  let room = null;
  let activeRoom = null;
  let socket = null;
  let localStream = null;
  let joining = false;
  let openingMedia = false;
  let capturePending=false;
  let muted = false;
  let deafened = false;
  let serverMuted = false;
  let serverDeafened = false;
  let selfId = null;
  let currentCommunityId = null;
  let keepAlive = null;
  let durationTimer = null;
  let selfJoinedAt = null;
  let generation = 0;

  function message(text) {status.textContent = text;}
  function send(value) {
    if(socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
  }
  function labelOf(person) {return person?.name||person?.displayName||person?.username||'Membro';}
  function callAvatar(person,compact=false){
    const avatar=document.createElement('span');
    avatar.className='bc-call-person-avatar'+(compact?' bc-call-mini-avatar':'');
    const fallback=labelOf(person).trim().slice(0,2).toLocaleUpperCase('pt-BR')||'BC';
    avatar.textContent=fallback;
    const url=person?.avatarUrl;
    if(typeof url==='string'&&/^https:\/\/brasilcord-sinalizacao-dkx157\.onrender\.com\/api\/platform\/media\//.test(url)){
      const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';img.decoding='async';
      img.width=compact?26:34;img.height=compact?26:34;
      img.addEventListener('error',()=>{img.remove();avatar.textContent=fallback;},{once:true});
      avatar.replaceChildren(img);
    }
    return avatar;
  }
  function durationSince(timestamp) {
    if(!timestamp||!Number.isFinite(Number(timestamp)))return '00:00';
    const seconds=Math.max(0,Math.floor((Date.now()-Number(timestamp))/1000));
    const hours=Math.floor(seconds/3600);
    return (hours?String(hours).padStart(2,'0')+':':'')+
      String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  }
  function peopleInRoom(){
    if(!activeRoom)return [];
    return [{
      id:selfId||'self',name:myUser?.displayName||myUser?.username||'Você',
      username:myUser?.username||'',avatarUrl:myUser?.avatarUrl||null,muted:muted||serverMuted,deafened:deafened||serverDeafened,joinedAt:selfJoinedAt,self:true
    },...presence.values()];
  }
  function updateClock(){
    const joined=Boolean(activeRoom);
    const value=joined?durationSince(selfJoinedAt):'00:00';
    $('bc-call-elapsed').textContent=value;
    $('bc-call-dock-duration').textContent=value;
    for(const time of participants.querySelectorAll('[data-bc-joined-at]'))
      time.textContent=durationSince(Number(time.dataset.bcJoinedAt));
    const sidebar=$('bc-call-sidebar-presence');
    for(const time of sidebar.querySelectorAll('[data-bc-joined-at]'))
      time.textContent=durationSince(Number(time.dataset.bcJoinedAt));
  }
  function render() {
    const isConnected=Boolean(activeRoom && socket?.readyState===WebSocket.OPEN);
    joinButton.disabled=!token||!room||Boolean(activeRoom)||joining;
    joinButton.textContent=joining?'Conectando…':'◉ Entrar na call';
    muteButton.disabled=!isConnected;
    deafenButton.disabled=!isConnected;
    cameraButton.disabled=!isConnected||openingMedia;
    screenButton.disabled=!isConnected||openingMedia;
    cameraButton.textContent=localVideo.camera?'📷 Desligar câmera':'📷 Ligar câmera';
    screenButton.textContent=localVideo.screen?'🛑 Parar transmissão':'🖥️ Transmitir tela';
    cameraButton.setAttribute('aria-pressed',String(Boolean(localVideo.camera)));
    screenButton.setAttribute('aria-pressed',String(Boolean(localVideo.screen)));
    leaveButton.disabled=!activeRoom&&!joining;
    muteButton.textContent=serverMuted?'🔇 Silenciado pela moderação':muted?'🔇 Microfone desligado':'🎙 Microfone ligado';
    muteButton.setAttribute('aria-pressed',String(muted||serverMuted));
    deafenButton.textContent=serverDeafened?'🔕 Áudio bloqueado pela moderação':deafened?'🔕 Áudio desativado':'🔊 Ouvir';
    deafenButton.setAttribute('aria-pressed',String(deafened||serverDeafened));
    dock.hidden=!activeRoom;
    dockName.textContent=activeRoom?'◉ '+activeRoom.name:'';
    dockMute.textContent=(muted||serverMuted)?'🔇':'🎙';
    roomLabel.textContent=activeRoom?.name||room?.name||'Escolha um canal de voz';
    renderVideoTiles();
    participants.replaceChildren();
    const sidebar=$('bc-call-sidebar-presence');
    sidebar.replaceChildren();
    sidebar.hidden=!activeRoom;
    const people=peopleInRoom();
    $('bc-call-member-count').textContent=String(people.length);
    if(!activeRoom){
      const p=document.createElement('p');
      p.className='bc-call-empty';
      p.textContent='Entre em um canal de voz para ver os participantes.';
      participants.append(p);
    }else{
      for(const person of people){
        const card=document.createElement('article');
        card.className='bc-call-person';
        if(person.id && person.id!=='self'){
          card.dataset.bcUserId=person.id;
          card.dataset.bcUsername=person.username||'';
          card.title='Clique com o botão direito para ver o perfil';
        }
        const avatar=callAvatar(person);
        if(person.self)card.dataset.bcVoiceSelf='true';
        else card.dataset.bcVoiceUser=person.id;
        const info=document.createElement('span');info.className='bc-call-person-info';
        const title=document.createElement('strong');
        title.textContent=labelOf(person)+(person.self?' (você)':'');
        const state=document.createElement('small');
        state.textContent=(person.muted?'Microfone mutado':'Microfone ligado')+
          ' · '+(person.deafened?'Áudio silenciado':'Ouvindo');
        const duration=document.createElement('small');
        duration.className='bc-call-peer-time';
        duration.dataset.bcJoinedAt=String(person.joinedAt||Date.now());
        duration.textContent=durationSince(person.joinedAt);
        info.append(title,state,duration);
        const icons=document.createElement('span');icons.className='bc-call-person-state';
        icons.textContent=(person.muted?'🔇':'🎙')+' '+(person.deafened?'🔕':'🔊');
        card.append(avatar,info,icons);participants.append(card);
        const compact=document.createElement('div');compact.className='bc-voice-connected-member';
        if(person.id&&person.id!=='self'){
          compact.dataset.bcUserId=person.id;
          compact.dataset.bcUsername=person.username||'';
          compact.title='Clique com o botão direito para abrir o perfil';
        }
        if(person.self)compact.dataset.bcVoiceSelf='true';
        else compact.dataset.bcVoiceUser=person.id;
        const icon=callAvatar(person,true);
        const name=document.createElement('span');
        name.textContent=(person.muted?'🔇':'🎙')+' '+labelOf(person);
        const time=document.createElement('small');
        time.dataset.bcJoinedAt=String(person.joinedAt||Date.now());
        time.textContent=durationSince(person.joinedAt);
        compact.append(icon,name,time);
        sidebar.append(compact);
      }
    }
    updateClock();
    if(selfMeter?.talking)markSpeaking('self',true);
    for(const [id,meter] of meters)if(meter.talking)markSpeaking(id,true);
  }
  function preset() {
    return {...qualityPresets[qualitySelect.value]||qualityPresets[720],fps:Number(fpsSelect.value)||30};
  }
  function mediaState() {
    send({type:'media-state',camera:Boolean(localVideo.camera),screen:Boolean(localVideo.screen)});
    render();
  }
  function tileKey(id,kind){return String(id)+'-'+kind;}
  function renderVideoTiles() {
    // Os elementos de video sao persistentes para nao reiniciar playback a cada render.
    for(const tile of [...videoStage.children]) {
      const id=tile.dataset.peer;
      const kind=tile.dataset.kind;
      const track=tile.querySelector('video')?.srcObject?.getVideoTracks?.()[0];
      const receiving=Boolean(track&&track.readyState==='live'&&!track.muted);
      const visible=id==='self'?Boolean(localVideo[kind]):Boolean(presence.get(id)?.media?.[kind]||receiving);
      tile.classList.toggle('bc-call-video-waiting',visible&&id!=='self'&&!receiving);
      tile.hidden=!visible;
    }
    videoStage.hidden=![...videoStage.children].some(el=>!el.hidden);
  }
  function ensureVideoTile(id,kind,name,stream,self=false) {
    const key=tileKey(id,kind);
    let tile=[...videoStage.children].find(el=>el.dataset.key===key);
    if(!tile) {
      tile=document.createElement('article');
      tile.className='bc-call-video-tile';
      tile.dataset.key=key;tile.dataset.peer=id;tile.dataset.kind=kind;
      const vid=document.createElement('video');
      vid.autoplay=true;vid.playsInline=true;vid.muted=Boolean(self);
      vid.setAttribute('aria-label',(kind==='screen'?'Tela de ':'Câmera de ')+name);
      const label=document.createElement('span');
      label.className='bc-call-video-name';
      label.textContent=(kind==='screen'?'🖥️ Tela · ':'📷 Câmera · ')+name;
      tile.append(vid,label);
      videoStage.append(tile);
    }
    const vid=tile.querySelector('video');
    if(vid.srcObject!==stream)vid.srcObject=stream;
    if(self||!stream.getVideoTracks()[0]?.muted)void vid.play().catch(()=>{});
    else vid.dataset.waiting='true';
    renderVideoTiles();
    return tile;
  }
  function removeVideoTile(id,kind) {
    const key=tileKey(id,kind);
    const tile=[...videoStage.children].find(el=>el.dataset.key===key);
    if(tile) {
      const video=tile.querySelector('video');
      video.pause();video.srcObject=null;tile.remove();
    }
    renderVideoTiles();
  }
  async function updateSenderParameters(sender,kind) {
    if(!sender?.track)return;
    const options=preset();
    try {
      const params=sender.getParameters();
      if(!Array.isArray(params.encodings)||!params.encodings.length)return;
      params.encodings[0].maxBitrate=kind==='screen'?Math.floor(options.bitrate*1.3):options.bitrate;
      params.encodings[0].maxFramerate=options.fps;
      await sender.setParameters(params);
    }catch{
      // Alguns drivers/WebRTC nao suportam alterar bitrate em tempo real.
    }
  }
  async function applyQualityToTrack(track) {
    if(!track||track.readyState!=='live')return;
    const options=preset();
    try{await track.applyConstraints({height:{ideal:options.height},frameRate:{ideal:options.fps}});}
    catch{/* Usa a melhor resolucao que o dispositivo oferecer. */}
  }
  async function applyQuality() {
    const tracks=Object.entries(localVideo);
    await Promise.all(tracks.map(async ([kind,stream])=>{
      if(!stream)return;
      await applyQualityToTrack(stream.getVideoTracks()[0]);
      await Promise.all([...videoSenders.values()].map(s=>updateSenderParameters(s[kind],kind)));
    }));
    if(tracks.some(([,stream])=>stream))message('Qualidade ajustada conforme o dispositivo e a conexão permitirem.');
  }
  async function waitForStable(pc){
    if(pc.signalingState==='stable')return true;
    if(pc.signalingState==='closed')return false;
    return new Promise(resolve=>{
      let timer;
      const update=()=>{
        if(pc.signalingState==='stable'||pc.signalingState==='closed'){
          clearTimeout(timer);pc.removeEventListener('signalingstatechange',update);
          resolve(pc.signalingState==='stable');
        }
      };
      pc.addEventListener('signalingstatechange',update);
      timer=setTimeout(()=>{pc.removeEventListener('signalingstatechange',update);resolve(false);},8000);
    });
  }
  async function renegotiatePeer(id){
    const pc=connections.get(id);
    if(!pc||!activeRoom||!await waitForStable(pc))return;
    await pc.setLocalDescription(await pc.createOffer());
    send({type:'signal',to:id,payload:{type:'offer',sdp:pc.localDescription.sdp}});
  }
  function renegotiateAll(){
    for(const id of connections.keys())queueSignal(id,()=>renegotiatePeer(id));
  }
  async function replaceOutbound(kind,track) {
    await Promise.all([...videoSenders.values()].map(async senders=>{
      if(!senders[kind])return;
      await senders[kind].replaceTrack(track);
      if(track)await updateSenderParameters(senders[kind],kind);
    }));
  }
  async function stopVideo(kind,notify=true) {
    const stream=localVideo[kind];
    if(!stream)return;
    localVideo[kind]=null;
    await replaceOutbound(kind,null).catch(err=>message('Falha ao desativar vídeo: '+err.message));
    stream.getTracks().forEach(track=>track.stop());
    removeVideoTile('self',kind);
    if(kind==='camera')await window.brasilcord.releaseInlineCallCamera().catch(()=>{});
    else await window.brasilcord.clearInlineCallSource().catch(()=>{});
    if(notify){
      mediaState();
      renegotiateAll();
      message(kind==='camera'?'Câmera desligada.':'Transmissão de tela encerrada.');
    }
  }
  async function setVideo(kind,stream) {
    if(!activeRoom){stream.getTracks().forEach(t=>t.stop());return;}
    const track=stream.getVideoTracks()[0];
    if(!track)throw Error('Nenhuma trilha de vídeo disponível.');
    await applyQualityToTrack(track);
    localVideo[kind]=stream;
    track.addEventListener('ended',()=>{if(localVideo[kind]===stream)void stopVideo(kind);},{once:true});
    try{await replaceOutbound(kind,track);}
    catch(err){
      localVideo[kind]=null;stream.getTracks().forEach(t=>t.stop());throw err;
    }
    ensureVideoTile('self',kind,'Você',stream,true);
    mediaState();
    // A trilha pode ser ativada depois do primeiro SDP. Renegociar garante
    // que os demais participantes recebam a câmera ou a tela.
    renegotiateAll();
    message(kind==='camera'?'Câmera ligada dentro da call.':'Sua tela está aparecendo dentro da call.');
  }
  async function cameraToggle() {
    if(!activeRoom||openingMedia)return;
    if(localVideo.camera){await stopVideo('camera');return;}
    openingMedia=true;render();
    const seq=generation;
    try {
      const result=await window.brasilcord.requestInlineCallCamera();
      if(!result?.ok){message('Acesso à câmera cancelado.');return;}
      const p=preset();
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{height:{ideal:p.height},frameRate:{ideal:p.fps}},audio:false
      });
      if(seq!==generation){stream.getTracks().forEach(t=>t.stop());return;}
      await setVideo('camera',stream);
    }catch(e){
      await window.brasilcord.releaseInlineCallCamera().catch(()=>{});
      message('Falha ao ligar câmera: '+(e.name==='NotAllowedError'?'permissão negada.':e.message));
    }
    finally{if(seq===generation){openingMedia=false;render();}}
  }
  async function showSourcePicker() {
    if(!activeRoom||openingMedia)return;
    if(localVideo.screen){await stopVideo('screen');return;}
    if(window.brasilcord?.isWeb){await beginScreenCapture('browser');return;}
    openingMedia=true;render();
    try {
      const result=await window.brasilcord.listInlineCallSources();
      if(!result?.ok||!Array.isArray(result.sources))throw Error(result?.message||'Falha ao listar fontes.');
      sourcesGrid.replaceChildren();
      if(!result.sources.length){message('Nenhuma tela ou janela encontrada.');return;}
      for(const source of result.sources){
        const button=document.createElement('button');
        button.type='button';button.className='bc-call-source-item';
        const thumbnail=document.createElement('img');
        thumbnail.src=source.thumbnail;thumbnail.alt='';
        const label=document.createElement('span');
        label.textContent=(source.kind==='screen'?'🖥️ Tela inteira · ':'▣ Janela · ')+source.name;
        button.append(thumbnail,label);
        button.addEventListener('click',()=>void beginScreenCapture(source.id));
        sourcesGrid.append(button);
      }
      picker.hidden=false;
      message('Selecione a janela ou tela que deseja compartilhar.');
    }catch(e){message(e.message);}
    finally{openingMedia=false;render();}
  }
  async function beginScreenCapture(sourceId) {
    if(!activeRoom||capturePending)return;
    capturePending=true;openingMedia=true;render();
    const seq=generation;
    picker.hidden=true;
    try {
      if(!window.brasilcord?.isWeb){
        const selected=await window.brasilcord.selectInlineCallSource(sourceId);
        if(!selected?.ok)throw Error(selected?.message||'Seleção inválida.');
      }
      // O handler do Electron utiliza somente a fonte explicitamente selecionada.
      if(!navigator.mediaDevices.getDisplayMedia)throw Error('Captura de tela indisponível nesta versão do Electron.');
      const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
      if(seq!==generation){stream.getTracks().forEach(t=>t.stop());return;}
      await setVideo('screen',stream);
    }catch(e){message('Falha na transmissão: '+(e.name==='NotAllowedError'?'seleção cancelada ou acesso negado.':e.message));}
    finally{
      capturePending=false;
      await window.brasilcord.clearInlineCallSource().catch(()=>{});
      if(seq===generation){openingMedia=false;render();}
    }
  }
  function cancelPicker() {
    picker.hidden=true;
    sourcesGrid.replaceChildren();
    void window.brasilcord.clearInlineCallSource().catch(()=>{});
  }

  function closePeer(id) {
    const pc=connections.get(id);
    if(pc){pc.ontrack=null;pc.onicecandidate=null;pc.onconnectionstatechange=null;pc.close();connections.delete(id);}
    destroyMeter(meters.get(id));meters.delete(id);
    const audio=document.getElementById('bc-audio-'+id);
    if(audio){audio.pause();audio.srcObject=null;audio.remove();}
    for(const kind of ['camera','screen'])removeVideoTile(id,kind);
    videoSenders.delete(id);
    remoteVideos.delete(id);
    pendingCandidates.delete(id);
    peerTasks.delete(id);ignoredOffers.delete(id);
  }
  function dropCall(reason) {
    generation++;
    clearInterval(keepAlive);keepAlive=null;
    clearInterval(durationTimer);durationTimer=null;
    selfJoinedAt=null;
    if(socket) {
      const old=socket;socket=null;
      old.onclose=null;old.onmessage=null;old.onopen=null;old.onerror=null;
      if(old.readyState===WebSocket.OPEN)old.send(JSON.stringify({type:'leave'}));
      old.close();
    }
    for(const id of [...connections.keys()]) closePeer(id);
    cleanupMeters();closePeerMenu();
    presence.clear();
    for(const kind of ['camera','screen']){
      const stream=localVideo[kind];localVideo[kind]=null;
      if(stream)stream.getTracks().forEach(track=>track.stop());
      removeVideoTile('self',kind);
    }
    cancelPicker();
    void window.brasilcord.releaseInlineCallCamera().catch(()=>{});
    if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
    void window.brasilcord.setVoiceMicrophoneAllowed(false).catch(()=>{});
    activeRoom=null;joining=false;openingMedia=false;selfId=null;muted=false;deafened=false;serverMuted=false;serverDeafened=false;
    message(reason||'Você saiu da call.');
    render();
  }
  async function ensurePeer(id) {
    if(connections.has(id))return connections.get(id);
    if(!localStream)throw Error('Microfone indisponível.');
    const pc=new RTCPeerConnection({iceServers:ICE_SERVERS});
    connections.set(id,pc);
    for(const track of localStream.getAudioTracks())pc.addTrack(track,localStream);
    // Trilha de vídeo de câmera e tela em transceivers permanentes.
    // replaceTrack atualiza a mídia e renegotiateAll publica a mudança no SDP.
    const cam=pc.addTransceiver('video',{direction:'sendrecv'});
    const screen=pc.addTransceiver('video',{direction:'sendrecv'});
    videoSenders.set(id,{camera:cam.sender,screen:screen.sender});
    for(const kind of ['camera','screen']){
      const track=localVideo[kind]?.getVideoTracks()[0];
      if(track){await videoSenders.get(id)[kind].replaceTrack(track);await updateSenderParameters(videoSenders.get(id)[kind],kind);}
    }
    pc.onicecandidate = evt=>{
      if(evt.candidate)send({type:'signal',to:id,payload:{type:'candidate',candidate:evt.candidate.toJSON()}});
    };
    pc.ontrack=evt=>{
      if(evt.track.kind==='video'){
        const videoTransceivers=pc.getTransceivers().filter(t=>t.receiver?.track?.kind==='video');
        const index=videoTransceivers.indexOf(evt.transceiver);
        const kind=index===0?'camera':index===1?'screen':null;
        if(!kind)return;
        const name=presence.get(id)?.name||'Membro';
        const stream=new MediaStream([evt.track]);
        ensureVideoTile(id,kind,name,stream,false);
        const update=()=>{
          const tile=[...videoStage.children].find(el=>el.dataset.key===tileKey(id,kind));
          const vid=tile?.querySelector('video');
          if(!vid)return;
          if(!evt.track.muted){delete vid.dataset.waiting;void vid.play().catch(()=>message('Clique no vídeo para iniciar a reprodução.'));}
          else vid.dataset.waiting='true';
          renderVideoTiles();
        };
        evt.track.addEventListener('unmute',update);
        evt.track.addEventListener('mute',update);
        evt.track.addEventListener('ended',update);
        update();return;
      }
      let audio=document.getElementById('bc-audio-'+id);
      if(!audio) {
        audio=document.createElement('audio');
        audio.id='bc-audio-'+id;audio.autoplay=true;audio.playsInline=true;
        audioHost.append(audio);
      }
      const stream=evt.streams[0]||new MediaStream([evt.track]);
      audio.srcObject=stream;
      destroyMeter(meters.get(id));const meter=newMeter(stream);if(meter)meters.set(id,meter);
      applyVolume(id);
      void audio.play().catch(()=>message('Clique em Ouvir caso o sistema tenha bloqueado o áudio.'));
    };
    pc.onconnectionstatechange=()=>{
      if(pc.connectionState==='failed')message('A conexão entre participantes falhou. Uma rede com NAT restrito pode exigir TURN.');
    };
    return pc;
  }
  function queueSignal(id,task) {
    const prior=peerTasks.get(id)||Promise.resolve();
    const next=prior.catch(()=>{}).then(task);
    peerTasks.set(id,next);
    void next.catch(err=>{message('Problema na conexão WebRTC: '+err.message);});
  }
  async function handleSignal(from,payload) {
    if(!activeRoom||!payload||!['offer','answer','candidate'].includes(payload.type))return;
    const pc=await ensurePeer(from);
    if(payload.type==='candidate') {
      if(ignoredOffers.has(from))return;
      if(!pc.remoteDescription) {
        const queue=pendingCandidates.get(from)||[];
        if(queue.length<80)queue.push(payload.candidate);
        pendingCandidates.set(from,queue);
      } else await pc.addIceCandidate(payload.candidate);
      return;
    }
    if(typeof payload.sdp!=='string')return;
    if(payload.type==='offer') {
      const collision=pc.signalingState!=='stable';
      const polite=String(selfId||myUser?.id||'')>String(from);
      if(collision&&!polite){ignoredOffers.add(from);return;}
      ignoredOffers.delete(from);
      if(collision)await pc.setLocalDescription({type:'rollback'});
      await pc.setRemoteDescription({type:'offer',sdp:payload.sdp});
      for(const item of pendingCandidates.get(from)||[])await pc.addIceCandidate(item);
      pendingCandidates.delete(from);
      await pc.setLocalDescription(await pc.createAnswer());
      send({type:'signal',to:from,payload:{type:'answer',sdp:pc.localDescription.sdp}});
    }else if(pc.signalingState==='have-local-offer'){
      ignoredOffers.delete(from);
      await pc.setRemoteDescription({type:'answer',sdp:payload.sdp});
      for(const item of pendingCandidates.get(from)||[])await pc.addIceCandidate(item);
      pendingCandidates.delete(from);
    }
  }
  async function offerPeer(id) {
    await ensurePeer(id);
    await renegotiatePeer(id);
  }
  async function joinCall() {
    if(!token||!room||activeRoom||joining)return;
    joining=true;
    const seq=++generation;
    const joiningRoom={...room};
    render();
    message('Solicitando permissão para usar seu microfone…');
    try {
      const allowed=await window.brasilcord.setVoiceMicrophoneAllowed(true);
      if(!allowed)throw Error('Permissão local de microfone indisponível.');
      const audioProfile=audioProfiles[noiseMode];
      const stream=await navigator.mediaDevices.getUserMedia({
        audio:{
          echoCancellation:audioProfile.echoCancellation,
          noiseSuppression:audioProfile.noiseSuppression,
          autoGainControl:audioProfile.autoGainControl,
          channelCount:1
        },
        video:false
      });
      if(seq!==generation){stream.getTracks().forEach(t=>t.stop());return;}
      localStream=stream;
      await applyAudioProcessing(stream.getAudioTracks()[0]);
      await refreshIceServers();
      if(!stream.getAudioTracks().length)throw Error('Nenhum microfone foi encontrado.');
      selfMeter=newMeter(stream);
      clearInterval(speakingTimer);speakingTimer=setInterval(updateMeters,150);
      stream.getAudioTracks().forEach(track=>{
        track.addEventListener('ended',()=>{if(seq===generation)dropCall('O microfone foi desconectado.');});
      });
      message('Conectando ao canal de voz…');
      const ws=new WebSocket('wss://brasilcord-sinalizacao-dkx157.onrender.com/platform/voice');
      socket=ws;
      ws.onopen=()=>{
        if(seq!==generation)return;
        ws.send(JSON.stringify({type:'auth',token}));
        keepAlive=setInterval(()=>{if(socket===ws&&ws.readyState===WebSocket.OPEN)send({type:'ping'});},20000);
      };
      ws.onmessage=event=>{
        if(seq!==generation)return;
        let data;
        try{data=JSON.parse(event.data);}catch{return;}
        if(data.type==='authenticated')send({type:'join',channelId:joiningRoom.id,muted,deafened});
        if(data.type==='error'){dropCall(data.message||'Não foi possível entrar na call.');return;}
        if(data.type==='joined') {
          activeRoom=joiningRoom;selfId=data.selfId;joining=false;
          selfJoinedAt=data.joinedAt||Date.now();
          clearInterval(durationTimer);
          durationTimer=setInterval(updateClock,1000);
          presence.clear();
          for(const p of data.peers||[])presence.set(p.id,p);
          mediaState();
          message('Conectado. Você pode conversar com os participantes do canal.');
          render();
          for(const p of data.peers||[])queueSignal(p.id,()=>offerPeer(p.id));
        }
        if(data.type==='peer-joined'&&data.peer){
          presence.set(data.peer.id,data.peer);render();
        }
        if(data.type==='peer-left'){
          presence.delete(data.id);closePeer(data.id);render();
        }
        if(data.type==='peer-media'){
          const peer=presence.get(data.id);
          if(peer){peer.media=data.media;render();}
        }
        if(data.type==='peer-deafen'){
          const peer=presence.get(data.id);
          if(peer){peer.deafened=data.deafened===true;render();}
        }
        if(data.type==='peer-mute'){
          const peer=presence.get(data.id);
          if(peer){peer.muted=data.muted===true;render();}
        }
        if(data.type==='moderation-restrictions'){
          serverMuted=data.serverMuted===true;serverDeafened=data.serverDeafened===true;
          localStream?.getAudioTracks().forEach(t=>{t.enabled=!(muted||serverMuted);});
          for(const audio of audioHost.querySelectorAll('audio'))applyVolume(audio.id.slice('bc-audio-'.length));
          message(serverMuted||serverDeafened?'A moderação alterou suas permissões de voz.':'Restrições de voz removidas.');
          render();return;
        }
        if(data.type==='moderation-disconnect'){dropCall(data.message||'Desconectado pela moderação.');return;}
        if(data.type==='signal'&&typeof data.from==='string')queueSignal(data.from,()=>handleSignal(data.from,data.payload));
      };
      ws.onclose=()=>{if(seq===generation)dropCall('Conexão encerrada. Verifique a internet ou tente entrar novamente.');};
      ws.onerror=()=>{if(seq===generation)message('Falha na conexão de voz.');};
    }catch(err) {
      if(seq===generation)dropCall('Não foi possível entrar na call: '+(err.name==='NotAllowedError'?'autorize o microfone no Windows.':err.message));
    }
  }
  function toggleMute() {
    if(!activeRoom||!localStream)return;
    muted=!muted;
    localStream.getAudioTracks().forEach(track=>{track.enabled=!(muted||serverMuted);});
    send({type:'mute',muted});
    render();
  }
  function toggleDeafen(){
    if(!activeRoom)return;
    deafened=!deafened;
    for(const audio of audioHost.querySelectorAll('audio'))applyVolume(audio.id.slice('bc-audio-'.length));
    send({type:'deafen',deafened});
    render();
  }

  joinButton.addEventListener('click',()=>void joinCall());
  cameraButton.addEventListener('click',()=>void cameraToggle());
  screenButton.addEventListener('click',()=>void showSourcePicker());
  $('bc-call-picker-cancel').addEventListener('click',cancelPicker);
  qualitySelect.addEventListener('change',()=>void applyQuality());
  fpsSelect.addEventListener('change',()=>void applyQuality());
  noiseSuppressionSelect?.addEventListener('change',()=>{
    noiseMode=audioProfiles[noiseSuppressionSelect.value]?noiseSuppressionSelect.value:'standard';
    saveNoiseMode(noiseMode);
    if(localStream?.getAudioTracks()[0])void applyAudioProcessing(localStream.getAudioTracks()[0],true);
    else if(audioProcessingStatus)audioProcessingStatus.textContent=audioProfiles[noiseMode].label+' · será aplicada ao entrar na call.';
  });
  muteButton.addEventListener('click',toggleMute);
  deafenButton.addEventListener('click',toggleDeafen);
  leaveButton.addEventListener('click',()=>dropCall('Você saiu da call.'));
  dockMute.addEventListener('click',toggleMute);
  dockLeave.addEventListener('click',()=>dropCall('Você saiu da call.'));
  document.addEventListener('bc:platform-state',event=>{
    const e=event.detail||{};
    if(e.type==='voice-session'){
      token=e.token||null;
      if(!token)dropCall('Entre na sua conta para participar das calls.');
      render();
    }
    if(e.type==='user'){myUser=e.user;render();}
    if(e.type==='logout'){dropCall('Você saiu da sua conta.');token=null;myUser=null;room=null;render();}
    if(e.type==='community'){
      if(currentCommunityId && e.community?.id!==currentCommunityId)dropCall('Comunidade alterada.');
      currentCommunityId=e.community?.id||null;
      room=null;render();
    }
    if(e.type==='voice-channels') {
      if(room && !room.private && !(e.channels||[]).some(c=>c.id===room.id))room=null;
      if(!room && Array.isArray(e.channels)&&e.channels.length)room=e.channels[0];
      render();
    }
    if(e.type==='voice-join-request'&&e.channel) {
      if(activeRoom&&activeRoom.id!==e.channel.id)dropCall('Mudando de canal de voz.');
      room={...e.channel};
      render();
      const calls=document.querySelector('#page-app .bc-rail-action[data-bc-view="calls"]');
      calls?.click();
      void joinCall();
    }
  });
  document.addEventListener('bc:page-changed',event=>{
    if(event.detail?.name!=='app' && (activeRoom||joining))dropCall('Você saiu da área BrasilCord.');
  });
  window.addEventListener('pagehide',()=>dropCall('Encerrado.'));
  render();
})();
