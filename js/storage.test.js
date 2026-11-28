const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('./storage.js');
const S = global.MangaFlowStorage;

test('validates local binary assets and enforces per-file size limits', () => {
  assert.equal(S.validateAsset({id:'image-1',blob:new Blob(['image'],{type:'image/png'})}),true);
  assert.throws(()=>S.validateAsset({id:'',blob:new Blob(['x'])}),/requires an id/);
  assert.throws(()=>S.validateAsset({id:'empty',blob:new Blob([])}),/empty/);
  assert.throws(()=>S.validateAsset({id:'large',blob:{size:S.MAX_ASSET_BYTES+1}}),/50 MB/);
  assert.throws(()=>S.validateAsset({id:'x'.repeat(161),blob:new Blob(['x'])}),/too long/);
});
