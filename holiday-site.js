'use strict';

(() => {
  const body = document.body;
  if (!body || body.dataset.holidaySiteReady === 'true') return;
  body.dataset.holidaySiteReady = 'true';

  const preferenceKey = 'brasilcord-christmas-enabled';
  const readEnabled = () => {
    try {
      const value = localStorage.getItem(preferenceKey);
      return value !== 'false';
    } catch {
      return true;
    }
  };
  const saveEnabled = enabled => {
    try { localStorage.setItem(preferenceKey, String(enabled)); } catch {}
  };

  const apply = enabled => {
    body.classList.toggle('holiday-site', true);
    body.classList.toggle('christmas-on', enabled);
    const button = document.querySelector('.holiday-theme-toggle');
    if (button) {
      button.setAttribute('aria-pressed', String(enabled));
      button.title = enabled ? 'Desativar tema natalino' : 'Ativar tema natalino';
      button.querySelector('.holiday-toggle-label').textContent = enabled ? 'Tema normal' : 'Tema natalino';
      button.firstChild.textContent = enabled ? '☼ ' : '🎄 ';
    }
    const decorative = document.querySelectorAll('.holiday-snow, .holiday-lights');
    decorative.forEach(node => { node.hidden = !enabled; });
  };

  const headerActions = document.querySelector('.header-actions');
  if (headerActions && !headerActions.querySelector('.holiday-theme-toggle')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'holiday-theme-toggle';
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', 'Alternar tema natalino');
    button.title = 'Desativar tema natalino';
    button.innerHTML = '<span aria-hidden="true">🎄 </span><span class="holiday-toggle-label">Tema normal</span>';
    button.addEventListener('click', () => {
      const enabled = !body.classList.contains('christmas-on');
      saveEnabled(enabled);
      apply(enabled);
    });
    const themeSwitch = headerActions.querySelector('.theme-switch');
    headerActions.insertBefore(button, themeSwitch || headerActions.firstChild);
  }

  const header = document.querySelector('.site-header');
  if (header && !header.querySelector('.holiday-lights')) {
    const lights = document.createElement('div');
    lights.className = 'holiday-lights';
    lights.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 16; index += 1) {
      const light = document.createElement('span');
      light.className = 'holiday-light';
      lights.append(light);
    }
    header.append(lights);
  }

  if (!document.querySelector('.holiday-snow')) {
    const snow = document.createElement('div');
    snow.className = 'holiday-snow';
    snow.setAttribute('aria-hidden', 'true');
    const flakes = ['❄', '✦', '❅', '✧'];
    for (let index = 0; index < 20; index += 1) {
      const flake = document.createElement('span');
      flake.className = 'holiday-snowflake';
      flake.textContent = flakes[index % flakes.length];
      flake.style.left = (Math.random() * 100).toFixed(2) + '%';
      flake.style.setProperty('--holiday-flake-size', (8 + Math.random() * 9).toFixed(1) + 'px');
      flake.style.setProperty('--holiday-flake-opacity', (0.18 + Math.random() * 0.4).toFixed(2));
      flake.style.setProperty('--holiday-flake-duration', (14 + Math.random() * 17).toFixed(2) + 's');
      flake.style.setProperty('--holiday-flake-delay', (-Math.random() * 20).toFixed(2) + 's');
      flake.style.setProperty('--holiday-flake-drift', (-30 + Math.random() * 60).toFixed(1) + 'px');
      snow.append(flake);
    }
    body.append(snow);
  }

  apply(readEnabled());
})();