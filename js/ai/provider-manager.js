/* MangaFlow AI provider manager — browser-safe, no secret keys stored here. */
(function (global) {
  'use strict';
  const DEFAULTS = {
    mode: 'hybrid',
    onlineEndpoint: '',
    onlineModel: '',
    localEndpoint: 'http://localhost:11434/v1/chat/completions',
    localModel: 'qwen2.5:3b',
    timeoutMs: 45000
  };
  function cleanConfig(input) {
    const value = Object.assign({}, DEFAULTS, input || {});
    value.mode = ['online', 'local', 'hybrid'].includes(value.mode) ? value.mode : 'hybrid';
    value.onlineEndpoint = String(value.onlineEndpoint || '').trim();
    value.onlineModel = String(value.onlineModel || '').trim();
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
  global.MangaFlowAI = { defaults: DEFAULTS, cleanConfig, generate, test };
})(window);
