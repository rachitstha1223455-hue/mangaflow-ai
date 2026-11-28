const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/story/story-intelligence.js', 'utf8');
const window = {};
vm.runInNewContext(source, { window });
const story = window.MangaFlowStory;
const input = { title: 'Test Story', genre: 'Fantasy', language: 'English', protagonist: 'Ari', idea: 'A lost map', blueprint: '', chapterCount: 10, chaptersPerEpisode: 2 };

test('offline fallback creates requested chapter count', () => {
  const plan = story.createFallbackPlan(input);
  assert.equal(plan.chapters.length, 10);
  assert.equal(plan.chapters[0].number, 1);
  assert.ok(plan.chapters.every(chapter => chapter.title && chapter.summary && chapter.cliffhanger));
});

test('episode grouping covers every chapter without overlap', () => {
  const plan = story.createFallbackPlan(input);
  const episodes = story.groupEpisodes(plan, 2);
  assert.equal(episodes.length, 5);
  assert.equal(JSON.stringify(episodes.map(ep => [ep.chapterStart, ep.chapterEnd])), JSON.stringify([[1,2],[3,4],[5,6],[7,8],[9,10]]));
});

test('AI JSON response is normalized and numbered', () => {
  const raw = JSON.stringify({ title: 'AI Plan', logline: 'A test', chapters: Array.from({length:10}, (_,i) => ({ title: 'C'+i, summary: 'Summary '+i })) });
  const plan = story.parsePlan(raw, input);
  assert.equal(plan.title, 'AI Plan');
  assert.equal(plan.chapters.length, 10);
  assert.equal(plan.chapters[9].number, 10);
});

test('invalid or incomplete AI output is rejected', () => {
  assert.throws(() => story.parsePlan('not json', input), /JSON chapter plan/);
  assert.throws(() => story.parsePlan(JSON.stringify({chapters:[{title:'Only one',summary:'Short'}]}), input), /incomplete/);
});

test('chapter count is clamped to supported maximum', () => {
  const plan = story.createFallbackPlan({...input, chapterCount: 99});
  assert.equal(plan.chapters.length, 30);
});
