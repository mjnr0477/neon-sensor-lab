(function () {
  'use strict';

  const REFRESH_MS = 1000;
  const QUESTIONS = [
    { id: 'movement', label: 'Movement', type: 'motion', icon: '↔', help: 'How much am I moving?' },
    { id: 'heart-rate', label: 'Heart rate', type: 'heart-rate', icon: '♥', help: 'What is my heart rate?' },
    { id: 'oxygen', label: 'Blood oxygen', type: 'oxygen', icon: '◉', help: 'What is my oxygen level?' },
    { id: 'weight', label: 'Weight', type: 'weight', icon: '↕', help: 'What do I weigh?' },
    { id: 'body-temperature', label: 'Body temperature', type: 'body-temperature', icon: '°', help: 'What is my temperature?' },
    { id: 'blood-pressure', label: 'Blood pressure', type: 'blood-pressure', icon: '⌁', help: 'What is my blood pressure?' },
    { id: 'breathing', label: 'Breathing', type: 'breathing', icon: '≈', help: 'What is my breathing rate?' },
    { id: 'posture', label: 'Posture', type: 'posture', icon: '↕', help: 'How am I positioned?' },
    { id: 'activity', label: 'Activity', type: 'activity', icon: '●', help: 'What am I doing?' },
    { id: 'environment', label: 'Environment', type: 'environment', icon: '⌂', help: 'What is around me?' }
  ];
  const PANELS = {
    sensors: ['ble-intelligence', 'ble-stream'],
    research: ['research-engine', 'research-quality', 'experiment-protocol-panel', 'research-session-manager', 'research-diagnostics'],
    data: ['dataset-search', 'storage-manager', 'measurement-registry-panel']
  };
  let selected = null;

  function events() { return window.NeonSensorSources?.events?.() || []; }
  function escapeHTML(value) {
    return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function findEvent(question) {
    return events().slice().reverse().find(event => {
      const text = JSON.stringify(event.value || {}).toLowerCase();
      const type = String(event.type || '').toLowerCase();
      if (question.type === 'motion' || question.type === 'activity' || question.type === 'posture') return type === 'motion';
      if (question.type === 'heart-rate') return text.includes('heart') || text.includes('2a37');
      if (question.type === 'oxygen') return text.includes('oxygen') || text.includes('2a5e') || text.includes('2a5f');
      if (question.type === 'weight') return text.includes('weight') || text.includes('2a9d');
      if (question.type === 'environment') return text.includes('temperature') || text.includes('pressure') || text.includes('humidity') || text.includes('light');
      return text.includes(question.type);
    }) || null;
  }

  function statusFor(question) {
    const event = findEvent(question);
    if (event) return { kind: 'available', value: formatValue(event, question), message: 'A recent measurement is available.' };

    const id = {
      'heart-rate': 'heart-rate-ble',
      oxygen: 'pulse-ox-ble',
      weight: 'weight-ble',
      'body-temperature': 'body-temperature-external',
      'blood-pressure': 'blood-pressure-external',
      breathing: 'breathing-external',
      posture: 'posture-derived',
      activity: 'activity-derived',
      environment: 'environment-sensors'
    }[question.type];
    const capability = id ? window.NeonMeasurementRegistry?.get?.(id) : null;

    if (capability?.status === 'supported') return { kind: 'connect', message: 'Connect a compatible sensor to get this measurement.' };
    if (capability?.status === 'future-adapter') return { kind: 'unavailable', message: 'A compatible sensor or data source is required for this measurement.' };
    return { kind: 'unavailable', message: 'This measurement is not available from the phone right now.' };
  }

  function formatValue(event, question) {
    const value = event.value || {};
    if (question.type === 'motion' || question.type === 'activity' || question.type === 'posture') {
      const x = Number(value.x), y = Number(value.y), z = Number(value.z);
      if ([x, y, z].every(Number.isFinite)) return Math.sqrt(x ** 2 + y ** 2 + z ** 2).toFixed(2);
    }
    if (value.text) return escapeHTML(value.text);
    return value.hex ? escapeHTML(value.hex) : 'Measurement received';
  }

  function render() {
    const root = document.querySelector('main.app') || document.body;
    if (!root || document.getElementById('at-a-glance-panel')) return;
    const panel = document.createElement('section');
    panel.className = 'intelligence-panel question-first';
    panel.id = 'at-a-glance-panel';
    panel.innerHTML = `
      <div class="question-hero">
        <span class="label">NEON SENSOR LAB</span>
        <h2>What do you want to know about yourself?</h2>
        <p>Pick one thing. We will show you the result when the required sensor is available.</p>
      </div>
      <div class="question-grid" aria-label="Choose what to measure">
        ${QUESTIONS.map(q => `
          <button type="button" class="question-button" data-question="${q.id}">
            <span class="question-icon" aria-hidden="true">${q.icon}</span>
            <span><strong>${q.label}</strong><small>${q.help}</small></span>
          </button>`).join('')}
      </div>
      <section class="answer-card" id="answer-card" aria-live="polite">
        <span class="label">Your result</span>
        <h3 id="answer-title">Choose a measurement</h3>
        <div class="answer-value" id="answer-value">—</div>
        <p id="answer-message">Your answer will appear here.</p>
        <div class="answer-actions">
          <button type="button" id="answer-save" class="answer-secondary" hidden>Save this result</button>
          <button type="button" id="answer-connect" hidden>Connect a sensor</button>
        </div>
        <div class="save-status" id="answer-save-status" role="status"></div>
      </section>
      <div class="simple-more">
        <button type="button" data-glance-section="sensors">Sensor controls</button>
        <button type="button" data-glance-section="research">Research</button>
        <button type="button" data-glance-section="data">Saved data</button>
      </div>
      <div class="research-boundary">Only real available measurements are shown. The app does not diagnose conditions or read thoughts, EEG, or brain activity.</div>
    `;
    const anchor = root.querySelector('.grid');
    if (anchor) root.insertBefore(panel, anchor); else root.appendChild(panel);

    panel.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => choose(button.dataset.question)));
    panel.querySelectorAll('[data-glance-section]').forEach(button => button.addEventListener('click', () => showSection(button.dataset.glanceSection)));
    document.getElementById('answer-connect')?.addEventListener('click', () => showSection('sensors'));
    document.getElementById('answer-save')?.addEventListener('click', save);
  }

  function choose(id) {
    selected = QUESTIONS.find(q => q.id === id) || null;
    if (!selected) return;
    document.querySelectorAll('[data-question]').forEach(button => button.classList.toggle('is-selected', button.dataset.question === id));
    updateAnswer();
    document.getElementById('answer-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function updateAnswer() {
    if (!selected) return;
    const result = statusFor(selected);
    const title = document.getElementById('answer-title');
    const value = document.getElementById('answer-value');
    const message = document.getElementById('answer-message');
    const saveButton = document.getElementById('answer-save');
    const connectButton = document.getElementById('answer-connect');
    if (title) title.textContent = selected.label;
    if (value) {
      value.textContent = result.kind === 'available' ? result.value : 'Not available';
      value.className = `answer-value answer-${result.kind}`;
    }
    if (message) message.textContent = result.message;
    if (saveButton) saveButton.hidden = result.kind !== 'available';
    if (connectButton) connectButton.hidden = result.kind !== 'connect';
  }

  function save() {
    if (!selected) return;
    const result = statusFor(selected);
    if (result.kind !== 'available') return;
    try {
      const key = 'neon-sensor-lab-results';
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      saved.push({ savedAt: new Date().toISOString(), question: selected.label, value: result.value });
      localStorage.setItem(key, JSON.stringify(saved.slice(-50)));
      const node = document.getElementById('answer-save-status');
      if (node) node.textContent = 'Saved on this device.';
    } catch (error) {
      console.error('Result save failed:', error);
    }
  }

  function managedNodes() {
    const root = document.querySelector('main.app');
    if (!root) return [];
    const ids = [...new Set(Object.values(PANELS).flat())];
    return [root.querySelector('.grid'), root.querySelector('.recorder'), ...ids.map(id => document.getElementById(id))].filter(Boolean);
  }

  function showSection(section) {
    const target = PANELS[section] ? section : null;
    managedNodes().forEach(node => node.classList.add('landing-hidden'));
    if (!target) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const root = document.querySelector('main.app');
    const nodes = target === 'sensors'
      ? [root.querySelector('.grid'), root.querySelector('.recorder'), ...PANELS.sensors.map(id => document.getElementById(id))]
      : PANELS[target].map(id => document.getElementById(id));
    const first = nodes.filter(Boolean)[0];
    nodes.filter(Boolean).forEach(node => node.classList.remove('landing-hidden'));
    first?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function update() { render(); updateAnswer(); }

  window.addEventListener('load', () => {
    update();
    setTimeout(() => showSection(null), 100);
    setInterval(update, REFRESH_MS);
  });

  window.NeonPresentation = { update, showSection, choose };
})();