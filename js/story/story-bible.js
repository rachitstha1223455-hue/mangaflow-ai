/* Extract and normalize story bible entities. All AI output is treated as untrusted data. */
(function (global) {
  'use strict';
  const LIMITS = { characters: 100, locations: 100, props: 150 };
  const text = (value, max) => String(value == null ? '' : value).trim().slice(0, max);
  function buildPrompt(story, language) {
    return [
      'Analyze the supplied original story and extract only entities explicitly supported by the text.',
      'Return ONLY valid JSON with this exact shape:',
      '{"characters":[{"name":"...","role":"...","description":"...","locked":"...","motivation":"...","relationships":"..."}],"locations":[{"name":"...","type":"...","description":"...","landmarks":"...","lighting":"...","palette":"..."}],"props":[{"name":"...","type":"...","description":"...","owner":"...","visualLock":"..."}]}',
      'Write descriptions in ' + (language || 'English') + '.',
      'Do not invent missing details. Use an empty string when a field is unknown.',
      'Preserve names and spelling exactly as written. Merge duplicate references to the same entity.',
      'Character locked field must contain only stable appearance details explicitly described in the story.',
      'Location records describe reusable environments, not momentary camera shots.',
      'Props are distinct named or story-significant objects; do not list generic everyday items.',
      'Story text follows:',
      String(story || '').slice(0, 30000)
    ].join('\n');
  }
  function parseJson(raw) {
    let value = String(raw || '').trim().replace(/^\uFEFF/, '');
    value = value.replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}$/i, '');
    const start = value.indexOf('{'), end = value.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('The AI response did not contain a JSON story bible.');
    try { return JSON.parse(value.slice(start, end + 1)); }
    catch (_) { throw new Error('The AI response was not valid JSON. Try again.'); }
  }
  function normalize(raw) {
    const parsed = parseJson(raw);
    const output = { characters: [], locations: [], props: [] };
    for (const key of Object.keys(output)) {
      if (!Array.isArray(parsed[key])) throw new Error('The AI story bible is missing its ' + key + ' list.');
      const seen = new Set();
      output[key] = parsed[key].slice(0, LIMITS[key]).map(item => {
        const record = {};
        const fields = key === 'characters'
          ? ['name','role','description','locked','motivation','relationships']
          : key === 'locations'
            ? ['name','type','description','landmarks','lighting','palette']
            : ['name','type','description','owner','visualLock'];
        fields.forEach(field => { record[field] = text(item && item[field], field === 'description' ? 1800 : 600); });
        if (!record.name) return null;
        const identity = record.name.toLocaleLowerCase();
        if (seen.has(identity)) return null;
        seen.add(identity);
        return record;
      }).filter(Boolean);
    }
    return output;
  }
  function withIds(data, current) {
    const next = { characters: [], locations: [], props: [] };
    const config = [
      ['characters','CHAR-', current.characters || []],
      ['locations','LOC-', current.locations || []],
      ['props','PROP-', current.props || []]
    ];
    config.forEach(([key,prefix,existing]) => {
      const known = new Set(existing.map(item => String(item.name || '').toLocaleLowerCase()));
      let number = existing.reduce((max,item) => {
        const match = String(item.id || '').match(/(\d+)$/);
        return Math.max(max, match ? Number(match[1]) : 0);
      }, 0);
      (data[key] || []).forEach(item => {
        const identity = String(item.name || '').toLocaleLowerCase();
        if (!identity || known.has(identity)) return;
        number += 1;
        next[key].push(Object.assign({ id: prefix + String(number).padStart(3,'0') }, item));
        known.add(identity);
      });
    });
    return next;
  }
  global.MangaFlowBible = { buildPrompt, normalize, withIds, limits: LIMITS };
})(window);
