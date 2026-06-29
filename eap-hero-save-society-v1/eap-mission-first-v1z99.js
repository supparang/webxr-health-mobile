/* EAP Hero: Save the Society
   v1z99 Mission-First Story Flow
   Student-facing presentation layer. It keeps existing assessment, portfolio,
   unlock, AI support, and teacher data logic unchanged.
*/
(() => {
  'use strict';

  const VERSION = '20260629-v1z99-mission-first-story-flow';
  const STORE_KEY = 'EAP_HERO_MISSION_FIRST_V1Z99';
  const DAY_MS = 24 * 60 * 60 * 1000;

  const MISSIONS = Object.freeze({
    1:{emoji:'🫧', title:'Academic Hero Awakening', boss:'Confusion Slime', area:'Orientation Gate', crisis:'The campus briefing is scrambled. Build one clear academic goal to restore the first signal.', objective:'Choose one study goal and one realistic action.', thai:'ตั้งเป้าหมายให้ชัด แล้วเลือกวิธีฝึก 1 วิธี'},
    2:{emoji:'👺', title:'Vocabulary Lab', boss:'Lazy Word Goblin', area:'Word Lab', crisis:'Key academic words have disappeared from the campus archive.', objective:'Recover one word, its meaning, and one useful use.', thai:'เลือกคำ 1 คำ บอกความหมาย และใช้ให้ถูก'},
    3:{emoji:'🕷️', title:'Main Idea Hunter', boss:'Detail Trap Spider', area:'Library Gate', crisis:'The spider has hidden the important message under too many details.', objective:'Find one main idea and one supporting detail.', thai:'หาใจความสำคัญ 1 จุด และรายละเอียด 1 จุด'},
    4:{emoji:'📢', title:'Keyword Scanner', boss:'Noise Monster', area:'Library Gate', crisis:'Noise is covering the clue words that show how ideas connect.', objective:'Spot one keyword or signal word.', thai:'หาคำสำคัญหรือคำเชื่อม 1 คำ'},
    5:{emoji:'👻', title:'Critical Reading', boss:'Fake News Phantom', area:'Library Gate', crisis:'A false claim is spreading across campus screens.', objective:'Separate fact, opinion, claim, and evidence.', thai:'แยก Fact / Opinion / Claim / Evidence'},
    6:{emoji:'🧟', title:'Summary Builder', boss:'Copy-Paste Zombie', area:'Writing Studio', crisis:'The Copy-Paste Zombie is turning every source into a long copied block.', objective:'Keep the main idea in your own words.', thai:'เก็บใจความสำคัญด้วยคำของเรา'},
    7:{emoji:'🧌', title:'Academic Tone Battle', boss:'Casual Talk Troll', area:'Writing Studio', crisis:'The troll has made every report sound too casual.', objective:'Improve one sentence using academic tone.', thai:'ปรับ 1 ประโยคให้เป็นภาษาเชิงวิชาการ'},
    8:{emoji:'🐍', title:'Paragraph Structure Lab', boss:'Structure Maze Warden', area:'Writing Studio', crisis:'Paragraph paths are mixed up. Rebuild a clear route for the reader.', objective:'Put topic, support, example, and closing in order.', thai:'จัด Topic → Support → Example → Closing'},
    9:{emoji:'🐺', title:'Paragraph Writing', boss:'Broken Paragraph Beast', area:'Writing Studio', crisis:'The beast has broken a useful paragraph into disconnected pieces.', objective:'Build a short paragraph with one clear support.', thai:'เขียนย่อหน้าสั้นที่มีเหตุผล/ตัวอย่าง'},
    10:{emoji:'🐉', title:'Data Description', boss:'Graph Fog Dragon', area:'Data Tower', crisis:'Fog is hiding the real trend in the data.', objective:'Describe the trend without guessing a cause.', thai:'บรรยายแนวโน้มจากข้อมูล ไม่เดาสาเหตุ'},
    11:{emoji:'👹', title:'Academic Email', boss:'Rude Mail Gremlin', area:'Ethics Court', crisis:'The Gremlin has sent an unclear, impolite email to the whole class.', objective:'Write one polite and clear request.', thai:'เขียนคำขอที่สุภาพและชัดเจน'},
    12:{emoji:'👾', title:'Citation & Ethics', boss:'Plagiarism Monster', area:'Ethics Court', crisis:'The monster is removing credit from useful ideas and sources.', objective:'Use sources and AI responsibly.', thai:'ใช้แหล่งข้อมูลและ AI อย่างรับผิดชอบ'},
    13:{emoji:'🌪️', title:'Academic Listening', boss:'Lecture Storm', area:'Lecture Hall', crisis:'A lecture storm is scattering every important keyword.', objective:'Listen twice: main point first, details second.', thai:'ฟัง 2 รอบ: ใจความหลักก่อน รายละเอียดทีหลัง'},
    14:{emoji:'👻', title:'Academic Presentation', boss:'Nervous Ghost', area:'Conference Arena', crisis:'The audience needs a clear idea, one support, and a confident close.', objective:'Present one point, one support, and one close.', thai:'นำเสนอ 1 ประเด็น 1 หลักฐาน 1 ข้อสรุป'},
    15:{emoji:'👑', title:'Final Integration', boss:'Stagnation Emperor', area:'Society Core', crisis:'The Society Core needs an evidence-based solution before the final system fails.', objective:'Connect a problem, evidence, and solution.', thai:'เชื่อมปัญหา หลักฐาน และทางออก'}
  });

  const SKILL_META = Object.freeze({
    Reading:{icon:'🔎', stage:'Scout Challenge', thai:'สแกนหลักฐาน', cue:'Read the topic first. Then find one idea and one clue.'},
    Writing:{icon:'🧩', stage:'Build & Defend', thai:'สร้างคำตอบ', cue:'Use the frame. Add one clear idea and one reason or example.'},
    Listening:{icon:'🎧', stage:'Signal Scan', thai:'ฟังสัญญาณ', cue:'Round 1: topic. Round 2: two keywords and one detail.'},
    Speaking:{icon:'🎙️', stage:'Rally Call', thai:'สื่อสารเพื่อช่วยทีม', cue:'Say the topic, one point, and one short closing sentence.'},
    Boss:{icon:'⚔️', stage:'Rescue Clash', thai:'ปะทะบอส', cue:'Slow down. Accuracy builds combo power.'}
  });

  const ROUTES = Object.freeze({
    focus:{icon:'🎯', name:'Focus Route', thai:'เส้นทางโฟกัส', detail:'One idea at a time. Use the shortest helpful step.'},
    support:{icon:'🧭', name:'Support Route', thai:'เส้นทางช่วยเหลือ', detail:'Use frames, word banks, and one optional clue.'},
    challenge:{icon:'⚡', name:'Challenge Route', thai:'เส้นทางท้าทาย', detail:'Try first without an extra clue. Earn a style badge, not extra marks.'}
  });

  let installed = false;
  let sessionLaunchBypass = false;
  let skillLaunchBypass = false;
  let observer = null;
  let decorateTimer = null;
  const originals = {};

  function root(){ return document.getElementById('app'); }
  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function today(){ return new Date().toISOString().slice(0,10); }
  function defaultState(){
    return {version:VERSION, energy:0, streak:0, lastPlayDate:'', route:'focus', rewards:{clue:0, shield:0, style:0}, visited:{}, claimed:{}};
  }
  function readState(){
    try{
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return Object.assign(defaultState(), saved || {}, {rewards:Object.assign({}, defaultState().rewards, saved?.rewards || {})});
    }catch(_){ return defaultState(); }
  }
  function writeState(next){
    try{ localStorage.setItem(STORE_KEY, JSON.stringify(next)); }catch(_){}
    return next;
  }
  function player(){ return readState(); }
  function savePlayer(next){ return writeState(next); }
  function touchStreak(){
    const p = player();
    const now = today();
    if(p.lastPlayDate !== now){
      const previous = p.lastPlayDate ? new Date(p.lastPlayDate+'T00:00:00').getTime() : 0;
      const current = new Date(now+'T00:00:00').getTime();
      p.streak = previous && current - previous <= DAY_MS * 1.5 ? Math.max(1, Number(p.streak || 0) + 1) : 1;
      p.lastPlayDate = now;
      savePlayer(p);
    }
    return p;
  }
  function earnEnergy(amount){
    const p = touchStreak();
    p.energy = Math.max(0, Math.min(999, Number(p.energy || 0) + Number(amount || 0)));
    savePlayer(p);
    return p;
  }
  function setRoute(route){
    const p = player();
    if(ROUTES[route]) p.route = route;
    savePlayer(p);
    return p;
  }
  function getRoute(){ const p = player(); return ROUTES[p.route] || ROUTES.focus; }
  function mission(sessionId){ return MISSIONS[Number(sessionId)] || MISSIONS[1]; }
  function skillMeta(skill){ return SKILL_META[String(skill || '')] || SKILL_META.Boss; }

  function screenContext(){
    const app = root();
    const text = String(app?.innerText || '');
    const heading = app?.querySelector('h1,h2,h3')?.textContent || '';
    const sessionMatch = text.match(/(?:Session\s*|S)(1[0-5]|[1-9])\b/i);
    const sid = Number(sessionMatch?.[1] || 1);
    let skill = '';
    if(/Reading Mission/i.test(text)) skill = 'Reading';
    else if(/Writing Mission/i.test(text)) skill = 'Writing';
    else if(/Listening Mission/i.test(text)) skill = 'Listening';
    else if(/Speaking Mission/i.test(text)) skill = 'Speaking';
    else if(/Boss Battle|Boss Gate|Boss Defeated|Choose Your Contract|Rematch Contract/i.test(text)) skill = 'Boss';
    let kind = 'other';
    if(app?.querySelector('.session-path-panel')) kind = 'path';
    else if(/Evidence Saved|Boss Defeated!|Try Again/i.test(text)) kind = 'result';
    else if(skill === 'Boss') kind = 'boss';
    else if(skill) kind = 'mission';
    else if(/Campus Map|Learning Route/i.test(text)) kind = 'map';
    return {sid, skill, kind, heading, text};
  }

  function toast(message){
    let el = document.getElementById('eapMissionFirstToast');
    if(!el){
      el = document.createElement('div');
      el.id = 'eapMissionFirstToast';
      el.className = 'mf-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(()=>el.classList.remove('show'), 2600);
  }

  function missionHudHTML(ctx){
    const p = touchStreak();
    const route = getRoute();
    const m = mission(ctx.sid);
    const sm = skillMeta(ctx.skill || (ctx.kind==='boss' ? 'Boss' : 'Reading'));
    const stage = ctx.kind === 'path' ? 'MISSION BOARD' : ctx.kind === 'result' ? 'RESCUE COMPLETE' : sm.stage.toUpperCase();
    const progress = ctx.kind === 'path' ? 1 : ctx.kind === 'mission' ? 2 : ctx.kind === 'boss' ? 3 : 3;
    return `
      <section class="mf-hud mf-${String(ctx.skill || ctx.kind).toLowerCase()}" data-mf-hud="${esc(stage)}" aria-label="Mission progress">
        <div class="mf-hud-top"><span class="mf-kicker">⚡ Mission Mode v1z99</span><span class="mf-stage">${esc(stage)}</span></div>
        <div class="mf-hud-main">
          <div class="mf-mission-icon" aria-hidden="true">${m.emoji}</div>
          <div><h3>${esc(m.title)}</h3><p>${esc(sm.thai)} · ${esc(m.area)}</p></div>
          <div class="mf-stats"><span>⚡ ${Number(p.energy||0)}</span><span>🔥 ${Number(p.streak||0)}</span></div>
        </div>
        <div class="mf-stepper" aria-label="Three mission stages">
          <span class="${progress>=1?'on':''}">1<br><b>Brief</b></span><i></i>
          <span class="${progress>=2?'on':''}">2<br><b>Action</b></span><i></i>
          <span class="${progress>=3?'on':''}">3<br><b>Rescue</b></span>
        </div>
        <div class="mf-hud-bottom"><span>${route.icon} ${esc(route.name)}: ${esc(route.detail)}</span><button type="button" class="mf-clue" onclick="EAPHero.missionFirstQuickClue()">Need a 10-sec clue?</button></div>
      </section>`;
  }

  function injectHud(){
    const app = root();
    if(!app || document.querySelector('.mf-brief-overlay')) return;
    const ctx = screenContext();
    if(ctx.kind==='map' || ctx.kind==='other') return;
    const target = app.querySelector('.session-path-panel,.result-hero,.battle-layout,section.panel,section');
    if(!target) return;
    const existing = target.querySelector(':scope > .mf-hud');
    if(existing){
      existing.replaceWith(htmlNode(missionHudHTML(ctx)));
    }else{
      target.insertAdjacentHTML('afterbegin', missionHudHTML(ctx));
    }
    if(ctx.kind==='path') injectRouteBoard(target,ctx);
    if(ctx.kind==='result') injectRewardChoice(target,ctx);
  }

  function htmlNode(html){
    const wrap=document.createElement('div'); wrap.innerHTML=html.trim(); return wrap.firstElementChild;
  }

  function injectRouteBoard(target,ctx){
    if(target.querySelector('.mf-route-board')) return;
    const m=mission(ctx.sid), p=player();
    const routeCards = Object.entries(ROUTES).map(([key,route])=>`
      <button type="button" class="mf-route-card ${p.route===key?'selected':''}" onclick="EAPHero.missionFirstChooseRoute('${key}')">
        <span>${route.icon}</span><b>${esc(route.name)}</b><small>${esc(route.thai)}</small><em>${esc(route.detail)}</em>
      </button>`).join('');
    const lead = target.querySelector('.lead');
    const board = `<div class="mf-route-board">
      <div><span class="mf-kicker">RESCUE PLAN</span><h3>Save ${esc(m.area)} in 3 moves</h3><p>เริ่มจากภารกิจหลักก่อน แล้วเลือก Support เพื่อเสริมความมั่นใจ ก่อนสู้บอส</p></div>
      <ol class="mf-plan"><li><b>Scout</b><span>Core skill: find the important clue.</span></li><li><b>Build</b><span>Support skill: apply the same idea in a new way.</span></li><li><b>Rescue</b><span>Boss Gate: use what you practised.</span></li></ol>
      <div class="mf-route-grid">${routeCards}</div>
    </div>`;
    if(lead) lead.insertAdjacentHTML('afterend',board); else target.insertAdjacentHTML('afterbegin',board);
  }

  function injectRewardChoice(target,ctx){
    if(target.querySelector('.mf-reward-choice')) return;
    const p = player();
    const marker = `${today()}_${ctx.sid}_${ctx.skill || 'result'}_${String(ctx.heading).slice(0,32)}`;
    const claimed = p.claimed?.[marker];
    const content = claimed ? `<div class="mf-reward-result">${esc(claimed)}</div>` : `
      <p>Choose one safe support reward for your next mission. It never changes your academic score.</p>
      <div class="mf-reward-grid">
        <button type="button" onclick="EAPHero.missionFirstClaimReward('clue','${esc(marker)}')">🔍<b>Clue Card</b><span>one extra strategy reminder</span></button>
        <button type="button" onclick="EAPHero.missionFirstClaimReward('shield','${esc(marker)}')">🛡️<b>Replay Shield</b><span>encouragement to retry a new route</span></button>
        <button type="button" onclick="EAPHero.missionFirstClaimReward('style','${esc(marker)}')">✨<b>Hero Style</b><span>a collectible Mission badge</span></button>
      </div>`;
    target.insertAdjacentHTML('beforeend',`<aside class="mf-reward-choice"><span class="mf-kicker">REWARD CHOICE</span><h3>Mission complete. Choose your support reward.</h3>${content}</aside>`);
  }

  function decorate(){
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(()=>{
      try{ injectHud(); markMissionCards(); refreshTopMessage(); }catch(err){ console.warn('[EAP v1z99]',err); }
    }, 30);
  }

  function markMissionCards(){
    const app=root(); if(!app) return;
    app.querySelectorAll('.session-mission-card').forEach((card,index)=>{
      card.classList.add(index===0?'mf-scout-card':'mf-build-card');
      if(!card.querySelector('.mf-card-label')){
        card.insertAdjacentHTML('afterbegin',`<span class="mf-card-label">${index===0?'1 · SCOUT':'2 · BUILD'}</span>`);
      }
    });
  }

  function refreshTopMessage(){
    const app=root(); if(!app) return;
    const topbar = app.querySelector('.topbar,.app-header,header');
    if(topbar && !topbar.querySelector('.mf-top-tag')){
      topbar.insertAdjacentHTML('beforeend','<span class="mf-top-tag">⚡ Mission Mode</span>');
    }
  }

  function showSessionBrief(sessionId, starter){
    const sid = Number(sessionId||1), m=mission(sid), p=touchStreak(), route=getRoute();
    closeOverlay();
    const overlay=document.createElement('div');
    overlay.className='mf-brief-overlay'; overlay.id='eapMissionBrief';
    overlay.innerHTML=`<div class="mf-brief-card" role="dialog" aria-modal="true" aria-labelledby="mfBriefTitle">
      <button class="mf-close" aria-label="Close briefing" onclick="EAPHero.missionFirstCloseBrief()">×</button>
      <div class="mf-brief-hero"><span>${m.emoji}</span><div><div class="mf-kicker">EMERGENCY BRIEFING · S${sid}</div><h2 id="mfBriefTitle">${esc(m.title)}</h2><p>${esc(m.area)} · Enemy: ${esc(m.boss)}</p></div></div>
      <div class="mf-crisis"><b>Campus alert:</b><p>${esc(m.crisis)}</p><small>${esc(m.thai)}</small></div>
      <div class="mf-objective"><span>🎯</span><div><b>Win condition</b><p>${esc(m.objective)}</p></div><span>⏱ 6–8 min</span></div>
      <div class="mf-brief-steps"><div><b>1</b><span>Scout the clue</span></div><div><b>2</b><span>Build a response</span></div><div><b>3</b><span>Rescue the zone</span></div></div>
      <div class="mf-route-inline"><span>Route:</span><b>${route.icon} ${esc(route.name)}</b><button type="button" onclick="EAPHero.missionFirstRotateRoute()">Change route</button></div>
      <div class="mf-brief-actions"><button class="mf-btn ghost" onclick="EAPHero.missionFirstCloseBrief()">Back to Map</button><button class="mf-btn primary" onclick="EAPHero.missionFirstStartSession(${sid})">Start Rescue Mission →</button></div>
      <p class="mf-fine">🔥 Streak ${Number(p.streak||0)} · ⚡ Rescue Energy ${Number(p.energy||0)} · Rewards are play support only and never change grades.</p>
    </div>`;
    document.body.appendChild(overlay); document.body.classList.add('mf-modal-open');
    overlay._starter = starter;
    setTimeout(()=>overlay.querySelector('.mf-btn.primary')?.focus(),20);
  }

  function showSkillBrief(skill, sessionId){
    const sid=Number(sessionId||1), m=mission(sid), meta=skillMeta(skill), p=touchStreak();
    closeOverlay();
    const overlay=document.createElement('div'); overlay.className='mf-brief-overlay'; overlay.id='eapMissionBrief';
    overlay.innerHTML=`<div class="mf-brief-card mf-skill-brief" role="dialog" aria-modal="true" aria-labelledby="mfSkillTitle">
      <button class="mf-close" aria-label="Close briefing" onclick="EAPHero.missionFirstCloseBrief()">×</button>
      <div class="mf-brief-hero"><span>${meta.icon}</span><div><div class="mf-kicker">MISSION START · S${sid}</div><h2 id="mfSkillTitle">${esc(meta.stage)}</h2><p>${esc(m.title)} · ${esc(skill)}</p></div></div>
      <div class="mf-crisis"><b>Your move now:</b><p>${esc(meta.cue)}</p><small>${esc(m.thai)}</small></div>
      <div class="mf-objective"><span>${meta.icon}</span><div><b>Keep it simple</b><p>${esc(m.objective)}</p></div><span>1 clue at a time</span></div>
      <div class="mf-route-inline"><span>Current route:</span><b>${getRoute().icon} ${esc(getRoute().name)}</b><button type="button" onclick="EAPHero.missionFirstRotateRoute()">Change route</button></div>
      <div class="mf-brief-actions"><button class="mf-btn ghost" onclick="EAPHero.missionFirstCloseBrief()">Back</button><button class="mf-btn primary" onclick="EAPHero.missionFirstStartSkill('${esc(skill)}',${sid})">Begin ${esc(skill)} →</button></div>
      <p class="mf-fine">⚡ ${Number(p.energy||0)} Rescue Energy · Need help? Use the 10-second clue in the mission HUD.</p>
    </div>`;
    document.body.appendChild(overlay); document.body.classList.add('mf-modal-open');
  }

  function closeOverlay(){
    document.getElementById('eapMissionBrief')?.remove();
    document.body.classList.remove('mf-modal-open');
  }

  function quickClue(){
    const ctx=screenContext();
    const meta=skillMeta(ctx.skill || (ctx.kind==='boss'?'Boss':'Reading'));
    const p=player();
    let extra='';
    if((p.rewards?.clue||0)>0) extra=' Saved Clue Card active: check the frame or useful words once more.';
    toast(`${meta.icon} ${meta.cue}${extra}`);
  }

  function rotateRoute(){
    const order=['focus','support','challenge']; const now=player().route || 'focus';
    const next=order[(order.indexOf(now)+1)%order.length]; setRoute(next);
    toast(`${ROUTES[next].icon} ${ROUTES[next].name} selected.`); decorate();
  }

  function validAttempt(skill){
    if(skill==='Writing') return !!document.getElementById('writingOutput')?.value.trim();
    if(skill==='Reading') return Array.from(document.querySelectorAll('[id^="readingAns"]')).some(x=>x.value.trim());
    if(skill==='Listening') return !!(document.getElementById('listeningNotes')?.value || document.getElementById('listeningOutput')?.value || '').trim();
    if(skill==='Speaking') return true;
    return true;
  }

  function awardForEvidence(skill){
    if(!validAttempt(skill)) return;
    const p=earnEnergy(10);
    toast(`+10 Rescue Energy · ${skill} evidence saved. ⚡ ${Number(p.energy||0)}`);
  }

  function install(api){
    if(installed || api.__missionFirstV1z99) return;
    installed=true; api.__missionFirstV1z99=true;

    ['openSessionFromCard','forceCheckpointSessionFallback','directOpenSession'].forEach(name=>{
      if(typeof api[name] !== 'function') return;
      originals[name]=api[name].bind(api);
      api[name]=function(sessionId,...rest){
        if(sessionLaunchBypass) return originals[name](sessionId,...rest);
        showSessionBrief(Number(sessionId||1), ()=>originals[name](sessionId,...rest));
        return false;
      };
    });

    if(typeof api.openSkillMission === 'function'){
      originals.openSkillMission=api.openSkillMission.bind(api);
      api.openSkillMission=function(skill,sessionId){
        if(skillLaunchBypass) return originals.openSkillMission(skill,sessionId);
        showSkillBrief(String(skill||'Reading'),Number(sessionId||1));
        return false;
      };
    }
    if(typeof api.openSkillMissionFromButton === 'function'){
      originals.openSkillMissionFromButton=api.openSkillMissionFromButton.bind(api);
      api.openSkillMissionFromButton=function(btn){
        if(skillLaunchBypass) return originals.openSkillMissionFromButton(btn);
        showSkillBrief(String(btn?.dataset?.skill||btn?.getAttribute?.('data-skill')||'Reading'),Number(btn?.dataset?.session||btn?.getAttribute?.('data-session')||1));
        return false;
      };
    }

    [['submitReading','Reading'],['submitWriting','Writing'],['submitListening','Listening'],['submitSpeaking','Speaking']].forEach(([name,skill])=>{
      if(typeof api[name] !== 'function') return;
      originals[name]=api[name].bind(api);
      api[name]=function(...args){
        const didAttempt=validAttempt(skill);
        const result=originals[name](...args);
        if(didAttempt) setTimeout(()=>awardForEvidence(skill),45);
        setTimeout(decorate,80);
        return result;
      };
    });

    api.missionFirstStartSession=function(sessionId){
      const overlay=document.getElementById('eapMissionBrief');
      const starter=overlay?._starter;
      closeOverlay(); sessionLaunchBypass=true;
      try{
        if(typeof starter==='function') return starter();
        const fn=originals.openSessionFromCard || originals.directOpenSession || originals.forceCheckpointSessionFallback;
        return fn ? fn(sessionId) : false;
      }finally{ setTimeout(()=>{sessionLaunchBypass=false; decorate();},0); }
    };
    api.missionFirstStartSkill=function(skill,sessionId){
      closeOverlay(); skillLaunchBypass=true;
      try{ return originals.openSkillMission ? originals.openSkillMission(skill,sessionId) : false; }
      finally{ setTimeout(()=>{skillLaunchBypass=false; decorate();},0); }
    };
    api.missionFirstCloseBrief=closeOverlay;
    api.missionFirstQuickClue=quickClue;
    api.missionFirstChooseRoute=function(route){ setRoute(route); toast(`${ROUTES[route]?.icon||'🎯'} ${ROUTES[route]?.name||'Route'} selected.`); decorate(); };
    api.missionFirstRotateRoute=rotateRoute;
    api.missionFirstClaimReward=function(kind,marker){
      const p=player(); p.rewards=p.rewards||{}; p.claimed=p.claimed||{};
      if(p.claimed[marker]) return;
      const labels={clue:'Clue Card added for your next mission.',shield:'Replay Shield added: try a fresh route when you need practice.',style:'Hero Style badge collected.'};
      p.rewards[kind]=Number(p.rewards[kind]||0)+1; p.claimed[marker]=labels[kind]||'Reward collected.'; savePlayer(p);
      toast(`✨ ${p.claimed[marker]}`); decorate();
    };
    api.missionFirstStatus=function(){ return Object.assign({version:VERSION},player()); };

    window.addEventListener('click',function(event){
      if(skillLaunchBypass || event.defaultPrevented) return;
      const target=event.target?.closest?.('.js-skill-mission-btn');
      if(!target || target.closest('#eapMissionBrief')) return;
      event.preventDefault(); event.stopImmediatePropagation(); event.stopPropagation();
      showSkillBrief(String(target.dataset.skill||'Reading'),Number(target.dataset.session||1));
    },true);

    window.addEventListener('keydown',event=>{ if(event.key==='Escape') closeOverlay(); });
    observer=new MutationObserver(decorate);
    observer.observe(root()||document.body,{childList:true,subtree:true});
    touchStreak(); decorate();
  }

  function boot(){
    const api=window.EAPHero;
    if(api) install(api);
    else setTimeout(boot,80);
  }
  boot();
})();
