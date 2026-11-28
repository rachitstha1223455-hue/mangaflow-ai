const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html=fs.readFileSync(path.join(process.cwd(),'index.html'),'utf8');
const sw=fs.readFileSync(path.join(process.cwd(),'sw.js'),'utf8');

test('all local script tags point to files that exist in the repository', () => {
  const refs=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(refs.length>0);
  for(const ref of refs) assert.ok(fs.existsSync(path.join(process.cwd(),ref)), 'Missing script: '+ref);
});
test('static HTML contains no duplicate element IDs', () => {
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
  assert.deepEqual([...new Set(duplicates)],[]);
});
test('the project data module loads after all of its model dependencies', () => {
  const order=['js/comic/comic-studio.js','js/audio/audio-studio.js','js/video/video-studio.js','js/core/project-data.js','js/core/project-bundle.js'];
  const positions=order.map(ref=>html.indexOf('src="'+ref+'"'));
  assert.ok(positions.every(position=>position>=0));
  assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
});
test('PWA precache contains every local application script', () => {
  const refs=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
  for(const ref of refs) assert.ok(sw.includes("'./"+ref+"'"), 'Not precached: '+ref);
  for(const asset of ['./index.html','./manifest.json','./icon-192.png','./icon-512.png']) assert.ok(sw.includes("'"+asset+"'"), 'Not precached: '+asset);
});
