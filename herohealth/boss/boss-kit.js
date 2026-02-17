// === /herohealth/boss/boss-kit.js — Universal Boss Kit (deterministic) v20260217a ===
'use strict';

function strToSeed(s){
  const str = String(s||'');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

const PRESETS = ['classic','memory','twin','trickster'];
const SKILLS  = ['reverse','combo_lock','stamina_drain','fake_callout'];

function pickPreset(ctx){
  const cg = String(ctx.conditionGroup||'').toLowerCase();
  if (PRESETS.includes(cg)) return cg;

  // mixed / mix: deterministic from pid+study+phase+seed
  if (cg === 'mix' || cg === 'mixed'){
    const base = `${ctx.pid||ctx.studentKey||''}|${ctx.studyId||''}|${ctx.phase||''}|${ctx.seed||''}|preset`;
    const h = strToSeed(base);
    return PRESETS[h % PRESETS.length];
  }
  // default: seed-based
  const h2 = strToSeed(String(ctx.seed||Date.now()));
  return PRESETS[h2 % PRESETS.length];
}
function pickSkill(ctx){
  const base = `${ctx.pid||ctx.studentKey||''}|${ctx.studyId||''}|${ctx.phase||''}|${ctx.seed||''}|skill`;
  const h = strToSeed(base);
  return SKILLS[h % SKILLS.length];
}
function skillLabel(k){
  if (k==='reverse') return 'Reverse';
  if (k==='combo_lock') return 'ComboLock';
  if (k==='stamina_drain') return 'Drain';
  if (k==='fake_callout') return 'Fake';
  return '—';
}

function buildSeq(rng, preset, len){
  const patterns = (preset==='trickster')
    ? ['random','random','abab','aab','mirror','stair']
    : ['abab','aab','mirror','stair','random'];

  const p = patterns[Math.floor(rng()*patterns.length)];
  const a = (rng()<0.5) ? 'A' : 'B';
  const b = (a==='A') ? 'B' : 'A';

  const seq = [];
  if (p === 'abab'){
    for (let i=0;i<len;i++) seq.push(i%2===0?a:b);
  } else if (p === 'aab'){
    for (let i=0;i<len;i++) seq.push((i%3===2)?b:a);
  } else if (p === 'stair'){
    for (let i=0;i<len;i++){
      const block = Math.floor(i/2);
      seq.push(block%2===0?a:b);
    }
  } else {
    let last=null, streak=0;
    for (let i=0;i<len;i++){
      let n = (rng()<0.5)?'A':'B';
      if (n===last){ streak++; if (streak>=2) n=(n==='A')?'B':'A'; }
      else streak=0;
      seq.push(n); last=n;
    }
  }

  // trickster: flip 1 item (feint)
  if (preset==='trickster' && seq.length>=6){
    const i = 3 + Math.floor(rng()*Math.max(1, seq.length-4));
    seq[i] = (seq[i]==='A') ? 'B' : 'A';
  }
  // twin: duplicate 1 element
  if (preset==='twin' && seq.length>=5){
    const i = 2 + Math.floor(rng()*Math.max(1, seq.length-3));
    seq.splice(i, 0, seq[i]);
  }

  return { pattern:p, seq };
}

/**
 * createBossKit
 * - ctx: { pid/studentKey, studyId, phase, conditionGroup, seed }
 * - rng: function() -> [0,1)
 * - mode: training/test/research
 * - diff: easy/normal/hard
 * - emitEvent(type, extraObj)
 * - spawnPattern(seqAB, meta)  // seqAB: ['A','B',...]
 * - showTele(on:boolean, text?)
 * - showToast(text, kind?)
 * - onEnd(reason)
 */
export function createBossKit(opts={}){
  const ctx = opts.ctx || {};
  const baseSeed = strToSeed(`${ctx.pid||ctx.studentKey||''}|${ctx.studyId||''}|${ctx.phase||''}|${ctx.seed||''}|bosskit`);
  const rng = opts.rng || mulberry32(baseSeed);

  const preset = pickPreset(ctx);
  const skill  = pickSkill(ctx);

  // core tunables
  const HP_MAX = 100;
  const dmgHit = 6;
  const dmgPerfect = 9;

  const burstBaseMs = 5200;
  const tempoBaseMs = 4200;

  const state = {
    preset, skill,
    alive:false,
    hp:HP_MAX,
    nextBurstAt:0,
    nextTempoAt:0,
    nextSkillAt:0,
    skillUntil:0,
    reverseOn:false,
    fakeArmed:false,

    shieldNeed:0,
    shieldStreak:0,
  };

  function enter(t){
    state.alive = true;
    state.hp = HP_MAX;
    state.nextBurstAt = t + 1200;
    state.nextTempoAt = t + 1400;
    state.nextSkillAt = t + 1800;
    state.skillUntil  = 0;
    state.reverseOn = false;
    state.fakeArmed = false;
    state.shieldNeed = 0;
    state.shieldStreak = 0;

    opts.emitEvent?.('boss_enter', { preset, skill, hp: state.hp });
    opts.showToast?.(`⚡ BOSS! preset=${preset} skill=${skillLabel(skill)}`, 'combo');
    opts.showTele?.(true, 'BOSS!');
    setTimeout(()=> opts.showTele?.(false), 650);
  }

  function applySkill(t){
    if (t >= state.nextSkillAt){
      state.nextSkillAt = t + 5200 + (rng()*900 - 300);
      state.skillUntil  = t + 1800 + (rng()*600);

      if (skill === 'reverse'){
        state.reverseOn = true;
        opts.showToast?.('🌀 REVERSE!', 'combo');
        opts.emitEvent?.('skill_on', { skill:'reverse' });
      } else if (skill === 'combo_lock'){
        opts.showToast?.('🔒 COMBO LOCK!', 'combo');
        opts.emitEvent?.('skill_on', { skill:'combo_lock' });
      } else if (skill === 'stamina_drain'){
        opts.showToast?.('🧪 DRAIN!', 'combo');
        opts.emitEvent?.('skill_on', { skill:'stamina_drain' });
      } else if (skill === 'fake_callout'){
        state.fakeArmed = true;
        opts.showToast?.('🎭 FAKE!', 'combo');
        opts.emitEvent?.('skill_on', { skill:'fake_callout' });
      }
      opts.showTele?.(true, 'SKILL!');
      setTimeout(()=> opts.showTele?.(false), 600);
    }

    if (state.skillUntil && t >= state.skillUntil){
      if (state.reverseOn){
        state.reverseOn = false;
        opts.emitEvent?.('skill_off', { skill:'reverse' });
      }
      state.skillUntil = 0;
    }
  }

  function burst(t){
    // length by preset+diff+mode
    let len = 6;
    if (preset==='memory') len += 1;
    if (preset==='twin')   len += 2;
    if (preset==='trickster') len += 2;

    const diff = String(opts.diff||'normal').toLowerCase();
    if (diff==='hard') len += 1;
    if (diff==='easy') len -= 1;

    len = clamp(len, 5, 9);
    const mode = String(opts.mode||'training').toLowerCase();
    if (mode==='test' || mode==='research') len = Math.min(len, 7);

    const built = buildSeq(rng, preset, len);
    const meta = { preset, skill, pattern: built.pattern, len: built.seq.length };
    opts.emitEvent?.('boss_burst', meta);
    opts.showTele?.(true, 'RHYTHM!');
    setTimeout(()=> opts.showTele?.(false), 650);
    opts.spawnPattern?.(built.seq.slice(), meta);
  }

  function tick(t, progress){
    // phase3-only: caller decides when to activate (usually progress >= 0.70)
    if (!state.alive) enter(t);

    applySkill(t);

    if (t >= state.nextTempoAt){
      state.nextTempoAt = t + tempoBaseMs + (rng()*450 - 200);
      opts.emitEvent?.('boss_tempo', { preset });
      opts.showTele?.(true, 'TEMPO SHIFT');
      setTimeout(()=> opts.showTele?.(false), 600);
    }

    if (t >= state.nextBurstAt){
      state.nextBurstAt = t + burstBaseMs + (rng()*600 - 240);
      burst(t);
    }

    // shield gate at hp <= 55
    if (state.hp <= 55 && state.shieldNeed === 0){
      state.shieldNeed = 6;
      state.shieldStreak = 0;
      opts.emitEvent?.('boss_shield_start', { need:6 });
      opts.showToast?.('🛡️ SHIELD! ถูกติดกัน 6 ครั้ง!', 'combo');
    }

    if (state.hp <= 0){
      state.hp = 0;
      state.alive = false;
      opts.emitEvent?.('boss_down', { preset });
      opts.showToast?.('🏆 BOSS DOWN!', 'combo');
      opts.onEnd?.('boss-down');
    }
  }

  function onHit({ perfect=false, combo=0, fever=false }={}){
    if (!state.alive) return;

    let dmg = perfect ? dmgPerfect : dmgHit;
    if (fever) dmg *= 1.2;
    state.hp = Math.max(0, state.hp - dmg);

    if (state.shieldNeed > 0){
      state.shieldStreak++;
      if (state.shieldStreak >= state.shieldNeed){
        state.shieldNeed = 0;
        state.shieldStreak = 0;
        state.hp = Math.max(0, state.hp - 14);
        opts.emitEvent?.('boss_shield_break', {});
        opts.showToast?.('💥 SHIELD BREAK!', 'combo');
      }
    }
  }

  function onMiss(){
    if (!state.alive) return;
    if (state.shieldNeed > 0) state.shieldStreak = 0;
  }

  function mapNeed(need){
    // need can be 'A'/'B' or game semantic; reverse flips A<->B
    if (!state.reverseOn) return need;
    if (need==='A') return 'B';
    if (need==='B') return 'A';
    return need;
  }

  function consumeFake(){
    if (skill !== 'fake_callout') return false;
    if (!state.fakeArmed) return false;
    state.fakeArmed = false;
    opts.emitEvent?.('skill_fake_used', {});
    return true;
  }

  function getHUD(){
    return {
      preset,
      skill,
      skillLabel: skillLabel(skill),
      hp: state.hp,
      reverseOn: !!state.reverseOn,
      shieldNeed: state.shieldNeed,
      shieldStreak: state.shieldStreak
    };
  }

  return { tick, onHit, onMiss, mapNeed, consumeFake, getHUD };
}