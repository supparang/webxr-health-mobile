// === /herohealth/vr-clean/clean.kids.core.js ===
// Clean Objects — Kids Mode Core
// FINAL 4 PHASES / BOSS / CHILD-FRIENDLY
// PATCH v20260320-CLEAN-KIDS-CORE-FINAL-4PHASE-BOSS

'use strict';

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
function shuffleInPlace(arr, rng){
  for(let i=arr.length-1;i>0;i--){
    const j = Math.floor(rng() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

const CLEAN_KIDS_PHASE_POOLS = {
  phase1: {
    title: 'ด่าน 1 ห้องเรียน',
    theme: 'classroom',
    timeTotal: 18,
    passNeed: 2,
    maxPicks: 2,
    cards: [
      { id:'class-switch', kind:'good', kidLabel:'สวิตช์ไฟห้องเรียน', kidIcon:'💡' },
      { id:'class-tablet', kind:'good', kidLabel:'แท็บเล็ตห้องเรียน', kidIcon:'📱' },
      { id:'class-bag', kind:'decoy', kidLabel:'กระเป๋านักเรียน', kidIcon:'🎒' },
      { id:'class-pencil', kind:'decoy', kidLabel:'กล่องดินสอ', kidIcon:'✏️' }
    ]
  },

  phase2: {
    title: 'ด่าน 2 ของใช้ร่วม',
    theme: 'shared',
    timeTotal: 16,
    passNeed: 2,
    maxPicks: 3,
    cards: [
      { id:'shared-door', kind:'good', kidLabel:'ลูกบิดประตู', kidIcon:'🚪' },
      { id:'shared-remote', kind:'good', kidLabel:'รีโมทส่วนกลาง', kidIcon:'📺' },
      { id:'shared-rail', kind:'good', kidLabel:'ราวจับ', kidIcon:'🛗' },
      { id:'shared-book', kind:'decoy', kidLabel:'กองหนังสือ', kidIcon:'📚' },
      { id:'shared-apple', kind:'decoy', kidLabel:'แอปเปิล', kidIcon:'🍎' }
    ]
  },

  phase3: {
    title: 'ด่าน 3 ห้องน้ำ',
    theme: 'bathroom',
    timeTotal: 14,
    passNeed: 3,
    maxPicks: 3,
    cards: [
      { id:'bath-faucet', kind:'good', kidLabel:'ก๊อกน้ำ', kidIcon:'🚰' },
      { id:'bath-toilet', kind:'good', kidLabel:'ชักโครก', kidIcon:'🚽' },
      { id:'bath-soap', kind:'good', kidLabel:'ที่กดสบู่', kidIcon:'🧴' },
      { id:'bath-trash', kind:'decoy', kidLabel:'ฝาถังขยะ', kidIcon:'🗑️' },
      { id:'bath-mirror', kind:'decoy', kidLabel:'ขอบกระจก', kidIcon:'🪞' },
      { id:'bath-flush', kind:'special', kidLabel:'ภารกิจพิเศษ: ที่กดชักโครก', kidIcon:'🌟' }
    ]
  },

  phase4: {
    title: 'ด่าน 4 Boss Mission',
    theme: 'boss',
    timeTotal: 12,
    passNeed: 3,
    maxPicks: 3,
    cards: [
      { id:'boss-door', kind:'good', kidLabel:'จุดระบาด: ลูกบิดประตู', kidIcon:'🚪' },
      { id:'boss-faucet', kind:'good', kidLabel:'จุดระบาด: ก๊อกน้ำ', kidIcon:'🚰' },
      { id:'boss-toilet', kind:'good', kidLabel:'จุดระบาด: ชักโครก', kidIcon:'🚽' },
      { id:'boss-remote', kind:'decoy', kidLabel:'รีโมทส่วนกลาง', kidIcon:'📺' },
      { id:'boss-book', kind:'decoy', kidLabel:'กองหนังสือ', kidIcon:'📚' },
      { id:'boss-bag', kind:'decoy', kidLabel:'กระเป๋านักเรียน', kidIcon:'🎒' },
      { id:'boss-core', kind:'boss', kidLabel:'BOSS: หยุดการระบาด', kidIcon:'👾' }
    ]
  }
};

function getThemeNameByPhase(phaseNo){
  phaseNo = Number(phaseNo || 1);
  if(phaseNo === 1) return 'classroom';
  if(phaseNo === 2) return 'shared';
  if(phaseNo === 3) return 'bathroom';
  return 'boss';
}

function getMissionText(phase){
  if(!phase) return '';
  if(phase.phaseNo === 1) return 'ห้องเรียน: เลือกจุดที่ควรเช็ดก่อน';
  if(phase.phaseNo === 2) return 'ของใช้ร่วม: มองหาจุดที่หลายคนจับ';
  if(phase.phaseNo === 3) return 'ห้องน้ำ: จุดเสี่ยงสูง และมีภารกิจพิเศษ';
  return 'Boss Mission: เลือก 3 จุดสำคัญเพื่อหยุดการระบาด';
}

function themedFeedback(phaseNo, kind, extra={}){
  const theme = getThemeNameByPhase(phaseNo);

  if(kind === 'boss_clear'){
    return 'สุดยอด! หยุดการระบาดสำเร็จแล้ว 🏆';
  }

  if(extra.special){
    if(theme === 'bathroom') return 'เยี่ยมมาก! ภารกิจพิเศษในห้องน้ำสำเร็จแล้ว ⭐';
    if(theme === 'boss') return 'เยี่ยมมาก! เข้าใกล้การหยุดบอสแล้ว ⭐';
    return 'เยี่ยมมาก! ทำภารกิจพิเศษสำเร็จ ⭐';
  }

  if(kind === 'good'){
    if(theme === 'classroom') return 'ดีมาก! จุดนี้เด็กใช้บ่อย ควรเช็ดก่อน';
    if(theme === 'shared') return 'ใช่เลย! จุดนี้หลายคนจับร่วมกัน';
    if(theme === 'bathroom') return 'ถูกต้อง! จุดนี้ในห้องน้ำเสี่ยงสูง';
    return 'เยี่ยมมาก! จุดนี้สำคัญต่อการหยุดการระบาด';
  }

  if(kind === 'warn'){
    if(theme === 'classroom') return 'ลองใหม่ มองหาจุดที่จับบ่อยในห้องเรียน';
    if(theme === 'shared') return 'ลองอีกที มองหาของที่หลายคนใช้ร่วมกัน';
    if(theme === 'bathroom') return 'ลองอีกครั้ง มองหาจุดเสี่ยงในห้องน้ำ';
    return 'ลองอีกที เลือกจุดที่เสี่ยงที่สุดก่อน';
  }

  if(kind === 'start'){
    if(theme === 'classroom') return 'เริ่มด่านห้องเรียน แตะจุดที่ควรเช็ดก่อน';
    if(theme === 'shared') return 'เริ่มด่านของใช้ร่วม มองหาจุดที่หลายคนจับ';
    if(theme === 'bathroom') return 'เริ่มด่านห้องน้ำ มองหาจุดเสี่ยงสูงและภารกิจพิเศษ';
    return 'Boss Mission เริ่มแล้ว! เลือก 3 จุดหลักเพื่อหยุดการระบาด';
  }

  if(kind === 'clear'){
    if(theme === 'classroom') return 'ผ่านด่านห้องเรียนแล้ว! เก่งมาก';
    if(theme === 'shared') return 'ผ่านด่านของใช้ร่วมแล้ว! เยี่ยมมาก';
    if(theme === 'bathroom') return 'ผ่านด่านห้องน้ำแล้ว! สุดยอด';
    return 'ผ่าน Boss Mission แล้ว! เก่งมากจริง ๆ';
  }

  return 'เก่งมาก!';
}

function buildPhaseFromCurated(def, phaseNo, rng){
  const cards = (def.cards || []).map(x => ({ ...x }));
  shuffleInPlace(cards, rng);

  return {
    id: `phase-${phaseNo}`,
    phaseNo,
    title: def.title,
    theme: def.theme,
    timeTotal: def.timeTotal,
    timeLeft: def.timeTotal,
    passNeed: def.passNeed,
    maxPicks: def.maxPicks,
    cards,
    goodIds: cards.filter(x => x.kind === 'good').map(x => String(x.id)),
    specialId: (cards.find(x => x.kind === 'special') || {}).id || '',
    bossId: (cards.find(x => x.kind === 'boss') || {}).id || ''
  };
}

function buildFourPhases(rng){
  const p1 = buildPhaseFromCurated(CLEAN_KIDS_PHASE_POOLS.phase1, 1, rng);
  const p2 = buildPhaseFromCurated(CLEAN_KIDS_PHASE_POOLS.phase2, 2, rng);
  const p3 = buildPhaseFromCurated(CLEAN_KIDS_PHASE_POOLS.phase3, 3, rng);
  const p4 = buildPhaseFromCurated(CLEAN_KIDS_PHASE_POOLS.phase4, 4, rng);
  return [p1, p2, p3, p4];
}

export function createCleanKidsCore(cfg={}, hooks={}){
  const runMode = String(qs('run', cfg.run || 'play') || 'play');
  const seedStr = String(qs('seed', cfg.seed || String(Date.now())) || Date.now());
  const view = normalizeView(qs('view', cfg.view || ''));
  const rng = makeRng(seedStr + '::cleankids::final4phase');

  const phases = buildFourPhases(rng);

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

    phaseIndex: 0,
    phases,

    chosenIds: [],
    correct: 0,
    wrong: 0,
    specialDone: false,
    bossClear: false,

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
    const bossClear = !!phaseResult.bossClear;
    const passNeed = Number(phaseResult.passNeed || 1);
    const phaseNo = Number(phaseResult.phaseNo || 1);

    let stars = 0;
    if(c >= Math.max(1, passNeed - 1)) stars = 1;
    if(c >= passNeed) stars = 2;

    if(phaseNo < 3){
      if(c >= passNeed && w === 0) stars = 3;
    } else if(phaseNo === 3){
      if(c >= passNeed && specialDone && w <= 1) stars = 3;
    } else {
      if(c >= passNeed && bossClear && w <= 1) stars = 4;
      else if(c >= passNeed && w <= 1) stars = 3;
    }

    return stars;
  }

  function calcCurrentPhaseStars(){
    const phase = getPhase();
    if(!phase) return 0;
    return calcPhaseStars({
      phaseNo: phase.phaseNo,
      correct: state.correct,
      wrong: state.wrong,
      specialDone: state.specialDone,
      bossClear: state.bossClear,
      passNeed: phase.passNeed
    });
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

      phaseIndex: state.phaseIndex,
      phaseNo: phase ? phase.phaseNo : 0,
      phaseTotal: state.phases.length,
      phaseTitle: phase ? phase.title : '',
      phaseText: getMissionText(phase),

      cards: phase ? phase.cards.slice(0) : [],
      goodIds: phase ? phase.goodIds.slice(0) : [],
      specialId: phase ? phase.specialId : '',
      bossId: phase ? phase.bossId : '',
      chosenIds: state.chosenIds.slice(0),

      correct: state.correct,
      wrong: state.wrong,
      specialDone: state.specialDone,
      bossClear: state.bossClear,
      maxPicks: phase ? phase.maxPicks : 0,
      stars: calcCurrentPhaseStars(),

      totalCorrect: state.totalCorrect,
      totalWrong: state.totalWrong,
      totalStars: state.totalStars,
      phaseResults: state.phaseResults.slice(0)
    };
  }

  function emitState(){
    try{
      hooks.onState && hooks.onState(snapshot());
    }catch(e){}
  }

  function emitCoach(kind, text, data={}){
    try{
      hooks.onCoach && hooks.onCoach({ kind, text, data, ts: Date.now() });
    }catch(e){}
    emitEvt('hha:coach', { game:'cleanobjects-kids', kind, text, data, ts: Date.now() });
  }

  function beginPhase(index){
    state.phaseIndex = index;
    state.chosenIds = [];
    state.correct = 0;
    state.wrong = 0;
    state.specialDone = false;
    state.bossClear = false;
    state.waitingNextPhase = false;

    const phase = getPhase();
    if(phase){
      phase.timeLeft = phase.timeTotal;
    }

    emitEvt('hha:event', {
      type: 'kids_phase_start',
      game: 'cleanobjects',
      mode: 'kids',
      phaseNo: phase?.phaseNo || 0,
      title: phase?.title || '',
      sessionId: state.cfg.sessionId,
      ts: nowIso()
    });

    emitState();

    const current = getPhase();
    emitCoach('tip', themedFeedback(current?.phaseNo || 1, 'start'), {
      phaseNo: current?.phaseNo || 1
    });
  }

  function finishGame(reason='done'){
    if(state.ended) return;
    state.ended = true;

    const totalScore = state.phaseResults.reduce((sum, r) => {
      const base =
        (Number(r.correct || 0) * 100) -
        (Number(r.wrong || 0) * 20) +
        (Number(r.stars || 0) * 30);

      let bonus = 0;
      if(r.phaseNo === 3){
        bonus = (r.specialDone ? 120 : 0) + (r.passed ? 60 : 0);
      } else if(r.phaseNo === 4){
        bonus = (r.bossClear ? 180 : 0) + (r.passed ? 100 : 0);
      } else {
        bonus = r.passed ? 40 : 0;
      }

      return sum + base + bonus;
    }, 0);

    const totalStars = state.phaseResults.reduce((a,b)=> a + Number(b.stars || 0), 0);

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
        stars: totalStars,
        bossClear: !!state.phaseResults.find(x => x.phaseNo === 4 && x.bossClear),
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

    if(state.waitingNextPhase || state.ended) return;

    const passed =
      (state.correct >= phase.passNeed) ||
      (phase.phaseNo === 3 && state.correct >= 2 && state.specialDone) ||
      (phase.phaseNo === 4 && state.correct >= 2 && state.bossClear);

    const result = {
      phaseNo: phase.phaseNo,
      title: phase.title,
      correct: state.correct,
      wrong: state.wrong,
      specialDone: state.specialDone,
      bossClear: state.bossClear,
      passNeed: phase.passNeed,
      chosenIds: state.chosenIds.slice(0),
      goodIds: phase.goodIds.slice(0),
      specialId: phase.specialId || '',
      bossId: phase.bossId || '',
      passed,
      reason: String(phaseReason || 'done')
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
      bossClear: state.bossClear,
      reason: String(phaseReason || 'done'),
      sessionId: state.cfg.sessionId,
      ts: nowIso()
    });

    if(!passed){
      return finishGame('phase_fail');
    }

    if(state.phaseIndex >= state.phases.length - 1){
      if(phase.phaseNo === 4 && state.bossClear){
        emitCoach('boss', themedFeedback(4, 'boss_clear'), { phaseNo: 4 });
      } else {
        emitCoach('good', themedFeedback(phase.phaseNo, 'clear'), { phaseNo: phase.phaseNo });
      }
      return finishGame('all_phases_clear');
    }

    state.waitingNextPhase = true;

    emitCoach('good', themedFeedback(phase.phaseNo, 'clear'), {
      phaseNo: phase.phaseNo,
      nextPhaseNo: phase.phaseNo + 1
    });

    emitState();

    setTimeout(()=>{
      if(state.ended) return;
      beginPhase(state.phaseIndex + 1);
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

    const pickedCard = (phase.cards || []).find(x => String(x.id) === id);
    const isGood = !!pickedCard && pickedCard.kind === 'good';
    const isSpecial = !!pickedCard && pickedCard.kind === 'special';
    const isBoss = !!pickedCard && pickedCard.kind === 'boss';

    if(isGood){
      state.correct++;
      emitCoach('good', themedFeedback(phase.phaseNo, 'good'), {
        id,
        isGood: true,
        phaseNo: phase.phaseNo
      });
    } else if(isBoss){
      state.bossClear = true;
      emitCoach('boss', 'เยี่ยมมาก! เจอหัวใจของการระบาดแล้ว 👾', {
        id,
        isBoss: true,
        phaseNo: phase.phaseNo
      });
    } else {
      state.wrong++;
      emitCoach('warn', themedFeedback(phase.phaseNo, 'warn'), {
        id,
        isGood: false,
        phaseNo: phase.phaseNo
      });
    }

    if(isSpecial){
      state.specialDone = true;
      emitCoach('boss', themedFeedback(phase.phaseNo, 'boss', { special:true }), {
        id,
        special: true,
        phaseNo: phase.phaseNo
      });

      emitEvt('hha:event', {
        type: 'kids_special_clear',
        game: 'cleanobjects',
        mode: 'kids',
        ts: nowIso(),
        id,
        phaseNo: phase.phaseNo,
        sessionId: state.cfg.sessionId
      });
    }

    if(isBoss){
      emitEvt('hha:event', {
        type: 'kids_boss_clear',
        game: 'cleanobjects',
        mode: 'kids',
        ts: nowIso(),
        id,
        phaseNo: phase.phaseNo,
        sessionId: state.cfg.sessionId
      });
    }

    emitEvt('hha:event', {
      type: 'kids_pick',
      game: 'cleanobjects',
      mode: 'kids',
      ts: nowIso(),
      id,
      isGood,
      isSpecial,
      isBoss,
      phaseNo: phase.phaseNo,
      sessionId: state.cfg.sessionId
    });

    emitState();

    const passedEarly =
      (state.correct >= phase.passNeed) ||
      (phase.phaseNo === 3 && state.correct >= 2 && state.specialDone) ||
      (phase.phaseNo === 4 && state.correct >= 2 && state.bossClear);

    if(passedEarly){
      setTimeout(()=>{
        finishPhase('pass_early');
      }, 250);
      return { ok:true, isGood, isSpecial, isBoss };
    }

    const remainNeed = Math.max(0, phase.passNeed - state.correct);
    const remainPick = Math.max(0, phase.maxPicks - state.chosenIds.length);

    if(remainNeed > 0 && remainPick > 0){
      emitCoach('tip', `เหลืออีก ${remainNeed} จุด`, {
        phaseNo: phase.phaseNo,
        remainNeed,
        remainPick
      });
    }

    if(state.chosenIds.length >= phase.maxPicks){
      setTimeout(()=>{
        finishPhase('maxpicks');
      }, 250);
    }

    return { ok:true, isGood, isSpecial, isBoss };
  }

  function start(){
    if(state.started) return;

    state.started = true;
    state.ended = false;
    state.waitingNextPhase = false;

    state.t0 = performance.now ? performance.now() : Date.now();
    state.lastMs = state.t0;
    state.elapsed = 0;

    emitEvt('hha:event', {
      type: 'kids_session_start',
      game: 'cleanobjects',
      mode: 'kids',
      phaseCount: state.phases.length,
      pid: String(qs('pid','anon') || 'anon'),
      sessionId: state.cfg.sessionId,
      ts: nowIso()
    });

    beginPhase(0);
  }

  function tick(){
    if(!state.started || state.ended) return;
    if(state.waitingNextPhase) return;

    const phase = getPhase();
    if(!phase) return;

    const now = performance.now ? performance.now() : Date.now();
    let dt = (now - state.lastMs) / 1000;
    state.lastMs = now;
    dt = clamp(dt, 0, 0.25);

    state.elapsed += dt;
    phase.timeLeft = Math.max(0, Number(phase.timeLeft || 0) - dt);

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

export default createCleanKidsCore;