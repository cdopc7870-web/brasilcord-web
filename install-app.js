'use strict';
(() => {
  let installPrompt = null;
  const $ = id => document.getElementById(id);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const dismissedKey = 'brasilcord-install-dismissed';
  const els = {};
  function showHelp() {
    const browser = /Firefox/i.test(navigator.userAgent) ? 'Firefox' : /Edg/i.test(navigator.userAgent) ? 'Edge' : /Chrome/i.test(navigator.userAgent) ? 'Chrome' : 'navegador';
    const message = isIos()
      ? 'No iPhone ou iPad, abra o BrasilCord no Safari, toque em Compartilhar (ícone de quadrado com seta para cima) e escolha "Adicionar à Tela de Início". Confirme em "Adicionar".'
      : isAndroid()
      ? 'No Android, abra o BrasilCord no Chrome, toque no menu ⋮ e escolha "Instalar app" ou "Adicionar à tela inicial". Confirme a instalação.'
      : 'No computador, abra o BrasilCord no Chrome ou Edge e use o ícone Instalar aplicativo na barra de endereços ou o menu do navegador > Instalar BrasilCord. No '+browser+', a opção pode variar conforme a versão.';
    els.helpText.textContent = message;
    if (typeof els.help.showModal === 'function') els.help.showModal();
    else els.help.setAttribute('open', '');
  }
  function refresh() {
    const installed = isStandalone();
    els.banner.hidden = installed || sessionStorage.getItem(dismissedKey) === '1';
    els.button.textContent = installPrompt ? 'Instalar aplicativo' : 'Como instalar';
    els.button.setAttribute('aria-label', installPrompt ? 'Instalar o BrasilCord neste dispositivo' : 'Ver instruções para instalar o BrasilCord');
  }
  document.addEventListener('DOMContentLoaded', () => {
    els.banner = $('bc-install-banner');
    els.button = $('bc-install-button');
    els.help = $('bc-install-help');
    els.helpText = $('bc-install-help-text');
    if (!els.banner || !els.button || !els.help || !els.helpText) return;
    els.button.addEventListener('click', async () => {
      if (!installPrompt) { showHelp(); return; }
      const prompt = installPrompt;
      installPrompt = null;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome !== 'accepted') showHelp();
      } catch (error) {
        console.warn('Não foi possível iniciar instalação automática:', error);
        showHelp();
      }
      refresh();
    });
    $('bc-install-dismiss').addEventListener('click', () => {
      sessionStorage.setItem(dismissedKey, '1'); refresh();
    });
    function closeHelp() { if (els.help.open && typeof els.help.close === 'function') els.help.close(); else els.help.removeAttribute('open'); }
    $('bc-install-help-close').addEventListener('click', closeHelp);
    $('bc-install-help-ok').addEventListener('click', closeHelp);
    els.help.addEventListener('click', event => { if (event.target === els.help) closeHelp(); });
    refresh();
  });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    if (els.button) refresh();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    if (els.banner) { sessionStorage.removeItem(dismissedKey); els.banner.hidden = true; }
  });
  const displayQuery = window.matchMedia('(display-mode: standalone)');
  displayQuery.addEventListener?.('change', () => { if (els.banner) refresh(); });
})();
