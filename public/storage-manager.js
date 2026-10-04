(function () {
  'use strict';

  const state = {
    sessions: [],
    selectedId: null,
    storageEstimate: null
  };

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function refresh() {
    if (!window.NeonSessionStore?.list) return;
    state.sessions = await window.NeonSessionStore.list(50);

    if (navigator.storage?.estimate) {
      state.storageEstimate = await navigator.storage.estimate();
    }

    render();
  }

  async function requestPersistence() {
    if (!navigator.storage?.persist) {
      setStatus('Persistent-storage request is not available in this browser.');
      return false;
    }

    try {
      const granted = await navigator.storage.persist();
      setStatus(granted
        ? 'Browser granted persistent storage for this origin.'
        : 'Browser kept best-effort storage. Export important datasets.');
      await refresh();
      return granted;
    } catch (error) {
      setStatus(`Storage request failed: ${error.message}`);
      return false;
    }
  }

  function setStatus(message) {
    const node = document.getElementById('storage-status');
    if (node) node.textContent = message;
  }

  async function clearAll() {
    if (!window.NeonSessionStore?.clear) return;
    const confirmed = window.confirm(
      'Delete every saved research dataset from this browser? This cannot be undone.'
    );
    if (!confirmed) return;

    await window.NeonSessionStore.clear();
    state.selectedId = null;
    setStatus('All local research datasets were deleted.');
    await refresh();
  }

  function render() {
    const count = document.getElementById('storage-session-count');
    const usage = document.getElementById('storage-usage');
    const quota = document.getElementById('storage-quota');
    const list = document.getElementById('storage-session-list');

    if (count) count.textContent = String(state.sessions.length);
    if (usage) usage.textContent = formatBytes(state.storageEstimate?.usage);
    if (quota) quota.textContent = formatBytes(state.storageEstimate?.quota);
    if (!list) return;

    list.replaceChildren();

    if (!state.sessions.length) {
      const empty = document.createElement('div');
      empty.className = 'signal-history-item';
      empty.textContent = 'No saved research datasets.';
      list.appendChild(empty);
      return;
    }

    for (const session of state.sessions) {
      const item = document.createElement('div');
      item.className = 'signal-history-item';

      const main = document.createElement('div');
      const title = document.createElement('strong');
      const details = document.createElement('small');
      const button = document.createElement('button');

      title.textContent = session.metadata?.title || session.id || 'Untitled';
      details.textContent =
        `${session.eventCount || 0} events · ${session.sources?.join(', ') || 'no sources'} · ${session.endedAt ? new Date(session.endedAt).toLocaleString() : 'unknown'}`;
      button.textContent = 'Export';
      button.type = 'button';

      button.addEventListener('click', () => {
        if (window.NeonDatasetManager?.download) {
          window.NeonDatasetManager.download(session, 'neon-research-dataset');
        }
      });

      main.append(title, details);
      item.append(main, button);
      list.appendChild(item);
    }
  }

  function buildPanel() {
    const root = document.querySelector('main.app') || document.body;
    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'storage-manager';

    panel.innerHTML = `
      <div class="intelligence-header">
        <div>
          <span class="label">Local Storage</span>
          <h2>Research data vault</h2>
          <p class="intelligence-subtitle">
            Monitor browser storage and protect important datasets with explicit export.
          </p>
        </div>
        <span class="intelligence-badge">LOCAL</span>
      </div>

      <div class="intelligence-metrics">
        <div class="intelligence-metric">
          <small>Saved datasets</small>
          <strong id="storage-session-count">0</strong>
        </div>
        <div class="intelligence-metric">
          <small>Estimated usage</small>
          <strong id="storage-usage">—</strong>
        </div>
        <div class="intelligence-metric">
          <small>Estimated quota</small>
          <strong id="storage-quota">—</strong>
        </div>
        <div class="intelligence-metric">
          <small>Network upload</small>
          <strong>None</strong>
        </div>
      </div>

      <div class="actions storage-actions">
        <button id="storage-persist">Request persistent storage</button>
        <button id="storage-refresh">Refresh vault</button>
        <button id="storage-clear">Delete all local datasets</button>
      </div>

      <div class="signal-summary" id="storage-status">
        Research data stays in this browser unless you explicitly export it.
      </div>

      <div class="signal-history">
        <span class="label">Saved datasets</span>
        <div class="signal-history-list" id="storage-session-list"></div>
      </div>

      <div class="research-boundary">
        Browser storage is best-effort by default and may be evicted when quotas or browser policies require it.
        Export important research datasets to a separate trusted location.
      </div>
    `;

    root.appendChild(panel);

    document.getElementById('storage-persist')?.addEventListener('click', requestPersistence);
    document.getElementById('storage-refresh')?.addEventListener('click', refresh);
    document.getElementById('storage-clear')?.addEventListener('click', clearAll);

    refresh();
  }

  window.NeonStorageManager = {
    refresh,
    requestPersistence,
    clearAll,
    getState: () => ({
      sessionCount: state.sessions.length,
      storageEstimate: state.storageEstimate
        ? { ...state.storageEstimate }
        : null
    })
  };

  window.addEventListener('load', buildPanel);
  window.addEventListener('neon:dataset-imported', refresh);
})();