/* MangaFlow story intelligence: structured chapter planning with safe deterministic fallback. */
(function (global) {
  'use strict';
  const MAX_CHAPTERS = 30;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
  function buildPrompt(input) {
    return [
      'Create a completely original manhwa chapter and episode plan. Do not copy or imitate existing works.',
      'Return ONLY valid JSON. Do not use Markdown fences or commentary.',
      'Required JSON shape: {"title":"...","logline":"...","chapters":[{"number":1,"title":"...","summary":"...","goal":"...","conflict":"...","turningPoint":"...","cliffhanger":"..."}]}',
      'Create exactly ' + clamp(input.chapterCount, 1, MAX_CHAPTERS) + ' chapters.',
      'Group chapters into episodes of ' + clamp(input.chaptersPerEpisode, 1, 10) + ' chapters each when displayed.',
      'Story title: ' + input.title,
      'Genre: ' + input.genre,
      'Language: ' + input.language + '. Write every field in this language.',
      'Protagonist: ' + input.protagonist,
      'Core idea: ' + input.idea,
      'Existing story blueprint for continuity: ' + (input.blueprint || 'Not supplied.'),
      'Make each chapter causally advance the story. Vary emotional beats, escalate consequences, give the protagonist meaningful choices, and end most chapters with a compelling question or cliffhanger.',
      'Avoid repetitive filler, copied terminology, recognizable characters, scenes, dialogue, plot sequences, or endings.'
    ].join('\n');
  }
  function createFallbackPlan(input) {
    const count = clamp(input.chapterCount, 1, MAX_CHAPTERS);
    const title = input.title || 'Untitled Manhwa';
    const protagonist = input.protagonist || 'the protagonist';
    const beats = [
      ['An Unwelcome Beginning','Establish the protagonist’s ordinary life, central desire and immediate pressure.','A personal limitation blocks the goal.','A small incident exposes a larger problem.','A new threat notices the protagonist.'],
      ['The First Clue','Introduce the mystery, opportunity or relationship that changes the direction of the story.','The clue has a cost or contradicts what the protagonist believes.','The protagonist makes a risky choice.','The choice creates an unexpected obligation.'],
      ['A Costly First Step','Show the first attempt to act on the new information.','An opponent or system exploits a weakness.','A partial victory reveals a hidden disadvantage.','Someone close is affected by the decision.'],
      ['Pressure Builds','Deepen a relationship and reveal competing motives.','Trust and ambition pull in opposite directions.','A secret changes the meaning of an earlier event.','The protagonist realizes the conflict is larger.'],
      ['The Midpoint Reversal','Deliver a major reversal that forces a new strategy.','The original plan becomes impossible.','The protagonist chooses a harder path.','A former advantage is lost.'],
      ['The Price of Progress','Show consequences, training or investigation through concrete choices.','The cost threatens something the protagonist values.','A supporting character takes an independent action.','The enemy prepares a decisive move.'],
      ['Truth in the Open','Reveal a key part of the central mystery without resolving everything.','The truth damages an alliance or belief.','The protagonist accepts responsibility.','A new conflict emerges from the truth.'],
      ['The Breaking Point','Bring personal and external conflicts together.','A sacrifice seems unavoidable.','The protagonist rejects an easy but harmful solution.','The final confrontation begins.'],
      ['The Decisive Choice','Resolve the current arc through a consequential action.','The protagonist must choose what to protect.','The choice changes the balance of power.','The outcome carries a lasting cost.'],
      ['Aftermath and Next Horizon','Give emotional closure and show how the world has changed.','An unresolved consequence remains.','The protagonist defines a new goal.','A final clue opens the next arc.']
    ];
    const chapters = Array.from({length:count}, (_, index) => {
      const beat = beats[Math.min(beats.length - 1, Math.floor(index * beats.length / count))];
      const chapterNo = index + 1;
      return {
        number: chapterNo,
        title: beat[0] + (count > 10 ? ' — ' + chapterNo : ''),
        summary: beat[1] + ' Story context: ' + (input.idea || 'the central mystery') + '.',
        goal: 'Move ' + protagonist + ' toward the next story objective.',
        conflict: beat[2],
        turningPoint: beat[3],
        cliffhanger: beat[4]
      };
    });
    return { title, logline: (input.idea || 'An original story about choices and consequences.') + ' The journey follows ' + protagonist + ' through escalating trials.', chapters, source: 'built-in outline template' };
  }
  function parsePlan(raw, input) {
    let text = String(raw || '').trim();
    text = text.replace(/^\uFEFF/, '').replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}$/i, '');
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first < 0 || last <= first) throw new Error('The AI response did not contain a JSON chapter plan.');
    let parsed;
    try { parsed = JSON.parse(text.slice(first, last + 1)); }
    catch (_) { throw new Error('The AI response was not valid JSON. Try again or use the built-in outline.'); }
    if (!parsed || !Array.isArray(parsed.chapters)) throw new Error('The AI plan is missing its chapters array.');
    const wanted = clamp(input.chapterCount, 1, MAX_CHAPTERS);
    const chapters = parsed.chapters.slice(0, wanted).map((chapter, index) => ({
      number: index + 1,
      title: String(chapter.title || ('Chapter ' + (index + 1))).slice(0, 160),
      summary: String(chapter.summary || '').slice(0, 1600),
      goal: String(chapter.goal || '').slice(0, 500),
      conflict: String(chapter.conflict || '').slice(0, 500),
      turningPoint: String(chapter.turningPoint || '').slice(0, 500),
      cliffhanger: String(chapter.cliffhanger || '').slice(0, 500)
    }));
    if (chapters.length !== wanted || chapters.some(chapter => !chapter.summary)) {
      throw new Error('The AI plan is incomplete. Try again or use the built-in outline.');
    }
    return {
      title: String(parsed.title || input.title || 'Untitled Manhwa').slice(0, 160),
      logline: String(parsed.logline || '').slice(0, 1000),
      chapters,
      source: 'AI provider'
    };
  }
  function groupEpisodes(plan, chaptersPerEpisode) {
    const size = clamp(chaptersPerEpisode, 1, 10);
    const chapters = Array.isArray(plan && plan.chapters) ? plan.chapters : [];
    const episodes = [];
    for (let start = 0; start < chapters.length; start += size) {
      const batch = chapters.slice(start, start + size);
      episodes.push({
        number: episodes.length + 1,
        title: 'Episode ' + (episodes.length + 1),
        chapterStart: batch[0].number,
        chapterEnd: batch[batch.length - 1].number,
        chapters: batch
      });
    }
    return episodes;
  }
  global.MangaFlowStory = { maxChapters: MAX_CHAPTERS, buildPrompt, createFallbackPlan, parsePlan, groupEpisodes };
})(window);
