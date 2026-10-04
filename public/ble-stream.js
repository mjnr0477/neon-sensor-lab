(function () {
  'use strict';

  const state = {
    device: null,
    running: false,
    subscriptions: [],
    events: []
  };

  const MAX_EVENTS = 200;

  const root = document.querySelector('main.app') || document.body;
  const panel = document.createElement('section');
  panel.className = 'intelligence-panel';
  panel.id = 'ble-stream';

  panel.innerHTML = `
    <div class="intelligence-header">
      <div>
        <span class="label">BLE Live Stream</span>
        <h2>Local characteristic notifications</h2>
        <p class="intelligence-subtitle">
          Opt-in live values from BLE characteristics that expose notify or indicate.
        </p>
      </div>
      <span class="intelligence-badge" id="ble-stream-status">READY</span>
    </div>

    <div class="intelligence-metrics">
      <div class="intelligence-metric">
        <small>Events</small>
        <strong id="ble-stream-count">0</strong>
      </div>
      <div class="intelligence-metric">
        <small>Subscriptions</small>
        <strong id="ble-stream-subscriptions">0</strong>
      </div>
      <div class="intelligence-metric">
        <small>Mode</small>
        <strong>LOCAL</strong>
      </div>
    </div>

    <div class="actions">
      <button id="ble-stream-toggle" disabled>Start live stream</button>
      <button id="ble-stream-clear" disabled>Clear events</button>
    </div>

    <div class="signal-summary" id="ble-stream-summary">
      Select a BLE device first. Streaming starts only when you choose it.
    </div>

    <div class="history-panel">
      <h3>Recent BLE events</h3>
      <div id="ble-stream-log">No live events yet.</div>
    </div>

    <div class="research-boundary">
      <strong>BLE boundary:</strong>
      values are raw device notifications decoded locally as bytes and optional text.
      No cloud upload or medical interpretation is performed.
    </div>
  `;

  root.appendChild(panel);

  const status = document.getElementById('ble-stream-status');
  const count = document.getElementById('ble-stream-count');
  const subscriptions = document.getElementById('ble-stream-subscriptions');
  const toggle = document.getElementById('ble-stream-toggle');
  const clear = document.getElementById('ble-stream-clear');
  const summary = document.getElementById('ble-stream-summary');
  const log = document.getElementById('ble-stream-log');

  function escapeHTML(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function decode(dataView) {
    const bytes = [];

    for (let i = 0; i < dataView.byteLength; i += 1) {
      bytes.push(dataView.getUint8(i));
    }

    let text = null;

    try {
      const decoded = new TextDecoder()
        .decode(dataView)
        .replace(/\0/g, '')
        .trim();

      if (decoded) text = decoded;
    } catch {
      text = null;
    }

    return {
      hex: bytes
        .slice(0, 32)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(' '),
      byteLength: dataView.byteLength,
      text
    };
  }

  function render() {
    count.textContent = String(state.events.length);
    subscriptions.textContent = String(state.subscriptions.length);

    if (!state.events.length) {
      log.textContent = 'No live events yet.';
      return;
    }

    log.replaceChildren();

    state.events
      .slice()
      .reverse()
      .slice(0, 25)
      .forEach(event => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const value = event.value.text
          ? `text="${event.value.text}" · ${event.value.hex}`
          : event.value.hex || 'No bytes';

        item.textContent =
          `${new Date(event.timestamp).toLocaleTimeString()} · ` +
          `${event.name} · ${value}`;

        log.appendChild(item);
      });
  }

  function onNotification(event) {
    const characteristic = event.target;
    const value = decode(event.target.value);

    state.events.push({
      timestamp: new Date().toISOString(),
      uuid: characteristic.uuid,
      name: characteristic.userDescription || characteristic.uuid,
      value
    });

    if (state.events.length > MAX_EVENTS) {
      state.events.splice(0, state.events.length - MAX_EVENTS);
    }

    render();
  }

  async function stopStream() {
    for (const subscription of state.subscriptions) {
      try {
        subscription.characteristic.removeEventListener(
          'characteristicvaluechanged',
          subscription.handler
        );
        await subscription.characteristic.stopNotifications();
      } catch (error) {
        console.warn('BLE notification stop failed:', error);
      }
    }

    state.subscriptions = [];
    state.running = false;

    status.textContent = 'READY';
    toggle.textContent = 'Start live stream';
    toggle.disabled = !state.device;

    summary.textContent = state.device
      ? 'Live stream stopped. No data leaves the browser.'
      : 'Select a BLE device first.';
    render();
  }

  async function startStream() {
    if (!state.device?.gatt) {
      throw new Error('Select a BLE device before starting the stream.');
    }

    if (state.running) {
      await stopStream();
      return;
    }

    const server = state.device.gatt.connected
      ? state.device.gatt
      : await state.device.gatt.connect();

    const services = await server.getPrimaryServices();
    let subscribed = 0;

    for (const service of services) {
      const characteristics = await service.getCharacteristics();

      for (const characteristic of characteristics) {
        const properties = characteristic.properties || {};

        if (!properties.notify && !properties.indicate) {
          continue;
        }

        try {
          const handler = onNotification;
          characteristic.addEventListener(
            'characteristicvaluechanged',
            handler
          );
          await characteristic.startNotifications();

          state.subscriptions.push({ characteristic, handler });
          subscribed += 1;
        } catch (error) {
          console.warn(
            `BLE subscription failed for ${characteristic.uuid}:`,
            error
          );
        }
      }
    }

    if (!subscribed) {
      state.running = false;
      status.textContent = 'NO STREAM';
      summary.textContent =
        'The selected device exposes no notification/indication characteristic that this browser can subscribe to.';
      toggle.textContent = 'Start live stream';
      toggle.disabled = false;
      render();
      return;
    }

    state.running = true;
    status.textContent = 'STREAMING';
    toggle.textContent = 'Stop live stream';
    summary.textContent =
      `Subscribed to ${subscribed} BLE characteristic(s). Values are kept locally in this browser.`;
    render();
  }

  toggle.addEventListener('click', async () => {
    toggle.disabled = true;

    try {
      await startStream();
    } catch (error) {
      console.error('BLE live stream error:', error);
      status.textContent = 'ERROR';
      summary.textContent = error.message || String(error);
      toggle.disabled = !state.device;
    } finally {
      if (!state.running) {
        toggle.disabled = !state.device;
      }
    }
  });

  clear.addEventListener('click', () => {
    state.events = [];
    render();
  });

  window.addEventListener('neon:ble-device-selected', event => {
    if (state.running) {
      stopStream().catch(error => {
        console.warn('BLE stream cleanup failed:', error);
      });
    }

    state.device = event.detail?.device || null;
    state.events = [];

    toggle.disabled = !state.device;
    clear.disabled = !state.device;

    status.textContent = state.device ? 'DEVICE READY' : 'READY';
    summary.textContent = state.device
      ? 'Device selected. Start live stream to subscribe to supported BLE notifications.'
      : 'Select a BLE device first.';

    render();
  });

  render();

  window.NeonBLEStream = {
    getState: () => ({
      running: state.running,
      device: state.device
        ? { id: state.device.id, name: state.device.name }
        : null,
      eventCount: state.events.length,
      subscriptions: state.subscriptions.length
    }),
    stop: stopStream
  };
})();
