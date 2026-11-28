const test=require('node:test');
const assert=require('node:assert/strict');
global.window=global;
require('./project-bundle.js');
const B=global.MangaFlowBundle;
test('round-trips project metadata and binary media in a portable ZIP',async()=>{
 const state={projects:[{title:'Demo',comicPages:[{panels:[{imageAssetId:'image-1'}]}]}]};
 const assets=[{id:'image-1',projectId:'Demo',type:'image/png',name:'art.png',blob:new Blob(['binary-art'])},{id:'audio-1',type:'audio/mpeg',name:'voice.mp3',blob:new Blob(['binary-audio'])}];
 const zip=await B.createBundle(state,assets);
 assert.equal(zip.type,'application/zip');
 const result=await B.readBundle(zip);
 assert.equal(result.state.projects[0].title,'Demo');
 assert.equal(result.assets.length,2);
 assert.equal(await result.assets[0].blob.text(),'binary-art');
 assert.equal(await result.assets[1].blob.text(),'binary-audio');
});
test('rejects invalid or corrupted portable bundles',async()=>{
 await assert.rejects(()=>B.readBundle(new Blob(['not zip'])),/not a MangaFlow/);
 const zip=await B.createBundle({projects:[]},[]);
 const bytes=new Uint8Array(await zip.arrayBuffer());bytes[bytes.length-23]^=1;
 await assert.rejects(()=>B.readBundle(new Blob([bytes])),/not a MangaFlow|integrity/);
});
