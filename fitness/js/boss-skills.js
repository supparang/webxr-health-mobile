// === /fitness/js/boss-skills.js ===
// Boss Skills + Telegraph for Shadow Breaker — PATCH F
// ✅ deterministic-ish scheduling (no heavy RNG dependence)
// ✅ telegraph events: onTelegraph({name,ms,kind})
// ✅ skill fire callbacks: spawnFn({type, count, sizeMul, ttlMul, tag})
// ✅ difficulty/phase scaled

'use strict';

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

export class BossSkills {
  constructor(opts = {}){
    this.onTelegraph = typeof opts.onTelegraph === 'function' ? opts.onTelegraph : ()=>{};
    this.onFire = typeof opts.onFire === 'function' ? opts.onFire : ()=>{};
    this._t = 0;
    this._nextAt = 0;
    this._cooldownMs = 5200;
    this._enabled = true;
    this._lastSkill = '';
  }

  reset(){
    this._t = 0;
    this._nextAt = 2400;
    this._lastSkill = '';
  }

  setEnabled(v){ this._enabled = !!v; }

  // call every tick with elapsedMs
  tick(elapsedMs, ctx){
    if(!this._enabled) return;
    this._t = elapsedMs;

    // ctx: { diffKey, phase, bossIndex, feverOn, youHpPct, bossHpPct }
    const phase = clamp(ctx.phase||1, 1, 6);
    const diff = (ctx.diffKey||'normal');
    const bossIndex = clamp(ctx.bossIndex||0, 0, 9);

    // base cadence
    let baseCd = 5200;
    if(diff === 'easy') baseCd = 5900;
    if(diff === 'hard') baseCd = 4600;

    // phase makes faster
    baseCd = baseCd * clamp(1 - (phase-1)*0.06, 0.78, 1.0);

    // boss low -> more pressure
    const bossHpPct = clamp(ctx.bossHpPct ?? 1, 0, 1);
    if(bossHpPct < 0.35) baseCd *= 0.90;
    if(bossHpPct < 0.20) baseCd *= 0.88;

    this._cooldownMs = clamp(baseCd, 2800, 7800);

    if(this._t < this._nextAt) return;

    // decide skill by bossIndex (gives each boss identity) + phase pressure
    // avoid repeating same skill twice
    const pick = this._pickSkill(bossIndex, phase, diff, this._lastSkill);
    this._lastSkill = pick.name;

    // telegraph duration depends on skill
    const teleMs = pick.teleMs;

    this.onTelegraph({ name: pick.name, ms: teleMs, kind: pick.kind });

    const fireAt = this._t + teleMs;
    const nextAt = this._t + this._cooldownMs + 250; // after fire

    // schedule fire using setTimeout (engine runs in browser)
    setTimeout(()=>{
      this.onFire(pick.firePayload(phase, diff));
    }, teleMs);

    this._nextAt = nextAt;
  }

  _pickSkill(bossIndex, phase, diff, last){
    // weighted by boss personality
    const isHard = diff === 'hard';
    const p = clamp((phase-1)/3, 0, 1);

    const skillPool = [];

    // Skill A: Meteor Rain (bomb wave) — scary, obvious telegraph
    skillPool.push({
      name:'Meteor Rain',
      kind:'danger',
      teleMs: isHard ? 780 : 920,
      w: 1.0 + 0.6*p + (bossIndex===1 ? 0.9 : 0),
      firePayload: (ph,d)=>({
        tag:'meteor',
        burst: 1,
        plan: [
          { type:'bomb', count: clamp(3 + ph, 3, 9), sizeMul: 1.02, ttlMul: 0.95 },
          { type:'decoy', count: clamp(1 + Math.floor(ph/2), 1, 4), sizeMul: 0.95, ttlMul: 1.0 }
        ]
      })
    });

    // Skill B: Decoy Swarm — tricksters
    skillPool.push({
      name:'Decoy Swarm',
      kind:'trick',
      teleMs: isHard ? 680 : 820,
      w: 0.9 + 0.7*p + (bossIndex===2 ? 0.8 : 0),
      firePayload: (ph,d)=>({
        tag:'decoyswarm',
        burst: 2,
        plan: [
          { type:'decoy', count: clamp(4 + ph, 4, 11), sizeMul: 0.92, ttlMul: 0.9 },
          { type:'normal', count: clamp(2 + Math.floor(ph/2), 2, 6), sizeMul: 0.98, ttlMul: 0.95 }
        ]
      })
    });

    // Skill C: Heal Bubbles — gives recovery windows (kid-friendly)
    skillPool.push({
      name:'Heal Bubbles',
      kind:'reward',
      teleMs: isHard ? 620 : 760,
      w: 0.8 + (bossIndex===0 ? 0.7 : 0) + (bossIndex===1 ? 0.2 : 0),
      firePayload: (ph,d)=>({
        tag:'heal',
        burst: 1,
        plan: [
          { type:'heal', count: clamp(2 + Math.floor(ph/2), 2, 5), sizeMul: 0.95, ttlMul: 1.05 },
          { type:'normal', count: clamp(2 + Math.floor(ph/2), 2, 6), sizeMul: 0.98, ttlMul: 1.0 }
        ]
      })
    });

    // Skill D: Shield Parade — introduces “safety” targets
    skillPool.push({
      name:'Shield Parade',
      kind:'reward',
      teleMs: isHard ? 650 : 800,
      w: 0.75 + 0.55*p + (bossIndex===1 ? 0.25 : 0),
      firePayload: (ph,d)=>({
        tag:'shield',
        burst: 1,
        plan: [
          { type:'shield', count: clamp(1 + Math.floor(ph/2), 1, 4), sizeMul: 0.95, ttlMul: 1.0 },
          { type:'bomb', count: clamp(2 + Math.floor(ph/2), 2, 6), sizeMul: 1.00, ttlMul: 0.95 },
        ]
      })
    });

    // avoid repeat
    const filtered = skillPool.filter(s => s.name !== last);
    const pool = filtered.length ? filtered : skillPool;

    // weighted random
    const total = pool.reduce((a,s)=>a + (s.w||1), 0);
    let r = Math.random() * total;
    for(const s of pool){
      r -= (s.w||1);
      if(r <= 0) return s;
    }
    return pool[0];
  }
}