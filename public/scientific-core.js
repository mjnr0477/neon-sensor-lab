(function () {
  'use strict';

  const SCHEMA = 'neon-scientific-observation';
  const VERSION = '1.0';

  const UNITS = Object.freeze({
    bpm: { name: 'beats per minute', dimension: 'rate' },
    '%': { name: 'percent', dimension: 'ratio' },
    kg: { name: 'kilograms', dimension: 'mass' },
    lb: { name: 'pounds', dimension: 'mass' },
    '°C': { name: 'degrees Celsius', dimension: 'temperature' },
    'mmHg': { name: 'millimetres of mercury', dimension: 'pressure' },
    'breaths/min': { name: 'breaths per minute', dimension: 'rate' },
    'm/s²': { name: 'metres per second squared', dimension: 'acceleration' },
    deg: { name: 'degrees', dimension: 'angle' }
  });

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function mean(values) {
    const xs = values.filter(finite);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }

  function variance(values) {
    const xs = values.filter(finite);
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return xs.reduce((sum, x) => sum + ((x - m) ** 2), 0) / (xs.length - 1);
  }

  function standardDeviation(values) {
    return Math.sqrt(variance(values));
  }

  function coefficientOfVariation(values) {
    const m = mean(values);
    if (!finite(m) || m === 0) return null;
    return standardDeviation(values) / Math.abs(m);
  }

  function linearTrend(values) {
    const xs = values.filter(finite);
    if (xs.length < 2) return { slope: null, direction: 'insufficient-data' };
    const xMean = (xs.length - 1) / 2;
    const yMean = mean(xs);
    let numerator = 0;
    let denominator = 0;
    xs.forEach((y, i) => {
      numerator += (i - xMean) * (y - yMean);
      denominator += (i - xMean) ** 2;
    });
    const slope = denominator ? numerator / denominator : 0;
    return {
      slope,
      direction: Math.abs(slope) < 1e-9 ? 'stable' : slope > 0 ? 'rising' : 'falling'
    };
  }

  function quantiles(values) {
    const xs = values.filter(finite).sort((a, b) => a - b);
    if (!xs.length) return { p05: null, p25: null, median: null, p75: null, p95: null };
    const at = p => xs[Math.min(xs.length - 1, Math.max(0, Math.round((xs.length - 1) * p)))];
    return { p05: at(.05), p25: at(.25), median: at(.5), p75: at(.75), p95: at(.95) };
  }

  function validateObservation(observation) {
    const errors = [];
    if (!observation || observation.schema !== SCHEMA) errors.push('schema');
    if (!observation.timestamp || Number.isNaN(Date.parse(observation.timestamp))) errors.push('timestamp');
    if (!observation.measurement || typeof observation.measurement !== 'string') errors.push('measurement');
    if (!observation.provenance || typeof observation.provenance !== 'object') errors.push('provenance');
    if (observation.value === undefined || observation.value === null) errors.push('value');
    return { valid: errors.length === 0, errors };
  }

  function observation(input) {
    const value = input?.value;
    return {
      schema: SCHEMA,
      schemaVersion: VERSION,
      id: input?.id || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random()),
      timestamp: input?.timestamp || new Date().toISOString(),
      measurement: input?.measurement || 'unknown',
      value,
      unit: input?.unit || null,
      source: input?.source || 'unknown',
      provenance: {
        transport: input?.transport || 'unknown',
        deviceId: input?.deviceId || null,
        characteristic: input?.characteristic || null,
        algorithm: input?.algorithm || 'direct',
        quality: input?.quality || 'unrated',
        derivedFrom: Array.isArray(input?.derivedFrom) ? [...input.derivedFrom] : []
      }
    };
  }

  window.NeonScientific = {
    schema: () => ({ name: SCHEMA, version: VERSION }),
    units: () => ({ ...UNITS }),
    finite, clamp, mean, variance, standardDeviation,
    coefficientOfVariation, linearTrend, quantiles,
    validateObservation, observation
  };
})();