/* Comic storyboard data model. No DOM or network dependencies. */
(function (global) {
  'use strict';
  const LIMITS = { pages: 100, panelsPerPage: 20, text: 2000 };
  const clean = (value, max = LIMITS.text) => String(value == null ? '' : value).trim().slice(0, max);
  const id = (prefix, number) => prefix + String(number).padStart(3, '0');
  function createPanel(scene, number) {
    const source = scene || {};
    return {
      id: id('PANEL-', number || 1),
      sceneId: clean(source.id, 40),
      sceneTitle: clean(source.title, 160),
      visual: clean(source.summary || source.visualPrompt, LIMITS.text),
      camera: clean(source.camera, 120),
      speaker: '',
      dialogue: '',
      narration: '',
      sfx: ''
    };
  }
  function createPage(title, chapter, number, scenes) {
    return {
      id: id('PAGE-', number || 1),
      title: clean(title, 160) || 'Comic page ' + (number || 1),
      chapter: clean(chapter, 160),
      layout: 'grid-2',
      panels: (scenes || []).slice(0, LIMITS.panelsPerPage).map((scene, i) => createPanel(scene, i + 1))
    };
  }
  function normalizePages(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, LIMITS.pages).map((page, pi) => {
      const panels = Array.isArray(page && page.panels) ? page.panels.slice(0, LIMITS.panelsPerPage) : [];
      return {
        id: clean(page && page.id, 40) || id('PAGE-', pi + 1),
        title: clean(page && page.title, 160) || 'Comic page ' + (pi + 1),
        chapter: clean(page && page.chapter, 160),
        layout: ['single','grid-2','wide-top','grid-3','grid-4'].includes(page && page.layout) ? page.layout : 'grid-2',
        panels: panels.map((panel, i) => ({
          id: clean(panel && panel.id, 40) || id('PANEL-', i + 1),
          sceneId: clean(panel && panel.sceneId, 40),
          sceneTitle: clean(panel && panel.sceneTitle, 160),
          visual: clean(panel && panel.visual),
          camera: clean(panel && panel.camera, 120),
          speaker: clean(panel && panel.speaker, 120),
          dialogue: clean(panel && panel.dialogue),
          narration: clean(panel && panel.narration),
          sfx: clean(panel && panel.sfx, 300)
        }))
      };
    });
  }
  function toText(pages) {
    return normalizePages(pages).map(page => [
      page.id + ' — ' + page.title + (page.chapter ? ' [' + page.chapter + ']' : ''),
      ...page.panels.map((panel, i) => [
        '  ' + (i + 1) + '. ' + panel.id + (panel.sceneId ? ' / ' + panel.sceneId : ''),
        '     Visual: ' + panel.visual,
        '     Camera: ' + panel.camera,
        '     Dialogue' + (panel.speaker ? ' (' + panel.speaker + ')' : '') + ': ' + panel.dialogue,
        '     Narration: ' + panel.narration,
        '     SFX: ' + panel.sfx
      ].join('\n'))
    ].join('\n')).join('\n\n');
  }
  global.MangaFlowComic = { limits: LIMITS, createPanel, createPage, normalizePages, toText };
})(window);
