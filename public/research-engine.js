(function () {
  'use strict';

  const LAB = window.NeonSensorLab;

  if (!LAB) {
    console.error('Neon Sensor Lab research engine: core bridge unavailable.');
    return;
  }

  const state = LAB.getState();

  const root = document.querySelector('main.app') || document.body;

  const panel = document.createElement('section');
  panel.className = 'intelligence-panel';
  panel.id = 'research-engine';

  panel.innerHTML = `
    <div class="intelligence-header">
      <div>
        <span class="label">Research Engine</span>
        <h2>Structured signal dataset</h2>
        <p class="intelligence-subtitle">
          Converts the current local session into reproducible measurement features.
        </p>
      </div>
      <span class="intelligence-badge" id="research-status">READY</span>
    </div>

    <div class="intelligence-metrics">
      <div class="intelligence-metric">
        <small>Sampling rate</small>
        <strong id="research-rate">—</strong>
      </div>

      <div class="intelligence-metric">
        <small>Windows</small>
        <strong id="research-windows">0</strong>
      </div>

      <div class="intelligence-metric">
        <small>Coverage</small>
        <strong id="research-coverage">—</strong>
      </div>

      <div class="intelligence-metric">
        <small>Signal quality</small>
        <strong id="research-quality">—</strong>
      </div>
    </div>

    <div class="signal-summary" id="research-summary">
      Start a recording session to generate structured research features.
    </div>

    <div class="intelligence-metrics">
      <div class="intelligence-metric">
        <small>Motion samples</small>
        <strong id="research-motion">0</strong>
      </div>

      <div class="intelligence-metric">
        <small>Orientation samples</small>
        <strong id="research-orientation">0</strong>
      </div>

      <div class="intelligence-metric">
        <small>Session length</small>
        <strong id="research-duration">—</strong>
      </div>

      <div class="intelligence-metric">
        <small>Dataset version</small>
        <strong>1.0</strong>
      </div>
    </div>

    <button id="research-export">Export research dataset</button>
  `;

  root.appendChild(panel);

  const $ = (id) => document.getElementById(id);

  function motionSamples() {
    return state.samples
      .filter(sample => sample.type === 'motion')
      .map(sample => ({
        ...sample,
        time: Date.parse(sample.timestamp)
      }))
      .filter(sample => Number.isFinite(sample.time));
  }

  function orientationSamples() {
    return state.samples
      .filter(sample => sample.type === 'orientation')
      .map(sample => ({
        ...sample,
        time: Date.parse(sample.timestamp)
      }))
      .filter(sample => Number.isFinite(sample.time));
  }

  function magnitude(sample) {
    const x = Number(sample.x) || 0;
    const y = Number(sample.y) || 0;
    const z = Number(sample.z) || 0;

    return Math.sqrt(x * x + y * y + z * z);
  }

  function estimateSamplingRate(samples) {
    if (samples.length < 2) return null;

    const deltas = [];

    for (let i = 1; i < samples.length; i += 1) {
      const delta = samples[i].time - samples[i - 1].time;

      if (delta > 0 && delta < 5000) {
        deltas.push(delta);
      }
    }

    if (!deltas.length) return null;

    deltas.sort((a, b) => a - b);

    const median = deltas[Math.floor(deltas.length / 2)];

    return median > 0 ? 1000 / median : null;
  }

  function buildWindows(samples, windowMs = 5000) {
    if (!samples.length) return [];

    const first = samples[0].time;
    const buckets = new Map();

    for (const sample of samples) {
      const index = Math.floor((sample.time - first) / windowMs);

      if (!buckets.has(index)) {
        buckets.set(index, []);
      }

      buckets.get(index).push(sample);
    }

    return [...buckets.entries()].map(([index, bucket]) => {
      const values = bucket.map(magnitude);

      const mean =
        values.reduce((sum, value) => sum + value, 0) /
        values.length;

      const peak = Math.max(...values);

      const variance =
        values.reduce(
          (sum, value) => sum + ((value - mean) ** 2),
          0
        ) / values.length;

      return {
        index,
        startOffsetMs: index * windowMs,
        endOffsetMs: (index + 1) * windowMs,
        sampleCount: bucket.length,
        meanMagnitude: Number(mean.toFixed(6)),
        peakMagnitude: Number(peak.toFixed(6)),
        variability: Number(Math.sqrt(variance).toFixed(6))
      };
    });
  }

  function calculateCoverage(samples) {
    if (samples.length < 2) return 0;

    const start = samples[0].time;
    const end = samples[samples.length - 1].time;
    const duration = Math.max(0, end - start);

    if (!duration) return 0;

    const expectedRate = estimateSamplingRate(samples);

    if (!expectedRate) return 0;

    const expectedSamples =
      Math.max(1, (duration / 1000) * expectedRate);

    return Math.min(100, (samples.length / expectedSamples) * 100);
  }

  function qualityLabel(samples, coverage) {
    if (samples.length < 5) return 'INSUFFICIENT';

    if (coverage >= 85) return 'HIGH';
    if (coverage >= 60) return 'MODERATE';

    return 'LOW';
  }

  function buildDataset() {
    const motion = motionSamples();
    const orientation = orientationSamples();

    const all = [...state.samples];

    const startedAt =
      state.startedAt instanceof Date
        ? state.startedAt.toISOString()
        : null;

    const endedAt = new Date().toISOString();

    const samplingRate = estimateSamplingRate(motion);
    const coverage = calculateCoverage(motion);
    const windows = buildWindows(motion);

    const durationMs =
      motion.length >= 2
        ? motion[motion.length - 1].time - motion[0].time
        : 0;

    return {
      schema: 'neon-sensor-lab.research-session',
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),

      project: {
        name: 'Neon Sensor Lab',
        purpose: 'Local-first sensor research'
      },

      device: {
        model: 'Neon Ray Ultra M',
        platform: 'Android',
        platformVersion: '13'
      },

      session: {
        startedAt,
        endedAt,
        durationMs,
        durationSeconds: Number((durationMs / 1000).toFixed(3))
      },

      sensors: {
        motion: {
          sampleCount: motion.length,
          estimatedSamplingRateHz:
            samplingRate == null
              ? null
              : Number(samplingRate.toFixed(3)),
          coveragePercent: Number(coverage.toFixed(2)),
          quality: qualityLabel(motion, coverage)
        },

        orientation: {
          sampleCount: orientation.length
        }
      },

      windows,

      samples: all,

      interpretationBoundary: {
        permitted: [
          'sensor measurement',
          'movement magnitude',
          'signal variability',
          'sampling characteristics',
          'signal coverage'
        ],

        excluded: [
          'thought reading',
          'EEG inference',
          'brain activity inference',
          'consciousness detection',
          'medical diagnosis',
          'psychological diagnosis'
        ]
      }
    };
  }

  function update() {
    const motion = motionSamples();
    const orientation = orientationSamples();

    const samplingRate = estimateSamplingRate(motion);
    const coverage = calculateCoverage(motion);
    const quality = qualityLabel(motion, coverage);
    const windows = buildWindows(motion);

    $('research-rate').textContent =
      samplingRate == null
        ? '—'
        : `${samplingRate.toFixed(1)} Hz`;

    $('research-windows').textContent =
      String(windows.length);

    $('research-coverage').textContent =
      motion.length >= 2
        ? `${coverage.toFixed(0)}%`
        : '—';

    $('research-quality').textContent = quality;

    $('research-motion').textContent =
      String(motion.length);

    $('research-orientation').textContent =
      String(orientation.length);

    const duration =
      motion.length >= 2
        ? (motion[motion.length - 1].time - motion[0].time) / 1000
        : 0;

    $('research-duration').textContent =
      duration > 0
        ? `${duration.toFixed(1)} s`
        : '—';

    $('research-status').textContent =
      state.recording
        ? 'RECORDING'
        : motion.length
          ? 'ANALYZED'
          : 'READY';

    if (!motion.length) {
      $('research-summary').textContent =
        'No motion dataset is available yet. Start recording to generate structured features.';
      return;
    }

    $('research-summary').textContent =
      `${motion.length} motion measurements were captured across ` +
      `${windows.length} five-second analysis window(s). ` +
      `Estimated sampling rate is ` +
      `${samplingRate == null ? 'unavailable' : samplingRate.toFixed(1) + ' Hz'}, ` +
      `with approximately ${coverage.toFixed(0)}% temporal coverage.`;
  }

  function exportDataset() {
    const dataset = buildDataset();

    if (!dataset.samples.length) {
      alert('No measurements have been recorded yet.');
      return;
    }

    const blob = new Blob(
      [JSON.stringify(dataset, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `neon-research-dataset-${Date.now()}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('research-export')?.addEventListener(
    'click',
    exportDataset
  );

  setInterval(update, 500);

  update();
})();
