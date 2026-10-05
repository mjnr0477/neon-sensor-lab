(function () {
  'use strict';

  const REFRESH_MS = 1000;

  function getSensorEvents() {
    return window.NeonSensorSources?.events?.() || [];
  }

  function getRegistry() {
    return window.NeonMeasurementRegistry?.list?.() || [];
  }

  function summarize() {
    const events = getSensorEvents();
    const sources = {};
    const types = {};
    events.forEach(event => {
      sources[event.source] = (sources[event.source] || 0) + 1;
      types[event.type] = (types[event.type] || 0) + 1;
    });

    const quality = window.NeonResearchQuality?.inspect?.(events) || null;
    const capabilities = getRegistry();
    const available = capabilities.filter(item => item.status === 'available').length;
    const supported = capabilities.filter(item => item.status === 'supported').length;

    return {
      eventCount: events.length,
      sourceCount: Object.keys(sources).length,
      sources,
      types,
      quality,
      capabilities: capabilities.length,
      available,
      supported,
      lastEvent: events.length ? events[events.length - 1].timestamp : null
    };
  }

  function barRows(map, limit) {
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit || 6);
  }

  function render() {
    const root = document.querySelector('main.app') || document.body;
    if (!root || document.getElementById('at-a-glance-panel')) return;

    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'at-a-glance-panel';
    panel.innerHTML = `
      <div class="intelligence-header">
        <div>
          <span class="label">At a glance</span>
          <h2>Your measurement picture, simplified</h2>
          <p class="intelligence-subtitle">A quick summary first, with the raw dataset still available underneath.</p>
        </div>
        <span class="intelligence-badge" id="glance-status">WAITING</span>
      </div>

      <div class="glance-kpis">
        <div class="glance-kpi"><small>Events captured</small><strong id="glance-events">0</strong><span>timestamped observations</span></div>
        <div class="glance-kpi"><small>Signal sources</small><strong id="glance-sources">0</strong><span>currently represented</span></div>
        <div class="glance-kpi"><small>Data quality</small><strong id="glance-quality">—</strong><span id="glance-quality-note">no stream yet</span></div>
        <div class="glance-kpi"><small>Capabilities</small><strong id="glance-capabilities">0</strong><span id="glance-capability-note">catalogued</span></div>
      </div>

      <div class="glance-layout">
        <div class="glance-card">
          <div class="glance-card-title"><strong>Where the data comes from</strong><span>share of captured events</span></div>
          <div id="glance-source-bars" class="glance-bars"><p class="muted">Start a session to see the distribution.</p></div>
        </div>
        <div class="glance-card">
          <div class="glance-card-title"><strong>What the system sees</strong><span>event types</span></div>
          <div id="glance-type-bars" class="glance-bars"><p class="muted">No normalized events yet.</p></div>
        </div>
      </div>

      <div class="glance-summary" id="glance-summary">
        <strong>Ready.</strong> Enable a sensor or connect a supported device, then collect a session.
      </div>

      <div class="research-boundary">
        <strong>Interpretation boundary:</strong>
        this view summarizes recorded measurements and data quality. It does not turn sensor
        signals into a diagnosis, personality judgment, thought reading, or claim about an unmeasured state.
      </div>
    `;
    const anchor = root.querySelector('.grid');
    if (anchor) root.insertBefore(panel, anchor);
    else root.appendChild(panel);
  }

  function renderBars(id, rows, total) {
    const target = document.getElementById(id);
    if (!target) return;

    if (!rows.length || !total) {
      target.innerHTML = '<p class="muted">No data yet.</p>';
      return;
    }

    target.innerHTML = rows.map(([name, count]) => {
      const percent = Math.max(1, Math.round((count / total) * 100));
      const safe = String(name).replace(/[&<>"]/g, '');
      return `
        <div class="glance-bar-row">
          <div><span>${safe}</span><strong>${count} · ${percent}%</strong></div>
          <div class="glance-track"><i style="width:${percent}%"></i></div>
        </div>
      `;
    }).join('');
  }

  function update() {
    render();
    const s = summarize();
    const events = document.getElementById('glance-events');
    const sources = document.getElementById('glance-sources');
    const quality = document.getElementById('glance-quality');
    const qualityNote = document.getElementById('glance-quality-note');
    const capabilities = document.getElementById('glance-capabilities');
    const capabilityNote = document.getElementById('glance-capability-note');
    const status = document.getElementById('glance-status');
    const summary = document.getElementById('glance-summary');

    if (events) events.textContent = String(s.eventCount);
    if (sources) sources.textContent = String(s.sourceCount);
    if (capabilities) capabilities.textContent = String(s.capabilities);
    if (capabilityNote) capabilityNote.textContent = `${s.available} available · ${s.supported} device-supported`;

    if (quality?.integrityScore !== null && quality?.integrityScore !== undefined) {
      if (quality) quality.textContent = `${quality.integrityScore}%`;
      if (qualityNote) qualityNote.textContent = quality.integrityIssues ? `${quality.integrityIssues} integrity issue(s)` : 'stream looks structurally clean';
    } else {
      if (quality) quality.textContent = '—';
      if (qualityNote) qualityNote.textContent = 'no stream yet';
    }

    if (status) status.textContent = s.eventCount ? 'LIVE SUMMARY' : 'WAITING';

    renderBars('glance-source-bars', barRows(s.sources, 6), s.eventCount);
    renderBars('glance-type-bars', barRows(s.types, 6), s.eventCount);

    if (summary) {
      if (!s.eventCount) {
        summary.innerHTML = '<strong>Ready.</strong> Enable a sensor or connect a supported device, then collect a session.';
      } else {
        const qualityText = s.quality?.integrityScore == null ? 'quality is not scored yet' : `data integrity is ${s.quality.integrityScore}%`;
        summary.innerHTML = `<strong>In plain language:</strong> ${s.eventCount} normalized event(s) from ${s.sourceCount} source(s); ${qualityText}.`;
      }
    }
  }

  window.addEventListener('load', () => {
    update();
    window.setInterval(update, REFRESH_MS);
  });

  window.NeonPresentation = { summarize, update };
})();
