(function () {
  'use strict';

  const SCHEMA = 'neon-research-session';
  const VERSION = '1.0';

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function validIso(value) {
    return typeof value === 'string' && Number.isFinite(Date.parse(value));
  }

  function validateEvent(event) {
    if (!isObject(event)) return 'Event must be an object.';
    if (event.schema !== 'neon-sensor-event') return 'Unsupported sensor-event schema.';
    if (typeof event.schemaVersion !== 'string') return 'Sensor-event schema version is missing.';
    if (!validIso(event.timestamp)) return 'Event timestamp is invalid.';
    if (typeof event.source !== 'string' || !event.source.trim()) return 'Event source is invalid.';
    if (typeof event.type !== 'string' || !event.type.trim()) return 'Event type is invalid.';
    if (!Object.prototype.hasOwnProperty.call(event, 'value')) return 'Event value is missing.';
    return null;
  }

  function validateSession(input) {
    if (!isObject(input)) return { ok: false, error: 'Dataset must be a JSON object.' };
    if (input.schema !== SCHEMA) return { ok: false, error: 'Unsupported dataset schema.' };
    if (input.schemaVersion !== VERSION) return { ok: false, error: 'Unsupported dataset version.' };
    if (typeof input.id !== 'string' || !input.id.trim()) return { ok: false, error: 'Dataset id is missing.' };
    if (!validIso(input.startedAt) || !validIso(input.endedAt)) return { ok: false, error: 'Dataset timestamps are invalid.' };
    if (!Array.isArray(input.events)) return { ok: false, error: 'Dataset events must be an array.' };
    if (input.events.length > 10000) return { ok: false, error: 'Dataset is too large for browser import.' };

    for (let i = 0; i < input.events.length; i += 1) {
      const error = validateEvent(input.events[i]);
      if (error) return { ok: false, error: `Event ${i + 1}: ${error}` };
    }

    return { ok: true, error: null };
  }

  function download(dataset, prefix) {
    const validation = validateSession(dataset);

    if (!validation.ok) {
      alert(validation.error);
      return false;
    }

    const blob = new Blob(
      [JSON.stringify(dataset, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${prefix || 'neon-dataset'}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  async function importDataset(file) {
    if (!file) throw new Error('No file selected.');

    if (file.size > 8 * 1024 * 1024) {
      throw new Error('Dataset exceeds the 8 MB browser import limit.');
    }

    const text = await file.text();

    let dataset;

    try {
      dataset = JSON.parse(text);
    } catch {
      throw new Error('The selected file is not valid JSON.');
    }

    const validation = validateSession(dataset);

    if (!validation.ok) {
      throw new Error(validation.error);
    }

    const saved = await window.NeonSessionStore?.save?.({
      ...dataset,
      importedAt: new Date().toISOString()
    });

    if (!saved) throw new Error('IndexedDB could not save the imported dataset.');

    window.dispatchEvent(new CustomEvent('neon:dataset-imported', {
      detail: dataset
    }));

    return dataset;
  }

  function buildPanel() {
    const root = document.querySelector('main.app') || document.body;
    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'dataset-manager';

    panel.innerHTML = `
      <div class="intelligence-header">
        <div>
          <span class="label">Dataset Control</span>
          <h2>Import, export and validate research data</h2>
          <p class="intelligence-subtitle">
            Versioned JSON datasets with strict local validation.
          </p>
        </div>
        <span class="intelligence-badge">SCHEMA 1.0</span>
      </div>

      <div class="actions dataset-actions">
        <label class="file-button">
          Import JSON dataset
          <input id="dataset-import" type="file" accept="application/json,.json" hidden>
        </label>
        <button id="dataset-export-current">Export current session</button>
        <button id="dataset-refresh-history">Refresh saved datasets</button>
      </div>

      <div class="signal-summary" id="dataset-status">
        Ready. Imported files are validated before they can enter local storage.
      </div>

      <div class="signal-history">
        <span class="label">Saved research datasets</span>
        <div class="signal-history-list" id="dataset-history"></div>
      </div>
    `;

    root.appendChild(panel);

    const input = document.getElementById('dataset-import');
    const exportButton = document.getElementById('dataset-export-current');
    const refreshButton = document.getElementById('dataset-refresh-history');
    const status = document.getElementById('dataset-status');

    input?.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const dataset = await importDataset(file);
        status.textContent = `Imported ${dataset.eventCount} events from “${dataset.metadata?.title || dataset.id}”.`;
        await renderHistory();
      } catch (error) {
        status.textContent = `Import failed: ${error.message}`;
      } finally {
        input.value = '';
      }
    });

    exportButton?.addEventListener('click', () => {
      const session = window.NeonResearchSession?.getSession?.();

      if (!session) {
        status.textContent = 'No unified session is active or available.';
        return;
      }

      download(session, 'neon-unified-session');
    });

    refreshButton?.addEventListener('click', renderHistory);

    renderHistory();
  }

  async function renderHistory() {
    const target = document.getElementById('dataset-history');
    if (!target || !window.NeonSessionStore?.list) return;

    const sessions = await window.NeonSessionStore.list(12);

    if (!sessions.length) {
      target.innerHTML = '<div class="signal-history-item">No unified datasets saved yet.</div>';
      return;
    }

    target.replaceChildren();

    for (const session of sessions) {
      const item = document.createElement('div');
      item.className = 'signal-history-item';

      const main = document.createElement('div');
      const title = document.createElement('strong');
      const details = document.createElement('small');

      title.textContent = session.metadata?.title || session.id || 'Untitled dataset';
      details.textContent =
        `${session.eventCount || 0} events · ${session.sources?.join(', ') || 'no sources'} · ${session.endedAt ? new Date(session.endedAt).toLocaleString() : 'unknown time'}`;

      main.append(title, details);
      item.appendChild(main);
      target.appendChild(item);
    }
  }

  window.NeonDatasetManager = {
    validateSession,
    download,
    importDataset,
    refreshHistory: renderHistory
  };

  window.addEventListener('load', buildPanel);
  window.addEventListener('neon:dataset-imported', renderHistory);
})();