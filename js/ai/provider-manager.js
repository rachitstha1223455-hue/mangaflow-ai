/* MangaFlow AI provider manager — browser-safe, no secret keys stored here. */
(function (global) {
  'use strict';
  const DEFAULTS = {
    mode: 'hybrid',
    onlineEndpoint: '',
    onlineModel: '',
    imageEndpoint: '',
    imageModel: '',
    ttsEndpoint: '',
    ttsModel: '',
    ttsVoice: 'alloy',
    localEndpoint: 'http://localhost:11434/v1/chat/completions',
    localModel: 'qwen2.5:3b',
    timeoutMs: 45000
  };
  function cleanConfig(input) {
    const value = Object.assign({}, DEFAULTS, input || {});
    value.mode = ['online', 'local', 'hybrid'].includes(value.mode) ? value.mode : 'hybrid';
    value.onlineEndpoint = String(value.onlineEndpoint || '').trim();
    value.onlineModel = String(value.onlineModel || '').trim();
    value.imageEndpoint = String(value.imageEndpoint || '').trim();
    value.imageModel = String(value.imageModel || '').trim();
    value.ttsEndpoint = String(value.ttsEndpoint || '').trim();
    value.ttsModel = String(value.ttsModel || '').trim();
    value.ttsVoice = String(value.ttsVoice || 'alloy').trim().slice(0, 120);
    value.localEndpoint = String(value.localEndpoint || DEFAULTS.localEndpoint).trim();
    value.localModel = String(value.localModel || DEFAULTS.localModel).trim();
    value.timeoutMs = Math.min(120000, Math.max(5000, Number(value.timeoutMs) || DEFAULTS.timeoutMs));
    return value;
  }
  function endpointUrl(value) {
    if (!value) throw new Error('Provider endpoint is not configured.');
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Endpoint must use HTTP or HTTPS.');
    if (url.username || url.password) throw new Error('Do not put credentials inside the endpoint URL.');
    return url.href;
  }
  async function request(endpoint, model, prompt, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpointUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: 'You are MangaFlow AI, an assistant for developing original, copyright-respecting manhwa stories. Follow the requested language and format.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.8
        }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload.error && (payload.error.message || payload.error) || payload.message || ('HTTP ' + response.status);
        throw new Error(String(detail));
      }
      const content = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('Provider returned an empty or unsupported response.');
      return content.trim();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Provider request timed out. Check the endpoint and try again.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  async function generate(prompt, settings, onStatus) {
    const config = cleanConfig(settings);
    const attempts = config.mode === 'hybrid'
      ? [{ name: 'Online proxy', endpoint: config.onlineEndpoint, model: config.onlineModel }, { name: 'Local AI', endpoint: config.localEndpoint, model: config.localModel }]
      : config.mode === 'online'
        ? [{ name: 'Online proxy', endpoint: config.onlineEndpoint, model: config.onlineModel }]
        : [{ name: 'Local AI', endpoint: config.localEndpoint, model: config.localModel }];
    const errors = [];
    for (const item of attempts) {
      if (!item.endpoint || !item.model) {
        errors.push(item.name + ': endpoint or model is not configured.');
        continue;
      }
      try {
        if (typeof onStatus === 'function') onStatus('Connecting to ' + item.name + '…');
        const result = await request(item.endpoint, item.model, prompt, config.timeoutMs);
        return { text: result, engine: item.name };
      } catch (error) {
        errors.push(item.name + ': ' + error.message);
        if (typeof onStatus === 'function') onStatus(item.name + ' failed; trying the next configured engine…');
      }
    }
    throw new Error(errors.join('\n') || 'No AI provider is configured.');
  }
  async function test(settings, providerName) {
    const config = cleanConfig(settings);
    const selected = providerName === 'online'
      ? { name: 'Online proxy', endpoint: config.onlineEndpoint, model: config.onlineModel }
      : { name: 'Local AI', endpoint: config.localEndpoint, model: config.localModel };
    if (!selected.endpoint || !selected.model) throw new Error(selected.name + ' endpoint and model are required.');
    const result = await request(selected.endpoint, selected.model, 'Reply with exactly: MangaFlow connection successful.', 15000);
    return { engine: selected.name, reply: result };
  }

  async function generateImage(prompt, settings, onStatus) {
    const config = cleanConfig(settings);
    if (!config.imageEndpoint || !config.imageModel) throw new Error('Configure an image-generation proxy endpoint and model in AI Settings first.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(config.timeoutMs, 90000));
    try {
      if (typeof onStatus === 'function') onStatus('Sending artwork prompt to image provider…');
      const response = await fetch(endpointUrl(config.imageEndpoint), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.imageModel, prompt: String(prompt || ''),
          n: 1, size: '1024x1536', response_format: 'b64_json' }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload.error && (payload.error.message || payload.error) || payload.message || ('HTTP ' + response.status);
        throw new Error(String(detail));
      }
      const item = payload.data && payload.data[0];
      if (item && item.b64_json) {
        const binary = atob(item.b64_json);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return { blob: new Blob([bytes], { type: 'image/png' }), engine: 'Image provider' };
      }
      if (item && item.url) {
        const imageResponse = await fetch(item.url, { signal: controller.signal });
        if (!imageResponse.ok) throw new Error('Image URL could not be downloaded. Configure your proxy to return b64_json to avoid cross-origin restrictions.');
        return { blob: await imageResponse.blob(), engine: 'Image provider' };
      }
      throw new Error('Image provider response must include data[0].b64_json or data[0].url.');
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Image generation timed out.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  async function synthesizeSpeech(text, settings, voice, onStatus) {
    const config = cleanConfig(settings);
    if (!config.ttsEndpoint || !config.ttsModel) throw new Error('Configure a text-to-speech endpoint and model in AI Settings first.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(config.timeoutMs, 90000));
    try {
      if (typeof onStatus === 'function') onStatus('Generating speech audio…');
      const response = await fetch(endpointUrl(config.ttsEndpoint), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.ttsModel, input: String(text || ''),
          voice: String(voice || config.ttsVoice || 'alloy'), response_format: 'mp3' }),
        signal: controller.signal
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const detail = payload.error && (payload.error.message || payload.error) || payload.message || ('HTTP ' + response.status);
        throw new Error(String(detail));
      }
      const type = response.headers.get('content-type') || 'audio/mpeg';
      if (type.includes('application/json')) {
        const payload = await response.json();
        if (!payload.audio && !payload.b64_json) throw new Error('TTS JSON response must include audio or b64_json base64 data.');
        const binary = atob(payload.audio || payload.b64_json);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return { blob: new Blob([bytes], { type: payload.mime_type || 'audio/mpeg' }), engine: 'TTS provider' };
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error('TTS provider returned an empty audio file.');
      return { blob, engine: 'TTS provider' };
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Speech generation timed out.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  global.MangaFlowAI = { defaults: DEFAULTS, cleanConfig, generate, test, generateImage, synthesizeSpeech };
})(window);
