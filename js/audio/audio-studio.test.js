const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('js/audio/audio-studio.js', 'utf8'), context);
const audio = context.window.MangaFlowAudio;

test('creates audio queue items with supported kinds and defaults', () => {
  const item = audio.createItem({ kind: 'narration', speaker: 'Narrator', text: 'A storm begins.', language: 'Hindi' }, 3);
  assert.equal(item.id, 'AUDIO-003');
  assert.equal(item.kind, 'narration');
  assert.equal(item.language, 'Hindi');
  assert.equal(item.status, 'pending');
});

test('normalizes queue size, text length and unknown kinds', () => {
  const queue = audio.normalizeQueue([{ kind: 'unknown', text: 'x'.repeat(7000) }, null]);
  assert.equal(queue.length, 2);
  assert.equal(queue[0].kind, 'dialogue');
  assert.equal(queue[0].text.length, audio.MAX_TEXT);
  assert.equal(queue[1].id, 'AUDIO-002');
});

test('preserves uploaded audio references and exports readable queue text', () => {
  const queue = audio.normalizeQueue([{ id: 'AUDIO-007', kind: 'sfx', text: 'Thunder', audioAssetId: 'asset-7' }]);
  assert.equal(queue[0].status, 'ready');
  assert.match(audio.toText(queue), /asset-7/);
  assert.match(audio.toText(queue), /Thunder/);
});
