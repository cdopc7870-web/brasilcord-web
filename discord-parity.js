'use strict';

(() => {
  const root = document.querySelector('#page-app .bc-community-desktop');
  if (!root || root.dataset.bcParityReady === 'true') return;
  root.dataset.bcParityReady = 'true';

  const settingsKey = 'brasilcord-ui-parity';
  const defaultSettings = {
    theme: 'dark',
    compact: false,
    reducedMotion: false,
    highContrast: false,
    notifications: true
  };
  let settings = readSettings();
  let activeSettingsTab = 'appearance';
  let notificationItems = [];
  let quickItems = [];
  let quickIndex = 0;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function readSettings() {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem(settingsKey) || '{}') };
    } catch {
      return { ...defaultSettings };
    }
  }

  function saveSettings() {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
    applySettings();
  }

  function applySettings() {
    document.body.classList.toggle('bc-parity-compact', Boolean(settings.compact));
    document.body.classList.toggle('bc-parity-reduced-motion', Boolean(settings.reducedMotion));
    document.body.classList.toggle('bc-parity-high-contrast', Boolean(settings.highContrast));
    document.body.classList.toggle('bc-parity-theme-dim', settings.theme === 'dim');
    document.body.classList.toggle('bc-parity-theme-light', settings.theme === 'light');
    document.documentElement.style.setProperty('--bc-parity-accent', '#78d8ad');
  }

  function addNotification(text, type = 'info') {
    if (!settings.notifications || !text) return;
    notificationItems.unshift({ text, type, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
    notificationItems = notificationItems.slice(0, 24);
    updateNotificationBadge();
  }

  function updateNotificationBadge() {
    const button = $('[data-parity-action="notifications"]');
    if (!button) return;
    let badge = $('.bc-parity-badge', button);
    if (!notificationItems.length) {
      badge?.remove();
      return;
    }
    if (!badge) {
      badge = make('span', 'bc-parity-badge');
      button.append(badge);
    }
    badge.textContent = String(Math.min(notificationItems.length, 99));
  }

  function closeSurfaces(except) {
    $$('.bc-parity-surface').forEach(surface => {
      if (surface !== except) surface.hidden = true;
    });
  }

  function addSurface(className, title, subtitle) {
    const surface = make('section', 'bc-parity-surface ' + className);
    surface.hidden = true;
    const head = make('header', 'bc-parity-surface-head');
    const copy = make('div');
    copy.append(make('h2', '', title), make('p', '', subtitle));
    const close = make('button', 'bc-parity-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar');
    close.addEventListener('click', () => { surface.hidden = true; });
    head.append(copy, close);
    surface.append(head);
    root.append(surface);
    return surface;
  }

  function setupTopbar() {
    const topbar = $('.bc-stage-topbar');
    if (!topbar || $('.bc-parity-actions', topbar)) return;
    const actions = make('div', 'bc-parity-actions');
    const controls = [
      ['notifications', '♢', 'Notificações'],
      ['quick', '⌕', 'Busca rápida (Ctrl+K)'],
      ['pins', '⚑', 'Mensagens fixadas'],
      ['settings', '⚙', 'Configurações do aplicativo'],
      ['help', '?', 'Atalhos e ajuda']
    ];
    controls.forEach(([action, label, title]) => {
      const button = make('button', 'bc-parity-top-button', label);
      button.type = 'button';
      button.dataset.parityAction = action;
      button.title = title;
      button.setAttribute('aria-label', title);
      actions.append(button);
    });
    topbar.insertBefore(actions, $('#bc-platform-connection', topbar));
    actions.addEventListener('click', event => {
      const button = event.target.closest('[data-parity-action]');
      if (!button) return;
      const action = button.dataset.parityAction;
      if (action === 'notifications') openNotifications();
      if (action === 'quick') openQuickSwitcher();
      if (action === 'pins') openPinned();
      if (action === 'settings') openSettings('appearance');
      if (action === 'help') openSettings('shortcuts');
    });
  }

  function buildSurfaces() {
    const quick = addSurface('bc-quick-switcher', 'Busca rápida', 'Navegue por comunidades, canais e áreas do aplicativo.');
    const quickInput = make('input', 'bc-quick-search');
    quickInput.type = 'search';
    quickInput.placeholder = 'Digite o nome de um canal, comunidade ou comando…';
    quickInput.setAttribute('aria-label', 'Busca rápida');
    const quickResults = make('div', 'bc-quick-results');
    quick.append(quickInput, quickResults);

    const notifications = addSurface('bc-notification-panel', 'Notificações', 'Pedidos, atividades e avisos recentes.');
    const notificationList = make('div', 'bc-notification-list');
    notifications.append(notificationList);

    const settingsSurface = addSurface('bc-parity-settings', 'Configurações do BrasilCord', 'Preferências locais deste dispositivo.');
    const settingsLayout = make('div', 'bc-settings-layout');
    const tabs = make('nav', 'bc-settings-tabs');
    [['appearance','Aparência'],['notifications','Notificações'],['accessibility','Acessibilidade'],['shortcuts','Atalhos']].forEach(([id,label]) => {
      const tab = make('button', 'bc-settings-tab', label);
      tab.type = 'button';
      tab.dataset.parityTab = id;
      tabs.append(tab);
    });
    const content = make('div', 'bc-settings-content');
    settingsLayout.append(tabs, content);
    settingsSurface.append(settingsLayout);

    const thread = addSurface('bc-parity-thread', 'Thread da mensagem', 'Respostas e contexto da conversa.');
    const threadBody = make('div', 'bc-thread-body');
    thread.append(threadBody);

    const pinned = addSurface('bc-parity-thread', 'Mensagens fixadas', 'Atalhos para os destaques deste canal.');
    pinned.dataset.parityPinned = 'true';
    const pinnedBody = make('div', 'bc-parity-pinned-list');
    pinned.append(pinnedBody);

    root.addEventListener('click', event => {
      const tab = event.target.closest('[data-parity-tab]');
      if (tab) {
        activeSettingsTab = tab.dataset.parityTab;
        renderSettings(settingsSurface, content, tabs);
      }
      const close = event.target.closest('[data-parity-close-surface]');
      if (close) close.closest('.bc-parity-surface').hidden = true;
      const composerButton = event.target.closest('[data-parity-composer]');
      if (composerButton) toggleComposerMenu(composerButton);
      const emoji = event.target.closest('[data-parity-emoji]');
      if (emoji) insertIntoComposer(emoji.dataset.parityEmoji);
      const mention = event.target.closest('[data-parity-mention]');
      if (mention) insertIntoComposer('@' + mention.dataset.parityMention + ' ');
    });

    return { quick, quickInput, quickResults, notifications, notificationList, settingsSurface, settingsContent: content, settingsTabs: tabs, thread, threadBody, pinned, pinnedBody };
  }

  function renderSettings(surface, content, tabs) {
    $$('.bc-settings-tab', tabs).forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.parityTab === activeSettingsTab)));
    content.replaceChildren();
    if (activeSettingsTab === 'appearance') {
      content.append(make('h3', '', 'Aparência'));
      content.append(make('p', '', 'Escolha como o BrasilCord aparece neste dispositivo. Essas opções não alteram sua conta.'));
      content.append(settingSelect('Tema', 'theme', [['dark','Escuro'],['dim','Cinza profundo'],['light','Claro']], 'Tema global'));
      content.append(settingToggle('Compactar mensagens e canais', 'compact', 'Mais itens visíveis por tela.'));
    } else if (activeSettingsTab === 'notifications') {
      content.append(make('h3', '', 'Notificações'));
      content.append(make('p', '', 'Controle apenas os avisos visuais desta interface.'));
      content.append(settingToggle('Central de notificações', 'notifications', 'Mostra eventos recentes no topo do aplicativo.'));
      content.append(make('button', 'bc-parity-close', 'Limpar notificações'));
      const clear = content.lastChild;
      clear.addEventListener('click', () => { notificationItems = []; updateNotificationBadge(); renderNotificationList(); });
    } else if (activeSettingsTab === 'accessibility') {
      content.append(make('h3', '', 'Acessibilidade'));
      content.append(make('p', '', 'Preferências locais para leitura e movimento.'));
      content.append(settingToggle('Reduzir animações', 'reducedMotion', 'Desativa transições e rolagens suaves.'));
      content.append(settingToggle('Alto contraste', 'highContrast', 'Aumenta o contraste do texto e dos estados ativos.'));
    } else {
      content.append(make('h3', '', 'Atalhos de teclado'));
      content.append(make('p', '', 'Atalhos ativos enquanto você estiver no aplicativo.'));
      const table = make('table', 'bc-shortcut-table');
      [['Ctrl/⌘ + K','Busca rápida'],['Esc','Fechar painel aberto'],['Ctrl/⌘ + Enter','Enviar mensagem'],['E','Abrir configurações']].forEach(row => {
        const tr = make('tr'); tr.append(make('td','',row[1]),make('td','',row[0])); table.append(tr);
      });
      content.append(table);
    }
  }

  function settingToggle(label, key, hint) {
    const row = make('label', 'bc-settings-field');
    const text = make('span');
    text.append(make('strong','',label), make('small','',hint));
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(settings[key]);
    input.addEventListener('change', () => { settings[key] = input.checked; saveSettings(); });
    row.append(text, input);
    return row;
  }

  function settingSelect(label, key, options, hint) {
    const row = make('label', 'bc-settings-field');
    const text = make('span'); text.append(make('strong','',label), make('small','',hint));
    const select = document.createElement('select');
    options.forEach(([value, title]) => { const option = new Option(title, value); select.append(option); });
    select.value = settings[key];
    select.addEventListener('change', () => { settings[key] = select.value; saveSettings(); });
    row.append(text, select);
    return row;
  }

  function openSettings(tab = 'appearance') {
    activeSettingsTab = tab;
    closeSurfaces(surfaces.settingsSurface);
    surfaces.settingsSurface.hidden = false;
    renderSettings(surfaces.settingsSurface, surfaces.settingsContent, surfaces.settingsTabs);
  }

  function renderNotificationList() {
    surfaces.notificationList.replaceChildren();
    if (!notificationItems.length) {
      surfaces.notificationList.append(make('div', 'bc-notification-empty', 'Nenhuma notificação nova.'));
      return;
    }
    notificationItems.forEach(item => {
      const card = make('article', 'bc-notification-item');
      card.append(make('strong','',item.text), make('time','',item.time));
      surfaces.notificationList.append(card);
    });
  }

  function openNotifications() {
    closeSurfaces(surfaces.notifications);
    renderNotificationList();
    surfaces.notifications.hidden = false;
    notificationItems = [];
    updateNotificationBadge();
  }

  function collectQuickItems() {
    const items = [];
    const seen = new Set();
    $$('[data-bc-view]').forEach(button => {
      const label = button.getAttribute('aria-label') || button.title || button.textContent.trim();
      if (!label || seen.has('view:' + label)) return;
      seen.add('view:' + label);
      items.push({ icon: '◈', label, type: 'Área', run: () => button.click() });
    });
    $$('#bc-platform-communities button, #bc-platform-channel-list button, #bc-platform-voice-list button, #bc-platform-friends button').forEach(button => {
      const label = button.getAttribute('aria-label') || button.title || button.textContent.trim();
      if (!label || seen.has(label)) return;
      seen.add(label);
      const type = button.closest('#bc-platform-channel-list') ? 'Canal' : button.closest('#bc-platform-voice-list') ? 'Voz' : button.closest('#bc-platform-friends') ? 'Amigo' : 'Comunidade';
      items.push({ icon: type === 'Canal' ? '#' : type === 'Voz' ? '◉' : '•', label, type, run: () => button.click() });
    });
    return items;
  }

  function renderQuickResults() {
    const query = surfaces.quickInput.value.trim().toLocaleLowerCase('pt-BR');
    quickItems = collectQuickItems().filter(item => !query || (item.label + ' ' + item.type).toLocaleLowerCase('pt-BR').includes(query));
    quickIndex = Math.max(0, Math.min(quickIndex, quickItems.length - 1));
    surfaces.quickResults.replaceChildren();
    if (!quickItems.length) {
      surfaces.quickResults.append(make('div', 'bc-notification-empty', 'Nada encontrado. Tente outro termo.'));
      return;
    }
    quickItems.slice(0, 40).forEach((item, index) => {
      const button = make('button', 'bc-quick-result');
      button.type = 'button';
      button.dataset.index = String(index);
      button.setAttribute('aria-selected', String(index === quickIndex));
      button.append(make('span','bc-quick-result-icon',item.icon));
      const copy = make('span','bc-quick-result-copy');
      copy.append(make('strong','',item.label), make('small','',item.type));
      button.append(copy);
      button.addEventListener('click', () => { item.run(); surfaces.quick.hidden = true; });
      surfaces.quickResults.append(button);
    });
  }

  function openQuickSwitcher() {
    closeSurfaces(surfaces.quick);
    surfaces.quick.hidden = false;
    surfaces.quickInput.value = '';
    quickIndex = 0;
    renderQuickResults();
    setTimeout(() => surfaces.quickInput.focus(), 0);
  }

  function insertIntoComposer(value) {
    const input = $('#bc-platform-message-input');
    if (!input || input.disabled) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + value + input.value.slice(end);
    input.selectionStart = input.selectionEnd = start + value.length;
    input.focus();
  }

  function toggleComposerMenu(button) {
    let menu = $('.bc-parity-composer-menu');
    if (!menu) {
      menu = make('div', 'bc-parity-composer-menu');
      menu.hidden = true;
      menu.append(make('span','bc-composer-menu-label','Inserir no texto'));
      const grid = make('div','bc-composer-menu-grid');
      ['😀','😂','😍','😮','😢','👏','🔥','🎉','💚','🇧🇷','👍','✅','✨','🎮','🚀'].forEach(emoji => {
        const item = make('button');
        item.type = 'button'; item.textContent = emoji; item.dataset.parityEmoji = emoji;
        grid.append(item);
      });
      const mentionLabel = make('span','bc-composer-menu-label','Mencionar');
      mentionLabel.style.marginTop = '10px';
      const mentions = make('div','bc-composer-menu-grid');
      const names = $$('.bc-platform-member .bc-member-name strong').map(node => node.textContent.trim()).filter(Boolean).slice(0, 10);
      (names.length ? names : ['everyone']).forEach(name => {
        const item = make('button'); item.type = 'button'; item.textContent = '@'; item.title = '@' + name; item.dataset.parityMention = name;
        mentions.append(item);
      });
      menu.append(grid, mentionLabel, mentions);
      button.closest('form').append(menu);
    }
    menu.hidden = !menu.hidden;
  }

  function dispatchMessageMenu(row, label) {
    row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.max(20, row.getBoundingClientRect().left + 40), clientY: Math.max(20, row.getBoundingClientRect().top + 20) }));
    setTimeout(() => {
      const action = $$('.bc-message-context-menu button').find(item => item.textContent.includes(label));
      action?.click();
    }, 0);
  }

  function openThread(row) {
    const clone = row.cloneNode(true);
    clone.querySelector('.bc-parity-message-actions')?.remove();
    surfaces.threadBody.replaceChildren();
    surfaces.threadBody.append(make('div','bc-thread-note','As respostas usam o mesmo canal e continuam disponíveis para todos os membros.'));
    const rootCard = make('div','bc-thread-message');
    rootCard.append(clone);
    surfaces.threadBody.append(rootCard);
    const replies = $$('#bc-platform-messages .bc-platform-message').filter(item => item.querySelector('.bc-reply-preview') && item !== row);
    if (replies.length) {
      surfaces.threadBody.append(make('div','bc-thread-note',String(replies.length) + ' resposta(s) encontrada(s) nesta conversa.'));
      replies.slice(0, 20).forEach(reply => {
        const card = make('div','bc-thread-message');
        const copy = reply.cloneNode(true); copy.querySelector('.bc-parity-message-actions')?.remove();
        card.append(copy); surfaces.threadBody.append(card);
      });
    } else {
      surfaces.threadBody.append(make('div','bc-thread-note','Ainda não há respostas visíveis para esta mensagem.'));
    }
    closeSurfaces(surfaces.thread);
    surfaces.thread.hidden = false;
  }

  function openPinned() {
    const pinned = $$('#bc-platform-messages .bc-platform-message').filter(row => row.querySelector('.bc-message-pinned'));
    surfaces.pinnedBody.replaceChildren();
    if (!pinned.length) {
      surfaces.pinnedBody.append(make('div','bc-notification-empty','Nenhuma mensagem fixada está carregada neste canal.'));
    } else {
      pinned.forEach(row => {
        const card = make('article','bc-parity-pinned-item');
        const copy = row.cloneNode(true); copy.querySelector('.bc-parity-message-actions')?.remove();
        const jump = make('button','', 'Ir para a mensagem');
        jump.type = 'button';
        jump.addEventListener('click', () => { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('bc-parity-highlight'); setTimeout(() => row.classList.remove('bc-parity-highlight'), 1300); });
        card.append(copy, jump); surfaces.pinnedBody.append(card);
      });
    }
    closeSurfaces(surfaces.pinned);
    surfaces.pinned.hidden = false;
  }

  function decorateMessages() {
    $$('#bc-platform-messages .bc-platform-message').forEach(row => {
      if (row.dataset.bcParityDecorated === 'true') return;
      row.dataset.bcParityDecorated = 'true';
      const actions = make('div','bc-parity-message-actions');
      [['↩','Responder','reply'],['😊','Reagir','react'],['⌘','Thread','thread'],['•••','Mais','more']].forEach(([icon,title,action]) => {
        const button = make('button','',icon);
        button.type = 'button'; button.title = title; button.setAttribute('aria-label',title); button.dataset.parityMessageAction = action;
        button.addEventListener('click', event => {
          event.stopPropagation();
          if (action === 'thread') openThread(row);
          else if (action === 'reply') dispatchMessageMenu(row, 'Responder');
          else if (action === 'react') dispatchMessageMenu(row, 'Reagir');
          else { row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: Math.max(20, row.getBoundingClientRect().left + 40), clientY: Math.max(20, row.getBoundingClientRect().top + 20) })); }
        });
        actions.append(button);
      });
      row.append(actions);
    });
  }

  function setupComposer() {
    const form = $('#bc-platform-message-form');
    if (!form || $('.bc-parity-composer-tool', form)) return;
    const button = make('button','bc-parity-composer-tool','＋');
    button.type = 'button'; button.dataset.parityComposer = 'true'; button.title = 'Inserir emoji ou menção'; button.setAttribute('aria-label','Inserir emoji ou menção');
    form.insertBefore(button, $('#bc-platform-message-input'));
    form.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (!form.querySelector('button[type=submit]')?.disabled) form.requestSubmit();
      }
    });
  }

  function setupKeyboard() {
    document.addEventListener('keydown', event => {
      const tag = document.activeElement?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); openQuickSwitcher(); return;
      }
      if (event.key === 'Escape') {
        closeSurfaces();
        return;
      }
      if (!typing && event.key.toLowerCase() === 'e') openSettings('appearance');
    });
    surfaces.quickInput.addEventListener('input', renderQuickResults);
    surfaces.quickInput.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); quickIndex = Math.min(quickIndex + 1, quickItems.length - 1); renderQuickResults(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); quickIndex = Math.max(0, quickIndex - 1); renderQuickResults(); }
      if (event.key === 'Enter' && quickItems[quickIndex]) { quickItems[quickIndex].run(); surfaces.quick.hidden = true; }
    });
  }

  function bindEvents() {
    document.addEventListener('bc:dm-requests-updated', () => addNotification('Você recebeu uma atualização nas solicitações de conversa.'));
    document.addEventListener('bc:community-joined', () => addNotification('Você entrou em uma nova comunidade.'));
    document.addEventListener('bc:refresh-current-community', () => addNotification('A comunidade foi atualizada.'));
  }

  const surfaces = buildSurfaces();
  setupTopbar();
  setupComposer();
  setupKeyboard();
  bindEvents();
  applySettings();
  renderSettings(surfaces.settingsSurface, surfaces.settingsContent, surfaces.settingsTabs);
  addNotification('BrasilCord pronto para usar.');
  const observer = new MutationObserver(() => { decorateMessages(); });
  const messageHost = $('#bc-platform-messages');
  if (messageHost) { decorateMessages(); observer.observe(messageHost, { childList: true, subtree: true }); }
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
})();