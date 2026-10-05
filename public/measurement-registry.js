(function () {
  'use strict';

  const SCHEMA = 'neon-measurement-registry';
  const VERSION = '1.0';

  const catalog = [
    { id: 'motion', domain: 'human-motion', label: 'Motion / acceleration', source: 'phone', status: 'available', examples: ['accelerometer', 'movement magnitude'] },
    { id: 'orientation', domain: 'human-motion', label: 'Orientation / rotation', source: 'phone', status: 'available', examples: ['alpha', 'beta', 'gamma'] },
    { id: 'camera', domain: 'visual', label: 'Camera observations', source: 'phone-camera', status: 'available', examples: ['frames', 'visual features'] },
    { id: 'microphone', domain: 'acoustic', label: 'Audio observations', source: 'phone-microphone', status: 'available', examples: ['sound level', 'audio features'] },
    { id: 'heart-rate-ble', domain: 'external-biometric', label: 'Heart-rate device stream', source: 'ble', status: 'supported', examples: ['BLE heart-rate measurement'] },
    { id: 'pulse-ox-ble', domain: 'external-biometric', label: 'Pulse-oximeter stream', source: 'ble', status: 'supported', examples: ['BLE pulse-ox measurements'] },
    { id: 'weight-ble', domain: 'external-biometric', label: 'Weight-scale stream', source: 'ble', status: 'supported', examples: ['BLE weight measurements'] },
    { id: 'cycling-ble', domain: 'external-device', label: 'Cycling device stream', source: 'ble', status: 'supported', examples: ['speed', 'cadence', 'power'] },
    { id: 'temperature-external', domain: 'environment', label: 'External temperature sensor', source: 'external', status: 'future-adapter', examples: ['ambient temperature'] },
    { id: 'pressure-external', domain: 'environment', label: 'External pressure sensor', source: 'external', status: 'future-adapter', examples: ['air pressure'] },
    { id: 'body-temperature-external', domain: 'external-biometric', label: 'Body-temperature sensor', source: 'external', status: 'future-adapter', examples: ['body temperature'] },
    { id: 'blood-pressure-external', domain: 'external-biometric', label: 'Blood-pressure monitor', source: 'external', status: 'future-adapter', examples: ['systolic', 'diastolic', 'pulse'] },
    { id: 'breathing-external', domain: 'external-biometric', label: 'Breathing sensor', source: 'external', status: 'future-adapter', examples: ['respiratory rate'] },
    { id: 'posture-derived', domain: 'human-motion', label: 'Posture / position analysis', source: 'phone', status: 'supported', examples: ['orientation', 'movement patterns'] },
    { id: 'activity-derived', domain: 'human-motion', label: 'Activity analysis', source: 'phone', status: 'supported', examples: ['movement patterns', 'activity state'] },
    { id: 'environment-sensors', domain: 'environment', label: 'Environmental sensor inputs', source: 'external', status: 'future-adapter', examples: ['temperature', 'pressure', 'humidity', 'light', 'sound'] },
    { id: 'location-external', domain: 'environment', label: 'Location / movement context', source: 'external', status: 'future-adapter', examples: ['position', 'route context'] }
  ];

  function list(filters) {
    const f = filters || {};
    return catalog.filter(item =>
      (!f.domain || item.domain === f.domain) &&
      (!f.source || item.source === f.source) &&
      (!f.status || item.status === f.status)
    ).map(item => ({ ...item, examples: [...item.examples] }));
  }

  function domains() {
    return [...new Set(catalog.map(item => item.domain))];
  }

  function get(id) {
    const item = catalog.find(entry => entry.id === id);
    return item ? { ...item, examples: [...item.examples] } : null;
  }

  function render() {
    if (document.getElementById('measurement-registry-panel')) return;

    const root = document.querySelector('main.app') || document.body;
    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'measurement-registry-panel';

    const grouped = domains().map(domain => {
      const items = list({ domain });
      return `
        <div class="measurement-group">
          <h3>${domain.replace(/-/g, ' ')}</h3>
          <div class="measurement-list">
            ${items.map(item => `
              <article class="measurement-item">
                <div>
                  <strong>${item.label}</strong>
                  <small>${item.source} · ${item.status}</small>
                </div>
                <span>${item.examples.join(' · ')}</span>
              </article>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    panel.innerHTML = `
      <div class="intelligence-header">
        <div>
          <span class="label">Measurement Registry</span>
          <h2>One catalog for human, external, and environmental signals</h2>
          <p class="intelligence-subtitle">
            A capability registry for deciding what can be measured now and what needs an adapter.
          </p>
        </div>
        <span class="intelligence-badge">${catalog.length} CAPABILITIES</span>
      </div>
      <div class="measurement-groups">${grouped}</div>
      <div class="research-boundary">
        <strong>Capability boundary:</strong>
        “Supported” means the software understands a compatible data source; it does not
        guarantee that the phone has the hardware, that a device is connected, or that a
        measurement is clinically validated.
      </div>
    `;

    root.appendChild(panel);
  }

  window.addEventListener('load', render);

  window.NeonMeasurementRegistry = {
    schema: () => ({ name: SCHEMA, version: VERSION }),
    list,
    get,
    domains,
    count: () => catalog.length
  };
})();
