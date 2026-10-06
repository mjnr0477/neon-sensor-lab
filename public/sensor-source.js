(function () {
  'use strict';

  const state = {
    sources: new Map(),
    events: [],
    lastPhoneSample: 0,
    lastBleEvent: 0,
    observations: []
  };

  function now() {
    return new Date().toISOString();
  }

  function registerSource(id, metadata) {
    state.sources.set(id, {
      id,
      ...metadata,
      registeredAt: now()
    });
  }

  function emit(source, type, value, timestamp) {
    const event = {
      schema: 'neon-sensor-event',
      schemaVersion: '1.0',
      timestamp: timestamp || now(),
      source,
      type,
      value
    };

    state.events.push(event);

    if (state.events.length > 1000) {
      state.events.splice(0, state.events.length - 1000);
    }

    window.dispatchEvent(new CustomEvent('neon:sensor-event', {
      detail: event
    }));
  }

  function ingestPhoneSamples() {
    const app = window.NeonSensorLab;
    if (!app) return;

    const session = app.getSession?.();
    const samples = session?.samples;

    if (!Array.isArray(samples)) return;

    if (samples.length < state.lastPhoneSample) state.lastPhoneSample = 0;

    for (let i = state.lastPhoneSample; i < samples.length; i += 1) {
      const sample = samples[i];

      emit(
        'phone',
        sample.type || 'unknown',
        {
          ...sample
        },
        sample.timestamp
      );
    }

    state.lastPhoneSample = samples.length;
  }

  function ingestBleEvents() {
    const ble = window.NeonBLEStream;
    const events = ble?.getEvents?.();

    if (!Array.isArray(events)) return;

    if (events.length < state.lastBleEvent) state.lastBleEvent = 0;

    for (let i = state.lastBleEvent; i < events.length; i += 1) {
      const event = events[i];

      emit(
        'ble',
        'notification',
        {
          uuid: event.uuid || null,
          name: event.name || null,
          ...event.value
        },
        event.timestamp
      );
    }

    state.lastBleEvent = events.length;
  }

  function collect() {
    ingestPhoneSamples();
    ingestBleEvents();
  }

  window.addEventListener('neon:scientific-observation', event => {
    const observation = event.detail;
    if (!observation || !window.NeonScientific?.validateObservation?.(observation).valid) return;
    state.observations.push(observation);
    if (state.observations.length > 2000) {
      state.observations.splice(0, state.observations.length - 2000);
    }
  });

  registerSource('phone', {
    category: 'device-sensor',
    transport: 'browser-sensor-api',
    localOnly: true
  });

  registerSource('ble', {
    category: 'external-sensor',
    transport: 'web-bluetooth',
    localOnly: true
  });

  setInterval(collect, 250);

  window.NeonSensorSources = {
    list: () => [...state.sources.values()],
    events: () => state.events.slice(),
    clear: () => {
      state.events.length = 0;
      state.observations.length = 0;
      state.lastPhoneSample = 0;
      state.lastBleEvent = 0;
    },
    observations: () => state.observations.slice(),
    state: () => ({
      eventCount: state.events.length,
      lastPhoneSample: state.lastPhoneSample,
      lastBleEvent: state.lastBleEvent
    }),
    schema: () => ({
      name: 'neon-sensor-event',
      version: '1.0',
      sources: [...state.sources.keys()]
    })
  };

  collect();
})();