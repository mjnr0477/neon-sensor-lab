(function () {
  'use strict';

  const checks = [];

  function add(name, ok, detail) {
    checks.push({ name, ok, detail });
  }

  function runChecks() {
    checks.length = 0;

    add('Sensor bridge', Boolean(window.NeonSensorLab), 'Core phone sensor bridge');
    add('Normalized sources', Boolean(window.NeonSensorSources), 'Phone + BLE normalization');
    add('BLE intelligence', Boolean(window.NeonBLE), 'BLE GATT discovery');
    add('BLE live stream', Boolean(window.NeonBLEStream), 'BLE notification stream');
    add('IndexedDB store', Boolean(window.NeonSessionStore), 'Local research persistence');
    add('Unified sessions', Boolean(window.NeonResearchSession), 'Experiment session manager');
    add('Dataset manager', Boolean(window.NeonDatasetManager), 'Versioned import/export');
    add('Service worker', 'serviceWorker' in navigator, 'Offline app shell capability');
    add('Web Bluetooth', 'bluetooth' in navigator, 'Browser BLE capability');
    add('Device motion', 'DeviceMotionEvent' in window, 'Phone motion API');

    const pass = checks.filter(check => check.ok).length;
    return { pass, total: checks.length, checks: checks.slice() };
  }

  function render() {
    const root = document.querySelector('main.app') || document.body;
    let panel = document.getElementById('research-diagnostics');

    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'intelligence-panel';
      panel.id = 'research-diagnostics';
      root.appendChild(panel);
    }

    const result = runChecks();

    panel.innerHTML = `
      <div class="intelligence-header">
        <div>
          <span class="label">System Diagnostics</span>
          <h2>Research stack readiness</h2>
          <p class="intelligence-subtitle">Capability checks only; no measurement is implied when a browser API is unavailable.</p>
        </div>
        <span class="intelligence-badge">${result.pass}/${result.total} READY</span>
      </div>
      <div class="diagnostic-list"></div>
    `;

    const list = panel.querySelector('.diagnostic-list');

    for (const check of result.checks) {
      const item = document.createElement('div');
      item.className = `diagnostic-item ${check.ok ? 'diagnostic-ok' : 'diagnostic-muted'}`;
      item.innerHTML = `<strong></strong><span></span>`;
      item.querySelector('strong').textContent = check.ok ? 'READY' : 'UNAVAILABLE';
      item.querySelector('span').textContent = `${check.name} — ${check.detail}`;
      list.appendChild(item);
    }
  }

  window.addEventListener('load', () => {
    render();
    window.setInterval(render, 3000);
  });
})();