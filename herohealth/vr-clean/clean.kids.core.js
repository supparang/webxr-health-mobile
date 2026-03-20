// === /herohealth/vr-clean/clean.kids.core.js ===
// Clean Objects — Kids Mode Core
// 3 PHASES / NON-REPEATING OBJECT SETS / CHILD-FRIENDLY
// PATCH v20260320-CLEAN-KIDS-CORE-3PHASE-r2

'use strict';

import { HOTSPOTS, MAP } from './clean.data.js';

function clamp(v, a, b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
}
function qs(k, d=''){
  try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
  catch(e){ return d; }
}
function nowIso(){ return new Date().toISOString(); }

function emitEvt(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(e){}
}

function xmur3(str){
  let h = 1779033703 ^ str.length;
  for(let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= (h >>> 16)) >>> 0;
  };
}
function sfc32(a,b,c,d){
  return function(){
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function makeRng(seedStr){
  const seed = xmur3(String(seedStr || 'seed'));
  return sfc32(seed(), seed(), seed(), seed());
}

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cvr' || v === 'cardboard' || v === 'vr') return 'cvr';
  if(v === 'mobile' || v === 'm') return 'mobile';
  if(v === 'pc' || v === 'desktop') return 'pc';
  return v || '';
}

function makeSessionId(){
  const pid = String(qs('pid','anon') || 'anon');
  const seed = String(qs('seed', String(Date.now())) || Date.now());
  return `CK_${pid}_${seed}_${Math.floor(Date.now()/1000)}`;
}

function valueScoreHotspot(h){
  const risk = clamp(h.risk, 0, 100) / 100;
  const touch = clamp(h.touchLevel, 0, 1);
  const traffic = clamp(h.traffic, 0, 1);
  const mins = Math.max(0, Number(h.timeLastCleanedMin || 0));
  const stale = clamp(mins / (24 * 60), 0, 2);
  return risk * (0.5 * touch + 0.35 * traffic + 0.15 * stale);
}

function rankHotspotsByValue(hs){
  return (hs || []).slice().sort((a,b)=> valueScoreHotspot(b) - valueScoreHotspot(a));
}

function makeKidLabel(h){
  const id = String(h.id || '').toLowerCase();
  const zone = String(h.zone || '').toLowerCase();

  if(id.includes('door')) return 'ลูกบิดประตู';
  if(id.includes('switch')) return 'สวิตช์ไฟ';
  if(id.includes('faucet')) return 'ก๊อกน้ำ';
  if(id.includes('toilet')) return 'ชักโครก';
  if(id.includes('flush')) return 'ที่กดชักโครก';
  if(id.includes('tablet')) return 'แท็บเล็ต';
  if(id.includes('remote')) return 'รีโมท';
  if(id.includes('mouse')) return 'เมาส์';
  if(id.includes('desk') || id.includes('table')) return 'โต๊ะ';
  if(id.includes('sink')) return 'อ่างล้างมือ';
  if(id.includes('trash')) return 'ฝาถังขยะ';
  if(id.includes('rail')) return 'ราวจับ';

  if(zone.includes('shared')) return 'ของใช้ร่วม';
  if(zone.includes('wet')) return 'จุดเปียก';
  if(zone.includes('entry')) return 'จุดทางเข้า';

  return String(h.name || h.id || 'จุดเสี่ยง');
}

function makeKidIcon(h){
  const id = String(h.id || '').toLowerCase();
  const zone = String(h.zone || '').toLowerCase();

  if(id.includes('door')) return '🚪';
  if(id.includes('switch')) return '💡';
  if(id.includes('faucet')) return '🚰';
  if(id.includes('toilet') || id.includes('flush')) return '🚽';
  if(id.includes('tablet')) return '📱';
  if(id.includes('remote')) return '📺';
  if(id.includes('mouse')) return '🖱️';
  if(id.includes('desk') || id.includes('table')) return '🪑';
  if(id.includes('sink')) return '🫧';
  if(id.includes('trash')) return '🗑️';
  if(id.includes('rail')) return '🛗';

  if(zone.includes('shared')) return '🤝';
  if(zone.includes('wet')) return '💧';
  if(zone.includes('entry')) return '🚪';

  return '🧽';
}

function buildFallbackDecoys(phaseNo){
  const pools = {
    1: [
      { id:'flower_pot', kidLabel:'กระถางดอกไม้', kidIcon:'🌼', fake:true },
      { id:'toy_bear', kidLabel:'ตุ๊กตา', kidIcon:'🧸', fake:true },
      { id:'pillow_soft', kidLabel:'หมอน', kidIcon:'🛏️', fake:true }
    ],
    2: [
      { id:'book_stack', kidLabel:'กองหนังสือ', kidIcon:'📚', fake:true },
      { id:'apple_snack', kidLabel:'แอปเปิล', kidIcon:'🍎', fake:true },
      { id:'color_box', kidLabel:'กล่องสี', kidIcon:'🎨', fake:true }
    ],
    3: [
      { id:'shoe_box', kidLabel:'กล่องรองเท้า', kidIcon:'👟', fake:true },
      { id:'hat_cap', kidLabel:'หมวก', kidIcon:'🧢', fake:true },
      { id:'toy_ball', kidLabel:'ลูกบอล', kidIcon:'⚽', fake:true }
    ]
  };
  return (pools[phaseNo] || []).map(x => ({ ...x }));
}

function chooseUniquePool(ranked, usedIds, nGood, nOtherPool){
  const good = [];
  const others = [];

  for(const h of ranked){
    const id = String(h.id || '');
    if(usedIds.has(id)) continue;
    if(good.length < nGood){
      good.push(h);
      usedIds.add(id);
    }else{
      others.push(h);
    }
    if(good.length >= nGood && others.length >= nOtherPool) break;
  }

  return { good, others };
}

function shuffleInPlace(arr, rng){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rng() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPhaseFromPool({
  phaseNo,
  title,
  timeTotal,
  cardCount,
  goodCount,
  passNeed,
  maxPicks,
  specialMission,
  ranked,
  usedIds,
  rng
}){
  const pick = chooseUniquePool(ranked, usedIds, goodCount, Math.max(4, cardCount));
  const good = pick.good.slice(0, goodCount);

  let decoys = pick.others
    .filter(h => !good.find(g => g.id === h.id))
    .slice(0, Math.max(0, cardCount - good.length - (specialMission ? 1 : 0)));

  if(decoys.length < Math.max(0, cardCount - good.length - (specialMission ? 1 : 0))){
    const fallback = buildFallbackDecoys(phaseNo);
    for(const f of fallback){
      if(decoys.length >= Math.max(0, cardCount - good.length - (specialMission ? 1 : 0))) break;
      decoys.push(f);
    }
  }

  let special = null;
  if(specialMission){
    const specialPool = pick.others.filter(h =>
      !good.find(g => g.id === h.id) &&
      !decoys.find(d => String(d.id) === String(h.id))
    );
    if(specialPool.length){
      special = specialPool[0];
      usedIds.add(String(special.id));
    }else{
      const fallback = buildFallbackDecoys(phaseNo).find(x =>
        !decoys.find(d => String(d.id) === String(x.id))
      );
      if(fallback) special = fallback;
    }
  }

  const cards = [
    ...good.map(h => ({
      ...h,
      kidLabel: makeKidLabel(h),
      kidIcon: makeKidIcon(h),
      kind: 'good'
    })),
    ...decoys.map(h => ({
      ...h,
      kidLabel: h.kidLabel || makeKidLabel(h),
      kidIcon: h.kidIcon || makeKidIcon(h),
      kind: 'decoy'
    }))
  ];

  if(special){
    cards.push({
      ...special,
      kidLabel: makeKidLabel(special),
      kidIcon: makeKidIcon(special),
      kind: 'special'
    });
  }

  shuffleInPlace(cards, rng);

  return {
    id: `phase-${phaseNo}`,
    phaseNo,
    title,
    timeTotal,
    passNeed,
    maxPicks,
    cards,
    goodIds: good.map(h => String(h.id)),
    specialId: special ? String(special.id) : ''
  };
}

function buildThreePhases(hotspots, rng){
  const ranked = rankHotspotsByValue(hotspots);
  const usedIds = new Set();

  const p1 = buildPhaseFromPool({
    phaseNo: 1,
    title: 'ด่าน 1',
    timeTotal: 20,
    cardCount: 4,
    goodCount: 2,
    passNeed: 2,
    maxPicks: 2,
    specialMission: false,
    ranked,
    usedIds,
    rng
  });

  const p2 = buildPhaseFromPool({
    phaseNo: 2,
    title: 'ด่าน 2',
    timeTotal: 18,
    cardCount: 5,
    goodCount: 3,
    passNeed: 2,
    maxPicks: 3,
    specialMission: false,
    ranked,
    usedIds,
    rng
  });

  const p3 = buildPhaseFromPool({
    phaseNo: 3,
    title: 'ด่าน 3',
    timeTotal: 15,
    cardCount: 6,
    goodCount: 3,
    passNeed: 3,
    maxPicks: 3,
    specialMission: true,
    ranked,
    usedIds,
    rng
  });

  return [p1, p2, p3];
}

export function createCleanKidsCore(cfg={}, hooks={}){
  const runMode = String(qs('run', cfg.run || 'play') || 'play');
  const seedStr = String(qs('seed', cfg.seed || String(Date.now())) || Date.now());
  const view = normalizeView(qs('view', cfg.view || ''));
  const rng = makeRng(seedStr + '::cleankids::3phase');

  const source = (HOTSPOTS || []).map(h => ({ ...h }));
  const phases = buildThreePhases(source, rng);

  const state = {
    cfg: {
      run: runMode,
      seed: seedStr,
      view,
      sessionId: cfg.sessionId || makeSessionId(),
      hub: qs('hub', cfg.hub || '')
    },

    started: false,
    ended: false,
    waitingNextPhase: false,

    t0: 0,
    lastMs: 0,
    elapsed: 0,

    map: MAP,

    phases,
    phaseIndex: 0,

    chosenIds: [],
    correct: 0,
    wrong: 0,
    specialDone: false,

    totalCorrect: 0,
    totalWrong: 0,
    totalStars: 0,

    phaseResults: []
  };

  function getPhase(){
    return state.phases[state.phaseIndex] || null;
  }

  function calcPhaseStars(phaseResult){
    if(!phaseResult) return 0;
    const c = Number(phaseResult.correct || 0);
    const w = Number(phaseResult.wrong || 0);
    const specialDone = !!phaseResult.specialDone;
    const passNeed = Number(phaseResult.passNeed || 1);

    let stars = 0;
    if(c >= Math.max(1, passNeed - 1)) stars = 1;
    if(c >= passNeed) stars = 2;
    if(c >= passNeed && specialDone && w <= 1) stars = 3;

    return stars;
  }

  function calcCurrentPhaseStars(){
    const phase = getPhase();
    if(!phase) return 0;

    let stars = 0;
    if(state.correct >= Math.max(1, phase.passNeed - 1)) stars = 1;
    if(state.correct >= phase.passNeed) stars = 2;
    if(state.correct >= phase.passNeed && state.specialDone && state.wrong <= 1) stars = 3;

    return stars;
  }

  function getMissionText(phase){
    if(!phase) return '';
    if(phase.phaseNo === 1) return 'แตะจุดที่ควรเช็ดก่อน';
    if(phase.phaseNo === 2) return 'เริ่มเลือกจุดสำคัญให้แม่นขึ้น';
    return 'ด่านสุดท้าย! มองหาภารกิจพิเศษด้วย';
  }

  function emitState(){
    try{
      hooks.onState && hooks.onState(snapshot());
    }catch(e){}
  }

  function snapshot(){
    const phase = getPhase();

    return {
      started: state.started,
      ended: state.ended,
      waitingNextPhase: state.waitingNextPhase,

      elapsedSec: state.elapsed,
      timeTotal: phase ? phase.timeTotal : 0,
      timeLeft: phase ? phase.timeLeft : 0,

      map: state.map,

      phaseIndex: state.phaseIndex,
      phaseNo: phase ? phase.phaseNo : 0,
      phaseTotal: state.phases.length,
      phaseTitle: phase ? phase.title : '',
      phaseText: getMissionText(phase),

      cards: phase ? phase.cards.slice(0) : [],
      goodIds: phase ? phase.goodIds.slice(0) : [],
      specialId: phase ? phase.specialId : '',
      chosenIds: state.chosenIds.slice(0),

      correct: state.correct,
      wrong: state.wrong,
      specialDone: state.specialDone,
      maxPicks: phase ? phase.maxPicks : 0,
      stars: calcCurrentPhaseStars(),

      totalCorrect: state.totalCorrect,
      totalWrong: state.totalWrong,
      totalStars: state.totalStars,
      phaseResults: state.phaseResults.slice(0)
    };
  }

  function emitCoach(kind, text, data={}){
    try{
      hooks.onCoach && hooks.onCoach({ kind, text, data, ts: Date.now() });
    }catch(e){}
    emitEvt('hha:coach', { game:'cleanobjects-kids', kind, text, data, ts: Date.now() });
  }

  function setPhaseRuntime(phase){
    phase.timeLeft = phase.timeTotal;
  }

  function beginPhase(index){
    state.phaseIndex = index;
    state.chosenIds = [];
    state.correct = 0;
    state.wrong = 0;
    state.specialDone = false;
    state.waitingNextPhase = false;

    const phase = getPhase();
    if(phase) setPhaseRuntime(phase);

    emitState();
  }

  function finishGame(reason='done'){
    if(state.ended) return;
    state.ended = true;

    const totalScore =
      (state.totalCorrect * 100) +
      (state.phaseResults.filter(x => x.specialDone).length * 120) -
      (state.totalWrong * 20);

    const starsAll = state.phaseResults.reduce((a,b)=> a + Number(b.stars || 0), 0);

    const playUrl = (() => {
      try{
        const u = new URL('./clean-kids.html', location.href);
        u.searchParams.set('kids', '1');
        u.searchParams.set('run', String(qs('run','play') || 'play'));
        u.searchParams.set('diff', 'kids');
        u.searchParams.set('seed', seedStr);
        u.searchParams.set('pid', String(qs('pid','anon') || 'anon'));
        const hub = String(qs('hub','') || '');
        if(hub) u.searchParams.set('hub', hub);
        ['view','log','api','studyId','phase','conditionGroup']
          .forEach(k=>{
            const v = String(qs(k,'') || '');
            if(v) u.searchParams.set(k, v);
          });
        return u.toString();
      }catch{
        return '';
      }
    })();

    const summary = {
      schema: 'hha_summary_v1',
      title: 'Clean Objects Kids',
      zone: 'hygiene',
      game: 'cleanobjects',
      mode: 'kids',
      run: runMode,
      pid: String(qs('pid','anon') || 'anon'),
      seed: seedStr,
      sessionId: state.cfg.sessionId,
      ts: nowIso(),
      score: totalScore,
      reason,
      metrics: {
        mode: 'K',
        phaseCount: state.phases.length,
        totalCorrect: state.totalCorrect,
        totalWrong: state.totalWrong,
        stars: starsAll,
        phaseResults: state.phaseResults.slice(0)
      },
      __extraJson: JSON.stringify({
        url: playUrl,
        track: 'kids',
        game: 'cleanobjects',
        mode: 'kids'
      })
    };

    try{
      hooks.onSummary && hooks.onSummary(summary);
    }catch(e){}
  }

  function finishPhase(phaseReason='done'){
    const phase = getPhase();
    if(!phase) return finishGame(phaseReason);

    const passed = state.correct >= phase.passNeed || (phase.phaseNo === 3 && state.correct >= Math.max(2, phase.passNeed - 1) && state.specialDone);
    const result = {
      phaseNo: phase.phaseNo,
      title: phase.title,
      correct: state.correct,
      wrong: state.wrong,
      specialDone: state.specialDone,
      passNeed: phase.passNeed,
      chosenIds: state.chosenIds.slice(0),
      goodIds: phase.goodIds.slice(0),
      specialId: phase.specialId || '',
      passed
    };
    result.stars = calcPhaseStars(result);

    state.phaseResults.push(result);
    state.totalCorrect += state.correct;
    state.totalWrong += state.wrong;
    state.totalStars += result.stars;

    emitEvt('hha:event', {
      type: 'kids_phase_end',
      game: 'cleanobjects',
      mode: 'kids',
      phaseNo: phase.phaseNo,
      passed,
      correct: state.correct,
      wrong: state.wrong,
      specialDone: state.specialDone,
      sessionId: state.cfg.sessionId,
      ts: nowIso()
    });

    if(!passed){
      return finishGame('phase_fail');
    }

    if(state.phaseIndex >= state.phases.length - 1){
      return finishGame('all_phases_clear');
    }

    state.waitingNextPhase = true;
    emitCoach('good', `ผ่าน ${phase.title} แล้ว! ไปต่อด่าน ${phase.phaseNo + 1}`, {
      phaseNo: phase.phaseNo,
      nextPhaseNo: phase.phaseNo + 1
    });
    emitState();

    setTimeout(()=>{
      if(state.ended) return;
      beginPhase(state.phaseIndex + 1);
      const next = getPhase();
      emitCoach('tip', `${next?.title || 'ด่านถัดไป'}: ${getMissionText(next)}`, {
        phaseNo: next?.phaseNo || 0
      });
    }, 1200);
  }

  function selectCard(id){
    if(state.ended) return { ok:false, reason:'ended' };
    if(state.waitingNextPhase) return { ok:false, reason:'wait_next_phase' };

    const phase = getPhase();
    if(!phase) return { ok:false, reason:'no_phase' };

    id = String(id || '');
    if(!id) return { ok:false, reason:'id' };
    if(state.chosenIds.includes(id)) return { ok:false, reason:'already' };
    if(state.chosenIds.length >= phase.maxPicks) return { ok:false, reason:'full' };

    state.chosenIds.push(id);

    const isGood = phase.goodIds.includes(id);
    const isSpecial = !!phase.specialId && phase.specialId === id;

    if(isGood){
      state.correct++;
      emitCoach('good', 'เก่งมาก! จุดนี้ควรเช็ดก่อน', { id, isGood:true, phaseNo: phase.phaseNo });
    }else{
      state.wrong++;
      emitCoach('warn', 'ลองดูของใช้ร่วม ก๊อกน้ำ หรือจุดที่คนจับบ่อยนะ', { id, isGood:false, phaseNo: phase.phaseNo });
    }

    if(isSpecial){
      state.specialDone = true;
      emitCoach('boss', 'ภารกิจพิเศษสำเร็จ! ได้ดาวโบนัส', { id, special:true, phaseNo: phase.phaseNo });
    }

    emitEvt('hha:event', {
      type: 'kids_pick',
      game: 'cleanobjects',
      mode: 'kids',
      ts: nowIso(),
      id,
      isGood,
      isSpecial,
      phaseNo: phase.phaseNo,
      sessionId: state.cfg.sessionId
    });

    emitState();

    if(state.chosenIds.length >= phase.maxPicks){
      finishPhase('maxpicks');
    }

    return { ok:true, isGood, isSpecial };
  }

  function start(){
    if(state.started) return;
    state.started = true;
    state.t0 = performance.now ? performance.now() : Date.now();
    state.lastMs = state.t0;
    state.elapsed = 0;

    state.phases.forEach(setPhaseRuntime);
    beginPhase(0);

    const phase = getPhase();
    emitCoach('tip', `${phase?.title || 'ด่าน 1'}: ${getMissionText(phase)}`, {});
  }

  function tick(){
    if(!state.started || state.ended || state.waitingNextPhase) return;

    const phase = getPhase();
    if(!phase) return;

    const now = performance.now ? performance.now() : Date.now();
    let dt = (now - state.lastMs) / 1000;
    state.lastMs = now;
    dt = clamp(dt, 0, 0.25);

    state.elapsed += dt;
    phase.timeLeft = Math.max(0, phase.timeLeft - dt);

    try{
      hooks.onTick && hooks.onTick(snapshot(), dt);
    }catch(e){}

    if(phase.timeLeft <= 0){
      finishPhase('timeup');
    }
  }

  return {
    cfg: state.cfg,
    start,
    tick,
    snapshot,
    selectCard
  };
}