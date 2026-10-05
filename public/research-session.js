(function () {
  'use strict';

  const EVENT_NAME = 'neon:sensor-event';
  const SCHEMA = 'neon-research-session';
  const VERSION = '1.0';

  const state = {
    active: false,
    id: null,
    startedAt: null,
    endedAt: null,
    metadata: {
      title: 'Untitled experiment',
      notes: '',
      tags: []
    },
    events: [],
    sources: new Set()
  };

  function isoNow() {
    return new Date().toISOString();
  }

  function makeId() {
    return `research-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeMetadata(input) {
    const metadata = input || {};
    const tags = Array.isArray(metadata.tags)
      ? metadata.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 20)
      : [];

    return {
      title: String(metadata.title || 'Untitled experiment').trim().slice(0, 120),
      notes: String(metadata.notes || '').trim().slice(0, 2000),
      tags
    };
  }

  function validEvent(event) {
    return Boolean(
      event &&
      event.schema === 'neon-sensor-event' &&
      typeof event.timestamp === 'string' &&
      typeof event.source === 'string' &&
      typeof event.type === 'string' &&
      Object.prototype.hasOwnProperty.call(event, 'value')
    );
  }

  function handleEvent(event) {
    if (!state.active || !validEvent(event)) return;

    state.events.push(event);
    state.sources.add(event.source);

    if (state.events.length > 10000) {
      state.events.splice(0, state.events.length - 10000);
    }

    render();
  }

  function buildSession() {
    const endedAt = state.endedAt || isoNow();

    return {
      schema: SCHEMA,
      schemaVersion: VERSION,
      id: state.id,
      createdAt: state.startedAt,
      startedAt: state.startedAt,
      endedAt,
      metadata: { ...state.metadata, tags: [...state.metadata.tags] },
      sources: [...state.sources],
      eventCount: state.events.length,
      events: state.events.slice(),
      protocol: window.NeonExperimentProtocol?.getProtocol
        ? window.NeonExperimentProtocol.getProtocol()
        : null,
      provenance: {
        app: 'Neon Sensor Lab',
        device: 'Neon Ray Ultra M',
        platform: 'browser',
        localOnly: true
      }
    };
  }

  async function persist(session) {
    if (!window.NeonSessionStore?.save) return false;
    return window.NeonSessionStore.save(session);
  }

  function start(metadata) {
    if (state.active) stop();

    state.active = true;
    state.id = makeId();
    state.startedAt = isoNow();
    state.endedAt = null;
    state.metadata = normalizeMetadata(metadata);
    state.events = [];
    state.sources = new Set();

    render();
    return getState();
  }

  async function stop() {
    if (!state.active) return null;

    state.active = false;
    state.endedAt = isoNow();

    const session = buildSession();
    await persist(session);

    render();
    return session;
  }

  function clear() {
    state.active = false;
    state.id = null;
    state.startedAt = null;
    state.endedAt = null;
    state.metadata = normalizeMetadata();
    state.events = [];
    state.sources = new Set();
    render();
  }

  function getState() {
    return {
      active: state.active,
      id: state.id,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      metadata: { ...state.metadata, tags: [...state.metadata.tags] },
      eventCount: state.events.length,
      sources: [...state.sources]
    };
  }

  function getSession() {
    return state.id ? buildSession() : null;
  }

  function render() {
    const status = document.getElementById('research-session-status');
    const count = document.getElementById('research-session-events');
    const sources = document.getElementById('research-session-sources');

    if (status) status.textContent = state.active ? 'RECORDING' : 'READY';
    if (count) count.textContent = String(state.events.length);
    if (sources) sources.textContent = state.sources.size ? [...state.sources].join(', ') : '—';
  }

  function buildPanel() {
    const root = document.querySelector('main.app') || document.body;
    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'research-session-manager';

    panel.innerHTML = `
      <div class="intelligence-header">
        <div>
          <span class="label">Unified Research Session</span>
          <h2>Capture phone + BLE as one dataset</h2>
          <p class="intelligence-subtitle">
            A local experiment layer above the existing sensor engines.
          </p>
        </div>
        <span class="intelligence-badge" id="research-session-status">READY</span>
      </div>

      <div class="session-form-grid">
        <label>
          <span>Experiment title</span>
          <input id="research-session-title" maxlength="120" value="Untitled experiment">
        </label>
        <label>
          <span>Tags</span>
          <input id="research-session-tags" maxlength="300" placeholder="motion, pilot, BLE">
        </label>
        <label class="session-form-wide">
          <span>Notes</span>
          <textarea id="research-session-notes" maxlength="2000" rows="3" placeholder="What are you measuring?"></textarea>
        </label>
      </div>

      <div class="intelligence-metrics">
        <div class="intelligence-metric">
          <small>Normalized events</small>
          <strong id="research-session-events">0</strong>
        </div>
        <div class="intelligence-metric">
          <small>Sources</small>
          <strong id="research-session-sources">—</strong>
        </div>
        <div class="intelligence-metric">
          <small>Storage</small>
          <strong>IndexedDB</strong>
        </div>
        <div class="intelligence-metric">
          <small>Privacy</small>
          <strong>Local only</strong>
        </div>
      </div>

      <div class="actions session-actions">
        <button id="research-session-start">Start unified session</button>
        <button id="research-session-stop" disabled>Stop & save session</button>
        <button id="research-session-export" disabled>Export current session</button>
      </div>

      <div class="research-boundary">
        <strong>Data boundary:</strong>
        this layer records timestamped sensor events and metadata. It does not
        infer thoughts, EEG, consciousness, diagnosis, or other unmeasured states.
      </div>
    `;

    root.appendChild(panel);

    const title = document.getElementById('research-session-title');
    const tags = document.getElementById('research-session-tags');
    const notes = document.getElementById('research-session-notes');
    const startButton = document.getElementById('research-session-start');
    const stopButton = document.getElementById('research-session-stop');
    const exportButton = document.getElementById('research-session-export');

    startButton?.addEventListener('click', () => {
      const metadata = {
        title: title?.value,
        notes: notes?.value,
        tags: String(tags?.value || '').split(',').map(tag => tag.trim())
      };

      start(metadata);
      startButton.disabled = true;
      stopButton.disabled = false;
      exportButton.disabled = false;
    });

    stopButton?.addEventListener('click', async () => {
      await stop();
      startButton.disabled = false;
      stopButton.disabled = true;
    });

    exportButton?.addEventListener('click', () => {
      const session = getSession();

      if (!session || !session.eventCount) {
        alert('No unified sensor events have been captured yet.');
        return;
      }

      window.NeonDatasetManager?.download(session, 'neon-unified-session');
    });

    window.setInterval(() => {
      const active = state.active;
      if (startButton) startButton.disabled = active;
      if (stopButton) stopButton.disabled = !active;
      if (exportButton) exportButton.disabled = !state.id || !state.events.length;
    }, 500);
  }

  window.addEventListener(EVENT_NAME, (event) => handleEvent(event.detail));
  window.addEventListener('load', () => {
    buildPanel();
    render();
  });

  window.NeonResearchSession = {
    start,
    stop,
    clear,
    getState,
    getSession
  };
})();