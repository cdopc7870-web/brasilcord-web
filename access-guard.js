'use strict';
(function () {
  // This is a cosmetic maintenance gate; GitHub Pages is static and offers no server-side authorization.
  if (window.sessionStorage.getItem('brasilcord-maintenance-access') !== 'unlocked') {
    document.documentElement.style.visibility = 'hidden';
    window.location.replace('acesso.html');
  }
})();
