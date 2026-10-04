(function () {
  'use strict';

  const MAX_EVENTS = 1000;
  const GAP_THRESHOLD_MS = 2000;
  const REFRESH_MS = 500;

  const state = {
    lastEventCount: 0,
    lastUpdatedAt: null,
    metrics: null
  };

  function getEvents() {
    return window.NeonSensorSources?.events?.() || [];
  }

  function inspect(events) {
    const recent = events.slice(-MAX_EVENTS);
    let malformed = 0;
    let outOfOrder = 0;
    let duplicates = 0;
    let gaps = 0;
    let previous = null;
    const sources = Object.create(null);
    const types = Object.create(null);
    const timestamps = [];

    for (const event of recent) {
      const valid = Boolean(
        event &&
        event.schema === 'neon-sensor-event' &&
        typeof event.schemaVersion === 'string' &&
        typeof event.timestamp === 'string' &&
        typeof event.source === 'string' &&
        typeof event.type === 'string' &&
        Object.prototype.hasOwnProperty.call(event, 'value')
      );

      if (!valid) {
        malformed += 1;
        continue;
      }

      const time = Date.parse(event.timestamp);

      if (!Number.isFinite(time)) {
        malformed += 1;
        continue;
      }

      timestamps.push(time);
      sources[event.source] = (sources[event.source] || 0) + 1;
      types[event.type] = (types[event.type] || 0) + 1;

      if (previous !== null) {
        if (time < previous) outOfOrder += 1;
        if (time === previous) duplicates += 1;
        if (time - previous > GAP_THRESHOLD_MS) gaps += 1;
      }

      previous = time;
    }

    const first = timestamps[0];
    const last = timestamps[timestamps.length - 1];
    const durationMs = Number.isFinite(first) && Number.isFinite(last)
      ? Math.max(0, last - first)
      : 0;

    const rate = durationMs > 0
      ? timestamps.length / (durationMs / 1000)
      : 0;

    const integrityIssues = malformed + outOfOrder + duplicates + gaps;
    const integrityScore = timestamps.length
      ? Math.max(0, Math.round(100 - ((integrityIssues / timestamps.length) * 100)))
      : null;

    return {
      eventCount: recent.length,
      validCount: timestamps.length,
      malformed,
      outOfOrder,
      duplicates,
      gaps,
      durationMs,
      rate,
      integrityIssues,
      integrityScore,
      sources,
      types,
      latestTimestamp: Number.isFinite(last) ? new Date(last).toISOString() : null
    };
  }

  function safeText(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function drawActivity(canvas, events) {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 900));
    const height = 150;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#203149';
    ctx.lineWidth = 1;

    for (let y = 25; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const buckets = 60;
    const counts = new Array(buckets).fill(0);
    const recent = events.slice(-MAX_EVENTS);
    const start = recent.length ? Date.parse(recent[0].timestamp) : Date.now();
    const end = recent.length
      ? Math.max(start + 1, Date.parse(recent[recent.length - 1].timestamp))
      : start + 1;
    const span = end - start;

    for (const event of recent) {
      const time = Date.parse(event.timestamp);
      if (!Number.isFinite(time)) continue;
      const index = Math.min(
        buckets - 1,
        Math.max(0, Math.floor(((time - start) / span) * buckets))
      );
      counts[index] += 1;
    }

    const max = Math.max(...counts, 1);
    const barWidth = width / buckets;

    counts.forEach((count, index) => {
      const barHeight = (count / max) * (height - 32);
      ctx.fillStyle = '#8bb7df';
      ctx.fillRect(
        index * barWidth + 1,
        height - 16 - barHeight,
        Math.max(1, barWidth - 2),
        barHeight
      );
    });
  }

  function render(panel, metrics, events) {
    panel.querySelector('[data-quality-status]').textContent =
      metrics.eventCount ? 'MONITORING' : 'WAITING';

    panel.querySelector('[data-quality-score]').textContent =
      metrics.integrityScore == null ? '—' : String(metrics.integrityScore);

    panel.querySelector('[data-quality-rate]').textContent =
      metrics.rate ? metrics.rate.toFixed(1) + '/s' : '—';

    panel.querySelector('[data-quality-gaps]').textContent = String(metrics.gaps);
    panel.querySelector('[data-quality-invalid]').textContent =
      String(metrics.malformed + metrics.outOfOrder + metrics.duplicates);

    panel.querySelector('[data-quality-sources]').textContent =
      Object.keys(metrics.sources).length
        ? Object.entries(metrics.sources)
            .map(([source, count]) => safeText(source) + ': ' + count)
            .join(' · ')
        : 'No normalized events yet';

    panel.querySelector('[data-quality-detail]').textContent =
      metrics.eventCount
        ? metrics.validCount + ' valid events checked. ' +
          metrics.gaps + ' timing gap(s) above ' + GAP_THRESHOLD_MS + ' ms.'
        : 'Start a sensor or BLE stream to validate incoming normalized events.';

    drawActivity(panel.querySelector('canvas'), events);
  }

  function init() {
    const root = document.querySelector('main.app') || document.body;
    if (document.getElementById('research-quality')) return;

    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'research-quality';

    panel.innerHTML = [
      '<div class="intelligence-header">',
      '  <div>',
      '    <span class="label">Data Quality</span>',
      '    <h2>Research signal integrity</h2>',
      '    <p class="intelligence-subtitle">Validates the normalized data stream without interpreting health or mental state.</p>',
      '  </div>',
      '  <span class="intelligence-badge" data-quality-status>WAITING</span>',
      '</div>',
      '<div class="intelligence-metrics">',
      '  <div class="intelligence-metric"><small>Integrity score</small><strong data-quality-score>—</strong></div>',
      '  <div class="intelligence-metric"><small>Event rate</small><strong data-quality-rate>—</strong></div>',
      '  <div class="intelligence-metric"><small>Timing gaps</small><strong data-quality-gaps>0</strong></div>',
      '  <div class="intelligence-metric"><small>Schema/order issues</small><strong data-quality-invalid>0</strong></div>',
      '</div>',
      '<div class="signal-chart-wrap"><canvas class="signal-chart quality-chart" width="900" height="150"></canvas></div>',
      '<div class="signal-summary" data-quality-detail>Start a sensor or BLE stream to validate incoming normalized events.</div>',
      '<div class="research-boundary"><strong>Integrity only:</strong> the score reflects data-shape, timestamp, ordering, duplicate, and gap checks. It is not a medical, psychological, cognitive, or physiological score. Browser storage remains best-effort, so important datasets should be exported.</div>',
      '<p class="intelligence-subtitle" style="margin-top:14px"><strong>Sources:</strong> <span data-quality-sources>No normalized events yet</span></p>'
    ].join('\n');

    root.appendChild(panel);

    const update = () => {
      const events = getEvents();
      const metrics = inspect(events);
      state.lastEventCount = metrics.eventCount;
      state.lastUpdatedAt = new Date().toISOString();
      state.metrics = metrics;
      render(panel, metrics, events);
    };

    window.addEventListener('resize', update);
    setInterval(update, REFRESH_MS);
    update();
  }

  window.NeonResearchQuality = {
    inspect: () => inspect(getEvents()),
    getState: () => ({
      ...state,
      metrics: state.metrics ? { ...state.metrics } : null
    })
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();