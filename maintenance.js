'use strict';
(function () {
  const form = document.getElementById('maintenance-access-form');
  const input = document.getElementById('maintenance-password');
  const button = document.getElementById('maintenance-open-app');
  const feedback = document.getElementById('maintenance-feedback');
  if (!form || !input || !button || !feedback) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const password = input.value;
    feedback.textContent = '';
    button.disabled = true;
    try {
      if (window.brasilcord && typeof window.brasilcord.unlockMaintenance === 'function') {
        const result = await window.brasilcord.unlockMaintenance(password);
        if (!result || !result.ok) feedback.textContent = result?.message || 'Senha incorreta.';
        return;
      }
      // The GitHub Pages version uses a convenience gate only. Static sites cannot keep a secret.
      if (password !== 'PICHAL') {
        feedback.textContent = 'Senha incorreta.';
        return;
      }
      window.sessionStorage.setItem('brasilcord-maintenance-access', 'unlocked');
      window.location.assign('login.html');
    } catch (error) {
      feedback.textContent = 'Não foi possível abrir o BrasilCord. Tente novamente.';
    } finally {
      button.disabled = false;
      input.value = '';
    }
  });
})();
