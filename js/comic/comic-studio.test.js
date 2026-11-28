const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('js/comic/comic-studio.js', 'utf8'), context);
const comic = context.window.MangaFlowComic;

test('creates a page with ordered panels linked to scenes', () => {
  const page = comic.createPage('The Gate', 'Chapter 1', 2, [
    { id: 'SCENE-001', title: 'Arrival', summary: 'Hero arrives', camera: 'Wide shot' },
    { id: 'SCENE-002', title: 'Signal', summary: 'A light flashes' }
  ]);
  assert.equal(page.id, 'PAGE-002');
  assert.equal(page.panels.length, 2);
  assert.equal(page.panels[0].sceneId, 'SCENE-001');
  assert.equal(page.panels[1].id, 'PANEL-002');
});

test('normalizes legacy, missing and unsafe oversized fields', () => {
  const pages = comic.normalizePages([{ title: '<Gate>', layout: 'invalid', panels: [
    { dialogue: 'x'.repeat(2500), sceneId: 'SCENE-001' }
  ] }]);
  assert.equal(pages[0].layout, 'grid-2');
  assert.equal(pages[0].id, 'PAGE-001');
  assert.equal(pages[0].panels[0].dialogue.length, comic.limits.text);
  assert.equal(comic.normalizePages(null).length, 0);
});

test('exports page and panel script text', () => {
  const page = comic.createPage('Finale', 'Chapter 3', 1, [{ id: 'SCENE-004', summary: 'Door opens' }]);
  page.panels[0].speaker = 'Mira';
  page.panels[0].dialogue = 'We made it.';
  const text = comic.toText([page]);
  assert.match(text, /PAGE-001/);
  assert.match(text, /Mira/);
  assert.match(text, /We made it\./);
});

test('stores artwork references and bounded resize dimensions', () => {
  const page = comic.createPage('Resize', 'Chapter 1', 1, [{ id: 'SCENE-001' }]);
  page.panels[0].imageAssetId = 'asset-001';
  page.panels[0].span = 14;
  page.panels[0].height = 9999;
  const normalized = comic.normalizePages([page])[0].panels[0];
  assert.equal(normalized.imageAssetId, 'asset-001');
  assert.equal(normalized.span, 12);
  assert.equal(normalized.height, 900);
});

test('preserves panel image and speech data through normalization', () => {
  const page = comic.createPage('Art', '', 1, [{ id: 'SCENE-002', summary: 'Rainy street' }]);
  Object.assign(page.panels[0], { imageAssetId: 'image-x', speaker: 'Ari', dialogue: 'Run!' });
  const result = comic.normalizePages([page]);
  assert.equal(result[0].panels[0].imageAssetId, 'image-x');
  assert.equal(result[0].panels[0].speaker, 'Ari');
  assert.equal(result[0].panels[0].dialogue, 'Run!');
});
