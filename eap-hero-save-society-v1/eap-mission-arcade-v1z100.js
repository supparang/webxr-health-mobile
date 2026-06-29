/* EAP Hero: Save the Society
   v1z100 Mission Arcade + Active Quest Loop
   Companion layer for v1z99. Cosmetic and formative only:
   it never changes course scores, pass rules, unlocks, portfolio, or teacher records.
*/
(() => {
  'use strict';

  const VERSION = '20260629-v1z100-mission-arcade-active-quest-loop';
  const STORAGE_KEY = 'EAP_HERO_MISSION_ARCADE_V1Z100';
  const app = () => document.getElementById('app');
  let observer = null;
  let timer = null;

  const TOOLKITS = Object.freeze({
    Reading: {
      icon:'🔎', title:'Evidence Scanner', thai:'สแกนก่อนตอบ',
      tip:'Do not answer every detail. Find: topic → two keywords → one support detail.',
      actions:[['topic','1. Find topic'],['keywords','2. Mark 2 keywords'],['detail','3. Find 1 detail']]
    },
    Writing: {
      icon:'🧩', title:'Sentence Forge', thai:'ประกอบประโยคทีละชิ้น',
      tip:'Use one useful frame first. Then replace the blanks with your own idea.',
      frames:['This topic is important because ___.','One reason is ___.','For example, ___.','In conclusion, ___.']
    },
    Listening: {
      icon:'🎧', title:'Signal Compass', thai:'ฟังเป็นรอบ',
      tip:'Round 1: listen for the topic. Round 2: collect two keywords and one detail.',
      actions:[['round1','Round 1 · Topic'],['round2','Round 2 · Keywords'],['detail','Add 1 detail']]
    },
    Speaking: {
      icon:'🎙️', title:'Voice Launch Pad', thai:'พูดตามจุดนำทาง',
      tip:'You do not need perfect English. Say one opening, one support point, and one closing.',
      actions:[['open','Opening'],['support','One support'],['close','Closing']]
    }
  });

  function esc(v){ return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function read(){ try { return Object.assign({version:VERSION, runs:{}}, JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')); } catch(_) { return {version:VERSION,runs:{}}; } }
  function write(next){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch(_){} return next; }
  function context(){
    const node = app();
    const text = String(node?.innerText || '');
    const sid = Number((text.match(/(?:Session\s*|S)(1[0-5]|[1-9])\b/i)||[])[1] || 1);
    let skill = '';
    if(/Reading Mission/i.test(text)) skill='Reading';
    else if(/Writing Mission/i.test(text)) skill='Writing';
    else if(/Listening Mission/i.test(text)) skill='Listening';
    else if(/Speaking Mission/i.test(text)) skill='Speaking';
    const isResult = !!node?.querySelector('.result-hero') && /Evidence Saved|Mission complete|Saved/i.test(text);
    return {sid,skill,isResult,key:`S${sid}_${skill||'map'}`};
  }
  function getRun(ctx){ const state=read(); state.runs[ctx.key]=Object.assign({brief:true,action:false,evidence:false,tool:{},lastAt:''},state.runs[ctx.key]||{}); return {state,run:state.runs[ctx.key]}; }
  function saveRun(ctx, patch){ const pack=getRun(ctx); Object.assign(pack.run,patch||{}, {lastAt:new Date().toISOString()}); write(pack.state); return pack.run; }
  function count(run){ return (run.brief?1:0)+(run.action?1:0)+(run.evidence?1:0); }
  function questRoot(){ const node=app(); return node?.querySelector('.mf-hud')?.parentElement || node?.querySelector('.panel'); }

  function meterHTML(ctx,run){
    const n=count(run);
    return `<aside class="ma-quest" data-ma-key="${esc(ctx.key)}">
      <div class="ma-quest-head"><span class="ma-label">LIVE RESCUE METER</span><b>${n}/3 power</b></div>
      <div class="ma-meter" aria-label="Mission momentum"><span class="${run.brief?'on':''}"></span><span class="${run.action?'on':''}"></span><span class="${run.evidence?'on':''}"></span></div>
      <div class="ma-steps"><span class="${run.brief?'done':''}">📡 Brief</span><span class="${run.action?'done':''}">⚡ Action</span><span class="${run.evidence?'done':''}">🛡️ Rescue</span></div>
      <p>${run.evidence?'Zone secured. Your evidence is saved in the real learning path.':run.action?'Good. Build your evidence, then submit to break the final shield.':'Start with one small action. A draft, note, or voice start will charge the meter.'}</p>
    </aside>`;
  }

  function toolkitHTML(ctx,run){
    const t=TOOLKITS[ctx.skill]; if(!t) return '';
    if(ctx.skill==='Writing'){
      return `<section class="ma-toolkit ma-writing-toolkit" data-ma-toolkit="${esc(ctx.key)}"><div class="ma-toolkit-head"><span>${t.icon}</span><div><b>${esc(t.title)}</b><small>${esc(t.thai)}</small></div></div><p>${esc(t.tip)}</p><div class="ma-frame-grid">${t.frames.map((frame,i)=>`<button type="button" class="ma-frame-btn" data-ma-frame="${esc(frame)}"><span>${i+1}</span>${esc(frame)}</button>`).join('')}</div><small>Tap a frame to place it in your writing box. Edit the blanks with your own idea.</small></section>`;
    }
    return `<section class="ma-toolkit" data-ma-toolkit="${esc(ctx.key)}"><div class="ma-toolkit-head"><span>${t.icon}</span><div><b>${esc(t.title)}</b><small>${esc(t.thai)}</small></div></div><p>${esc(t.tip)}</p><div class="ma-action-grid">${t.actions.map(([id,label])=>`<button type="button" class="ma-action-btn ${run.tool?.[id]?'checked':''}" data-ma-action="${esc(id)}"><i>${run.tool?.[id]?'✓':'○'}</i>${esc(label)}</button>`).join('')}</div><small>${ctx.skill==='Listening'?'Tap Play AI Voice, then use these three checks while you listen.':ctx.skill==='Speaking'?'Use these as cue cards. They are not a score or a speaking checklist.':'These three checks help you prepare; they do not give answers.'}</small></section>`;
  }

  function injectMission(){
    const ctx=context(); if(!ctx.skill || ctx.isResult) return;
    const root=questRoot(); if(!root) return;
    const {run}=getRun(ctx);
    const existing=root.querySelector(`.ma-quest[data-ma-key="${CSS.escape(ctx.key)}"]`);
    if(existing) existing.outerHTML=meterHTML(ctx,run); else root.insertAdjacentHTML('afterbegin',meterHTML(ctx,run));
    const target=app()?.querySelector('.cefr-support,.answer-box-toolbar,.context.hidden-lecture-text,.guided-speaking-frame');
    const existingTool=app()?.querySelector(`.ma-toolkit[data-ma-toolkit="${CSS.escape(ctx.key)}"]`);
    if(existingTool) existingTool.outerHTML=toolkitHTML(ctx,run);
    else if(target) target.insertAdjacentHTML('beforebegin',toolkitHTML(ctx,run));
  }

  function injectResult(){
    const ctx=context(); if(!ctx.isResult) return;
    const root=app()?.querySelector('.result-hero'); if(!root || root.querySelector('.ma-recap')) return;
    const score=(String(root.innerText||'').match(/\b(\d{1,3})\/100\b/)||[])[1] || '';
    const run=saveRun(ctx,{brief:true,action:true,evidence:true});
    root.insertAdjacentHTML('afterbegin',`<div class="ma-recap"><span class="ma-recap-burst">⚔️</span><div><span class="ma-label">RESCUE MOMENT</span><h3>${score ? `Signal strength ${esc(score)}/100` : 'Evidence secured'}</h3><p>${score && Number(score)>=75 ? 'Strong rescue. Keep the strategy that worked and try a fresh source next time.' : score ? 'Good rescue. Use the feedback card below for one focused replay step.' : 'Your learning evidence is now safely stored in the session path.'}</p></div><b>${count(run)}/3</b></div>`);
    pulse('⚡ Rescue complete!');
  }

  function pulse(message){
    const old=document.querySelector('.ma-impact'); old?.remove();
    const node=document.createElement('div'); node.className='ma-impact'; node.innerHTML=`<span>⚡</span><b>${esc(message)}</b>`; document.body.appendChild(node);
    setTimeout(()=>node.classList.add('show'),20); setTimeout(()=>node.remove(),1500);
  }

  function markAction(reason){
    const ctx=context(); if(!ctx.skill || ctx.isResult) return;
    const before=getRun(ctx).run;
    const run=saveRun(ctx,{action:true});
    if(!before.action) pulse(reason || 'Action charged!');
    injectMission();
  }

  function frameInsert(button){
    const frame=button.dataset.maFrame || ''; const box=document.getElementById('writingOutput');
    if(!box) return;
    const start=Number(box.selectionStart||box.value.length); const end=Number(box.selectionEnd||start); const prefix=(box.value && !/\s$/.test(box.value.slice(0,start)))?' ':'';
    box.setRangeText(prefix+frame+' ',start,end,'end'); box.focus(); box.dispatchEvent(new Event('input',{bubbles:true})); markAction('Sentence frame forged!');
  }

  function actionToggle(button){
    const ctx=context(); if(!ctx.skill) return;
    const id=button.dataset.maAction || ''; const pack=getRun(ctx); pack.run.tool=Object.assign({},pack.run.tool||{}, {[id]:!pack.run.tool?.[id]}); pack.run.action=true; pack.run.lastAt=new Date().toISOString(); write(pack.state);
    pulse(pack.run.tool[id] ? 'Clue secured!' : 'Clue unchecked.'); injectMission();
  }

  function submitIntent(button){
    const text=String(button?.textContent||'');
    if(!/Submit|Save My Academic Goal/i.test(text)) return;
    const ctx=context(); if(!ctx.skill || ctx.isResult) return;
    markAction('Final shield targeted!');
  }

  function install(){
    if(!window.EAPHero || window.EAPHero.__missionArcadeV1z100) return false;
    window.EAPHero.__missionArcadeV1z100=true;
    window.EAPHero.missionArcadeStatus=function(){ return Object.assign({version:VERSION},read()); };
    window.EAPHero.missionArcadeReset=function(){ try{localStorage.removeItem(STORAGE_KEY);}catch(_){} pulse('Mission Arcade reset.'); schedule(); };

    document.addEventListener('input',event=>{
      if(event.target?.matches?.('#writingOutput,#readingAns0,#readingAns1,#readingAns2,#listeningNotes,#speakingTranscript')) markAction('Rescue energy charged!');
    },true);
    document.addEventListener('click',event=>{
      const target=event.target?.closest?.('button'); if(!target) return;
      if(target.matches('.ma-frame-btn')){ event.preventDefault(); frameInsert(target); return; }
      if(target.matches('.ma-action-btn')){ event.preventDefault(); actionToggle(target); return; }
      if(target.matches('#startSpeakBtn,#finishSpeakBtn') || /Play AI Voice|Replay chunk|Slow mode/i.test(String(target.textContent||''))) markAction('Signal captured!');
      submitIntent(target);
    },true);

    observer=new MutationObserver(schedule); observer.observe(app()||document.body,{childList:true,subtree:true}); schedule(); return true;
  }

  function decorate(){ try{ injectMission(); injectResult(); }catch(err){ console.warn('[EAP v1z100]',err); } }
  function schedule(){ clearTimeout(timer); timer=setTimeout(decorate,35); }
  function boot(){ if(!install()) setTimeout(boot,100); }
  boot();
})();
