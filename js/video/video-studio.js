/* Video timeline data model — browser-independent helpers. */
(function (global) {
  'use strict';
  const LIMITS = { clips: 200, captions: 500, audioTracks: 100, duration: 3600, text: 3000, renderSeconds: 3600 };
  const clean = (v, max = LIMITS.text) => String(v == null ? '' : v).trim().slice(0, max);
  const clamp = (v, min, max, fallback) => Math.max(min, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : fallback));
  const id = (prefix, n) => prefix + String(n || 1).padStart(3, '0');
  function createClip(input, number) {
    const x = input || {};
    return {
      id: clean(x.id, 80) || id('VCLIP-', number),
      sourceType: ['scene','panel','page'].includes(x.sourceType) ? x.sourceType : 'scene',
      sourceId: clean(x.sourceId, 100), title: clean(x.title, 180) || 'Video clip ' + number,
      visual: clean(x.visual), imageAssetId: clean(x.imageAssetId, 120),
      startTime: clamp(x.startTime, 0, LIMITS.duration, 0),
      duration: clamp(x.duration, 0.5, 120, 5),
      motion: ['none','zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down'].includes(x.motion) ? x.motion : 'none',
      transition: ['cut','fade'].includes(x.transition) ? x.transition : 'cut',
      transitionDuration: clamp(x.transitionDuration, 0, 5, 0.5)
    };
  }
  function createCaption(input, number) {
    const x = input || {};
    const startTime = clamp(x.startTime, 0, LIMITS.duration, 0);
    return {
      id: clean(x.id, 80) || id('CAP-', number),
      text: clean(x.text, 1000), language: ['Hindi','English'].includes(x.language) ? x.language : 'English',
      startTime, endTime: clamp(x.endTime, startTime + 0.1, LIMITS.duration, startTime + 3),
      position: ['top','center','bottom'].includes(x.position) ? x.position : 'bottom'
    };
  }
  function createAudioTrack(input, number) {
    const x = input || {};
    return {
      id: clean(x.id, 80) || id('V-AUDIO-', number),
      audioAssetId: clean(x.audioAssetId, 120), title: clean(x.title, 180) || 'Audio track ' + number,
      kind: ['dialogue','narration','music','sfx'].includes(x.kind) ? x.kind : 'dialogue',
      startTime: clamp(x.startTime, 0, LIMITS.duration, 0),
      duration: clamp(x.duration, 0, LIMITS.duration, 0), assetDuration: clamp(x.assetDuration, 0, LIMITS.duration, 0),
      volume: clamp(x.volume, 0, 1, 1), muted: Boolean(x.muted),
      trimStart: clamp(x.trimStart, 0, LIMITS.duration, 0), trimEnd: clamp(x.trimEnd, 0, LIMITS.duration, 0),
      fadeIn: clamp(x.fadeIn, 0, 30, 0), fadeOut: clamp(x.fadeOut, 0, 30, 0)
    };
  }
  function createTimeline(input) {
    const x = input || {};
    return normalizeTimeline(x);
  }
  function normalizeTimeline(input) {
    const x = input || {};
    const clips = Array.isArray(x.clips) ? x.clips.slice(0, LIMITS.clips).map((c,i) => createClip(c,i+1)) : [];
    const captions = Array.isArray(x.captions) ? x.captions.slice(0, LIMITS.captions).map((c,i) => createCaption(c,i+1)).filter(c => c.text) : [];
    const audioTracks = Array.isArray(x.audioTracks) ? x.audioTracks.slice(0, LIMITS.audioTracks).map((a,i) => createAudioTrack(a,i+1)) : [];
    return {
      version: 1,
      width: [1280,1920].includes(Number(x.width)) ? Number(x.width) : 1280,
      height: [720,1080].includes(Number(x.height)) ? Number(x.height) : 720,
      fps: [24,25,30,60].includes(Number(x.fps)) ? Number(x.fps) : 30,
      masterVolume: clamp(x.masterVolume, 0, 1, 1), clips, captions, audioTracks
    };
  }
  function duration(timeline) {
    const t = normalizeTimeline(timeline);
    return Math.min(LIMITS.duration, Math.max(0,
      ...t.clips.map(c => c.startTime + c.duration),
      ...t.captions.map(c => c.endTime),
      ...t.audioTracks.map(a => a.startTime + audioTrackDuration(a))));
  }
  function snapTime(seconds, fps) { const rate = [24,25,30,60].includes(Number(fps)) ? Number(fps) : 30; return Math.round(Math.max(0, Number(seconds) || 0) * rate) / rate; }
  function audioTrackDuration(track) { const a = createAudioTrack(track, 1); const start = a.assetDuration > 0 ? Math.min(a.trimStart,a.assetDuration) : a.trimStart; const end = a.trimEnd > start ? (a.assetDuration > 0 ? Math.min(a.trimEnd,a.assetDuration) : a.trimEnd) : a.assetDuration; const available = Math.max(0,end-start); if(a.assetDuration>0)return a.duration>0?Math.min(a.duration,available):available; return a.duration>0?a.duration:available; }
  function addClip(timeline, input) {
    const t = normalizeTimeline(timeline);
    if (t.clips.length >= LIMITS.clips) throw new Error('Video timeline clip limit reached.');
    const end = t.clips.reduce((m,c) => Math.max(m,c.startTime+c.duration),0);
    t.clips.push(createClip(Object.assign({ startTime:end },input || {}),t.clips.length+1));
    t.clips.forEach(c => { c.startTime = snapTime(c.startTime,t.fps); c.duration = Math.max(1/t.fps,snapTime(c.duration,t.fps)); });
    return t;
  }
  function updateClip(timeline, index, patch) {
    const t = normalizeTimeline(timeline);
    if (!t.clips[index]) return t;
    t.clips[index] = createClip(Object.assign({},t.clips[index],patch || {}),index+1);
    t.clips[index].startTime = snapTime(t.clips[index].startTime,t.fps);
    t.clips[index].duration = Math.max(1/t.fps,snapTime(t.clips[index].duration,t.fps));
    return t;
  }
  function removeClip(timeline, index) {
    const t = normalizeTimeline(timeline);
    t.clips.splice(index,1);
    return t;
  }
  function moveClip(timeline, index, direction) {
    const t = normalizeTimeline(timeline), target = index + direction;
    if (index < 0 || target < 0 || index >= t.clips.length || target >= t.clips.length) return t;
    [t.clips[index],t.clips[target]] = [t.clips[target],t.clips[index]];
    return t;
  }
  function addCaption(timeline, input) {
    const t = normalizeTimeline(timeline);
    if (t.captions.length >= LIMITS.captions) throw new Error('Subtitle limit reached.');
    const caption=createCaption(input,t.captions.length+1); caption.startTime=snapTime(caption.startTime,t.fps); caption.endTime=Math.max(caption.startTime+1/t.fps,snapTime(caption.endTime,t.fps)); t.captions.push(caption);
    return t;
  }
  function addAudioTrack(timeline, input) {
    const t = normalizeTimeline(timeline);
    if (t.audioTracks.length >= LIMITS.audioTracks) throw new Error('Audio track limit reached.');
    t.audioTracks.push(createAudioTrack(input,t.audioTracks.length+1));
    return t;
  }
  function toSRT(timeline) {
    return normalizeTimeline(timeline).captions.slice().sort((a,b)=>a.startTime-b.startTime).map((c,i) =>
      (i+1)+'\n'+timestamp(c.startTime,',')+' --> '+timestamp(c.endTime,',')+'\n'+c.text
    ).join('\n\n');
  }
  function toVTT(timeline) {
    const body = normalizeTimeline(timeline).captions.slice().sort((a,b)=>a.startTime-b.startTime).map(c =>
      timestamp(c.startTime,'.')+' --> '+timestamp(c.endTime,'.')+'\n'+c.text
    ).join('\n\n');
    return 'WEBVTT\n\n'+body;
  }
  function timestamp(seconds, separator) {
    const ms = Math.round(Math.max(0,seconds)*1000), h = Math.floor(ms/3600000), m = Math.floor(ms%3600000/60000), s = Math.floor(ms%60000/1000), milli = ms%1000;
    return [String(h).padStart(2,'0'),String(m).padStart(2,'0'),String(s).padStart(2,'0')].join(':')+separator+String(milli).padStart(3,'0');
  }
  global.MangaFlowVideo = { LIMITS, createClip, createCaption, createAudioTrack, createTimeline, normalizeTimeline, duration, snapTime, audioTrackDuration, addClip, updateClip, removeClip, moveClip, addCaption, addAudioTrack, toSRT, toVTT };
})(window);
