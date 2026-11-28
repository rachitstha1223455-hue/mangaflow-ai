/* Audio queue data model — browser-independent helpers. */
(function (global) {
  'use strict';
  const MAX_ITEMS = 300;
  const MAX_TEXT = 6000;
  const clean = (value, max = MAX_TEXT) => String(value == null ? '' : value).trim().slice(0, max);
  function createItem(input, number) {
    const item = input || {};
    return {
      id: clean(item.id, 100) || 'AUDIO-' + String(number || 1).padStart(3, '0'),
      kind: ['dialogue','narration','music','sfx'].includes(item.kind) ? item.kind : 'dialogue',
      speaker: clean(item.speaker, 120),
      text: clean(item.text),
      voice: clean(item.voice, 120),
      language: ['Hindi','English'].includes(item.language) ? item.language : 'English',
      audioAssetId: clean(item.audioAssetId, 120),
      fileName: clean(item.fileName, 180),
      duration: Math.max(0, Number(item.duration) || 0),
      status: item.audioAssetId ? 'ready' : 'pending'
    };
  }
  function normalizeQueue(queue) {
    if (!Array.isArray(queue)) return [];
    return queue.slice(0, MAX_ITEMS).map((item, index) => createItem(item, index + 1));
  }
  function toText(queue) {
    return normalizeQueue(queue).map((item, index) =>
      [String(index + 1) + '. ' + item.id + ' [' + item.kind + ']',
        'Speaker: ' + item.speaker, 'Language: ' + item.language,
        'Voice: ' + item.voice, 'Text: ' + item.text,
        'Audio: ' + (item.audioAssetId || 'not attached')].join('\n')
    ).join('\n\n');
  }
  global.MangaFlowAudio = { MAX_ITEMS, MAX_TEXT, createItem, normalizeQueue, toText };
})(window);
