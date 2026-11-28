/* Project schema normalization and safe backup helpers. */
(function (global) {
  'use strict';
  const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
  const MAX_PROJECTS = 500;
  const MAX_RECORDS = 5000;
  function records(value) { return Array.isArray(value) ? value.slice(0, MAX_RECORDS) : []; }
  function byteLength(value) { return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length; }
  function normalizeProject(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const project = Object.assign({}, source);
    project.title = String(source.title || source.storyTitle || 'Untitled project').slice(0, 240);
    if (Array.isArray(source.scenePlan)) project.scenePlan = source.scenePlan.slice(0, 500);
    if (Array.isArray(source.comicPages) && global.MangaFlowComic) project.comicPages = global.MangaFlowComic.normalizePages(source.comicPages);
    else if (!Array.isArray(source.comicPages)) project.comicPages = [];
    if (Array.isArray(source.audioQueue) && global.MangaFlowAudio) project.audioQueue = global.MangaFlowAudio.normalizeQueue(source.audioQueue);
    else if (!Array.isArray(source.audioQueue)) project.audioQueue = [];
    if (global.MangaFlowVideo) project.videoTimeline = global.MangaFlowVideo.normalizeTimeline(source.videoTimeline);
    if (Array.isArray(source.characters)) project.characters = records(source.characters);
    if (Array.isArray(source.locations)) project.locations = records(source.locations);
    if (Array.isArray(source.props)) project.props = records(source.props);
    return project;
  }
  function normalizeState(input) {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    return {
      projects: records(source.projects).slice(0, MAX_PROJECTS).map(normalizeProject),
      characters: records(source.characters),
      locations: records(source.locations),
      props: records(source.props)
    };
  }
  function parseBackupText(text) {
    const raw = String(text == null ? '' : text);
    if (!raw.trim()) throw new Error('The selected backup file is empty.');
    if (byteLength(raw) > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 25 MB import limit. Split the backup or remove large text records.');
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (_) { throw new Error('This file is not valid JSON. Your current projects have not been changed.'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.projects)) {
      throw new Error('This is not a MangaFlow backup: a projects array is required.');
    }
    return normalizeState(parsed);
  }
  function serializeBackup(input, now) {
    const state = normalizeState(input);
    state.backupVersion = 1;
    state.exportedAt = now || new Date().toISOString();
    const output = JSON.stringify(state, null, 2);
    if (byteLength(output) > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 25 MB export limit. Remove large text records or split your projects into separate backups.');
    return output;
  }
  function saveLocal(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (error) {
      const quota = error && (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014);
      return { ok: false, error: quota ? 'Browser storage is full. Export a backup, remove unused projects, or clear large text data before saving.' : 'Could not save to browser storage: ' + (error && error.message || 'unknown error') };
    }
  }
  global.MangaFlowProjects = { MAX_BACKUP_BYTES, MAX_PROJECTS, MAX_RECORDS, normalizeProject, normalizeState, parseBackupText, serializeBackup, saveLocal };
})(window);
