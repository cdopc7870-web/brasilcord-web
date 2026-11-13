'use strict';
(() => {
  const backend = 'https://brasilcord-backend.onrender.com';
  const summary = document.getElementById('bc-status-summary');
  const summaryText = document.getElementById('bc-status-summary-text');
  const updated = document.getElementById('bc-status-updated');
  const refreshButton = document.getElementById('bc-status-refresh');
  const checks = {
    site: {url: () => './index.html?status=' + Date.now(), label: 'Site funcionando'},
    backend: {url: () => backend + '/health', label: 'Servidor online'},
    api: {url: () => backend + '/api/platform/health', label: 'API respondendo'},
    voice: {url: () => backend + '/api/ice-config', label: 'Chamadas disponíveis'}
  };

  function formatUptime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const parts = [];
    if (days) parts.push(days + 'd');
    if (hours || days) parts.push(hours + 'h');
    parts.push(minutes + 'min');
    return parts.join(' ');
  }

  function setCard(id, state, detail, uptimeText = 'Uptime: indisponível') {
    const card = document.querySelector('[data-status-card="' + id + '"]');
    if (!card) return;
    card.classList.remove('is-checking', 'is-online', 'is-warning', 'is-offline');
    card.classList.add('is-' + state);
    const pill = card.querySelector('[data-status-pill]');
    const message = card.querySelector('[data-status-detail]');
    const uptime = card.querySelector('[data-status-uptime]');
    pill.textContent = state === 'online' ? 'Online' : state === 'warning' ? 'Atenção' : state === 'checking' ? 'Verificando' : 'Offline';
    message.textContent = detail;
    if (uptime) uptime.textContent = uptimeText;
  }

  async function probe(id) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(checks[id].url(), {
        cache: 'no-store',
        headers: {Accept: 'application/json'}
      });
      const body = await response.text();
      let parsed = null;
      try { parsed = JSON.parse(body); } catch {}
      const uptimeText = Number.isFinite(Number(parsed?.uptimeSeconds))
        ? 'Uptime: ' + formatUptime(parsed.uptimeSeconds)
        : id === 'site' ? 'Uptime: disponível agora' : 'Uptime: ativo, contador indisponível';
      if (!response.ok) {
        let detail = 'Resposta HTTP ' + response.status;
        if (parsed?.error) detail = parsed.error;
        setCard(id, id === 'api' && response.status >= 500 ? 'warning' : 'offline', detail, 'Uptime: indisponível');
        return false;
      }
      if (id === 'api' && parsed?.ok !== true) {
        setCard(id, 'warning', 'API respondeu com aviso.', uptimeText);
        return false;
      }
      setCard(id, 'online', checks[id].label, uptimeText);
      return true;
    } catch (error) {
      const detail = error?.name === 'AbortError'
        ? 'Tempo esgotado para responder.'
        : 'Não foi possível conectar — verifique CORS ou disponibilidade.';
      setCard(id, 'offline', detail);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function runChecks() {
    refreshButton.disabled = true;
    summary.dataset.state = 'checking';
    summaryText.textContent = 'Verificando serviços…';
    for (const id of Object.keys(checks)) setCard(id, 'checking', 'Verificando…', 'Uptime: calculando…');
    const results = await Promise.all(Object.keys(checks).map(probe));
    const onlineCount = results.filter(Boolean).length;
    const allOnline = onlineCount === results.length;
    const apiOnline = results[2] === true;
    const voiceOnline = results[3] === true;
    summary.dataset.state = allOnline ? 'online' : (apiOnline && voiceOnline) ? 'warning' : 'offline';
    summaryText.textContent = allOnline
      ? 'Tudo funcionando normalmente'
      : apiOnline
        ? 'O site está parcialmente disponível'
        : 'Há uma falha que precisa de atenção';
    updated.textContent = 'Última verificação: ' + new Intl.DateTimeFormat('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(new Date());
    refreshButton.disabled = false;
  }

  refreshButton.addEventListener('click', runChecks);
  runChecks();
  window.setInterval(runChecks, 30000);
})();
