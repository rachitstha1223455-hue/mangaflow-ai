/* Video timeline UI, preview renderer and browser WebM export. */
(function (global) {
  'use strict';
  let previewFrame = 0, previewStartedAt = 0, previewStartTime = 0, previewPlaying = false;
  let imageCache = Object.create(null);
  const $ = id => document.getElementById(id);
  const videoStatus = message => { if ($('videoStatus')) $('videoStatus').textContent = message; };
  function ensureTimeline() {
    if (!global.videoTimeline || !global.MangaFlowVideo) global.videoTimeline = MangaFlowVideo.createTimeline();
    global.videoTimeline = MangaFlowVideo.normalizeTimeline(global.videoTimeline);
    return global.videoTimeline;
  }
  function projectEnd() { return MangaFlowVideo.duration(ensureTimeline()); }
  function clipAt(time) {
    const clips = ensureTimeline().clips;
    for (let i=clips.length-1;i>=0;i--) if (time >= clips[i].startTime && time < clips[i].startTime + clips[i].duration) return {clip:clips[i],index:i};
    return null;
  }
  function addVideoScenes() {
    if (!Array.isArray(scenePlan) || !scenePlan.length) { videoStatus('Create a scene plan first, then add its scenes to the video timeline.'); return; }
    let t=ensureTimeline();
    try {
      scenePlan.forEach(s => { t=MangaFlowVideo.addClip(t,{sourceType:'scene',sourceId:s.id,title:s.title,visual:s.summary,duration:5,motion:'zoom-in',transition:'fade',transitionDuration:0.5}); });
      videoTimeline=t; renderVideoStudio(); videoStatus('Added '+scenePlan.length+' scenes. Set durations and attach artwork in Comic Studio before exporting.');
    } catch(e) { videoStatus(e.message); }
  }
  function addVideoComicPages() {
    if (!Array.isArray(comicPages) || !comicPages.length) { videoStatus('Create comic pages first.'); return; }
    let t=ensureTimeline(), added=0;
    try {
      comicPages.forEach(page => (page.panels||[]).forEach(panel => {
        t=MangaFlowVideo.addClip(t,{sourceType:'panel',sourceId:panel.id,title:panel.sceneTitle||panel.id,visual:panel.visual,imageAssetId:panel.imageAssetId,duration:5,motion:'zoom-in',transition:'fade',transitionDuration:0.5}); added++;
      }));
      videoTimeline=t; renderVideoStudio(); videoStatus('Added '+added+' comic panels. Existing artwork references are reused from local IndexedDB.');
    } catch(e) { videoStatus(e.message); }
  }
  async function readAudioAssetDuration(id) {
    const AudioCtor=global.AudioContext||global.webkitAudioContext;
    if(!AudioCtor||!global.MangaFlowStorage)return 0;
    let context;
    try { const record=await MangaFlowStorage.getAsset(id);if(!record||!record.blob)return 0;context=new AudioCtor();const decoded=await context.decodeAudioData(await record.blob.arrayBuffer());return decoded.duration||0; }
    catch(error) { return 0; }
    finally { if(context)try{await context.close()}catch(error){} }
  }
  async function addVideoAudioQueue() {
    if (!Array.isArray(audioQueue) || !audioQueue.length) { videoStatus('Audio queue is empty. Add or import audio in Audio Studio first.'); return; }
    let t=ensureTimeline(), cursor=t.audioTracks.reduce((m,a)=>Math.max(m,a.startTime+(a.duration||a.assetDuration||0)),0), added=0;
    try {
      const items=audioQueue.filter(a=>a.audioAssetId);
      for(const item of items) {
        videoStatus('Reading audio duration: '+(item.fileName||item.id)+'…');
        const assetDuration=await readAudioAssetDuration(item.audioAssetId);
        t=MangaFlowVideo.addAudioTrack(t,{audioAssetId:item.audioAssetId,title:item.speaker||item.fileName||item.id,kind:item.kind,startTime:cursor,duration:item.duration||0,assetDuration,volume:1});
        cursor += assetDuration || item.duration || 0; added++;
      }
      videoTimeline=t; renderVideoStudio();
      videoStatus(added ? 'Added '+added+' audio assets with decoded durations where supported. Set start times and volumes below.' : 'No generated or uploaded audio assets were found in the queue.');
    } catch(e) { videoStatus(e.message); }
  }
  function addComicCaptions() {
    const t=ensureTimeline(); let added=0;
    t.clips.forEach(clip => {
      if (clip.sourceType!=='panel') return;
      const panel=(comicPages||[]).flatMap(p=>p.panels||[]).find(p=>p.id===clip.sourceId);
      if (!panel) return;
      const text=[panel.dialogue,panel.narration].filter(Boolean).join('\n');
      if (!text || t.captions.some(c=>c.id==='CAP-'+clip.id)) return;
      try { t=MangaFlowVideo.addCaption(t,{id:'CAP-'+clip.id,text,language:'English',startTime:clip.startTime,endTime:clip.startTime+clip.duration}); added++; } catch(e) {}
    });
    videoTimeline=t; renderVideoStudio(); videoStatus('Created '+added+' subtitle entries from comic dialogue and narration. Review language and timing.');
  }
  function addVideoCaption() {
    const text=($('videoCaptionText')&&$('videoCaptionText').value||'').trim();
    if (!text) { videoStatus('Enter subtitle text first.'); return; }
    try {
      videoTimeline=MangaFlowVideo.addCaption(ensureTimeline(),{text,language:$('videoCaptionLanguage').value,startTime:Number($('videoCaptionStart').value)||0,endTime:Number($('videoCaptionEnd').value)||3,position:'bottom'});
      $('videoCaptionText').value=''; renderVideoStudio(); videoStatus('Subtitle added.');
    } catch(e) { videoStatus(e.message); }
  }
  function updateVideoClip(index,field,value) {
    const patch={}; patch[field]=['startTime','duration','transitionDuration'].includes(field)?Number(value):value;
    videoTimeline=MangaFlowVideo.updateClip(ensureTimeline(),index,patch); renderVideoStudio();
  }
  function removeVideoClip(index) { videoTimeline=MangaFlowVideo.removeClip(ensureTimeline(),index); renderVideoStudio(); }
  function moveVideoClip(index,direction) { videoTimeline=MangaFlowVideo.moveClip(ensureTimeline(),index,direction); renderVideoStudio(); }
  function updateVideoCaption(index,field,value) {
    const t=ensureTimeline(), c=t.captions[index]; if(!c)return;
    const next=Object.assign({},c); next[field]=['startTime','endTime'].includes(field)?Number(value):value;
    t.captions[index]=MangaFlowVideo.createCaption(next,index+1); videoTimeline=t; renderVideoStudio();
  }
  function removeVideoCaption(index) { const t=ensureTimeline(); t.captions.splice(index,1); videoTimeline=t; renderVideoStudio(); }
  function updateVideoAudio(index,field,value) {
    const t=ensureTimeline(), a=t.audioTracks[index]; if(!a)return;
    const next=Object.assign({},a); next[field]=['startTime','duration','volume'].includes(field)?Number(value):value;
    if(field==='muted')next.muted=Boolean(value);
    t.audioTracks[index]=MangaFlowVideo.createAudioTrack(next,index+1); videoTimeline=t; renderVideoStudio();
  }
  function removeVideoAudio(index) { const t=ensureTimeline(); t.audioTracks.splice(index,1); videoTimeline=t; renderVideoStudio(); }
  function setVideoResolution(value) {
    const t=ensureTimeline(); if(value==='1080p'){t.width=1920;t.height=1080}else{t.width=1280;t.height=720}
    t.fps=Number($('videoFps').value)||30; videoTimeline=t; renderVideoStudio();
  }
  function loadImageAsset(id) {
    if (!id) return Promise.resolve(null);
    if (imageCache[id]) return imageCache[id].promise;
    const entry={promise:null,url:null,image:null};
    entry.promise=(async()=>{
      const record=await MangaFlowStorage.getAsset(id);
      if(!record||!record.blob)return null;
      entry.url=URL.createObjectURL(record.blob);
      const img=new Image();
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Could not load artwork '+id));img.src=entry.url;});
      entry.image=img; return img;
    })().catch(()=>null);
    imageCache[id]=entry; return entry.promise;
  }
  async function prepareVideoImages() {
    const ids=ensureTimeline().clips.map(c=>c.imageAssetId).filter(Boolean);
    for(const id of [...new Set(ids)]) await loadImageAsset(id);
  }
  function drawClip(ctx,clip,time,alpha) {
    if(!clip)return;
    const canvas=ctx.canvas, progress=Math.max(0,Math.min(1,(time-clip.startTime)/clip.duration));
    const entry=imageCache[clip.imageAssetId], img=entry&&entry.image;
    ctx.save(); ctx.globalAlpha=alpha==null?1:alpha;
    if(img) {
      let zoom=1,dx=0,dy=0;
      if(clip.motion==='zoom-in')zoom=1+0.12*progress;
      if(clip.motion==='zoom-out')zoom=1.12-0.12*progress;
      if(clip.motion==='pan-left')dx=0.10*canvas.width*(0.5-progress);
      if(clip.motion==='pan-right')dx=0.10*canvas.width*(progress-0.5);
      if(clip.motion==='pan-up')dy=0.10*canvas.height*(0.5-progress);
      if(clip.motion==='pan-down')dy=0.10*canvas.height*(progress-0.5);
      const scale=Math.max(canvas.width/img.width,canvas.height/img.height)*zoom;
      const w=img.width*scale,h=img.height*scale;
      ctx.translate(canvas.width/2+dx,canvas.height/2+dy);ctx.scale(zoom,zoom);
      ctx.drawImage(img,-w/(2*zoom),-h/(2*zoom),w/zoom,h/zoom);
    } else {
      const grad=ctx.createLinearGradient(0,0,canvas.width,canvas.height);grad.addColorStop(0,'#25365c');grad.addColorStop(1,'#101526');
      ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font='bold '+Math.round(canvas.width*0.035)+'px system-ui';
      ctx.fillText(clip.title.slice(0,70),canvas.width/2,canvas.height/2-18);
      ctx.font=Math.round(canvas.width*0.018)+'px system-ui';wrapCanvasText(ctx,clip.visual,canvas.width/2,canvas.height/2+28,canvas.width*0.78,canvas.width*0.025,4);
    }
    ctx.restore();
  }
  function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines) {
    const words=String(text||'').split(/\s+/);let line='',count=0;
    for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>maxWidth&&line){ctx.fillText(line,x,y);line=word;y+=lineHeight;if(++count>=maxLines-1)break}else line=next}
    if(line&&count<maxLines)ctx.fillText(line,x,y);
  }
  function drawVideoFrame(time) {
    const canvas=$('videoCanvas'); if(!canvas)return;
    const t=ensureTimeline(),ctx=canvas.getContext('2d'),active=clipAt(time);
    ctx.fillStyle='#090d18';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(active){
      const clip=active.clip;
      if(clip.transition==='fade'&&clip.transitionDuration>0&&active.index>0){
        const prev=t.clips[active.index-1];drawClip(ctx,prev,prev.startTime+prev.duration,1);
        const alpha=Math.min(1,Math.max(0,(time-clip.startTime)/clip.transitionDuration));drawClip(ctx,clip,time,alpha);
      } else drawClip(ctx,clip,time,1);
    }
    const caption=t.captions.find(c=>time>=c.startTime&&time<c.endTime);
    if(caption){
      const font=Math.round(canvas.width*0.027),pad=Math.round(font*0.55),maxW=canvas.width*0.86;
      ctx.font='600 '+font+'px system-ui';ctx.textAlign='center';
      const lines=[];let line='';
      for(const word of caption.text.split(/\s+/)){const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxW-pad*2&&line){lines.push(line);line=word}else line=test}
      if(line)lines.push(line);
      const lineH=font*1.35,h=lines.length*lineH+pad*2,y=caption.position==='top'?canvas.height*0.08:caption.position==='center'?(canvas.height-h)/2:canvas.height-h-canvas.height*0.07;
      ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect((canvas.width-maxW)/2,y,maxW,h);ctx.fillStyle='#fff';
      lines.forEach((s,i)=>ctx.fillText(s,canvas.width/2,y+pad+font+i*lineH));
    }
    if($('videoPlayhead'))$('videoPlayhead').value=String(Math.min(projectEnd(),Math.max(0,time)));
    if($('videoTimeLabel'))$('videoTimeLabel').textContent=formatTime(time)+' / '+formatTime(projectEnd());
  }
  function formatTime(seconds) { const n=Math.max(0,Number(seconds)||0);return Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0')+'.'+String(Math.floor(n*10)%10); }
  function seekVideoPreview(value) { pauseVideoPreview();drawVideoFrame(Number(value)||0); }
  async function playVideoPreview() {
    if(!ensureTimeline().clips.length){videoStatus('Add scenes or comic panels to the timeline first.');return}
    pauseVideoPreview(); await prepareVideoImages(); previewStartTime=Number($('videoPlayhead').value)||0;previewStartedAt=performance.now();previewPlaying=true;
    const tick=now=>{if(!previewPlaying)return;const time=previewStartTime+(now-previewStartedAt)/1000;if(time>=projectEnd()){previewPlaying=false;drawVideoFrame(projectEnd());return}drawVideoFrame(time);previewFrame=requestAnimationFrame(tick)};
    previewFrame=requestAnimationFrame(tick);
  }
  function pauseVideoPreview() { previewPlaying=false;if(previewFrame)cancelAnimationFrame(previewFrame); }
  function renderVideoStudio() {
    const t=ensureTimeline(),list=$('videoClipList'),captions=$('videoCaptionList'),audio=$('videoAudioList'),canvas=$('videoCanvas');
    if(!list||!canvas)return;
    if(canvas.width!==t.width||canvas.height!==t.height){canvas.width=t.width;canvas.height=t.height}
    $('videoResolution').value=t.width===1920?'1080p':'720p';$('videoFps').value=String(t.fps);
    const total=Math.max(1,projectEnd());
    list.innerHTML=t.clips.length?t.clips.map((c,i)=>{
      const left=(c.startTime/total*100),width=(c.duration/total*100);
      return '<div class="video-clip"><div class="video-clip-bar" style="margin-left:'+left+'%;width:'+Math.max(4,width)+'%"></div><b>'+esc((i+1)+'. '+c.title)+'</b><div class="muted">'+esc(c.sourceType+' · '+c.sourceId+' · '+formatTime(c.startTime)+'–'+formatTime(c.startTime+c.duration))+'</div>'+
      '<div class="video-fields"><label>Start (sec)<input type="number" min="0" max="3600" step="0.5" value="'+c.startTime+'" onchange="updateVideoClip('+i+',\'startTime\',this.value)"></label><label>Duration (sec)<input type="number" min="0.5" max="120" step="0.5" value="'+c.duration+'" onchange="updateVideoClip('+i+',\'duration\',this.value)"></label>'+
      '<label>Motion<select onchange="updateVideoClip('+i+',\'motion\',this.value)">'+options(['none','zoom-in','zoom-out','pan-left','pan-right','pan-up','pan-down'],c.motion)+'</select></label><label>Transition<select onchange="updateVideoClip('+i+',\'transition\',this.value)">'+options(['cut','fade'],c.transition)+'</select></label></div>'+
      '<div class="actions"><button class="secondary" onclick="seekVideoPreview('+c.startTime+')">Preview</button><button class="secondary" onclick="moveVideoClip('+i+',-1)">↑</button><button class="secondary" onclick="moveVideoClip('+i+',1)">↓</button><button class="danger" onclick="removeVideoClip('+i+')">Remove</button></div></div>';
    }).join(''):'<p class="muted">Timeline is empty. Add a scene plan or comic panels.</p>';
    captions.innerHTML=t.captions.length?t.captions.map((c,i)=>'<div class="video-clip"><b>'+esc(c.language+' subtitle '+(i+1))+'</b><textarea onchange="updateVideoCaption('+i+',\'text\',this.value)">'+esc(c.text)+'</textarea><div class="video-fields"><label>Start<input type="number" min="0" step="0.1" value="'+c.startTime+'" onchange="updateVideoCaption('+i+',\'startTime\',this.value)"></label><label>End<input type="number" min="0.1" step="0.1" value="'+c.endTime+'" onchange="updateVideoCaption('+i+',\'endTime\',this.value)"></label><label>Language<select onchange="updateVideoCaption('+i+',\'language\',this.value)">'+options(['Hindi','English'],c.language)+'</select></label></div><button class="danger" onclick="removeVideoCaption('+i+')">Remove subtitle</button></div>').join(''):'<p class="muted">No subtitles added.</p>';
    audio.innerHTML=t.audioTracks.length?t.audioTracks.map((a,i)=>'<div class="video-clip"><b>'+esc(a.title)+' · '+esc(a.kind)+'</b><div class="muted">'+esc(a.audioAssetId||'No local audio asset')+'</div><div class="video-fields"><label>Start (sec)<input type="number" min="0" step="0.5" value="'+a.startTime+'" onchange="updateVideoAudio('+i+',\'startTime\',this.value)"></label><label>Duration (0 = full file)<input type="number" min="0" step="0.5" value="'+a.duration+'" onchange="updateVideoAudio('+i+',\'duration\',this.value)"></label><label>Volume<input type="number" min="0" max="1" step="0.1" value="'+a.volume+'" onchange="updateVideoAudio('+i+',\'volume\',this.value)"></label><label>Muted<select onchange="updateVideoAudio('+i+',\'muted\',this.value===\'true\')">'+options(['false','true'],String(a.muted))+'</select></label></div><button class="danger" onclick="removeVideoAudio('+i+')">Remove audio</button></div>').join(''):'<p class="muted">No audio tracks. Import generated/uploaded audio from Audio Studio.</p>';
    $('videoPlayhead').max=String(Math.max(1,projectEnd()));$('videoPlayhead').value=String(Math.min(Number($('videoPlayhead').value)||0,projectEnd()));
    drawVideoFrame(Number($('videoPlayhead').value)||0);
    $('videoSummary').textContent=t.clips.length+' clips · '+t.captions.length+' subtitles · '+t.audioTracks.length+' audio tracks · '+formatTime(projectEnd())+' total';
  }
  function options(values,selected){return values.map(v=>'<option value="'+v+'" '+(String(v)===String(selected)?'selected':'')+'>'+v+'</option>').join('')}
  function exportVideoSubtitles(format) {
    const text=format==='vtt'?MangaFlowVideo.toVTT(ensureTimeline()):MangaFlowVideo.toSRT(ensureTimeline());
    downloadText('mangaflow-subtitles.'+format,text|| (format==='vtt'?'WEBVTT\n':''));
  }
  async function exportVideoWebM() {
    const t=ensureTimeline(),duration=projectEnd(),canvas=$('videoCanvas');
    if(!t.clips.length||duration<=0){videoStatus('Add video clips before exporting.');return}
    if(duration>600){videoStatus('This browser export is limited to 10 minutes per render to reduce memory and stability problems. Split longer projects into parts.');return}
    if(!canvas.captureStream||!global.MediaRecorder){videoStatus('This browser does not support canvas capture and MediaRecorder. Try an up-to-date Chrome or Edge browser.');return}
    pauseVideoPreview();videoStatus('Preparing artwork and audio assets…');
    try {
      await prepareVideoImages();
      const stream=canvas.captureStream(t.fps);
      let audioContext=null, audioDestination=null, scheduled=0;
      if(t.audioTracks.length&& (global.AudioContext||global.webkitAudioContext)) {
        const AudioCtor=global.AudioContext||global.webkitAudioContext;audioContext=new AudioCtor();await audioContext.resume();
        audioDestination=audioContext.createMediaStreamDestination();
        for(const track of t.audioTracks) {
          if(!track.audioAssetId||track.muted||track.volume<=0)continue;
          const record=await MangaFlowStorage.getAsset(track.audioAssetId);if(!record||!record.blob)continue;
          const buffer=await audioContext.decodeAudioData(await record.blob.arrayBuffer());
          const source=audioContext.createBufferSource(),gain=audioContext.createGain();
          source.buffer=buffer;gain.gain.value=track.volume;source.connect(gain).connect(audioDestination);
          const start=Math.max(0,track.startTime),remaining=Math.max(0,buffer.duration);
          if(start>=duration)continue;
          source.start(audioContext.currentTime+start,0,Math.min(remaining,track.duration>0?track.duration:remaining,duration-start));scheduled++;
        }
        audioDestination.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
      }
      const types=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
      const mime=types.find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:t.width===1920?6000000:3500000}:undefined);
      const chunks=[];recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
      const stopped=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>reject(e.error||new Error('Video recording failed.'))});
      recorder.start(1000);const started=performance.now();
      await new Promise(resolve=>{
        const frame=now=>{const elapsed=(now-started)/1000;drawVideoFrame(Math.min(duration,elapsed));videoStatus('Rendering WebM: '+Math.min(100,Math.round(elapsed/duration*100))+'%');if(elapsed>=duration){recorder.stop();resolve()}else requestAnimationFrame(frame)};
        requestAnimationFrame(frame);
      });
      await stopped;stream.getTracks().forEach(track=>track.stop());
      if(audioContext)await audioContext.close();
      const blob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});
      if(!blob.size)throw new Error('The browser returned an empty video file.');
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mangaflow-video.webm';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      videoStatus('Export complete: WebM video ('+(blob.size/1024/1024).toFixed(1)+' MB). Audio tracks included: '+scheduled+'. MP4 is not provided by this browser exporter.');
      drawVideoFrame(0);
    } catch(error) { videoStatus('Video export failed: '+error.message); }
  }
  function exportVideoJSON(){downloadText('mangaflow-video-timeline.json',JSON.stringify(MangaFlowVideo.normalizeTimeline(ensureTimeline()),null,2))}
  Object.assign(global,{renderVideoStudio,addVideoScenes,addVideoComicPages,addVideoAudioQueue,addComicCaptions,addVideoCaption,updateVideoClip,removeVideoClip,moveVideoClip,updateVideoCaption,removeVideoCaption,updateVideoAudio,removeVideoAudio,setVideoResolution,seekVideoPreview,playVideoPreview,pauseVideoPreview,exportVideoSubtitles,exportVideoWebM,exportVideoJSON});
})(window);
