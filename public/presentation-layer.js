(function () {
  'use strict';

  const REFRESH_MS = 1000;
  const CATEGORIES = [
    {
      id: 'body',
      label: 'My body',
      icon: '◉',
      questions: [
        { id: 'heart-rate', label: 'Heart rate', type: 'heart-rate', icon: '♥' },
        { id: 'oxygen', label: 'Blood oxygen', type: 'oxygen', icon: '◉' },
        { id: 'weight', label: 'Weight', type: 'weight', icon: '↕' },
        { id: 'body-temperature', label: 'Temperature', type: 'body-temperature', icon: '°' },
        { id: 'blood-pressure', label: 'Blood pressure', type: 'blood-pressure', icon: '⌁' },
        { id: 'breathing', label: 'Breathing', type: 'breathing', icon: '≈' }
      ]
    },
    {
      id: 'movement',
      label: 'My movement',
      icon: '↔',
      questions: [
        { id: 'activity', label: 'Activity', type: 'activity', icon: '●' },
        { id: 'movement', label: 'Movement', type: 'motion', icon: '↔' },
        { id: 'posture', label: 'Posture', type: 'posture', icon: '↕' }
      ]
    },
    {
      id: 'environment',
      label: 'My environment',
      icon: '⌂',
      questions: [
        { id: 'environment', label: 'Environment', type: 'environment', icon: '⌂' }
      ]
    },
    {
      id: 'devices',
      label: 'My devices',
      icon: '⌁',
      questions: [
        { id: 'device', label: 'Connected sensors', type: 'device', icon: '⌁' }
      ]
    }
  ];

  const PANELS = {
    sensors: ['ble-intelligence', 'ble-stream'],
    research: ['research-engine', 'research-quality', 'experiment-protocol-panel', 'research-session-manager', 'research-diagnostics'],
    data: ['dataset-search', 'storage-manager', 'measurement-registry-panel']
  };

  let selectedCategory = null;
  let selected = null;

  function events() { return window.NeonSensorSources?.events?.() || []; }

  function escapeHTML(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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
    if (event) {
      return {
        kind: 'available',
        value: formatValue(event, question),
        message: 'Measurement available.'
      };
    }

    const id = {
      'heart-rate': 'heart-rate-ble',
      oxygen: 'pulse-ox-ble',
      weight: 'weight-ble',
      'body-temperature': 'body-temperature-external',
      'blood-pressure': 'blood-pressure-external',
      breathing: 'breathing-external',
      posture: 'posture-derived',
      activity: 'activity-derived',
      environment: 'environment-sensors',
      device: 'heart-rate-ble'
    }[question.type];

    const capability = id ? window.NeonMeasurementRegistry?.get?.(id) : null;

    if (question.type === 'device') {
      const ble = window.NeonBLEStream?.getState?.();
      if (ble?.device) return { kind: 'available', value: ble.device.name || 'Connected sensor', message: 'Connected sensor.' };
      return { kind: 'connect', message: 'Connect a compatible sensor.' };
    }

    if (capability?.status === 'supported') return { kind: 'connect', message: 'Connect a compatible sensor.' };
    if (capability?.status === 'future-adapter') return { kind: 'unavailable', message: 'A compatible sensor or data source is required.' };
    return { kind: 'unavailable', message: 'Not available from the phone right now.' };
  }

  function formatValue(event, question) {
    const value = event.value || {};

    if (question.type === 'motion' || question.type === 'activity' || question.type === 'posture') {
      const x = Number(value.x);
      const y = Number(value.y);
      const z = Number(value.z);
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
        <h2>What do you want to know?</h2>
        <p>Choose one.</p>
      </div>

      <div class="question-category-grid" aria-label="Choose a category">
        ${CATEGORIES.map(category => `
          <button type="button" class="question-category" data-category="${category.id}">
            <span class="question-icon" aria-hidden="true">${category.icon}</span>
            <strong>${category.label}</strong>
          </button>`).join('')}
      </div>

      <div class="question-detail" id="question-detail" hidden>
        <div class="question-detail-head">
          <button type="button" class="question-back" id="question-back">Back</button>
          <strong id="question-category-title"></strong>
        </div>
        <div class="question-choice-grid" id="question-choice-grid"></div>
      </div>

      <section class="answer-card" id="answer-card" aria-live="polite" hidden>
        <span class="label">Result</span>
        <h3 id="answer-title"></h3>
        <div class="answer-value" id="answer-value">—</div>
        <p id="answer-message"></p>
        <div class="answer-actions">
          <button type="button" id="answer-save" class="answer-secondary" hidden>Save result</button>
          <button type="button" id="answer-connect" hidden>Connect a sensor</button>
        </div>
        <div class="save-status" id="answer-save-status" role="status"></div>
      </section>

      <div class="simple-more">
        <button type="button" id="more-button">More</button>
      </div>

      <div class="more-options" id="more-options" hidden>
        <button type="button" data-glance-section="sensors">Sensor controls</button>
        <button type="button" data-glance-section="research">Research</button>
        <button type="button" data-glance-section="data">Saved data</button>
      </div>
    `;

    const anchor = root.querySelector('.grid');
    if (anchor) root.insertBefore(panel, anchor);
    else root.appendChild(panel);

    panel.querySelectorAll('[data-category]').forEach(button => {
      button.addEventListener('click', () => chooseCategory(button.dataset.category));
    });

    panel.querySelector('#question-back')?.addEventListener('click', showCategories);
    panel.querySelector('#more-button')?.addEventListener('click', () => {
      const more = document.getElementById('more-options');
      if (more) more.hidden = !more.hidden;
    });

    panel.querySelectorAll('[data-glance-section]').forEach(button => {
      button.addEventListener('click', () => showSection(button.dataset.glanceSection));
    });

    document.getElementById('answer-connect')?.addEventListener('click', () => showSection('sensors'));
    document.getElementById('answer-save')?.addEventListener('click', save);

    showCategories();
  }

  function chooseCategory(id) {
    selectedCategory = CATEGORIES.find(category => category.id === id) || null;
    selected = null;
    if (!selectedCategory) return;

    document.querySelectorAll('[data-category]').forEach(button => {
      button.classList.toggle('is-selected', button.dataset.category === id);
    });

    const detail = document.getElementById('question-detail');
    const grid = document.getElementById('question-choice-grid');
    const title = document.getElementById('question-category-title');

    if (title) title.textContent = selectedCategory.label;

    if (grid) {
      grid.innerHTML = selectedCategory.questions.map(question => `
        <button type="button" class="question-choice" data-question="${question.id}">
          <span class="question-icon" aria-hidden="true">${question.icon}</span>
          <strong>${question.label}</strong>
        </button>`).join('');

      grid.querySelectorAll('[data-question]').forEach(button => {
        button.addEventListener('click', () => choose(button.dataset.question));
      });
    }

    if (detail) detail.hidden = false;
    const categories = document.querySelector('.question-category-grid');
    if (categories) categories.hidden = true;
    document.getElementById('answer-card')?.setAttribute('hidden', '');
  }

  function showCategories() {
    selectedCategory = null;
    selected = null;

    const detail = document.getElementById('question-detail');
    const categories = document.querySelector('.question-category-grid');
    const answer = document.getElementById('answer-card');

    if (detail) detail.hidden = true;
    if (categories) categories.hidden = false;
    if (answer) answer.hidden = true;

    document.querySelectorAll('[data-category]').forEach(button => button.classList.remove('is-selected'));
  }

  function choose(id) {
    const question = selectedCategory?.questions.find(item => item.id === id);
    selected = question || null;
    if (!selected) return;

    document.querySelectorAll('[data-question]').forEach(button => {
      button.classList.toggle('is-selected', button.dataset.question === id);
    });

    updateAnswer();

    const answer = document.getElementById('answer-card');
    if (answer) answer.hidden = false;
    answer?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      saved.push({
        savedAt: new Date().toISOString(),
        question: selected.label,
        value: result.value
      });
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
    return [
      root.querySelector('.grid'),
      root.querySelector('.recorder'),
      ...ids.map(id => document.getElementById(id))
    ].filter(Boolean);
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

  function update() {
    render();
    updateAnswer();
  }

  window.addEventListener('load', () => {
    update();
    setTimeout(() => showSection(null), 100);
    setInterval(update, REFRESH_MS);
  });

  window.NeonPresentation = { update, showSection, choose };
})();