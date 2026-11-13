'use strict';
(() => {
  const backend = 'https://brasilcord-backend.onrender.com';
  const summary = document.querySelector('.bc-status-summary-card');
  const summaryText = document.getElementById('bc-status-summary-text');
  const summaryCaption = document.getElementById('bc-status-summary-caption');
  const updated = document.getElementById('bc-status-updated');
  const updatedChip = document.getElementById('bc-status-updated-chip');
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
    if (pill) pill.textContent = state === 'online' ? 'Operacional' : state === 'warning' ? 'Atenção' : state === 'checking' ? 'Verificando' : 'Indisponível';
    if (message) message.textContent = detail;
    if (uptime) uptime.textContent = uptimeText;
  }

  function updateDashboard(results) {
    const ids = Object.keys(checks);
    const total = ids.length;
    const online = results.filter(Boolean).length;
    const warning = ids.filter(id => document.querySelector('[data-status-card="' + id + '"]')?.classList.contains('is-warning')).length;
    const offline = Math.max(0, total - online - warning);
    const percentage = Math.round((online / total) * 100);

    document.getElementById('bc-metric-online').textContent = percentage + '%';
    document.getElementById('bc-metric-operational').textContent = online + '/' + total;
    document.getElementById('bc-metric-maintenance').textContent = warning;
    document.getElementById('bc-metric-offline').textContent = offline;
    document.getElementById('bc-service-count').textContent = total + ' serviços · ' + document.querySelectorAll('.bc-service-group').length + ' categorias';

    const allOnline = online === total;
    summary?.classList.toggle('is-warning', !allOnline && warning > 0);
    summary?.classList.toggle('is-offline', offline > 0);
    summaryText.textContent = allOnline ? 'Todos os sistemas no ar' : warning > 0 ? 'Serviços com atenção' : 'Há serviços indisponíveis';
    summaryCaption.textContent = online + ' de ' + total + ' serviços monitorados estão online.';

    document.querySelectorAll('.bc-service-group').forEach(group => {
      const rows = [...group.querySelectorAll('[data-status-card]')];
      const groupOnline = rows.filter(row => row.classList.contains('is-online')).length;
      const groupWarning = rows.some(row => row.classList.contains('is-warning'));
      const groupOffline = rows.some(row => row.classList.contains('is-offline'));
      const state = group.querySelector('[data-group-state]');
      group.classList.toggle('is-warning', groupWarning);
      group.classList.toggle('is-offline', groupOffline);
      if (state) {
        state.textContent = groupOffline ? 'Indisponível' : groupWarning ? 'Atenção' : groupOnline === rows.length ? 'Operacional' : 'Verificando';
      }
    });
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
    for (const id of Object.keys(checks)) setCard(id, 'checking', 'Verificando…', 'Uptime: calculando…');
    const results = await Promise.all(Object.keys(checks).map(probe));
    updateDashboard(results);
    const onlineCount = results.filter(Boolean).length;
    const allOnline = onlineCount === results.length;
    const apiOnline = results[2] === true;
    const voiceOnline = results[3] === true;
    if (summary) summary.dataset.state = allOnline ? 'online' : (apiOnline && voiceOnline) ? 'warning' : 'offline';
    updated.textContent = 'Última verificação: ' + new Intl.DateTimeFormat('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(new Date());
    updatedChip.textContent = 'Atualizado agora';
    refreshButton.disabled = false;
  }

  refreshButton.addEventListener('click', runChecks);
  runChecks();
  window.setInterval(runChecks, 30000);
})();