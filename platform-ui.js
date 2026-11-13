'use strict';

// Navegacao visual BrasilCord. As permissoes e mensagens continuam no backend.
(() => {
  const root = document.querySelector('#page-app .bc-community-desktop');
  const workarea = document.getElementById('bc-platform-app');
  if (!root || !workarea) return;
  const $ = id => document.getElementById(id);
  const views = new Set(['chat','friends','calls','profile','discover','dms','tools']);
  const controls = [...root.querySelectorAll('[data-bc-view]')];
  const panels = [...root.querySelectorAll('[data-bc-view-panel]')];
  const search = $('bc-chat-search');
  const membersToggle = $('bc-toggle-members');
  const memberPane = $('bc-members-pane');
  const status = $('bc-platform-status');
  const users = $('bc-platform-messages');
  const state = {view:'chat', user:null,community:null,channel:null,members:[]};
  const ACCENT_KEY = 'brasilcord-native-accent';
  let accent = 'green';

  function initials(value) {
    const name = String(value || 'BC').trim();
    return name.slice(0,2).toLocaleUpperCase('pt-BR') || 'BC';
  }

  function openView(view, {focus=true} = {}) {
    if (!views.has(view)) return;
    state.view = view;
    workarea.dataset.bcActiveView = view;
  
  const accountSettings = $('bc-user-settings');
  const accountMenu = $('bc-account-settings-menu');
  accountSettings.addEventListener('click', () => {
    const opening = accountMenu.hidden;
    accountMenu.hidden = !opening;
    accountSettings.setAttribute('aria-expanded',String(opening));
  });
  accountMenu.querySelector('[data-bc-view="profile"]').addEventListener('click', () => {
    accountMenu.hidden = true;
    accountSettings.setAttribute('aria-expanded','false');
    openView('profile');
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.bc-account-panel')) {
      accountMenu.hidden = true;
      accountSettings.setAttribute('aria-expanded','false');
    }
  });
  $('bc-user-mic-toggle').addEventListener('click', () => $('bc-call-mute').click());
  $('bc-user-audio-toggle').addEventListener('click', () => $('bc-call-deafen').click());
  for (const [source,target] of [['bc-call-mute','bc-user-mic-toggle'],['bc-call-deafen','bc-user-audio-toggle']]) {
    const sync = () => {
      const original = $(source), button = $(target);
      button.disabled = original.disabled;
      button.setAttribute('aria-pressed',original.getAttribute('aria-pressed') || 'false');
      button.classList.toggle('is-on',original.getAttribute('aria-pressed') === 'true');
    };
    $(source).addEventListener('click',sync);
    new MutationObserver(sync).observe($(source),{attributes:true,attributeFilter:['disabled','aria-pressed']});
    sync();
  }


  // Remove apenas o caret antigo "v" que algumas versões antigas do painel ainda injetam.
  function removeLegacyAccountCaret(){
    const area=document.querySelector('.bc-channel-bottom');
    if(!area)return;
    area.querySelectorAll('button').forEach(button=>{
      if(['bc-user-profile-shortcut','bc-user-mic-toggle','bc-user-audio-toggle','bc-user-settings','bc-platform-logout','bc-platform-invite'].includes(button.id))return;
      const label=(button.textContent||'').trim().toLocaleLowerCase('pt-BR');
      const title=(button.getAttribute('aria-label')||button.title||'').trim().toLocaleLowerCase('pt-BR');
      if(['v','⌄','▾','▼','chevron','abrir menu'].includes(label)||label==='v'+String.fromCharCode(0)||title==='abrir menu da conta')button.remove();
    });
  }
  removeLegacyAccountCaret();
  const accountCaretObserver=new MutationObserver(removeLegacyAccountCaret);
  const accountArea=document.querySelector('.bc-channel-bottom');
  if(accountArea)accountCaretObserver.observe(accountArea,{childList:true,subtree:true});

  controls.forEach(control => {
      const active = control.dataset.bcView === view;
      control.classList.toggle('is-active',active);
      control.setAttribute('aria-pressed',String(active));
    });
    panels.forEach(panel => {
      panel.hidden = panel.dataset.bcViewPanel !== view;
    });
    if (view === 'chat') {
      memberPane.hidden = workarea.dataset.bcMembersHidden === 'true';
    } else {
      memberPane.hidden = true;
    }
    if (focus) {
      const focused = root.querySelector('[data-bc-view-panel="'+view+'"] input:not([disabled])');
      const heading = root.querySelector('[data-bc-view-panel="'+view+'"] h2');
      if (focused && view === 'friends') focused.focus({preventScroll:true});
      else if (heading) {
        heading.tabIndex = -1;
        heading.focus({preventScroll:true});
      }
    }
  }

  controls.forEach(control => {
    control.addEventListener('click', () => openView(control.dataset.bcView));
  });

  function updateAvatar(user) {
    const name = user?.displayName || user?.username || 'BC';
    $('bc-profile-avatar').textContent = initials(name);
    $('bc-user-avatar').textContent = initials(name);
    $('bc-profile-display-name').textContent = user?.displayName || 'Minha conta';
    $('bc-profile-handle').textContent = user?.username ? '@'+user.username : '@brasilcord';
    $('bc-profile-bio').textContent = user?.bio || 'Adicione uma biografia para personalizar seu perfil.';
    $('bc-platform-user-label').textContent = (user?.displayName || user?.username || 'Minha conta') + (user?.username ? ' · @'+user.username : '');
    $('bc-dock-personal-status').textContent = user?.bio ? '📌 ' + user.bio : '📌 SEMI EM BREVE BIO!';
  }

  function updateRole() {
    const badge = $('bc-profile-role');
    const role = state.community?.role;
    if (!role) {
      badge.hidden = true;
      badge.textContent = '';
    } else {
      badge.hidden = false;
      badge.textContent = role === 'owner' ? '👑 Dono de comunidade' : role === 'admin' ? '🛡️ Administrador' : 'Membro';
    }
  }

  function filterMessages() {
    const query = search.value.trim().toLocaleLowerCase('pt-BR');
    const rows = [...users.querySelectorAll('.bc-platform-message')];
    for (const row of rows) {
      row.dataset.bcFilterHidden = String(Boolean(query) && !row.textContent.toLocaleLowerCase('pt-BR').includes(query));
    }
    const filtered = rows.filter(x=>x.dataset.bcFilterHidden !== 'true').length;
    const info = $('bc-platform-chat-info');
    if (query) info.textContent = filtered + ' mensagem(ns) encontradas nesta página';
    else info.textContent = 'Mensagens da sua comunidade';
  }

  search.addEventListener('input',filterMessages);
  new MutationObserver(filterMessages).observe(users,{childList:true});

  membersToggle.addEventListener('click', () => {
    const hidden = workarea.dataset.bcMembersHidden !== 'true';
    workarea.dataset.bcMembersHidden = String(hidden);
    membersToggle.setAttribute('aria-pressed',String(!hidden));
    memberPane.hidden = hidden || state.view !== 'chat';
  });

  function onPlatformState(event) {
    const data = event.detail;
    if (!data || typeof data !== 'object') return;
    switch(data.type) {
      case 'user':
        state.user = data.user || null;
        updateAvatar(state.user);
        break;
      case 'logout':
        state.user = null;
        state.channel = null;
        state.community = null;
        state.members = [];
        updateAvatar(null);
        updateRole();
        $('bc-member-count').textContent = '0';
        openView('chat',{focus:false});
        break;
      case 'community':
        state.community = data.community || null;
        updateRole();
        openView('chat',{focus:false});
        break;
      case 'channel':
        state.channel = data.channel || null;
        search.value = '';
        filterMessages();
        openView('chat',{focus:false});
        break;
      case 'members':
        state.members = Array.isArray(data.members) ? data.members : [];
        $('bc-member-count').textContent = String(state.members.length);
        break;
    }
  }
  document.addEventListener('bc:platform-state',onPlatformState);

  // Aplica a cor local apenas na area BrasilCord (nao no Discord).
  try {
    const saved = localStorage.getItem(ACCENT_KEY);
    if (['green','yellow','blue'].includes(saved)) accent = saved;
  } catch {}
  const swatches = [...root.querySelectorAll('[data-bc-accent]')];
  function useAccent(next) {
    if (!['green','yellow','blue'].includes(next)) return;
    accent = next;
    root.dataset.bcAccent = next;
    swatches.forEach(swatch => {
      const active = swatch.dataset.bcAccent === next;
      swatch.classList.toggle('is-active',active);
      swatch.setAttribute('aria-pressed',String(active));
    });
    try {localStorage.setItem(ACCENT_KEY,next);} catch {}
  }
  swatches.forEach(swatch=>swatch.addEventListener('click',()=>useAccent(swatch.dataset.bcAccent)));
  useAccent(accent);

  // A visibilidade do painel segue a aba selecionada e a largura da janela.
  function refreshMembersOnResize() {
    const compact = window.matchMedia('(max-width: 1200px)').matches;
    memberPane.hidden = compact || state.view !== 'chat' || workarea.dataset.bcMembersHidden === 'true';
  }
  window.addEventListener('resize',refreshMembersOnResize);
  const origOpenView = openView;
  // Estado inicial. Conteudo da interface e preenchido apenas apos login real.
  workarea.dataset.bcMembersHidden = 'false';
  origOpenView('chat',{focus:false});
  refreshMembersOnResize();

  window.addEventListener('pagehide', () => {
    document.removeEventListener('bc:platform-state',onPlatformState);
    window.removeEventListener('resize',refreshMembersOnResize);
  }, {once:true});
})();
