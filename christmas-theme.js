'use strict';

(() => {
  const root = document.querySelector('#page-app .bc-community-desktop');
  if (!root || root.dataset.bcChristmasReady === 'true') return;
  root.dataset.bcChristmasReady = 'true';
  document.body.classList.add('bc-christmas-mode');

  const topbar = root.querySelector('.bc-stage-topbar');
  if (topbar) {
    const ribbon = document.createElement('span');
    ribbon.className = 'bc-holiday-ribbon';
    ribbon.textContent = 'Boas festas · BrasilCord';
    topbar.append(ribbon);

    const lights = document.createElement('div');
    lights.className = 'bc-holiday-lights';
    lights.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 18; index += 1) {
      const bulb = document.createElement('span');
      bulb.className = 'bc-holiday-light';
      lights.append(bulb);
    }
    topbar.append(lights);
  }

  const snow = document.createElement('div');
  snow.className = 'bc-holiday-snow';
  snow.setAttribute('aria-hidden', 'true');
  const flakes = ['❄', '✦', '❅', '✧'];
  for (let index = 0; index < 22; index += 1) {
    const flake = document.createElement('span');
    flake.className = 'bc-holiday-snowflake';
    flake.textContent = flakes[index % flakes.length];
    flake.style.left = (Math.random() * 100).toFixed(2) + '%';
    flake.style.setProperty('--flake-size', (8 + Math.random() * 10).toFixed(1) + 'px');
    flake.style.setProperty('--flake-opacity', (0.22 + Math.random() * 0.48).toFixed(2));
    flake.style.setProperty('--flake-duration', (13 + Math.random() * 18).toFixed(2) + 's');
    flake.style.setProperty('--flake-delay', (-Math.random() * 22).toFixed(2) + 's');
    flake.style.setProperty('--flake-drift', (-32 + Math.random() * 64).toFixed(1) + 'px');
    snow.append(flake);
  }
  root.append(snow);
})();