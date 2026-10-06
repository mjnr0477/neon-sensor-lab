(function () {
  'use strict';

  const SCHEMA = 'neon-scientific-study';
  const VERSION = '1.0';

  function linearCalibration(value, calibration) {
    const x = Number(value);
    const scale = Number(calibration?.scale ?? 1);
    const offset = Number(calibration?.offset ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(scale) || !Number.isFinite(offset)) return null;
    return x * scale + offset;
  }

  function describe(values) {
    const s = window.NeonScientific;
    const xs = (values || []).map(Number).filter(Number.isFinite);
    if (!xs.length) return { n: 0 };
    return {
      n: xs.length,
      mean: s.mean(xs),
      sd: s.standardDeviation(xs),
      min: Math.min(...xs),
      max: Math.max(...xs),
      quantiles: s.quantiles(xs),
      trend: s.linearTrend(xs)
    };
  }

  function confidenceLabel(qualityScore) {
    const q = Number(qualityScore);
    if (!Number.isFinite(q)) return 'unknown';
    if (q >= 90) return 'high-data-quality';
    if (q >= 70) return 'moderate-data-quality';
    if (q > 0) return 'limited-data-quality';
    return 'no-data';
  }

  function createStudy(input) {
    return {
      schema: SCHEMA,
      schemaVersion: VERSION,
      id: input?.id || String(Date.now()) + '-' + Math.random(),
      title: input?.title || 'Neon scientific study',
      objective: input?.objective || '',
      hypothesis: input?.hypothesis || '',
      population: input?.population || 'self-observation',
      protocolVersion: input?.protocolVersion || '1.0',
      createdAt: input?.createdAt || new Date().toISOString(),
      variables: Array.isArray(input?.variables) ? input.variables.map(v => ({ ...v })) : [],
      sources: Array.isArray(input?.sources) ? [...input.sources] : [],
      limitations: Array.isArray(input?.limitations) ? [...input.limitations] : []
    };
  }

  function snapshot(observations, study) {
    const list = Array.isArray(observations) ? observations.slice() : [];
    const analysis = window.NeonSignalIntelligence?.analyze?.(list) || null;
    return {
      schema: 'neon-scientific-snapshot',
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      study: study || null,
      observationCount: list.length,
      analysis,
      reproducibility: {
        localOnly: true,
        rawObservationsIncluded: true,
        derivedResultsDependOn: ['observation order', 'timestamps', 'decoder version', 'analysis version']
      }
    };
  }

  window.NeonScientificMethod = {
    schema: () => ({ name: SCHEMA, version: VERSION }),
    linearCalibration,
    describe,
    confidenceLabel,
    createStudy,
    snapshot
  };
})();