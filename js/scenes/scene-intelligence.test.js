const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync('js/scenes/scene-intelligence.js','utf8'), {window});
const scenes = window.MangaFlowScenes;
const bible = {
  characters:[{id:'CHAR-001',name:'Mira',description:'Silver hair',locked:'Blue eyes'}],
  locations:[{id:'LOC-001',name:'Glass Citadel',description:'Crystal palace',landmarks:'North tower',lighting:'Blue moonlight'}],
  props:[{id:'PROP-001',name:'Ember Compass',description:'Brass compass',visualLock:'Red crystal'}]
};

test('offline scene splitter creates scene IDs and links known entities', () => {
  const result=scenes.fallback('Mira enters the Glass Citadel. She holds the Ember Compass.\n\nA shadow moves across the tower.',bible,180);
  assert.ok(result.length>=2);
  assert.equal(result[0].id,'SCENE-001');
  assert.ok(result.some(s=>s.characters.includes('CHAR-001')));
  assert.ok(result.some(s=>s.locationId==='LOC-001'));
  assert.ok(result.some(s=>s.propIds.includes('PROP-001')));
});

test('AI scene response is normalized and unknown entity IDs are discarded', () => {
  const raw=JSON.stringify({scenes:[{title:'Arrival',summary:'Mira reaches the palace.',characters:['CHAR-001','CHAR-999'],locationId:'LOC-001',propIds:['PROP-001','PROP-999'],camera:'Wide shot'}]});
  const result=scenes.parse(raw,bible);
  assert.equal(result.length,1);
  assert.deepEqual(Array.from(result[0].characters),['CHAR-001']);
  assert.equal(result[0].locationId,'LOC-001');
  assert.deepEqual(Array.from(result[0].propIds),['PROP-001']);
});

test('invalid or empty AI scene responses are rejected', () => {
  assert.throws(()=>scenes.parse('not json',bible),/JSON scene plan/);
  assert.throws(()=>scenes.parse(JSON.stringify({scenes:[{title:'Empty'}]}),bible),/No usable scenes/);
});

test('visual prompt includes linked character location and prop continuity', () => {
  const scene={summary:'Mira stands inside the citadel.',camera:'Low angle',visualPrompt:'A dramatic reveal.',characters:['CHAR-001'],locationId:'LOC-001',propIds:['PROP-001'],continuityNotes:'Keep the eye color unchanged.'};
  const prompt=scenes.makeVisualPrompt(scene,bible,'2D manhwa','16:9');
  assert.match(prompt,/Silver hair/);
  assert.match(prompt,/North tower/);
  assert.match(prompt,/Red crystal/);
  assert.match(prompt,/Low angle/);
});

test('scene planner caps output at supported maximum', () => {
  const raw=JSON.stringify({scenes:Array.from({length:120},(_,i)=>({title:'Scene '+i,summary:'Summary '+i}))});
  assert.equal(scenes.parse(raw,bible).length,100);
});
