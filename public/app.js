const $ = (id) => document.getElementById(id);

const state = {
  recording: false,
  startedAt: null,
  samples: [],
  motionHandler: null,
  orientationHandler: null
};

const setText = (id, value) => {
  const element = $(id);
  if (element) element.textContent = value;
};

const format = (value, digits = 3) =>
  Number.isFinite(value) ? Number(value).toFixed(digits) : "—";

function addSample(type, values) {
  if (!state.recording) return;

  state.samples.push({
    timestamp: new Date().toISOString(),
    type,
    ...values
  });
}

function updateStats() {
  const motion = state.samples.filter((s) => s.type === "motion");

  setText("sample-count", String(state.samples.length));

  if (!motion.length) {
    setText("mean-motion", "—");
    return;
  }

  const magnitudes = motion
    .map((s) => Math.sqrt(
      (s.x || 0) ** 2 +
      (s.y || 0) ** 2 +
      (s.z || 0) ** 2
    ));

  const mean =
    magnitudes.reduce((sum, value) => sum + value, 0) /
    magnitudes.length;

  setText("mean-motion", mean.toFixed(3));
}

function analyzeSession() {
  const motion = state.samples.filter((s) => s.type === "motion");

  if (!motion.length) {
    return {
      sampleCount: state.samples.length,
      motionSamples: 0,
      meanMagnitude: null,
      peakMagnitude: null,
      movementVariability: null
    };
  }

  const magnitudes = motion.map((s) => Math.sqrt(
    (Number(s.x) || 0) ** 2 +
    (Number(s.y) || 0) ** 2 +
    (Number(s.z) || 0) ** 2
  ));

  const meanMagnitude =
    magnitudes.reduce((sum, value) => sum + value, 0) /
    magnitudes.length;

  const peakMagnitude = Math.max(...magnitudes);

  const variance =
    magnitudes.reduce(
      (sum, value) => sum + (value - meanMagnitude) ** 2,
      0
    ) / magnitudes.length;

  return {
    sampleCount: state.samples.length,
    motionSamples: motion.length,
    meanMagnitude,
    peakMagnitude,
    movementVariability: Math.sqrt(variance)
  };
}

function buildTimeWindows(windowMs = 5000) {
  const motion = state.samples
    .filter((sample) => sample.type === "motion")
    .map((sample) => ({
      ...sample,
      time: new Date(sample.timestamp).getTime()
    }))
    .filter((sample) => Number.isFinite(sample.time));

  if (!motion.length) return [];

  const firstTime = motion[0].time;
  const windows = new Map();

  for (const sample of motion) {
    const index = Math.floor((sample.time - firstTime) / windowMs);
    if (!windows.has(index)) windows.set(index, []);
    windows.get(index).push(sample);
  }

  return [...windows.entries()].map(([index, samples]) => {
    const magnitudes = samples.map((sample) => Math.sqrt(
      (Number(sample.x) || 0) ** 2 +
      (Number(sample.y) || 0) ** 2 +
      (Number(sample.z) || 0) ** 2
    ));

    const mean =
      magnitudes.reduce((sum, value) => sum + value, 0) /
      magnitudes.length;

    const variance =
      magnitudes.reduce(
        (sum, value) => sum + (value - mean) ** 2,
        0
      ) / magnitudes.length;

    return {
      index,
      startOffsetMs: index * windowMs,
      endOffsetMs: (index + 1) * windowMs,
      sampleCount: samples.length,
      meanMagnitude: mean,
      peakMagnitude: Math.max(...magnitudes),
      variability: Math.sqrt(variance)
    };
  });
}

function startRecording() {
  if (state.recording) return;

  state.recording = true;
  state.startedAt = new Date();
  state.samples = [];

  setText("record-status", "Recording");
  setText("record-btn", "Stop recording");
}

function stopRecording() {
  state.recording = false;

  const analysis = analyzeSession();

  setText("record-status", "Stopped");
  setText("record-btn", "Start recording");

  updateStats();

  setText(
    "peak-motion",
    analysis.peakMagnitude == null
      ? "—"
      : format(analysis.peakMagnitude)
  );

  setText(
    "motion-variability",
    analysis.movementVariability == null
      ? "—"
      : format(analysis.movementVariability)
  );

  setText("motion-samples", String(analysis.motionSamples));

  const durationSeconds = state.startedAt
    ? (Date.now() - state.startedAt.getTime()) / 1000
    : 0;

  setText(
    "session-duration",
    `${durationSeconds.toFixed(1)} s`
  );

  console.log("Session analysis:", analysis);
}

function renderSessionHistory() {
  const element = $("session-history");
  if (!element) return;

  try {
    const sessions = JSON.parse(
      localStorage.getItem("neon-sensor-lab-sessions") || "[]"
    );

    if (!sessions.length) {
      element.textContent = "No saved sessions yet.";
      return;
    }

    element.replaceChildren();

    [...sessions].reverse().forEach((session, index) => {
      const item = document.createElement("div");
      item.className = "history-item";

      const date = session.endedAt
        ? new Date(session.endedAt).toLocaleString()
        : "Unknown time";

      const analysis = session.analysis || {};

      item.textContent =
        `Session ${sessions.length - index} · ${date} · ` +
        `${session.sampleCount || 0} samples · ` +
        `mean movement ${Number.isFinite(analysis.meanMagnitude)
          ? analysis.meanMagnitude.toFixed(3)
          : "—"}`;

      element.appendChild(item);
    });
  } catch (error) {
    console.error("Session history error:", error);
    element.textContent = "Session history unavailable.";
  }
}

function buildSessionPayload() {
  if (!state.samples.length) return null;

  return {
    project: "Neon Sensor Lab",
    device: "Neon Ray Ultra M",
    startedAt: state.startedAt?.toISOString() || null,
    endedAt: new Date().toISOString(),
    sampleCount: state.samples.length,
    analysis: analyzeSession(),
    timeWindows: buildTimeWindows(),
    samples: state.samples
  };
}

function saveSessionLocally() {
  const payload = buildSessionPayload();
  if (!payload) return false;

  try {
    const key = "neon-sensor-lab-sessions";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");

    existing.push(payload);

    // Keep the newest 20 sessions to prevent unbounded browser storage growth.
    const recent = existing.slice(-20);

    localStorage.setItem(key, JSON.stringify(recent));
    renderSessionHistory();
    return true;
  } catch (error) {
    console.error("Local session storage error:", error);
    return false;
  }
}

function exportSession() {
  if (!state.samples.length) {
    alert("No measurements have been recorded yet.");
    return;
  }

  const payload = buildSessionPayload();

  if (!payload) {
    alert("No measurements have been recorded yet.");
    return;
  }

  saveSessionLocally();

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `neon-sensor-session-${Date.now()}.json`;

  link.click();

  URL.revokeObjectURL(url);
}

async function enableMotion() {
  try {
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {
      const permission =
        await DeviceMotionEvent.requestPermission();

      if (permission !== "granted") {
        setText("motion-status", "Permission denied");
        return;
      }
    }

    if (state.motionHandler) {
      window.removeEventListener(
        "devicemotion",
        state.motionHandler
      );
    }

    state.motionHandler = (event) => {
      const acceleration =
        event.accelerationIncludingGravity;

      if (!acceleration) return;

      const x = acceleration.x;
      const y = acceleration.y;
      const z = acceleration.z;

      setText("acc-x", format(x));
      setText("acc-y", format(y));
      setText("acc-z", format(z));
      setText("motion-status", "Live");

      addSample("motion", {
        x,
        y,
        z
      });

      updateStats();
    };

    window.addEventListener(
      "devicemotion",
      state.motionHandler
    );
  } catch (error) {
    setText(
      "motion-status",
      `Error: ${error.message}`
    );
  }
}

async function enableOrientation() {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const permission =
        await DeviceOrientationEvent.requestPermission();

      if (permission !== "granted") {
        setText("orientation-status", "Permission denied");
        return;
      }
    }

    if (state.orientationHandler) {
      window.removeEventListener(
        "deviceorientation",
        state.orientationHandler
      );
    }

    state.orientationHandler = (event) => {
      const alpha = event.alpha;
      const beta = event.beta;
      const gamma = event.gamma;

      setText("alpha", format(alpha, 2));
      setText("beta", format(beta, 2));
      setText("gamma", format(gamma, 2));
      setText("orientation-status", "Live");

      addSample("orientation", {
        alpha,
        beta,
        gamma
      });

      updateStats();
    };

    window.addEventListener(
      "deviceorientation",
      state.orientationHandler
    );
  } catch (error) {
    setText(
      "orientation-status",
      `Error: ${error.message}`
    );
  }
}

async function testCamera() {
  try {
    const video = $("camera");

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });

    video.srcObject = stream;
    video.style.display = "block";

    setText("camera-status", "Camera working");
  } catch (error) {
    setText(
      "camera-status",
      `Unavailable: ${error.message}`
    );
  }
}

async function testMicrophone() {
  try {
    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

    setText("mic-status", "Microphone working");

    setTimeout(() => {
      stream.getTracks().forEach((track) => track.stop());
      setText("mic-status", "Test complete");
    }, 1500);
  } catch (error) {
    setText(
      "mic-status",
      `Unavailable: ${error.message}`
    );
  }
}

async function checkBluetooth() {
  if (!("bluetooth" in navigator)) {
    setText("bluetooth-status", "Web Bluetooth unavailable");
    setText(
      "bluetooth-detail",
      "The current browser does not expose Web Bluetooth."
    );
    return;
  }

  setText("bluetooth-status", "Web Bluetooth available");
  setText(
    "bluetooth-detail",
    "BLE device access can be requested by the user."
  );
}

$("motion-btn")?.addEventListener(
  "click",
  enableMotion
);

$("camera-btn")?.addEventListener(
  "click",
  testCamera
);

$("mic-btn")?.addEventListener(
  "click",
  testMicrophone
);

$("record-btn")?.addEventListener("click", () => {
  if (state.recording) {
    stopRecording();
  } else {
    startRecording();
  }
});

$("export-btn")?.addEventListener(
  "click",
  exportSession
);

enableOrientation();
checkBluetooth();

setText(
  "secure-status",
  window.isSecureContext
    ? "Secure context: available"
    : "Local testing context"
);

/* BLE discovery + GATT inspection */
const bluetoothButton = document.createElement("button");
bluetoothButton.id = "ble-scan-btn";
bluetoothButton.textContent = "Scan for BLE devices";

const bluetoothCard = $("bluetooth-status")?.closest(".card");

if (bluetoothCard && !document.getElementById("ble-scan-btn")) {
  bluetoothCard.appendChild(bluetoothButton);
}

bluetoothButton?.addEventListener("click", async () => {
  if (!navigator.bluetooth) {
    setText("bluetooth-status", "Web Bluetooth unavailable");
    return;
  }

  try {
    setText("bluetooth-status", "Waiting for device selection…");
    setText("bluetooth-detail", "Select a BLE device.");

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        "heart_rate",
        "battery_service",
        "device_information"
      ]
    });

    setText(
      "bluetooth-status",
      `Selected: ${device.name || "Unnamed BLE device"}`
    );

    setText(
      "bluetooth-detail",
      `Device ID: ${device.id} — connecting…`
    );

    if (!device.gatt) {
      throw new Error("GATT is not available for this device.");
    }

    const server = await device.gatt.connect();

    setText(
      "bluetooth-detail",
      `Device ID: ${device.id} — connected`
    );

    const services = await server.getPrimaryServices();

    if (!services.length) {
      setText(
        "bluetooth-detail",
        `Device ID: ${device.id} — connected, no primary services reported`
      );
      return;
    }

    const serviceNames = services.map((service) => {
      const uuid = service.uuid.toLowerCase();

      const known = {
        "0000180d-0000-1000-8000-00805f9b34fb": "Heart Rate",
        "0000180f-0000-1000-8000-00805f9b34fb": "Battery Service",
        "0000180a-0000-1000-8000-00805f9b34fb": "Device Information"
      };

      return `${known[uuid] || "Unknown service"} (${uuid})`;
    });

    setText(
      "bluetooth-detail",
      `Connected to ${device.name || "BLE device"}\nServices:\n${serviceNames.join("\n")}`
    );

    console.log("BLE device:", device);
    console.log("BLE services:", services);

  } catch (error) {
    console.error("BLE error:", error);

    if (error.name === "NotFoundError") {
      setText("bluetooth-status", "No device selected");
      setText("bluetooth-detail", "BLE scan cancelled.");
    } else {
      setText(
        "bluetooth-status",
        `BLE error: ${error.message || error.name}`
      );
      setText(
        "bluetooth-detail",
        "The device may not expose the requested services, or the browser may have denied access."
      );
    }
  }
});

renderSessionHistory();

/* ============================================================
   NEON SIGNAL INTELLIGENCE
   Uses existing sensor samples only.
   This layer describes measurable physical signals.
   It does NOT infer thoughts, consciousness, diagnosis, EEG,
   emotions, or other medical/mental states.
   ============================================================ */

(function initSignalIntelligence() {
  const root = document.querySelector('main.app') || document.body;

  const panel = document.createElement('section');
  panel.className = 'intelligence-panel';
  panel.id = 'signal-intelligence';

  panel.innerHTML = `
    <div class="intelligence-header">
      <div>
        <span class="label">Signal Intelligence</span>
        <h2>Live movement profile</h2>
        <p class="intelligence-subtitle">
          Descriptive analysis of the phone's measured motion signal.
        </p>
      </div>
      <span class="intelligence-badge" id="si-status">READY</span>
    </div>

    <div class="intelligence-metrics">
      <div class="intelligence-metric">
        <small>Movement</small>
        <strong id="si-level">No data</strong>
      </div>
      <div class="intelligence-metric">
        <small>Mean magnitude</small>
        <strong id="si-mean">—</strong>
      </div>
      <div class="intelligence-metric">
        <small>Peak magnitude</small>
        <strong id="si-peak">—</strong>
      </div>
      <div class="intelligence-metric">
        <small>Variability</small>
        <strong id="si-variability">—</strong>
      </div>
    </div>

    <div class="signal-chart-wrap">
      <canvas class="signal-chart" id="si-chart" width="900" height="220"></canvas>
    </div>

    <div class="signal-summary" id="si-summary">
      Start a signal session to build a measurable movement profile.
    </div>

    <div class="research-boundary">
      <strong>Research boundary:</strong>
      this system analyzes phone sensor measurements. It does not read
      thoughts, brain activity, consciousness, EEG, or diagnose a medical
      or psychological condition.
    </div>

    <div class="signal-history">
      <span class="label">Local session intelligence</span>
      <div class="signal-history-list" id="si-history"></div>
    </div>
  `;

  root.appendChild(panel);

  const els = {
    status: document.getElementById('si-status'),
    level: document.getElementById('si-level'),
    mean: document.getElementById('si-mean'),
    peak: document.getElementById('si-peak'),
    variability: document.getElementById('si-variability'),
    summary: document.getElementById('si-summary'),
    chart: document.getElementById('si-chart'),
    history: document.getElementById('si-history')
  };

  function motionSamples() {
    if (!Array.isArray(state.samples)) return [];

    return state.samples
      .filter(sample => sample.type === 'motion')
      .map(sample => {
        const x = Number(sample.x) || 0;
        const y = Number(sample.y) || 0;
        const z = Number(sample.z) || 0;

        return {
          timestamp: sample.timestamp,
          magnitude: Math.sqrt(x * x + y * y + z * z)
        };
      })
      .filter(sample => Number.isFinite(sample.magnitude));
  }

  function statistics(values) {
    if (!values.length) {
      return {
        mean: 0,
        peak: 0,
        variability: 0
      };
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const peak = Math.max(...values);

    const variance =
      values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) /
      values.length;

    return {
      mean,
      peak,
      variability: Math.sqrt(variance)
    };
  }

  function movementLevel(mean) {
    if (mean < 1.5) return 'LOWER';
    if (mean < 4) return 'MODERATE';
    return 'HIGHER';
  }

  function variabilityLabel(value, mean) {
    if (!mean) return '—';

    const ratio = value / mean;

    if (ratio < 0.2) return 'LOW';
    if (ratio < 0.5) return 'MODERATE';
    return 'HIGH';
  }

  function drawChart(values) {
    const canvas = els.chart;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || 900));
    const height = 220;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#203149';
    ctx.lineWidth = 1;

    for (let y = 30; y < height; y += 45) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (!values.length) return;

    const visible = values.slice(-160);
    const max = Math.max(...visible, 1);

    ctx.beginPath();

    visible.forEach((value, index) => {
      const x = visible.length === 1
        ? width / 2
        : (index / (visible.length - 1)) * width;

      const y = height - 18 - ((value / max) * (height - 42));

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.strokeStyle = '#8bb7df';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function update() {
    const samples = motionSamples();
    const values = samples.map(sample => sample.magnitude);
    const stats = statistics(values);

    els.mean.textContent = values.length ? stats.mean.toFixed(3) : '—';
    els.peak.textContent = values.length ? stats.peak.toFixed(3) : '—';
    els.variability.textContent = values.length
      ? variabilityLabel(stats.variability, stats.mean)
      : '—';

    if (!values.length) {
      els.level.textContent = 'No data';
      els.status.textContent = state.recording ? 'RECORDING' : 'READY';
      els.summary.textContent =
        'Start a signal session and move the phone naturally to collect measurements.';
      drawChart([]);
      return;
    }

    const level = movementLevel(stats.mean);
    const variability = variabilityLabel(stats.variability, stats.mean);

    els.level.textContent = level;
    els.status.textContent = state.recording ? 'RECORDING' : 'ANALYZED';

    els.summary.textContent =
      `${level.charAt(0) + level.slice(1).toLowerCase()} measured movement with ` +
      `${samples.length} motion samples. Signal variability is ${variability.toLowerCase()}. ` +
      `This is a description of the measured sensor signal, not an interpretation of mental state.`;

    drawChart(values);
  }

  function renderHistory() {
    let sessions = [];

    try {
      sessions = JSON.parse(
        localStorage.getItem('neon-sensor-lab-sessions') || '[]'
      );
    } catch {
      sessions = [];
    }

    if (!Array.isArray(sessions) || !sessions.length) {
      els.history.innerHTML =
        '<div class="signal-history-item">No saved sessions yet.</div>';
      return;
    }

    els.history.innerHTML = sessions.slice(0, 8).map(session => {
      const analysis = session.analysis || {};
      const count =
        analysis.motionSamples ??
        analysis.sampleCount ??
        session.samples?.filter(s => s.type === 'motion').length ??
        0;

      const date = session.session?.startedAt ||
        session.startedAt ||
        session.createdAt ||
        'Unknown time';

      return `
        <div class="signal-history-item">
          <div>
            <strong>${escapeHTML(String(date))}</strong>
            <small>${count} motion samples</small>
          </div>
          <strong>${escapeHTML(String(
            analysis.meanMotion ??
            analysis.mean ??
            '—'
          ))}</strong>
        </div>
      `;
    }).join('');
  }

  function escapeHTML(value) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  window.addEventListener('resize', update);

  setInterval(update, 250);
  setInterval(renderHistory, 1000);

  update();
  renderHistory();
})();
