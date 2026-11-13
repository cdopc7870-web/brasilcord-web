'use strict';

(() => {
  const root = document.querySelector('#page-app .bc-community-desktop');
  const app = document.getElementById('bc-platform-app');
  if (!root || !app) return;

  const search = document.getElementById('bc-chat-search');
  const statusHost = document.getElementById('bc-platform-status');
  const viewNames = {
    chat: 'Comunidade',
    friends: 'Amigos',
    calls: 'Chamadas',
    profile: 'Perfil',
    discover: 'Descobrir',
    dms: 'Mensagens diretas',
    tools: 'Ferramentas'
  };

  let status = document.querySelector('.bc-polish-status');
  if (!status && statusHost) {
    status = document.createElement('span');
    status.className = 'bc-polish-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    statusHost.append(status);
  }

  let statusTimer;
  function notify(message, kind = 'info') {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
    status.classList.add('is-visible');
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => status.classList.remove('is-visible'), 2200);
  }

  function syncView() {
    const view = app.dataset.bcActiveView || 'chat';
    root.dataset.bcPolishView = view;
    document.title = (viewNames[view] || 'BrasilCord') + ' · BrasilCord';
  }

  function focusSearch() {
    if (!search) return;
    search.focus({preventScroll: true});
    search.select();
    notify('Pesquisa pronta');
  }

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase('pt-BR') === 'k') {
      event.preventDefault();
      focusSearch();
    }
    if (event.key === 'Escape') {
      document.querySelectorAll('[aria-expanded="true"]').forEach(element => {
        element.setAttribute('aria-expanded', 'false');
      });
      document.querySelectorAll('[data-bc-view-panel]').forEach(panel => {
        if (panel.dataset.bcViewPanel !== (app.dataset.bcActiveView || 'chat')) panel.hidden = true;
      });
    }
  });

  root.addEventListener('click', event => {
    const control = event.target.closest('[data-bc-view]');
    if (control) {
      const label = viewNames[control.dataset.bcView] || 'Área';
      window.setTimeout(() => notify(label + ' aberta'), 0);
    }

    const button = event.target.closest('button');
    if (button && button.dataset.bcPolishNotice) notify(button.dataset.bcPolishNotice);
  });

  root.addEventListener('pointerdown', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    button.classList.add('bc-polish-pressing');
  });

  ['pointerup','pointercancel','pointerleave'].forEach(type => {
    root.addEventListener(type, event => {
      const button = event.target.closest('button');
      if (button) button.classList.remove('bc-polish-pressing');
    });
  });

  if (search) {
    search.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        search.value = '';
        search.dispatchEvent(new Event('input', {bubbles: true}));
        search.blur();
        notify('Pesquisa limpa');
      }
    });
  }

  const observer = new MutationObserver(syncView);
  observer.observe(app, {attributes: true, attributeFilter: ['data-bc-active-view']});
  syncView();

  window.addEventListener('pagehide', () => observer.disconnect(), {once: true});
})();
