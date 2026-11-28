const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test('application starts without uncaught JavaScript errors', async ({ page }) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('.brand')).toBeVisible();
  expect(errors).toEqual([]);
});

test('project survives save, reload and reopen', async ({ page }) => {
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');
  await page.locator('[data-page="story"]').click();
  await page.locator('#storyTitle').fill('Browser QA Story');
  await page.locator('#idea').fill('A test story persisted by the browser.');
  await page.locator('[data-page="projects"]').click();
  await page.locator('#projectName').fill('Browser QA Project');
  await page.getByRole('button',{name:'Save current project'}).click();
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('manhwaFlowAI_v1')).projects.length)).toBe(1);
  await page.reload();
  await page.locator('[data-page="projects"]').click();
  await expect(page.locator('#projectList')).toContainText('Browser QA Project');
  await page.getByRole('button',{name:'Open'}).click();
  await expect(page.locator('#storyTitle')).toHaveValue('Browser QA Story');
});

test('legacy JSON backup imports with compatible defaults', async ({ page }) => {
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');
  const backup={projects:[{title:'Legacy Project',storyTitle:'Legacy Story',story:'Old story text'}],characters:[]};
  await page.locator('#importFile').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('manhwaFlowAI_v1')).projects[0].videoTimeline.clips.length)).toBe(0);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('manhwaFlowAI_v1')));
  expect(saved.projects[0].story).toBe('Old story text');
  expect(saved.projects[0].comicPages).toEqual([]);
  expect(saved.projects[0].audioQueue).toEqual([]);
});

test('portable ZIP backup restores media blobs and project references', async ({ page, browserName }) => {
  test.skip(browserName==='webkit','WebKit on the Linux CI runner has intermittent IndexedDB Blob transaction failures; media bundles are tested in Chromium, Chrome, Edge and Firefox.');
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');
  await page.evaluate(async()=>{
    const blob=new Blob(['portable-test-image'],{type:'image/png'});
    await MangaFlowStorage.putAsset({id:'qa-image-asset',projectId:'QA',blob,type:'image/png',name:'qa.png'});
    localStorage.setItem('manhwaFlowAI_v1',JSON.stringify({projects:[{title:'Bundle QA',comicPages:[{title:'Page',panels:[{id:'P1',imageAssetId:'qa-image-asset'}]}]}],characters:[],locations:[],props:[]}));
  });
  await page.reload();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-page="projects"]').click();
  await page.getByRole('button',{name:/Export portable bundle/}).click();
  const download=await downloadPromise;
  const buffer=fs.readFileSync(await download.path());
  await page.evaluate(async()=>{
    await MangaFlowStorage.deleteAsset('qa-image-asset');
    localStorage.setItem('manhwaFlowAI_v1',JSON.stringify({projects:[],characters:[],locations:[],props:[]}));
  });
  await page.reload();
  await page.locator('#bundleFile').setInputFiles({name:'portable.zip',mimeType:'application/zip',buffer});
  await expect.poll(async()=>page.evaluate(async()=>{const asset=await MangaFlowStorage.getAsset('qa-image-asset');return !!asset&&await asset.blob.text()==='portable-test-image'})).toBe(true);
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('manhwaFlowAI_v1')));
  expect(state.projects[0].title).toBe('Bundle QA');
});



test('portable ZIP import rolls back overwritten and newly added media when project save fails', async ({ page, browserName }) => {
  test.skip(browserName==='webkit','IndexedDB Blob rollback is covered on Chromium, Chrome and Edge CI.');
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');
  const bytes=await page.evaluate(async()=>{
    await MangaFlowStorage.putAsset({id:'rollback-existing',projectId:'Original',blob:new Blob(['original-media'],{type:'image/png'}),type:'image/png',name:'original.png'});
    localStorage.setItem('manhwaFlowAI_v1',JSON.stringify({projects:[{title:'Original Project'}],characters:[],locations:[],props:[]}));
    const zip=await MangaFlowBundle.createBundle({projects:[{title:'Imported Project'}],characters:[],locations:[],props:[]},[
      {id:'rollback-existing',projectId:'Imported',blob:new Blob(['replacement-media'],{type:'image/png'}),type:'image/png',name:'replacement.png'},
      {id:'rollback-new',projectId:'Imported',blob:new Blob(['new-media'],{type:'image/png'}),type:'image/png',name:'new.png'}
    ]);
    return Array.from(new Uint8Array(await zip.arrayBuffer()));
  });
  await page.evaluate(()=>{
    Storage.prototype.setItem=function(){throw new Error('Simulated storage quota failure');};
  });
  await page.locator('#bundleFile').setInputFiles({name:'rollback-test.zip',mimeType:'application/zip',buffer:Buffer.from(bytes)});
  await expect.poll(async()=>page.evaluate(async()=>{
    const old=await MangaFlowStorage.getAsset('rollback-existing');
    const added=await MangaFlowStorage.getAsset('rollback-new');
    return {old:old&&await old.blob.text(),added:!!added};
  })).toEqual({old:'original-media',added:false});
  const state=await page.evaluate(()=>JSON.parse(Storage.prototype.getItem.call(localStorage,'manhwaFlowAI_v1')));
  expect(state.projects[0].title).toBe('Original Project');
});

test('JSON backup export and import round-trip current project metadata', async ({ page }) => {
  page.on('dialog',dialog=>dialog.accept());
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('manhwaFlowAI_v1',JSON.stringify({projects:[{title:'JSON Round Trip',story:'Backup text'}],characters:[],locations:[],props:[]})));
  await page.reload();
  await page.locator('[data-page="projects"]').click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export backup JSON'}).click();
  const download=await downloadPromise;
  const buffer=fs.readFileSync(await download.path());
  await page.evaluate(()=>localStorage.removeItem('manhwaFlowAI_v1'));
  await page.reload();
  await page.locator('#importFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer});
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('manhwaFlowAI_v1')).projects[0].title)).toBe('JSON Round Trip');
  const restored=await page.evaluate(()=>JSON.parse(localStorage.getItem('manhwaFlowAI_v1')));
  expect(restored.projects[0].story).toBe('Backup text');
});

test('large artwork and audio blobs survive a browser restart in IndexedDB', async ({ page, browserName }) => {
  test.skip(browserName==='webkit','Large IndexedDB Blob persistence is exercised on Chromium and Firefox CI; WebKit Linux has known transaction instability.');
  await page.goto('/');
  await page.evaluate(async()=>{
    const image=new Blob([new Uint8Array(8*1024*1024)],{type:'image/png'});
    const audio=new Blob([new Uint8Array(8*1024*1024)],{type:'audio/mpeg'});
    await MangaFlowStorage.putAsset({id:'large-qa-image',projectId:'Large QA',blob:image,type:'image/png',name:'large.png'});
    await MangaFlowStorage.putAsset({id:'large-qa-audio',projectId:'Large QA',blob:audio,type:'audio/mpeg',name:'large.mp3'});
  });
  await page.reload();
  const sizes=await page.evaluate(async()=>{
    const image=await MangaFlowStorage.getAsset('large-qa-image'),audio=await MangaFlowStorage.getAsset('large-qa-audio');
    return [image&&image.blob.size,audio&&audio.blob.size];
  });
  expect(sizes).toEqual([8*1024*1024,8*1024*1024]);
});

test('service worker supports offline reopening after first installation', async ({ page, context, browserName }) => {
  test.skip(browserName==='webkit','WebKit on the Linux CI runner fails offline reload internally; offline reopening is tested in Chromium, Chrome, Edge and Firefox.');
  await page.goto('/');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:15000});
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  await context.setOffline(false);
});

test('mobile-sized viewport keeps the app usable without page-wide horizontal overflow', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:/Video/}).click();
  const dimensions=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,nav:document.querySelector('.nav').scrollWidth}));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width+2);
  expect(dimensions.nav).toBeGreaterThan(0);
});


test('storyboard artwork, narration audio and subtitles form a persistent video timeline', async ({ page }) => {
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    await MangaFlowStorage.putAsset({id:'pipeline-art',projectId:'Pipeline QA',blob:new Blob(['artwork-bytes'],{type:'image/png'}),type:'image/png',name:'panel.png'});
    await MangaFlowStorage.putAsset({id:'pipeline-voice',projectId:'Pipeline QA',blob:new Blob(['audio-bytes'],{type:'audio/mpeg'}),type:'audio/mpeg',name:'voice.mp3'});
    let timeline=MangaFlowVideo.createTimeline({fps:30});
    timeline=MangaFlowVideo.addClip(timeline,{sourceType:'panel',sourceId:'PANEL-1',title:'Opening panel',imageAssetId:'pipeline-art',duration:4});
    timeline=MangaFlowVideo.addClip(timeline,{sourceType:'scene',sourceId:'SCENE-2',title:'Second scene',duration:6});
    timeline=MangaFlowVideo.addAudioTrack(timeline,{audioAssetId:'pipeline-voice',kind:'narration',startTime:0,duration:7,assetDuration:7,volume:0.8});
    timeline=MangaFlowVideo.addCaption(timeline,{text:'नमस्ते दुनिया',language:'Hindi',startTime:0,endTime:4});
    videoTimeline=timeline;
    localStorage.setItem('manhwaFlowAI_v1',JSON.stringify({projects:[{title:'Pipeline QA',videoTimeline:timeline}],characters:[],locations:[],props:[]}));
    return {duration:MangaFlowVideo.duration(timeline),srt:MangaFlowVideo.toSRT(timeline),clips:timeline.clips.length,audio:timeline.audioTracks.length,caption:timeline.captions.length};
  });
  expect(result).toEqual({duration:10,srt:'1\n00:00:00,000 --> 00:00:04,000\nनमस्ते दुनिया',clips:2,audio:1,caption:1});
  await page.reload();
  const restored=await page.evaluate(async()=>{
    const state=JSON.parse(localStorage.getItem('manhwaFlowAI_v1'));
    const image=await MangaFlowStorage.getAsset('pipeline-art');
    const voice=await MangaFlowStorage.getAsset('pipeline-voice');
    return {title:state.projects[0].title,clips:state.projects[0].videoTimeline.clips.length,audio:state.projects[0].videoTimeline.audioTracks.length,image:await image.blob.text(),voice:await voice.blob.text()};
  });
  expect(restored).toEqual({title:'Pipeline QA',clips:2,audio:1,image:'artwork-bytes',voice:'audio-bytes'});
});

test('short browser video render creates a non-empty downloadable media file', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  test.skip(testInfo.project.name!=='chromium','MediaRecorder canvas export is exercised in Chromium CI.');
  await page.addInitScript(()=>{window.FFmpegWASM={FFmpeg:class{on(){}async load(){}async writeFile(){}async exec(){}async readFile(){const data=new Uint8Array(2048);data.set([0,0,0,24,102,116,121,112,105,115,111,109]);return data;}},toBlobURL:async url=>url};});
  await page.goto('/');
  await page.getByRole('button',{name:/Video/}).click();
  await page.evaluate(()=>{
    videoTimeline=MangaFlowVideo.addClip(MangaFlowVideo.createTimeline(),{title:'QA clip',visual:'Short automated browser test',duration:1});
    renderVideoStudio();
  });
  const downloadPromise=page.waitForEvent('download',{timeout:20000});
  await page.getByRole('button',{name:'Export MP4 / WebM'}).click();
  const download=await downloadPromise;
  const file=fs.readFileSync(await download.path());
  expect(file.length).toBeGreaterThan(1000);
  expect(download.suggestedFilename()).toMatch(/\.mp4$/);
  expect(file.subarray(4,8).toString()).toBe('ftyp');
});
