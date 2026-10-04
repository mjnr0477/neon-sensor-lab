(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('Neon Sensor Lab offline shell ready:', registration.scope);
      })
      .catch(error => {
        console.warn('Offline shell unavailable:', error);
      });
  });
})();