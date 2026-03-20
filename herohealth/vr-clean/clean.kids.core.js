// === /herohealth/vr-clean/clean.kids.core.js ===
// Clean Objects — Kids Mode Core
// CHILD-FRIENDLY for Grade 5
// PATCH v20260320-CLEAN-KIDS-CORE-r1

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

  if(zone.includes('shared')) return '🤝';
  if(zone.includes('wet')) return '💧';
  if(zone.includes('entry')) return '🚪';

  return '🧽';
}

function buildRoundSet(hotspots, rng){
  const ranked = rankHotspotsByValue(hotspots);
  const top = ranked.slice(0, 6);

  const mustGood = top.slice(0, 2);
  const maybeGood = top.slice(2, 4);
  const lower = ranked.slice(4);

  const good = mustGood.slice(0);
  if(maybeGood.length){
    good.push(maybeGood[Math.floor(rng() * maybeGood.length)]);
  }

  const decoys = [];
  for(const h of lower){
    if(decoys.length >= 1) break;
    if(!good.find(x => x.id === h.id)) decoys.push(h);
  }

  const specialChance = rng();
  let special = null;
  if(specialChance < 0.7){
    const pool = top.filter(h => !good.find(x => x.id === h.id));
    if(pool.length){
      special = pool[Math.floor(rng() * pool.length)];
    }
  }

  const cards = [...good, ...decoys];
  if(special && !cards.find(x => x.id === special.id)) cards.push(special);

  cards.sort(()=> rng() - 0.5);

  return {
    cards,
    goodIds: good.map(h => h.id),
    specialId: special ? special.id : '',
  };
}

export function createCleanKidsCore(cfg={}, hooks={}){
  const runMode = String(qs('run', cfg.run || 'play') || 'play');
  const seedStr = String(qs('seed', cfg.seed || String(Date.now())) || Date.now());
  const view = normalizeView(qs('view', cfg.view || ''));
  const timeStd = clamp(qs('time', cfg.time ?? 30), 20, 60);
  const maxPicks = clamp(qs('maxPicks', cfg.maxPicks ?? 3), 2, 4);

  const rng = makeRng(seedStr + '::cleankids');
  const source = (HOTSPOTS || []).map(h => ({ ...h }));
  const round = buildRoundSet(source, rng);

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
    t0: 0,
    lastMs: 0,
    elapsed: 0,
    timeTotal: timeStd,
    timeLeft: timeStd,
    map: MAP,

    cards: round.cards.map(h => ({
      ...h,
      kidLabel: makeKidLabel(h),
      kidIcon: makeKidIcon(h)
    })),
    goodIds: round.goodIds.slice(0),
    specialId: round.specialId || '',
    chosenIds: [],
    correct: 0,
    wrong: 0,
    specialDone: false,
    maxPicks
  };

  function emitState(){
    try{
      hooks.onState && hooks.onState(snapshot());
    }catch(e){}
  }

  function snapshot(){
    return {
      started: state.started,
      ended: state.ended,
      elapsedSec: state.elapsed,
      timeTotal: state.timeTotal,
      timeLeft: state.timeLeft,

      cards: state.cards.slice(0),
      goodIds: state.goodIds.slice(0),
      specialId: state.specialId,
      chosenIds: state.chosenIds.slice(0),

      correct: state.correct,
      wrong: state.wrong,
      specialDone: state.specialDone,
      maxPicks: state.maxPicks,

      stars: calcStars(),
      phaseText: state.specialId ? 'ภารกิจพิเศษอาจมา!' : 'เลือกจุดที่ควรเช็ดก่อน'
    };
  }

  function calcStars(){
    let stars = 0;
    if(state.correct >= 1) stars = 1;
    if(state.correct >= 2) stars = 2;
    if(state.specialDone || state.correct >= 3) stars = 3;
    return stars;
  }

  function emitCoach(kind, text, data={}){
    try{
      hooks.onCoach && hooks.onCoach({ kind, text, data, ts: Date.now() });
    }catch(e){}
    emitEvt('hha:coach', { game:'cleanobjects-kids', kind, text, data, ts: Date.now() });
  }

  function finish(reason='done'){
    if(state.ended) return;
    state.ended = true;

    const stars = calcStars();
    const score =
      (state.correct * 100) +
      (state.specialDone ? 120 : 0) -
      (state.wrong * 20);

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
      score,
      reason,
      metrics: {
        mode: 'K',
        correct: state.correct,
        wrong: state.wrong,
        stars,
        specialDone: state.specialDone,
        chosenIds: state.chosenIds.slice(0),
        goodIds: state.goodIds.slice(0),
        specialId: state.specialId || ''
      }
    };

    try{
      hooks.onSummary && hooks.onSummary(summary);
    }catch(e){}
  }

  function selectCard(id){
    if(state.ended) return { ok:false, reason:'ended' };
    id = String(id || '');
    if(!id) return { ok:false, reason:'id' };
    if(state.chosenIds.includes(id)) return { ok:false, reason:'already' };
    if(state.chosenIds.length >= state.maxPicks) return { ok:false, reason:'full' };

    state.chosenIds.push(id);

    const isGood = state.goodIds.includes(id);
    const isSpecial = !!state.specialId && state.specialId === id;

    if(isGood){
      state.correct++;
      emitCoach('good', 'เก่งมาก! จุดนี้ควรเช็ดก่อน', { id, isGood:true });
    }else{
      state.wrong++;
      emitCoach('warn', 'ลองดูจุดสีแดงหรือของใช้ร่วมก่อนนะ', { id, isGood:false });
    }

    if(isSpecial){
      state.specialDone = true;
      emitCoach('boss', 'ภารกิจพิเศษสำเร็จ! ได้ดาวโบนัส', { id, special:true });
    }

    emitEvt('hha:event', {
      type: 'kids_pick',
      game: 'cleanobjects',
      mode: 'kids',
      ts: nowIso(),
      id,
      isGood,
      isSpecial,
      sessionId: state.cfg.sessionId
    });

    emitState();

    if(state.chosenIds.length >= state.maxPicks){
      finish('maxpicks');
    }

    return { ok:true, isGood, isSpecial };
  }

  function start(){
    if(state.started) return;
    state.started = true;
    state.t0 = performance.now ? performance.now() : Date.now();
    state.lastMs = state.t0;
    state.elapsed = 0;

    emitCoach('tip', 'แตะจุดที่ควรเช็ดก่อนให้ครบ 3 ครั้ง', {});
    emitState();
  }

  function tick(){
    if(!state.started || state.ended) return;

    const now = performance.now ? performance.now() : Date.now();
    let dt = (now - state.lastMs) / 1000;
    state.lastMs = now;
    dt = clamp(dt, 0, 0.25);

    state.elapsed += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);

    try{
      hooks.onTick && hooks.onTick(snapshot(), dt);
    }catch(e){}

    if(state.timeLeft <= 0){
      finish('timeup');
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