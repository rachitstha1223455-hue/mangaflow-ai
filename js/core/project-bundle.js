/* Portable ZIP bundle for project metadata and IndexedDB media assets. ZIP entries use STORE mode for native browser compatibility. */
(function (global) {
  'use strict';
  const MAX_BUNDLE_BYTES = 500 * 1024 * 1024;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const crcTable = (() => { const table = new Uint32Array(256); for (let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table; })();
  function crc32(bytes) { let crc=0xffffffff; for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8); return (crc^0xffffffff)>>>0; }
  function u16(view,offset,value){view.setUint16(offset,value,true)}
  function u32(view,offset,value){view.setUint32(offset,value>>>0,true)}
  async function createBundle(state, assets) {
    const list=Array.isArray(assets)?assets.filter(a=>a&&a.id&&a.blob):[];
    const entries=[];
    const manifest={format:'MangaFlow portable project bundle',version:1,exportedAt:new Date().toISOString(),state,assets:[]};
    entries.push({name:'mangaflow-bundle.json',bytes:encoder.encode(JSON.stringify(manifest))});
    let total=entries[0].bytes.byteLength;
    for(let i=0;i<list.length;i++){
      const asset=list[i],bytes=new Uint8Array(await asset.blob.arrayBuffer());
      total+=bytes.byteLength;
      if(total>MAX_BUNDLE_BYTES)throw new Error('Portable bundle exceeds the 500 MB limit. Export fewer media files at a time.');
      const name='assets/'+String(i+1).padStart(5,'0')+'.bin';
      manifest.assets.push({id:String(asset.id),projectId:String(asset.projectId||'default'),type:String(asset.type||asset.blob.type||'application/octet-stream'),name:String(asset.name||asset.id),path:name,size:bytes.byteLength});
      entries.push({name,bytes});
    }
    entries[0].bytes=encoder.encode(JSON.stringify(manifest));
    total=entries.reduce((n,e)=>n+e.bytes.byteLength,0);
    if(total>MAX_BUNDLE_BYTES)throw new Error('Portable bundle exceeds the 500 MB limit.');
    const local=[],central=[];let offset=0;
    for(const entry of entries){
      const name=encoder.encode(entry.name),data=entry.bytes,crc=crc32(data);
      const header=new Uint8Array(30+name.length),hv=new DataView(header.buffer);
      u32(hv,0,0x04034b50);u16(hv,4,20);u16(hv,6,0);u16(hv,8,0);u32(hv,14,crc);u32(hv,18,data.length);u32(hv,22,data.length);u16(hv,26,name.length);u16(hv,28,0);header.set(name,30);
      local.push(header,data);
      const ch=new Uint8Array(46+name.length),cv=new DataView(ch.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0);u16(cv,10,0);u32(cv,16,crc);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);ch.set(name,46);
      central.push(ch);offset+=header.length+data.length;
    }
    const centralBytes=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,8,entries.length);u16(ev,10,entries.length);u32(ev,12,centralBytes);u32(ev,16,offset);u16(ev,20,0);
    return new Blob([...local,...central,end],{type:'application/zip'});
  }
  async function readBundle(blob) {
    if(!blob||!blob.size||blob.size>MAX_BUNDLE_BYTES)throw new Error('Choose a valid portable bundle smaller than 500 MB.');
    const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files=new Map();
    let offset=0;
    while(offset+4<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
      if(offset+30>bytes.length)throw new Error('Portable bundle is damaged (truncated ZIP header).');
      const method=view.getUint16(offset+8,true),crc=view.getUint32(offset+14,true),size=view.getUint32(offset+18,true),nameLen=view.getUint16(offset+26,true),extraLen=view.getUint16(offset+28,true);
      if(method!==0)throw new Error('This bundle uses compression not supported by this importer. Use a MangaFlow portable bundle created by the app.');
      const nameStart=offset+30,name=decoder.decode(bytes.slice(nameStart,nameStart+nameLen)),dataStart=nameStart+nameLen+extraLen,dataEnd=dataStart+size;
      if(dataEnd>bytes.length)throw new Error('Portable bundle is damaged (truncated file data).');
      const data=bytes.slice(dataStart,dataEnd);if(crc32(data)!==crc)throw new Error('Portable bundle failed its integrity check: '+name);
      files.set(name,data);offset=dataEnd;
    }
    const manifestBytes=files.get('mangaflow-bundle.json');
    if(!manifestBytes)throw new Error('This ZIP is not a MangaFlow portable project bundle.');
    let manifest;try{manifest=JSON.parse(decoder.decode(manifestBytes));}catch(_){throw new Error('Portable bundle manifest is invalid.');}
    if(manifest.format!=='MangaFlow portable project bundle'||manifest.version!==1||!manifest.state)throw new Error('Unsupported MangaFlow portable bundle version.');
    if(!Array.isArray(manifest.assets)||manifest.assets.length>5000)throw new Error('Portable bundle contains an invalid or excessive media list.');
    const seenIds=new Set(),seenPaths=new Set();
    const assets=manifest.assets.map(meta=>{
      if(!meta||typeof meta!=='object'||typeof meta.id!=='string'||!meta.id||meta.id.length>160)throw new Error('Portable bundle contains an invalid media ID.');
      if(seenIds.has(meta.id))throw new Error('Portable bundle contains duplicate media IDs: '+meta.id);
      seenIds.add(meta.id);
      if(typeof meta.path!=='string'||!meta.path.startsWith('assets/')||meta.path.includes('..')||seenPaths.has(meta.path))throw new Error('Portable bundle contains an invalid or duplicate media path.');
      seenPaths.add(meta.path);
      if(!Number.isSafeInteger(meta.size)||meta.size<=0||meta.size>50*1024*1024)throw new Error('Portable bundle contains an invalid media size: '+meta.name);
      const data=files.get(meta.path);if(!data)throw new Error('Missing bundled media file: '+meta.name);
      if(data.byteLength!==meta.size)throw new Error('Media size check failed: '+meta.name);
      const type=String(meta.type||'application/octet-stream');
      if(type.length>128)throw new Error('Portable bundle contains an invalid media type.');
      return {id:meta.id,projectId:String(meta.projectId||'default'),type,name:String(meta.name||meta.id),blob:new Blob([data],{type})};
    });
    return {state:manifest.state,assets,exportedAt:manifest.exportedAt||null};
  }
  global.MangaFlowBundle={MAX_BUNDLE_BYTES,createBundle,readBundle};
})(window);
