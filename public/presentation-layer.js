(function () {
  'use strict';

  const REFRESH_MS = 1000;
  const PANEL_GROUPS = {
    overview: [],
    sensors: ['ble-intelligence', 'ble-stream'],
    research: [
      'research-engine',
      'research-quality',
      'experiment-protocol-panel',
      'research-session-manager',
      'research-diagnostics'
    ],
    data: [
      'dataset-search',
      'storage-manager',
      'measurement-registry-panel'
    ]
  };

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
          <span class="label">Overview</span>
          <h2>Everything important, at a glance.</h2>
          <p class="intelligence-subtitle">One visual summary first. Open a section only when you want the details.</p>
        </div>
        <span class="intelligence-badge" id="glance-status">WAITING</span>
      </div>

      <div class="glance-overview">
        <div class="glance-chart-card">
          <div class="glance-card-title">
            <strong>Measurement mix</strong>
            <span>one simple picture</span>
          </div>
          <div class="glance-donut-wrap">
            <div class="glance-donut" id="glance-donut" aria-label="Measurement source composition">
              <div class="glance-donut-hole">
                <strong id="glance-donut-total">0</strong>
                <span>events</span>
              </div>
            </div>
            <div id="glance-legend" class="glance-legend">
              <p class="muted">No measurements yet.</p>
            </div>
          </div>
        </div>

        <div class="glance-kpis">
          <div class="glance-kpi"><small>Events</small><strong id="glance-events">0</strong><span>captured</span></div>
          <div class="glance-kpi"><small>Sources</small><strong id="glance-sources">0</strong><span>represented</span></div>
          <div class="glance-kpi"><small>Quality</small><strong id="glance-quality">—</strong><span id="glance-quality-note">waiting for data</span></div>
          <div class="glance-kpi"><small>Capabilities</small><strong id="glance-capabilities">0</strong><span id="glance-capability-note">catalogued</span></div>
        </div>
      </div>

      <div class="glance-summary" id="glance-summary">
        <strong>Ready.</strong> Choose a section below when you want to explore.
      </div>

      <div class="landing-actions" aria-label="Explore Neon Sensor Lab">
        <button type="button" data-glance-section="sensors">Sensors</button>
        <button type="button" data-glance-section="research">Research</button>
        <button type="button" data-glance-section="data">Data & capabilities</button>
      </div>

      <div class="research-boundary">
        <strong>Interpretation boundary:</strong>
        this overview summarizes recorded measurements and data quality. It does not turn sensor
        signals into a diagnosis, personality judgment, thought reading, or claim about an unmeasured state.
      </div>
    `;

    const anchor = root.querySelector('.grid');
    if (anchor) root.insertBefore(panel, anchor);
    else root.appendChild(panel);

    panel.querySelectorAll('[data-glance-section]').forEach(button => {
      button.addEventListener('click', () => showSection(button.dataset.glanceSection));
    });
  }

  function renderDonut(sources, total) {
    const donut = document.getElementById('glance-donut');
    const legend = document.getElementById('glance-legend');
    const totalNode = document.getElementById('glance-donut-total');
    if (!donut || !legend || !totalNode) return;

    totalNode.textContent = String(total);

    if (!total) {
      donut.style.background = 'conic-gradient(#203149 0 100%)';
      legend.innerHTML = '<p class="muted">Start collecting data to see the measurement mix.</p>';
      return;
    }

    const rows = barRows(sources, 6);
    let cursor = 0;
    const stops = rows.map(([name, count], index) => {
      const end = cursor + (count / total) * 100;
      const hue = 200 + (index * 28);
      const stop = `hsl(${hue} 65% 65%) ${cursor}% ${end}%`;
      cursor = end;
      return stop;
    });
    donut.style.background = `conic-gradient(${stops.join(', ')})`;

    legend.innerHTML = rows.map(([name, count], index) => {
      const percent = Math.round((count / total) * 100);
      const hue = 200 + (index * 28);
      const safe = String(name).replace(/[&<>"]/g, '');
      return `<div class="glance-legend-row">
        <i style="background:hsl(${hue} 65% 65%)"></i>
        <span>${safe}</span>
        <strong>${percent}%</strong>
      </div>`;
    }).join('');
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

  function getSectionNodes(section) {
    const root = document.querySelector('main.app');
    if (!root) return [];

    const staticNodes = {
      sensors: [root.querySelector('.grid'), root.querySelector('.recorder')].filter(Boolean),
      research: [],
      data: [],
      overview: []
    };

    const ids = PANEL_GROUPS[section] || [];
    staticNodes[section].push(...ids.map(id => document.getElementById(id)).filter(Boolean));
    return staticNodes[section];
  }

  function allManagedNodes() {
    const root = document.querySelector('main.app');
    if (!root) return [];
    const ids = [...new Set(Object.values(PANEL_GROUPS).flat())];
    return [
      root.querySelector('.grid'),
      root.querySelector('.recorder'),
      ...ids.map(id => document.getElementById(id))
    ].filter(Boolean);
  }

  function showSection(section) {
    const target = PANEL_GROUPS[section] ? section : 'overview';
    allManagedNodes().forEach(node => {
      node.classList.add('landing-hidden');
    });
    getSectionNodes(target).forEach(node => {
      node.classList.remove('landing-hidden');
    });

    document.querySelectorAll('[data-glance-section]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.glanceSection === target);
    });

    if (target === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const first = getSectionNodes(target)[0];
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (capabilityNote) capabilityNote.textContent = `${s.available} ready · ${s.supported} device-supported`;

    if (s.quality?.integrityScore !== null && s.quality?.integrityScore !== undefined) {
      if (quality) quality.textContent = `${s.quality.integrityScore}%`;
      if (qualityNote) qualityNote.textContent = s.quality.integrityIssues
        ? `${s.quality.integrityIssues} issue(s)`
        : 'structurally clean';
    } else {
      if (quality) quality.textContent = '—';
      if (qualityNote) qualityNote.textContent = 'waiting for data';
    }

    if (status) status.textContent = s.eventCount ? 'LIVE' : 'READY';
    renderDonut(s.sources, s.eventCount);
    renderBars('glance-source-bars', barRows(s.sources, 6), s.eventCount);
    renderBars('glance-type-bars', barRows(s.types, 6), s.eventCount);

    if (summary) {
      if (!s.eventCount) {
        summary.innerHTML = '<strong>Ready.</strong> Sensors, research tools and stored data are separated behind simple sections.';
      } else {
        const qualityText = s.quality?.integrityScore == null
          ? 'quality is not scored yet'
          : `data integrity is ${s.quality.integrityScore}%`;
        summary.innerHTML = `<strong>In plain language:</strong> ${s.eventCount} event(s) from ${s.sourceCount} source(s); ${qualityText}.`;
      }
    }
  }

  window.addEventListener('load', () => {
    update();
    window.setTimeout(() => showSection('overview'), 100);
    window.setInterval(update, REFRESH_MS);
  });

  window.NeonPresentation = { summarize, update, showSection };
})();