'use strict';

(() => {
  const root = document.querySelector('#page-app .bc-community-desktop');
  const app = document.getElementById('bc-platform-app');
  if (!root || !app) return;

  const messages = document.getElementById('bc-platform-messages');
  const status = document.getElementById('bc-platform-status');
  const viewNames = {
    chat: 'Comunidade',
    friends: 'Amigos',
    calls: 'Chamadas',
    profile: 'Perfil',
    discover: 'Descobrir',
    dms: 'Mensagens diretas',
    tools: 'Ferramentas'
  };

  function notify(message, kind = 'info') {
    if (!status) return;
    status.textContent = message;
    status.dataset.cleanKind = kind;
    status.classList.add('is-visible');
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => status.classList.remove('is-visible'), 2200);
  }

  function enhanceEmptyChat() {
    if (!messages) return;
    const hasMessage = messages.querySelector('.bc-platform-message, .bc-message-row, [data-message-id], article');
    const text = messages.textContent || '';
    const placeholder = !hasMessage && /Selecione um canal para conversar|mensagens da sua comunidade aparecerão aqui/i.test(text);
    const existing = messages.querySelector('.bc-clean-empty');
    if (placeholder && !existing) {
      messages.innerHTML = '<div class="bc-clean-empty"><div class="bc-clean-empty-card"><div class="bc-clean-empty-icon" aria-hidden="true">#</div><h3>Pronto para conversar?</h3><p>Escolha um canal à esquerda ou comece uma mensagem. Aqui você acompanha novidades e participa da comunidade em tempo real.</p><div class="bc-clean-empty-actions"><button type="button" data-bc-clean-action="channel">Abrir boas-vindas</button><button type="button" data-bc-clean-action="members">Ver membros</button><button type="button" data-bc-clean-action="compose">Escrever mensagem</button></div></div></div>';
    }
    if (!placeholder && existing) existing.remove();
  }

  function syncView() {
    const view = app.dataset.bcActiveView || 'chat';
    root.dataset.bcCleanView = view;
    document.title = (viewNames[view] || 'BrasilCord') + ' · BrasilCord';
  }

  function handleAction(action) {
    if (action === 'members') {
      document.getElementById('bc-toggle-members')?.click();
      notify('Membros alternados');
      return;
    }
    if (action === 'compose') {
      const input = document.getElementById('bc-platform-message-input');
      if (input && !input.disabled) {
        input.focus({preventScroll: true});
        notify('Mensagem pronta');
      } else {
        notify('Escolha um canal para escrever', 'error');
      }
      return;
    }
    const first = document.querySelector('#bc-platform-channel-list button');
    first?.click();
    notify('Canal de boas-vindas aberto');
  }

  root.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-bc-view]');
    if (viewButton) {
      const label = viewNames[viewButton.dataset.bcView] || 'Área';
      window.setTimeout(() => notify(label + ' aberta'), 0);
    }
    const actionButton = event.target.closest('[data-bc-clean-action]');
    if (actionButton) handleAction(actionButton.dataset.bcCleanAction);
  });

  root.addEventListener('pointerdown', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    button.classList.add('bc-clean-pressing');
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    root.addEventListener(type, event => {
      const button = event.target.closest('button');
      if (button) button.classList.remove('bc-clean-pressing');
    });
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const search = document.getElementById('bc-chat-search');
      search?.focus({preventScroll: true});
      search?.select();
      notify('Pesquisa pronta');
    }
    if (event.key === 'Escape') {
      document.querySelectorAll('[aria-expanded="true"]').forEach(element => element.setAttribute('aria-expanded', 'false'));
    }
  });

  const emptyObserver = messages ? new MutationObserver(enhanceEmptyChat) : null;
  emptyObserver?.observe(messages, {childList: true, subtree: true});
  const viewObserver = new MutationObserver(syncView);
  viewObserver.observe(app, {attributes: true, attributeFilter: ['data-bc-active-view']});
  enhanceEmptyChat();
  syncView();

  window.addEventListener('pagehide', () => {
    emptyObserver?.disconnect();
    viewObserver.disconnect();
  }, {once: true});
})();
