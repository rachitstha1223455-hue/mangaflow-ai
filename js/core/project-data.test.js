const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('../comic/comic-studio.js');
require('../audio/audio-studio.js');
require('../video/video-studio.js');
require('./project-data.js');
const P = global.MangaFlowProjects;

test('loads older projects without newer comic, audio or video fields', () => {
  const old = P.normalizeState({projects:[{title:'Old project',story:'A beginning'}],characters:[{id:'CHAR-001'}]});
  assert.equal(old.projects[0].story,'A beginning');
  assert.deepEqual(old.projects[0].comicPages,[]);
  assert.deepEqual(old.projects[0].audioQueue,[]);
  assert.deepEqual(old.projects[0].videoTimeline.clips,[]);
  assert.equal(old.characters.length,1);
});
test('normalizes new project assets and keeps existing story content', () => {
  const project=P.normalizeProject({title:'Latest',story:'Keep this story',comicPages:[{title:'Page',panels:[{dialogue:'Hello'}]}],audioQueue:[{kind:'dialogue',text:'Hi'}],videoTimeline:{clips:[{title:'Opening',duration:4}]}});
  assert.equal(project.story,'Keep this story');
  assert.equal(project.comicPages[0].panels[0].dialogue,'Hello');
  assert.equal(project.audioQueue[0].text,'Hi');
  assert.equal(project.videoTimeline.clips[0].duration,4);
});
test('rejects malformed or oversized backups without modifying state', () => {
  assert.throws(()=>P.parseBackupText('not json'),/valid JSON/);
  assert.throws(()=>P.parseBackupText(JSON.stringify({characters:[]})),/projects array/);
  assert.throws(()=>P.parseBackupText(' '.repeat(P.MAX_BACKUP_BYTES+1)),/25 MB/);
});
test('round-trips legacy and current backup shapes', () => {
  const original={projects:[{title:'One',audioQueue:[{text:'Voice'}]}],characters:[],locations:[],props:[]};
  const backup=P.serializeBackup(original,'2026-11-28T00:00:00.000Z');
  const restored=P.parseBackupText(backup);
  assert.equal(restored.projects[0].audioQueue[0].text,'Voice');
  assert.equal(restored.projects[0].videoTimeline.clips.length,0);
  assert.equal(JSON.parse(backup).backupVersion,1);
});
test('reports local storage quota failures instead of throwing', () => {
  const result=P.saveLocal({setItem(){const e=new Error('full');e.name='QuotaExceededError';throw e;}},'key',{projects:[]});
  assert.equal(result.ok,false);
  assert.match(result.error,/storage is full/);
});
test('caps untrusted collection sizes and normalizes invalid state shapes', () => {
  const data=P.normalizeState({projects:Array.from({length:P.MAX_PROJECTS+3},(_,i)=>({title:'P'+i})),characters:'bad'});
  assert.equal(data.projects.length,P.MAX_PROJECTS);
  assert.deepEqual(data.characters,[]);
});

test('does not allow imported project keys to change object prototypes', () => {
  const source=JSON.parse('{"title":"Safe","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
  const project=P.normalizeProject(source);
  assert.equal(Object.getPrototypeOf(project),Object.prototype);
  assert.equal({}.polluted,undefined);
  assert.equal(project.title,'Safe');
});
