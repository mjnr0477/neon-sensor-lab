(function () {
  'use strict';

  const SCHEMA = 'neon-experiment-protocol';
  const VERSION = '1.0';
  const state = {
    protocol: {
      schema: SCHEMA,
      schemaVersion: VERSION,
      id: null,
      title: 'Untitled protocol',
      objective: '',
      collectionIntent: '',
      variables: [],
      notes: '',
      protocolVersion: '1.0',
      createdAt: null,
      updatedAt: null
    }
  };

  function now() { return new Date().toISOString(); }

  function makeId() {
    return 'protocol-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function normalizeList(value) {
    return String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  function updateFromForm() {
    const title = document.getElementById('experiment-protocol-title');
    const objective = document.getElementById('experiment-protocol-objective');
    const intent = document.getElementById('experiment-protocol-intent');
    const variables = document.getElementById('experiment-protocol-variables');
    const notes = document.getElementById('experiment-protocol-notes');

    state.protocol.title = String(title?.value || 'Untitled protocol').trim().slice(0, 120);
    state.protocol.objective = String(objective?.value || '').trim().slice(0, 1000);
    state.protocol.collectionIntent = String(intent?.value || '').trim().slice(0, 1000);
    state.protocol.variables = normalizeList(variables?.value);
    state.protocol.notes = String(notes?.value || '').trim().slice(0, 2000);
    state.protocol.updatedAt = now();

    if (!state.protocol.id) {
      state.protocol.id = makeId();
      state.protocol.createdAt = state.protocol.updatedAt;
    }

    renderStatus();
    return getProtocol();
  }

  function getProtocol() {
    return {
      ...state.protocol,
      variables: [...state.protocol.variables]
    };
  }

  function reset() {
    state.protocol = {
      schema: SCHEMA,
      schemaVersion: VERSION,
      id: null,
      title: 'Untitled protocol',
      objective: '',
      collectionIntent: '',
      variables: [],
      notes: '',
      protocolVersion: '1.0',
      createdAt: null,
      updatedAt: null
    };
    renderForm();
    renderStatus();
  }

  function attachToSession(session) {
    if (!session || typeof session !== 'object') return session;
    updateFromForm();
    return {
      ...session,
      protocol: getProtocol()
    };
  }

  function renderForm() {
    const p = state.protocol;
    const fields = {
      'experiment-protocol-title': p.title,
      'experiment-protocol-objective': p.objective,
      'experiment-protocol-intent': p.collectionIntent,
      'experiment-protocol-variables': p.variables.join(', '),
      'experiment-protocol-notes': p.notes
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
  }

  function renderStatus() {
    const status = document.getElementById('experiment-protocol-status');
    if (status) {
      status.textContent = state.protocol.id ? 'CONFIGURED' : 'DRAFT';
    }
  }

  function buildPanel() {
    const root = document.querySelector('main.app') || document.body;
    if (document.getElementById('experiment-protocol-panel')) return;

    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'experiment-protocol-panel';
    panel.innerHTML = `
      <div class="intelligence-header">
        <div>
          <span class="label">Experiment Protocol</span>
          <h2>Define the experiment before collecting data</h2>
          <p class="intelligence-subtitle">
            Structured context for repeatable local research sessions.
          </p>
        </div>
        <span class="intelligence-badge" id="experiment-protocol-status">DRAFT</span>
      </div>

      <div class="session-form-grid">
        <label>
          <span>Protocol title</span>
          <input id="experiment-protocol-title" maxlength="120" value="Untitled protocol">
        </label>
        <label>
          <span>Protocol version</span>
          <input maxlength="20" value="1.0" disabled>
        </label>
        <label class="session-form-wide">
          <span>Objective</span>
          <textarea id="experiment-protocol-objective" maxlength="1000" rows="2" placeholder="What question is this experiment trying to investigate?"></textarea>
        </label>
        <label class="session-form-wide">
          <span>Collection intent</span>
          <textarea id="experiment-protocol-intent" maxlength="1000" rows="2" placeholder="What signals or observations do you intend to collect?"></textarea>
        </label>
        <label class="session-form-wide">
          <span>Variables / sources</span>
          <input id="experiment-protocol-variables" maxlength="600" placeholder="motion, orientation, heart-rate BLE">
        </label>
        <label class="session-form-wide">
          <span>Protocol notes</span>
          <textarea id="experiment-protocol-notes" maxlength="2000" rows="3" placeholder="Controls, procedure, expected conditions, or reproducibility notes"></textarea>
        </label>
      </div>

      <div class="actions session-actions">
        <button id="experiment-protocol-save">Save protocol to session</button>
        <button id="experiment-protocol-reset">Reset draft</button>
      </div>

      <div class="research-boundary">
        <strong>Research boundary:</strong>
        the protocol records experimental intent and metadata. It does not claim
        that a phone sensor measures an unobserved mental, medical, or biological state.
      </div>
    `;

    root.appendChild(panel);

    document.getElementById('experiment-protocol-save')?.addEventListener('click', () => {
      updateFromForm();
      window.dispatchEvent(new CustomEvent('neon:protocol-updated', {
        detail: getProtocol()
      }));
    });

    document.getElementById('experiment-protocol-reset')?.addEventListener('click', reset);
  }

  window.addEventListener('load', () => {
    buildPanel();
    renderForm();
    renderStatus();
  });

  window.NeonExperimentProtocol = {
    getProtocol,
    updateFromForm,
    attachToSession,
    reset
  };
})();
