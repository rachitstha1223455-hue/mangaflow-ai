/* Semantic scene planning, entity linking and continuity-aware shot prompts. */
(function (global) {
  'use strict';
  const MAX_SCENES = 100;
  const clean = (value, max) => String(value == null ? '' : value).trim().slice(0, max);
  function buildPrompt(input) {
    return [
      'Turn the supplied chapter or script into a sequence of visually distinct, causally ordered manhwa scenes.',
      'Return ONLY valid JSON in this shape:',
      '{"scenes":[{"title":"...","summary":"...","purpose":"...","characters":["CHAR-001"],"locationId":"LOC-001","propIds":["PROP-001"],"camera":"Wide establishing shot","visualPrompt":"...","continuityNotes":"...","transition":"..."}]}',
      'Create between 1 and ' + MAX_SCENES + ' scenes. Do not invent IDs. Only use IDs listed in the story bible below.',
      'Keep character, location and prop IDs exactly as provided. If an entity is not clear, use an empty array or empty string.',
      'Each scene must describe one coherent visual moment, with a clear action or emotional beat. Split location changes, time changes and major action changes into separate scenes.',
      'Choose camera coverage that varies naturally: establishing wide shot, full shot, medium shot, close-up, extreme close-up, over-the-shoulder, low angle, high angle, tracking shot.',
      'Preserve locked appearance details, costume, props and location design. Do not add unlisted characters, objects or background landmarks.',
      'Language: ' + (input.language || 'English'),
      'Chapter: ' + (input.chapterTitle || 'Untitled chapter'),
      'Chapter / script text:',
      clean(input.script, 30000),
      'STORY BIBLE JSON:',
      JSON.stringify(input.bible || {characters:[],locations:[],props:[]}).slice(0,12000)
    ].join('\n');
  }
  function parse(raw, bible) {
    let value = String(raw || '').trim().replace(/^\uFEFF/, '');
    value = value.replace(/^\x60{3}(?:json)?\s*/i, '').replace(/\s*\x60{3}$/i, '');
    const start=value.indexOf('{'), end=value.lastIndexOf('}');
    if(start<0 || end<=start) throw new Error('AI response did not contain a JSON scene plan.');
    let parsed;
    try { parsed=JSON.parse(value.slice(start,end+1)); }
    catch (_) { throw new Error('AI scene plan was not valid JSON.'); }
    if(!parsed || !Array.isArray(parsed.scenes)) throw new Error('AI scene plan is missing its scenes array.');
    const characterIds=new Set((bible.characters||[]).map(x=>x.id));
    const locationIds=new Set((bible.locations||[]).map(x=>x.id));
    const propIds=new Set((bible.props||[]).map(x=>x.id));
    const scenes=parsed.scenes.slice(0,MAX_SCENES).map((item,index)=>{
      const ids=Array.isArray(item.characters)?item.characters.map(String).filter(id=>characterIds.has(id)):[];
      const props=Array.isArray(item.propIds)?item.propIds.map(String).filter(id=>propIds.has(id)):[];
      const loc=String(item.locationId||'');
      return {
        id:'SCENE-'+String(index+1).padStart(3,'0'),
        title:clean(item.title,160)||'Scene '+(index+1),
        summary:clean(item.summary,1200),
        purpose:clean(item.purpose,500),
        characters:[...new Set(ids)],
        locationId:locationIds.has(loc)?loc:'',
        propIds:[...new Set(props)],
        camera:clean(item.camera,120)||'Medium shot',
        visualPrompt:clean(item.visualPrompt,1800),
        continuityNotes:clean(item.continuityNotes,900),
        transition:clean(item.transition,300)
      };
    }).filter(scene=>scene.summary);
    if(!scenes.length) throw new Error('No usable scenes were found in the AI response.');
    return scenes;
  }
  function fallback(script, bible, size) {
    const text=clean(script,30000);
    const paragraphs=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
    if(!paragraphs.length) return [];
    const scenes=[];
    let buffer='';
    const limit=Math.max(180,Math.min(1800,Number(size)||700));
    function push(value){
      const n=scenes.length+1;
      const characters=(bible.characters||[]).filter(c=>{
        const name=String(c.name||'');
        return name && new RegExp('(^|[^\\p{L}\\p{N}_])'+escapeRegex(name)+'([^\\p{L}\\p{N}_]|$)','iu').test(value);
      }).map(c=>c.id);
      const locations=(bible.locations||[]).filter(x=>x.name && value.toLocaleLowerCase().includes(x.name.toLocaleLowerCase()));
      const props=(bible.props||[]).filter(x=>x.name && value.toLocaleLowerCase().includes(x.name.toLocaleLowerCase()));
      scenes.push({
        id:'SCENE-'+String(n).padStart(3,'0'),
        title:'Scene '+n,
        summary:value,
        purpose:'Preserve the beat and details from the supplied script.',
        characters:characters,
        locationId:locations[0] ? locations[0].id : '',
        propIds:props.map(x=>x.id),
        camera:'Medium shot',
        visualPrompt:value,
        continuityNotes:'Preserve all linked Story Bible designs. This fallback does not infer unseen details.',
        transition:'Cut'
      });
    }
    paragraphs.forEach(paragraph=>{
      if(paragraph.length>limit){
        if(buffer){push(buffer);buffer='';}
        for(let i=0;i<paragraph.length;i+=limit) push(paragraph.slice(i,i+limit));
      } else if(buffer && buffer.length+paragraph.length+1>limit){
        push(buffer);buffer=paragraph;
      } else buffer+=(buffer?'\n':'')+paragraph;
    });
    if(buffer)push(buffer);
    return scenes.slice(0,MAX_SCENES);
  }
  function makeVisualPrompt(scene,bible,style,ratio) {
    const find=(list,ids)=> (list||[]).filter(item=>ids.includes(item.id));
    const chars=find(bible.characters,scene.characters).map(c=>c.id+' '+c.name+': '+c.description+' Permanent visual lock: '+c.locked);
    const locations=find(bible.locations,scene.locationId?[scene.locationId]:[]).map(x=>x.id+' '+x.name+': '+x.description+' Landmarks: '+x.landmarks+' Lighting/palette: '+x.lighting);
    const props=find(bible.props,scene.propIds).map(x=>x.id+' '+x.name+': '+x.description+' Visual lock: '+x.visualLock);
    return [
      'Create a '+(style||'Premium 2D anime / modern Korean manhwa')+' illustration, '+(ratio||'16:9 landscape')+'.',
      'CAMERA: '+scene.camera,
      'SCENE: '+scene.summary,
      'VISUAL DIRECTION: '+scene.visualPrompt,
      'CHARACTERS — use only these exact designs:',
      chars.join('\n')||'No named character reference supplied.',
      'LOCATION — preserve this environment:',
      locations.join('\n')||'No registered location reference supplied.',
      'PROPS — preserve exact objects and ownership:',
      props.join('\n')||'No registered story prop reference supplied.',
      'CONTINUITY: '+scene.continuityNotes,
      'STYLE: clean hand-drawn 2D line art, consistent anatomy, expressive faces, detailed background, cinematic composition and lighting.',
      'NEGATIVE: photorealism, 3D, CGI, inconsistent face, changed costume, extra characters, unlisted props, extra limbs, malformed hands, text, watermark, logo.'
    ].join('\n');
  }
  function escapeRegex(value){return String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  global.MangaFlowScenes={maxScenes:MAX_SCENES,buildPrompt,parse,fallback,makeVisualPrompt};
})(window);
