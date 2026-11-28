const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const window = {};
vm.runInNewContext(fs.readFileSync('js/story/story-bible.js','utf8'), {window});
const bible = window.MangaFlowBible;
const raw = JSON.stringify({
  characters: [
    {name:'Mira',role:'Protagonist',description:'Silver hair',locked:'Blue eyes'},
    {name:'Mira',role:'Duplicate'}
  ],
  locations: [{name:'Glass Citadel',type:'Palace',description:'A tall crystal palace'}],
  props: [{name:'Ember Compass',type:'Artifact',owner:'Mira',visualLock:'Brass frame'}]
});

test('normalizes all three entity types and removes duplicate names', () => {
  const result = bible.normalize(raw);
  assert.equal(result.characters.length,1);
  assert.equal(result.characters[0].locked,'Blue eyes');
  assert.equal(result.locations[0].name,'Glass Citadel');
  assert.equal(result.props[0].name,'Ember Compass');
});

test('rejects malformed and incomplete extraction payloads', () => {
  assert.throws(() => bible.normalize('not json'), /JSON story bible/);
  assert.throws(() => bible.normalize(JSON.stringify({characters:[]})), /locations list/);
});

test('adds stable prefixed IDs and skips existing names', () => {
  const parsed = bible.normalize(raw);
  const current = {characters:[{id:'CHAR-004',name:'Mira'}],locations:[],props:[]};
  const result = bible.withIds(parsed,current);
  assert.equal(result.characters.length,0);
  assert.equal(result.locations[0].id,'LOC-001');
  assert.equal(result.props[0].id,'PROP-001');
});

test('caps excessive extraction output', () => {
  const large = {characters:Array.from({length:120},(_,i)=>({name:'Person '+i})),locations:[],props:[]};
  assert.equal(bible.normalize(JSON.stringify(large)).characters.length,100);
});
