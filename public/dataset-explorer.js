(function () {
  'use strict';

  const MAX_RESULTS = 50;

  function sessions() {
    return window.NeonSessionStore?.list?.(50) || Promise.resolve([]);
  }

  function csvCell(value) {
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    return '"' + text.replaceAll('"', '""') + '"';
  }

  function toCSV(dataset) {
    const rows = [
      ['dataset_id','experiment_title','timestamp','source','type','value']
    ];

    for (const event of dataset.events || []) {
      rows.push([
        dataset.id,
        dataset.metadata?.title || '',
        event.timestamp,
        event.source,
        event.type,
        typeof event.value === 'object' ? JSON.stringify(event.value) : event.value
      ]);
    }

    return rows.map(row => row.map(csvCell).join(',')).join('\n');
  }

  function downloadText(text, filename, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function matches(dataset, query) {
    if (!query) return true;
    const haystack = [
      dataset.id,
      dataset.metadata?.title,
      dataset.metadata?.notes,
      ...(dataset.metadata?.tags || []),
      ...(dataset.sources || [])
    ].join(' ').toLowerCase();

    return haystack.includes(query.toLowerCase());
  }

  async function search(query) {
    const all = await sessions();
    return all.filter(item => matches(item, query.trim())).slice(0, MAX_RESULTS);
  }

  function renderResults(target, items) {
    target.replaceChildren();

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'signal-history-item';
      empty.textContent = 'No datasets match this search.';
      target.appendChild(empty);
      return;
    }

    for (const dataset of items) {
      const item = document.createElement('article');
      item.className = 'signal-history-item';

      const info = document.createElement('div');
      const title = document.createElement('strong');
      const details = document.createElement('small');

      title.textContent = dataset.metadata?.title || dataset.id || 'Untitled dataset';
      details.textContent =
        (dataset.eventCount || dataset.events?.length || 0) + ' events · ' +
        (dataset.sources?.join(', ') || 'no sources') + ' · ' +
        (dataset.endedAt ? new Date(dataset.endedAt).toLocaleString() : 'unknown time');

      const actions = document.createElement('div');
      actions.className = 'dataset-row-actions';

      const exportJson = document.createElement('button');
      exportJson.type = 'button';
      exportJson.textContent = 'JSON';
      exportJson.addEventListener('click', () => {
        window.NeonDatasetManager?.download(dataset, 'neon-dataset');
      });

      const exportCsv = document.createElement('button');
      exportCsv.type = 'button';
      exportCsv.textContent = 'CSV';
      exportCsv.addEventListener('click', () => {
        downloadText(
          toCSV(dataset),
          'neon-dataset-' + Date.now() + '.csv',
          'text/csv;charset=utf-8'
        );
      });

      actions.append(exportJson, exportCsv);
      info.append(title, details);
      item.append(info, actions);
      target.appendChild(item);
    }
  }

  function buildPanel() {
    const root = document.querySelector('main.app') || document.body;
    if (document.getElementById('dataset-search')) return;

    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'dataset-search';

    panel.innerHTML = [
      '<div class="intelligence-header">',
      '  <div>',
      '    <span class="label">Dataset Explorer</span>',
      '    <h2>Search and export saved experiments</h2>',
      '    <p class="intelligence-subtitle">Search stays local to the browser. Export JSON for full fidelity or CSV for analysis tools.</p>',
      '  </div>',
      '  <span class="intelligence-badge">LOCAL INDEX</span>',
      '</div>',
      '<div class="session-form-grid">',
      '  <label class="session-form-wide"><span>Search datasets</span><input id="dataset-search-input" type="search" placeholder="title, tag, source or dataset ID"></label>',
      '</div>',
      '<div class="signal-summary" id="dataset-search-status">Loading saved datasets…</div>',
      '<div class="signal-history-list" id="dataset-search-results"></div>'
    ].join('\n');

    root.appendChild(panel);

    const input = panel.querySelector('#dataset-search-input');
    const status = panel.querySelector('#dataset-search-status');
    const results = panel.querySelector('#dataset-search-results');

    async function refresh() {
      const items = await search(input?.value || '');
      status.textContent = items.length + ' matching dataset' + (items.length === 1 ? '' : 's') + '.';
      renderResults(results, items);
    }

    input?.addEventListener('input', refresh);
    window.addEventListener('neon:dataset-imported', refresh);
    refresh();
  }

  window.NeonDatasetExplorer = {
    search,
    toCSV
  };

  window.addEventListener('load', buildPanel);
})();