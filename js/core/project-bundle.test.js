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
 const bytes=new Uint8Array(await zip.arrayBuffer());bytes[60]^=1;
 await assert.rejects(()=>B.readBundle(new Blob([bytes])),/not a MangaFlow|integrity/);
});

test('rejects duplicate media IDs in the asset manifest',async()=>{
 const duplicate=await B.createBundle({projects:[]},[
  {id:'same-id',name:'one.bin',blob:new Blob(['one'])},
  {id:'same-id',name:'two.bin',blob:new Blob(['two'])}
 ]);
 await assert.rejects(()=>B.readBundle(duplicate),/duplicate media IDs/);
});

test('rejects duplicate ZIP entry names before reading the manifest assets',async()=>{
 const zip=await B.createBundle({projects:[]},[
  {id:'first',name:'first.bin',blob:new Blob(['one'])},
  {id:'second',name:'second.bin',blob:new Blob(['two'])}
 ]);
 const bytes=new Uint8Array(await zip.arrayBuffer()),view=new DataView(bytes.buffer);
 const entryEnd=offset=>offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true)+view.getUint32(offset+18,true);
 const firstAssetOffset=entryEnd(0);
 const secondAssetOffset=entryEnd(firstAssetOffset);
 const firstNameLength=view.getUint16(firstAssetOffset+26,true);
 const secondNameLength=view.getUint16(secondAssetOffset+26,true);
 assert.equal(firstNameLength,secondNameLength);
 const firstName=bytes.slice(firstAssetOffset+30,firstAssetOffset+30+firstNameLength);
 bytes.set(firstName,secondAssetOffset+30);
 await assert.rejects(()=>B.readBundle(new Blob([bytes])),/duplicate ZIP entry/);
});
