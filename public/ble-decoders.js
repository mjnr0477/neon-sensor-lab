(function () {
  'use strict';

  const CHARACTERISTIC = {
    HEART_RATE: '2a37',
    PLX_CONTINUOUS: '2a5e',
    PLX_SPOT: '2a5f',
    WEIGHT: '2a9d',
    CSC: '2a5b',
    CYCLING_POWER: '2a63'
  };

  function viewOf(input) {
    if (input instanceof DataView) return input;
    if (input instanceof Uint8Array) return new DataView(input.buffer, input.byteOffset, input.byteLength);
    if (Array.isArray(input)) return new DataView(Uint8Array.from(input).buffer);
    return null;
  }

  function u16(v, o) { return v.getUint16(o, true); }
  function s16(v, o) { return v.getInt16(o, true); }
  function u32(v, o) { return v.getUint32(o, true); }

  function sfloat(v, o) {
    const raw = u16(v, o);
    let mantissa = raw & 0x0fff;
    if (mantissa >= 0x0800) mantissa -= 0x1000;
    let exponent = (raw >> 12) & 0x0f;
    if (exponent >= 0x08) exponent -= 0x10;
    if (mantissa === 0x07ff && exponent === 0x07) return NaN;
    if (mantissa === 0x0800 && exponent === 0x08) return NaN;
    return mantissa * (10 ** exponent);
  }

  function heartRate(input) {
    const v = viewOf(input);
    if (!v || v.byteLength < 2) return null;
    const flags = v.getUint8(0);
    const value = (flags & 1) ? u16(v, 1) : v.getUint8(1);
    const contactSupported = Boolean(flags & 4);
    let offset = (flags & 1) ? 3 : 2;
    let energyExpended = null;
    if (flags & 8 && v.byteLength >= offset + 2) {
      energyExpended = u16(v, offset);
      offset += 2;
    }
    const rrIntervals = [];
    if (flags & 16) {
      while (offset + 1 < v.byteLength) {
        rrIntervals.push(u16(v, offset) / 1024);
        offset += 2;
      }
    }
    return {
      measurement: 'heart-rate', value, unit: 'bpm',
      sensorContact: contactSupported ? Boolean(flags & 2) : null,
      energyExpended, rrIntervals, flags
    };
  }

  function pulseOximeter(input) {
    const v = viewOf(input);
    if (!v || v.byteLength < 3) return null;
    const flags = v.getUint8(0);
    const oxygen = sfloat(v, 1);
    const result = { measurement: 'blood-oxygen', value: oxygen, unit: '%', flags };
    if (v.byteLength >= 5) {
      result.pulseRate = sfloat(v, 3);
      result.pulseUnit = 'bpm';
    }
    return result;
  }

  function weight(input) {
    const v = viewOf(input);
    if (!v || v.byteLength < 3) return null;
    const flags = v.getUint8(0);
    const imperial = Boolean(flags & 1);
    const raw = sfloat(v, 1);
    return {
      measurement: 'weight',
      value: imperial ? raw * 0.45359237 : raw,
      unit: 'kg',
      originalValue: raw,
      originalUnit: imperial ? 'lb' : 'kg',
      flags
    };
  }

  function cyclingSpeedCadence(input) {
    const v = viewOf(input);
    if (!v || v.byteLength < 1) return null;
    const flags = v.getUint8(0);
    let offset = 1;
    const result = { measurement: 'cycling', flags };
    if (flags & 1 && v.byteLength >= offset + 6) {
      result.cumulativeWheelRevolutions = u32(v, offset);
      result.lastWheelEventTime = u16(v, offset + 4) / 1024;
      offset += 6;
    }
    if (flags & 2 && v.byteLength >= offset + 4) {
      result.cumulativeCrankRevolutions = u16(v, offset);
      result.lastCrankEventTime = u16(v, offset + 2) / 1024;
    }
    return result;
  }

  function cyclingPower(input) {
    const v = viewOf(input);
    if (!v || v.byteLength < 4) return null;
    return { measurement: 'cycling-power', value: s16(v, 2), unit: 'W', flags: u16(v, 0) };
  }

  function decode(uuid, input) {
    const id = String(uuid || '').toLowerCase().replace(/^.*-/, '');
    if (id === CHARACTERISTIC.HEART_RATE) return heartRate(input);
    if (id === CHARACTERISTIC.PLX_CONTINUOUS || id === CHARACTERISTIC.PLX_SPOT) return pulseOximeter(input);
    if (id === CHARACTERISTIC.WEIGHT) return weight(input);
    if (id === CHARACTERISTIC.CSC) return cyclingSpeedCadence(input);
    if (id === CHARACTERISTIC.CYCLING_POWER) return cyclingPower(input);
    return null;
  }

  window.NeonBLEDecoders = {
    characteristics: { ...CHARACTERISTIC }, viewOf, sfloat,
    heartRate, pulseOximeter, weight, cyclingSpeedCadence, cyclingPower, decode
  };
})();