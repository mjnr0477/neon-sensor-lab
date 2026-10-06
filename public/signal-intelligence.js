(function () {
  'use strict';

  const MAX_POINTS = 2000;

  function numeric(values) {
    return (values || []).map(Number).filter(Number.isFinite);
  }

  function summary(values, unit) {
    const xs = numeric(values);
    const s = window.NeonScientific;
    if (!xs.length) return { n: 0, unit: unit || null };
    return {
      n: xs.length,
      unit: unit || null,
      mean: s.mean(xs),
      sd: s.standardDeviation(xs),
      cv: s.coefficientOfVariation(xs),
      min: Math.min(...xs),
      max: Math.max(...xs),
      trend: s.linearTrend(xs),
      quantiles: s.quantiles(xs)
    };
  }

  function quality(observations) {
    const xs = Array.isArray(observations) ? observations : [];
    if (!xs.length) return { score: 0, label: 'no-data', n: 0, valid: 0, duplicates: 0, outOfOrder: 0, gaps: 0 };
    let valid = 0, duplicates = 0, outOfOrder = 0, gaps = 0, previous = 0;
    const seen = new Set();

    xs.forEach(item => {
      const t = Date.parse(item?.timestamp);
      if (window.NeonScientific?.validateObservation(item).valid) valid++;
      if (seen.has(item?.id)) duplicates++;
      seen.add(item?.id);
      if (Number.isFinite(t)) {
        if (previous && t < previous) outOfOrder++;
        if (previous && t - previous > 5000) gaps++;
        previous = Math.max(previous, t);
      }
    });

    const penalty = (duplicates + outOfOrder) / xs.length * 0.5 + Math.min(0.5, gaps / Math.max(1, xs.length));
    const score = Math.max(0, Math.round(100 * Math.max(0, valid / xs.length - penalty)));
    return {
      score,
      label: score >= 90 ? 'high-integrity' : score >= 70 ? 'usable' : 'limited',
      n: xs.length, valid, duplicates, outOfOrder, gaps
    };
  }

  function analyze(observations) {
    const list = (observations || []).slice(-MAX_POINTS);
    const byMeasurement = new Map();

    list.forEach(item => {
      if (!item?.measurement || !Number.isFinite(Number(item.value))) return;
      if (!byMeasurement.has(item.measurement)) byMeasurement.set(item.measurement, []);
      byMeasurement.get(item.measurement).push(item);
    });

    const measurements = {};
    for (const [name, items] of byMeasurement) {
      measurements[name] = summary(items.map(x => Number(x.value)), items[0].unit);
    }

    const result = {
      schema: 'neon-signal-intelligence',
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      observationCount: list.length,
      quality: quality(list),
      measurements
    };
    return result;
  }

  function humanSummary(result) {
    if (!result?.observationCount) return 'No measured signal is available yet.';
    const q = result.quality;
    if (q.label === 'high-integrity') return 'The available signal data is consistent enough for analysis.';
    if (q.label === 'usable') return 'The available signal data can be analyzed, with some gaps or quality limitations.';
    return 'The available signal data is limited; better measurements would improve the analysis.';
  }

  window.NeonSignalIntelligence = { summary, quality, analyze, humanSummary };
})();