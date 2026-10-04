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
