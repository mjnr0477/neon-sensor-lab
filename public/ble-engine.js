(function () {
  'use strict';

  const BLE = {
    services: {
      '00001800-0000-1000-8000-00805f9b34fb': 'Generic Access',
      '00001801-0000-1000-8000-00805f9b34fb': 'Generic Attribute',
      '0000180a-0000-1000-8000-00805f9b34fb': 'Device Information',
      '0000180d-0000-1000-8000-00805f9b34fb': 'Heart Rate',
      '0000180f-0000-1000-8000-00805f9b34fb': 'Battery Service',
      '0000181d-0000-1000-8000-00805f9b34fb': 'Weight Scale',
      '00001816-0000-1000-8000-00805f9b34fb': 'Cycling Speed and Cadence',
      '00001818-0000-1000-8000-00805f9b34fb': 'Cycling Power',
      '00001822-0000-1000-8000-00805f9b34fb': 'Pulse Oximeter'
    },

    characteristics: {
      '00002a00-0000-1000-8000-00805f9b34fb': 'Device Name',
      '00002a01-0000-1000-8000-00805f9b34fb': 'Appearance',
      '00002a19-0000-1000-8000-00805f9b34fb': 'Battery Level',
      '00002a24-0000-1000-8000-00805f9b34fb': 'Model Number String',
      '00002a25-0000-1000-8000-00805f9b34fb': 'Serial Number String',
      '00002a26-0000-1000-8000-00805f9b34fb': 'Firmware Revision String',
      '00002a27-0000-1000-8000-00805f9b34fb': 'Hardware Revision String',
      '00002a28-0000-1000-8000-00805f9b34fb': 'Software Revision String',
      '00002a29-0000-1000-8000-00805f9b34fb': 'Manufacturer Name String',
      '00002a37-0000-1000-8000-00805f9b34fb': 'Heart Rate Measurement',
      '00002a38-0000-1000-8000-00805f9b34fb': 'Body Sensor Location',
      '00002a5b-0000-1000-8000-00805f9b34fb': 'CSC Measurement',
      '00002a5c-0000-1000-8000-00805f9b34fb': 'CSC Feature',
      '00002a5d-0000-1000-8000-00805f9b34fb': 'Sensor Location',
      '00002a5e-0000-1000-8000-00805f9b34fb': 'PLX Continuous Measurement',
      '00002a5f-0000-1000-8000-00805f9b34fb': 'PLX Spot-Check Measurement',
      '00002a63-0000-1000-8000-00805f9b34fb': 'Cycling Power Measurement',
      '00002a65-0000-1000-8000-00805f9b34fb': 'Cycling Power Feature',
      '00002a9d-0000-1000-8000-00805f9b34fb': 'Weight Measurement'
    }
  };

  function normalizeUUID(uuid) {
    return String(uuid || '').toLowerCase();
  }

  function serviceName(uuid) {
    const normalized = normalizeUUID(uuid);
    return BLE.services[normalized] || 'Unknown service';
  }

  function characteristicName(uuid) {
    const normalized = normalizeUUID(uuid);
    return BLE.characteristics[normalized] || 'Unknown characteristic';
  }

  function properties(characteristic) {
    const p = characteristic.properties || {};

    return [
      p.read ? 'read' : null,
      p.write ? 'write' : null,
      p.writeWithoutResponse ? 'writeWithoutResponse' : null,
      p.notify ? 'notify' : null,
      p.indicate ? 'indicate' : null
    ].filter(Boolean);
  }

  function decodeValue(dataView) {
    if (!dataView) return null;

    const bytes = [];
    for (let i = 0; i < dataView.byteLength; i += 1) {
      bytes.push(dataView.getUint8(i));
    }

    let text = '';

    try {
      text = new TextDecoder().decode(dataView).replace(/\0/g, '').trim();
    } catch {
      text = '';
    }

    return {
      byteLength: dataView.byteLength,
      hex: bytes
        .slice(0, 32)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(' '),
      text: text || null
    };
  }

  async function inspectCharacteristic(characteristic) {
    const info = {
      uuid: normalizeUUID(characteristic.uuid),
      name: characteristicName(characteristic.uuid),
      properties: properties(characteristic),
      readableValue: null
    };

    if (!characteristic.properties?.read) {
      return info;
    }

    try {
      const value = await characteristic.readValue();
      info.readableValue = decodeValue(value);
    } catch (error) {
      info.readError = error.message || String(error);
    }

    return info;
  }

  async function inspectService(service) {
    const characteristics = await service.getCharacteristics();

    const result = {
      uuid: normalizeUUID(service.uuid),
      name: serviceName(service.uuid),
      characteristics: []
    };

    for (const characteristic of characteristics) {
      result.characteristics.push(
        await inspectCharacteristic(characteristic)
      );
    }

    return result;
  }

  async function inspectDevice(device) {
    if (!device?.gatt) {
      throw new Error('GATT is not available for this device.');
    }

    const server = device.gatt.connected
      ? device.gatt
      : await device.gatt.connect();

    const services = await server.getPrimaryServices();

    const result = {
      device: {
        id: device.id || null,
        name: device.name || 'Unnamed BLE device'
      },
      connected: device.gatt.connected,
      services: []
    };

    for (const service of services) {
      result.services.push(await inspectService(service));
    }

    return result;
  }

  function render(result) {
    const existing = document.getElementById('ble-intelligence');

    if (existing) {
      existing.remove();
    }

    const root =
      document.querySelector('main.app') ||
      document.body;

    const panel = document.createElement('section');
    panel.className = 'intelligence-panel';
    panel.id = 'ble-intelligence';

    const serviceCount = result.services.length;
    const characteristicCount =
      result.services.reduce(
        (total, service) =>
          total + service.characteristics.length,
        0
      );

    panel.innerHTML = `
      <div class="intelligence-header">
        <div>
          <span class="label">BLE GATT Intelligence</span>
          <h2>${escapeHTML(result.device.name)}</h2>
          <p class="intelligence-subtitle">
            Standardized Bluetooth services and characteristics discovered locally.
          </p>
        </div>
        <span class="intelligence-badge">CONNECTED</span>
      </div>

      <div class="intelligence-metrics">
        <div class="intelligence-metric">
          <small>Services</small>
          <strong>${serviceCount}</strong>
        </div>

        <div class="intelligence-metric">
          <small>Characteristics</small>
          <strong>${characteristicCount}</strong>
        </div>

        <div class="intelligence-metric">
          <small>Device ID</small>
          <strong>${escapeHTML(result.device.id || '—')}</strong>
        </div>

        <div class="intelligence-metric">
          <small>Data mode</small>
          <strong>LOCAL</strong>
        </div>
      </div>

      <div class="ble-service-list">
        ${result.services.map(renderService).join('')}
      </div>

      <div class="research-boundary">
        <strong>BLE boundary:</strong>
        this layer identifies and reads exposed BLE metadata and readable
        characteristics. It does not infer thoughts, EEG, consciousness,
        medical conditions, or psychological states.
      </div>
    `;

    root.appendChild(panel);
  }

  function renderService(service) {
    return `
      <article class="ble-service">
        <div class="ble-service-heading">
          <strong>${escapeHTML(service.name)}</strong>
          <code>${escapeHTML(service.uuid)}</code>
        </div>

        ${
          service.characteristics.length
            ? service.characteristics.map(renderCharacteristic).join('')
            : '<p>No characteristics reported.</p>'
        }
      </article>
    `;
  }

  function renderCharacteristic(characteristic) {
    const value = characteristic.readableValue;

    let valueMarkup = '';

    if (value) {
      valueMarkup = `
        <div class="ble-value">
          ${
            value.text
              ? `<span>Text: ${escapeHTML(value.text)}</span>`
              : ''
          }
          <code>${escapeHTML(value.hex || 'No bytes')}</code>
        </div>
      `;
    } else if (characteristic.readError) {
      valueMarkup = `
        <div class="ble-value">
          Read unavailable: ${escapeHTML(characteristic.readError)}
        </div>
      `;
    }

    return `
      <div class="ble-characteristic">
        <div>
          <strong>${escapeHTML(characteristic.name)}</strong>
          <code>${escapeHTML(characteristic.uuid)}</code>
        </div>

        <div class="ble-properties">
          ${
            characteristic.properties.length
              ? characteristic.properties
                  .map(
                    property =>
                      `<span>${escapeHTML(property)}</span>`
                  )
                  .join('')
              : '<span>no properties reported</span>'
          }
        </div>

        ${valueMarkup}
      </div>
    `;
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  window.NeonBLE = {
    registry: BLE,
    normalizeUUID,
    serviceName,
    characteristicName,
    inspectDevice
  };

  window.addEventListener('neon:ble-device-selected', async event => {
    try {
      const result = await inspectDevice(event.detail.device);
      render(result);

      console.log('Neon BLE intelligence:', result);
    } catch (error) {
      console.error('BLE intelligence error:', error);

      const status = document.getElementById('bluetooth-status');
      const detail = document.getElementById('bluetooth-detail');

      if (status) {
        status.textContent =
          `BLE inspection error: ${error.message || error}`;
      }

      if (detail) {
        detail.textContent =
          'The device connected, but its GATT structure could not be inspected.';
      }
    }
  });
})();
