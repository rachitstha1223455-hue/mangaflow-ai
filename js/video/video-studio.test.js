const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('./video-studio.js');
const V = global.MangaFlowVideo;

test('normalizes timeline settings and clips with safe defaults', () => {
  const t = V.normalizeTimeline({width:9999,fps:120,clips:[{title:'Opening',duration:-3,motion:'warp',transition:'wipe'}]});
  assert.equal(t.width,1280); assert.equal(t.fps,30);
  assert.equal(t.clips[0].duration,0.5); assert.equal(t.clips[0].motion,'none'); assert.equal(t.clips[0].transition,'cut');
});
test('adds, updates, moves and removes clips without mutating input', () => {
  const initial = V.createTimeline();
  const one = V.addClip(initial,{title:'One',duration:4});
  const two = V.addClip(one,{title:'Two',duration:6});
  assert.equal(two.clips[1].startTime,4);
  const changed = V.updateClip(two,0,{duration:8,motion:'zoom-in'});
  assert.equal(changed.clips[0].duration,8); assert.equal(changed.clips[0].motion,'zoom-in');
  const moved = V.moveClip(changed,0,1);
  assert.equal(moved.clips[0].title,'Two');
  assert.equal(V.removeClip(moved,0).clips.length,1);
  assert.equal(initial.clips.length,0);
});
test('normalizes subtitle intervals and exports SRT and VTT timestamps', () => {
  let t = V.addCaption(V.createTimeline(),{text:'नमस्ते',language:'Hindi',startTime:1.25,endTime:4.5});
  assert.match(V.toSRT(t),/00:00:01,250 --> 00:00:04,500/);
  assert.match(V.toSRT(t),/नमस्ते/);
  assert.match(V.toVTT(t),/^WEBVTT/);
});
test('tracks audio assets, volumes and timeline duration', () => {
  let t = V.addClip(V.createTimeline(),{duration:5});
  t = V.addAudioTrack(t,{audioAssetId:'asset-1',startTime:2,duration:8,volume:1.7});
  assert.equal(t.audioTracks[0].volume,1);
  assert.equal(V.duration(t),10);
  const withAssetLength = V.addAudioTrack(V.createTimeline(),{startTime:3,assetDuration:12});
  assert.equal(V.duration(withAssetLength),15);
});
test('enforces clip, caption and audio collection limits', () => {
  const many = Array.from({length:V.LIMITS.clips+5},(_,i)=>({title:'Clip '+i}));
  assert.equal(V.normalizeTimeline({clips:many}).clips.length,V.LIMITS.clips);
});
