const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  window: {},
  globalThis: {},
  console,
  setInterval,
  clearInterval,
  CustomEvent: class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  }
};
context.globalThis = context;
vm.createContext(context);

for (const file of ['public/scientific-core.js', 'public/ble-decoders.js', 'public/signal-intelligence.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const scientific = context.window.NeonScientific;
const decoders = context.window.NeonBLEDecoders;

assert.equal(scientific.mean([1, 2, 3]), 2);
assert.equal(scientific.standardDeviation([1, 2, 3]).toFixed(6), '1.000000');
assert.equal(scientific.linearTrend([1, 2, 3]).direction, 'rising');

assert.equal(decoders.heartRate([0, 72]).value, 72);
assert.equal(decoders.weight([0, 0xee, 0xf2]).value, 75);
assert.equal(decoders.pulseOximeter([0, 0xd9, 0xf3]).value, 98.5);

const observation = scientific.observation({
  measurement: 'heart-rate',
  value: 72,
  unit: 'bpm',
  source: 'ble',
  transport: 'web-bluetooth'
});
assert.equal(scientific.validateObservation(observation).valid, true);

console.log('Scientific core and BLE decoder tests passed.');
