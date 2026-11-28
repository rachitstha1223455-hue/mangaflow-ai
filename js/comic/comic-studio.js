/* Comic studio model and print renderer helpers. */
(function (global) {
  'use strict';
  const LIMITS = { pages: 100, panelsPerPage: 20, text: 2000, imageBytes: 12 * 1024 * 1024 };
  const clean = (value, max = LIMITS.text) => String(value == null ? '' : value).trim().slice(0, max);
  const id = (prefix, number) => prefix + String(number).padStart(3, '0');
  function createPanel(scene, number) {
    const source = scene || {};
    return {
      id: id('PANEL-', number || 1), sceneId: clean(source.id, 40),
      sceneTitle: clean(source.title, 160), visual: clean(source.summary || source.visualPrompt),
      camera: clean(source.camera, 120), speaker: '', dialogue: '', narration: '', sfx: '',
      imageAssetId: '', span: 6, height: 210
    };
  }
  function createPage(title, chapter, number, scenes) {
    return { id: id('PAGE-', number || 1), title: clean(title, 160) || 'Comic page ' + (number || 1),
      chapter: clean(chapter, 160), layout: 'grid-2',
      panels: (scenes || []).slice(0, LIMITS.panelsPerPage).map((scene, i) => createPanel(scene, i + 1)) };
  }
  function normalizePages(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, LIMITS.pages).map((page, pi) => {
      const panels = Array.isArray(page && page.panels) ? page.panels.slice(0, LIMITS.panelsPerPage) : [];
      return { id: clean(page && page.id, 40) || id('PAGE-', pi + 1),
        title: clean(page && page.title, 160) || 'Comic page ' + (pi + 1),
        chapter: clean(page && page.chapter, 160),
        layout: ['single','grid-2','wide-top','grid-3','grid-4'].includes(page && page.layout) ? page.layout : 'grid-2',
        panels: panels.map((panel, i) => ({ id: clean(panel && panel.id, 40) || id('PANEL-', i + 1),
          sceneId: clean(panel && panel.sceneId, 40), sceneTitle: clean(panel && panel.sceneTitle, 160),
          visual: clean(panel && panel.visual), camera: clean(panel && panel.camera, 120),
          speaker: clean(panel && panel.speaker, 120), dialogue: clean(panel && panel.dialogue),
          narration: clean(panel && panel.narration), sfx: clean(panel && panel.sfx, 300),
          imageAssetId: clean(panel && panel.imageAssetId, 100),
          span: Math.max(3, Math.min(12, Number(panel && panel.span) || 6)),
          height: Math.max(120, Math.min(900, Number(panel && panel.height) || 210)) })) };
    });
  }
  function toText(pages) {
    return normalizePages(pages).map(page => [page.id + ' — ' + page.title + (page.chapter ? ' [' + page.chapter + ']' : ''),
      ...page.panels.map((p, i) => ['  ' + (i + 1) + '. ' + p.id + (p.sceneId ? ' / ' + p.sceneId : ''),
        '     Visual: ' + p.visual, '     Camera: ' + p.camera,
        '     Dialogue' + (p.speaker ? ' (' + p.speaker + ')' : '') + ': ' + p.dialogue,
        '     Narration: ' + p.narration, '     SFX: ' + p.sfx,
        '     Artwork: ' + (p.imageAssetId || 'not attached')].join('\n'))].join('\n')).join('\n\n');
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/); let line = ''; let lines = 0;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y); y += lineHeight; lines++; line = word;
        if (lines >= maxLines - 1) break;
      } else line = test;
    }
    if (line && lines < maxLines) ctx.fillText(line, x, y);
    return y + lineHeight;
  }
  async function renderPageCanvas(page, imageResolver, options) {
    const opts = Object.assign({ width: 2480, height: 3508, margin: 100, background: '#f7f4ed' }, options || {});
    const canvas = document.createElement('canvas'); canvas.width = opts.width; canvas.height = opts.height;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = opts.background; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const margin = opts.margin, gap = Math.round(canvas.width * 0.012);
    ctx.fillStyle = '#111'; ctx.font = 'bold ' + Math.round(canvas.width * 0.025) + 'px sans-serif';
    ctx.fillText(clean(page.title, 100), margin, margin * 0.75);
    const top = margin * 1.2, usableW = canvas.width - margin * 2, usableH = canvas.height - top - margin;
    const panels = page.panels || [];
    if (!panels.length) { ctx.font = '40px sans-serif'; ctx.fillText('No panels on this page', margin, top + 100); return canvas; }
    const cols = 12, rowCount = Math.max(1, Math.ceil(panels.reduce((sum, p) => sum + (Number(p.span) || 6) / cols, 0)));
    const rowH = Math.max(usableH / rowCount, 360);
    let x = margin, y = top, rowSpan = 0, rowMaxH = rowH;
    for (const p of panels) {
      const span = Math.max(3, Math.min(12, Number(p.span) || 6));
      if (rowSpan + span > cols) { x = margin; y += rowMaxH + gap; rowSpan = 0; rowMaxH = rowH; }
      const w = usableW * span / cols - gap, h = Math.min(usableH, Number(p.height) / 210 * rowH);
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#151515'; ctx.lineWidth = Math.max(8, canvas.width * 0.003); ctx.strokeRect(x, y, w, h);
      let image = null;
      if (p.imageAssetId && imageResolver) { try { image = await imageResolver(p.imageAssetId); } catch (_) {} }
      if (image) {
        const scale = Math.max(w / image.width, h * 0.72 / image.height);
        const iw = image.width * scale, ih = image.height * scale;
        ctx.save(); ctx.beginPath(); ctx.rect(x + 8, y + 8, w - 16, h * 0.72); ctx.clip();
        ctx.drawImage(image, x + (w - iw) / 2, y + (h * 0.72 - ih) / 2, iw, ih); ctx.restore();
      } else {
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(x + 8, y + 8, w - 16, h * 0.72);
        ctx.fillStyle = '#333'; ctx.font = 'bold ' + Math.round(canvas.width * 0.014) + 'px sans-serif';
        wrapText(ctx, p.visual || p.sceneTitle || 'Artwork not attached', x + 28, y + 70, w - 56, 42, 5);
      }
      const textY = y + h * 0.75;
      ctx.fillStyle = '#111'; ctx.font = 'bold ' + Math.round(canvas.width * 0.013) + 'px sans-serif';
      if (p.dialogue) { const label = (p.speaker ? p.speaker + ': ' : '') + p.dialogue; ctx.fillStyle = '#fff'; ctx.fillRect(x + 18, textY, w - 36, h * 0.12); ctx.strokeRect(x + 18, textY, w - 36, h * 0.12); ctx.fillStyle = '#111'; wrapText(ctx, label, x + 32, textY + 42, w - 64, 38, 3); }
      if (p.narration) { ctx.fillStyle = '#fff0bd'; ctx.fillRect(x + 18, y + h * 0.88, w - 36, h * 0.09); ctx.fillStyle = '#111'; ctx.font = Math.round(canvas.width * 0.009) + 'px sans-serif'; wrapText(ctx, p.narration, x + 30, y + h * 0.88 + 34, w - 60, 30, 2); }
      if (p.sfx) { ctx.fillStyle = '#9f1239'; ctx.font = 'bold ' + Math.round(canvas.width * 0.016) + 'px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(clean(p.sfx, 60), x + w - 24, y + h - 24); ctx.textAlign = 'left'; }
      rowSpan += span; x += usableW * span / cols + gap; rowMaxH = Math.max(rowMaxH, h);
    }
    return canvas;
  }
  global.MangaFlowComic = { limits: LIMITS, createPanel, createPage, normalizePages, toText, renderPageCanvas };
})(window);
