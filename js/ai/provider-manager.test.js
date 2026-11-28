const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('./provider-manager.js');
const AI = global.MangaFlowAI;

test('cleans provider settings and clamps request timeouts', () => {
  const config=AI.cleanConfig({mode:'invalid',timeoutMs:999999,ttsVoice:'  voice  '});
  assert.equal(config.mode,'hybrid');
  assert.equal(config.timeoutMs,120000);
  assert.equal(config.ttsVoice,'voice');
});
test('accepts HTTP(S) endpoints but rejects unsafe protocols and embedded credentials', () => {
  assert.match(AI.validateEndpoint('https://example.com/v1/chat/completions'),/^https:/);
  assert.match(AI.validateEndpoint('http://localhost:11434/v1/chat/completions'),/^http:/);
  assert.throws(()=>AI.validateEndpoint('javascript:alert(1)'),/HTTP or HTTPS/);
  assert.throws(()=>AI.validateEndpoint('https://user:secret@example.com/v1'),/credentials/);
  assert.throws(()=>AI.validateEndpoint(''),/not configured/);
});
test('hybrid mode falls back from unavailable online provider to local AI', async () => {
  const originalFetch=global.fetch;
  global.fetch=async url=>{
    if(String(url).includes('online.example')) return {ok:false,status:503,json:async()=>({error:{message:'offline'}})};
    return {ok:true,status:200,json:async()=>({choices:[{message:{content:'नमस्ते'}}]})};
  };
  try {
    const result=await AI.generate('test',{mode:'hybrid',onlineEndpoint:'https://online.example/chat',onlineModel:'online',localEndpoint:'http://localhost:11434/chat',localModel:'local',timeoutMs:5000});
    assert.equal(result.engine,'Local AI');
    assert.equal(result.text,'नमस्ते');
  } finally { global.fetch=originalFetch; }
});
test('online mode does not silently switch to local mode', async () => {
  const originalFetch=global.fetch;
  global.fetch=async()=>({ok:false,status:500,json:async()=>({message:'offline'})});
  try {
    await assert.rejects(()=>AI.generate('test',{mode:'online',onlineEndpoint:'https://online.example/chat',onlineModel:'online',localEndpoint:'http://localhost:11434/chat',localModel:'local'}),/Online proxy: offline/);
  } finally { global.fetch=originalFetch; }
});
