/* Voice and audio queue UI. Uses shared project state and IndexedDB asset storage. */
(function (global) {
  'use strict';
  function addAudioItem() {
    if (!val('audioText')) { document.getElementById('audioStatus').textContent = 'Enter dialogue or narration text first.'; return; }
    if (audioQueue.length >= MangaFlowAudio.MAX_ITEMS) { document.getElementById('audioStatus').textContent = 'Audio queue is full.'; return; }
    audioQueue.push(MangaFlowAudio.createItem({
      kind: val('audioKind'), speaker: val('audioSpeaker'), text: val('audioText'),
      language: val('audioLanguage'), voice: val('audioVoice') || appSettings.ttsVoice
    }, audioQueue.length + 1));
    document.getElementById('audioText').value = '';
    renderAudioQueue();
    document.getElementById('audioStatus').textContent = 'Added to audio queue.';
  }
  function importComicAudio() {
    let added = 0, skipped = 0;
    const remaining = Math.max(0, MangaFlowAudio.MAX_ITEMS - audioQueue.length);
    comicPages.forEach(page => (page.panels || []).forEach(panel => {
      for (const entry of [{kind:'dialogue',speaker:panel.speaker,text:panel.dialogue},{kind:'narration',speaker:'Narrator',text:panel.narration}]) {
        if (!entry.text) continue;
        if (audioQueue.length >= MangaFlowAudio.MAX_ITEMS) { skipped++; continue; }
        audioQueue.push(MangaFlowAudio.createItem({ kind:entry.kind, speaker:entry.speaker, text:entry.text, language:val('audioLanguage')||'English', voice:appSettings.ttsVoice }, audioQueue.length+1)); added++;
      }
    }));
    audioQueue = MangaFlowAudio.normalizeQueue(audioQueue);
    renderAudioQueue();
    document.getElementById('audioStatus').textContent = 'Imported '+added+' dialogue/narration clips from comic pages.'+(skipped?' Skipped '+skipped+' because the 300-item queue limit was reached.':'');
  }
  function renderAudioQueue() {
    const el = document.getElementById('audioQueueList');
    if (!el) return;
    if (!audioQueue.length) { el.innerHTML = '<p class="muted">Audio queue is empty.</p>'; return; }
    el.innerHTML = audioQueue.map((item, i) =>
      '<div class="audio-item"><b>' + esc((i + 1) + '. ' + item.kind.toUpperCase() + ' — ' + (item.speaker || 'Untitled speaker')) + '</b>' +
      '<div class="muted">' + esc(item.language + ' · ' + item.voice + ' · ' + item.status) + '</div><p>' + esc(item.text || item.fileName || 'Uploaded audio track') + '</p>' +
      '<label>Attach audio file<input type="file" accept="audio/*" onchange="uploadAudioTrack(' + i + ',this)"></label>' +
      '<div class="actions"><button class="secondary" onclick="generateAudioItem(' + i + ')">Generate speech</button><button class="secondary" onclick="playAudioItem(' + i + ')">Play</button><button class="secondary" onclick="downloadAudioItem(' + i + ')">Download</button><button class="secondary" onclick="moveAudioItem(' + i + ',-1)">↑</button><button class="secondary" onclick="moveAudioItem(' + i + ',1)">↓</button><button class="danger" onclick="removeAudioItem(' + i + ')">Remove</button></div></div>'
    ).join('');
  }
  async function storeAudioBlob(index, blob, name) {
    if (!global.MangaFlowStorage) throw new Error('IndexedDB is unavailable.');
    const item = audioQueue[index];
    if (!item) throw new Error('This audio queue item no longer exists.');
    if (blob.size > MangaFlowStorage.MAX_ASSET_BYTES) throw new Error('Audio exceeds the 50 MB per-file limit. Compress or split it before adding.');
    const id = 'audio-' + item.id + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
    await MangaFlowStorage.putAsset({ id, projectId: val('projectName') || val('storyTitle') || 'default', blob, type: blob.type || 'audio/mpeg', name: name || item.id });
    if (audioQueue[index] !== item) { await MangaFlowStorage.deleteAsset(id); throw new Error('The queue changed while this file was processing. Please try again.'); }
    item.audioAssetId = id; item.fileName = name || item.id; item.status = 'ready';
    renderAudioQueue();
  }
  async function generateAudioItem(index) {
    const item = audioQueue[index];
    if (!item || !item.text) { document.getElementById('audioStatus').textContent = 'This queue item has no text to synthesize.'; return; }
    const status = document.getElementById('audioStatus');
    status.textContent = 'Generating audio for ' + item.id + '…';
    try {
      const result = await MangaFlowAI.synthesizeSpeech(item.text, appSettings, item.voice || appSettings.ttsVoice, message => { status.textContent = message; });
      await storeAudioBlob(index, result.blob, item.id + '.mp3');
      status.textContent = 'Generated audio for ' + item.id + '.';
    } catch (error) { status.textContent = 'TTS failed: ' + error.message; }
  }
  async function generateAllAudio() {
    for (let i = 0; i < audioQueue.length; i++) {
      const item = audioQueue[i];
      if (item.text && !item.audioAssetId && ['dialogue', 'narration'].includes(item.kind)) await generateAudioItem(i);
    }
    document.getElementById('audioStatus').textContent = 'Finished processing speech queue. Check for any missing audio clips.';
  }
  async function uploadAudioTrack(index, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) { alert('Choose an audio file.'); input.value = ''; return; }
    if (file.size > MangaFlowStorage.MAX_ASSET_BYTES) { alert('Audio file exceeds the 50 MB per-file limit. Compress or split it first.'); input.value = ''; return; }
    try { await storeAudioBlob(index, file, file.name); document.getElementById('audioStatus').textContent = 'Audio track uploaded.'; }
    catch (error) { alert(error.message); }
    input.value = '';
  }
  async function getAudioBlob(item) {
    if (!item.audioAssetId) return null;
    const record = await MangaFlowStorage.getAsset(item.audioAssetId);
    return record && record.blob || null;
  }
  async function playAudioItem(index) {
    const item = audioQueue[index], player = document.getElementById('audioPlayer');
    if (!item) return;
    try {
      const blob = await getAudioBlob(item);
      if (blob) {
        if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
        activeAudioUrl = URL.createObjectURL(blob); player.src = activeAudioUrl; await player.play(); audioPlayIndex = index; return;
      }
      if ('speechSynthesis' in global && item.text) {
        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = item.language === 'Hindi' ? 'hi-IN' : 'en-US';
        const match = speechSynthesis.getVoices().find(v => item.voice && v.name.toLowerCase().includes(item.voice.toLowerCase()));
        if (match) utterance.voice = match;
        utterance.onend = () => { if (audioPlayIndex >= 0) playNextAudio(); };
        audioPlayIndex = index; speechSynthesis.speak(utterance);
        document.getElementById('audioStatus').textContent = 'Playing browser speech preview. It is not an exported audio file.';
      } else document.getElementById('audioStatus').textContent = 'No audio file or text is available for this item.';
    } catch (error) { document.getElementById('audioStatus').textContent = 'Playback failed: ' + error.message; }
  }
  async function playAudioQueue() { audioPlayIndex = 0; await playNextAudio(); }
  async function playNextAudio() {
    if (audioPlayIndex < 0) return;
    if (audioPlayIndex >= audioQueue.length) { audioPlayIndex = -1; return; }
    const current = audioPlayIndex; audioPlayIndex = current + 1;
    const item = audioQueue[current], player = document.getElementById('audioPlayer');
    const blob = await getAudioBlob(item);
    if (blob) {
      if (activeAudioUrl) URL.revokeObjectURL(activeAudioUrl);
      activeAudioUrl = URL.createObjectURL(blob); player.src = activeAudioUrl;
      player.onended = () => playNextAudio();
      player.play().catch(error => { document.getElementById('audioStatus').textContent = 'Playback failed: ' + error.message; });
    } else if (item.text && 'speechSynthesis' in global) {
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.lang = item.language === 'Hindi' ? 'hi-IN' : 'en-US';
      const match = speechSynthesis.getVoices().find(v => item.voice && v.name.toLowerCase().includes(item.voice.toLowerCase()));
      if (match) utterance.voice = match;
      utterance.onend = () => playNextAudio(); speechSynthesis.speak(utterance);
    } else playNextAudio();
  }
  function stopAudioQueue() {
    audioPlayIndex = -1; document.getElementById('audioPlayer').pause();
    if ('speechSynthesis' in global) speechSynthesis.cancel();
    document.getElementById('audioStatus').textContent = 'Playback stopped.';
  }
  function moveAudioItem(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= audioQueue.length) return;
    [audioQueue[index], audioQueue[target]] = [audioQueue[target], audioQueue[index]];
    renderAudioQueue();
  }
  function removeAudioItem(index) { audioQueue.splice(index, 1); renderAudioQueue(); }
  async function downloadAudioItem(index) {
    const item = audioQueue[index];
    try {
      const blob = await getAudioBlob(item);
      if (!blob) { document.getElementById('audioStatus').textContent = 'Generate or upload this audio item before downloading.'; return; }
      const a = document.createElement('a'); const url = URL.createObjectURL(blob); a.href = url; a.download = item.fileName || item.id + '.mp3'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (error) { document.getElementById('audioStatus').textContent = 'Download failed: ' + error.message; }
  }
  function downloadAudioQueue() { downloadText('mangaflow-audio-queue.txt', MangaFlowAudio.toText(audioQueue) || 'Audio queue is empty.'); }
  function downloadAudioJSON() { downloadText('mangaflow-audio-queue.json', JSON.stringify({ version: 1, items: MangaFlowAudio.normalizeQueue(audioQueue) }, null, 2)); }
  Object.assign(global, { addAudioItem, importComicAudio, renderAudioQueue, generateAudioItem, generateAllAudio,
    uploadAudioTrack, playAudioItem, playAudioQueue, playNextAudio, stopAudioQueue, moveAudioItem,
    removeAudioItem, downloadAudioItem, downloadAudioQueue, downloadAudioJSON });
})(window);
