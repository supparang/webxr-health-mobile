// === sb-ai-hooks.js ===
// Shadow Breaker — AI Hooks (A+B+C) — PRODUCTION
// A) Difficulty Director (fair adaptive, research deterministic off)
// B) AI Coach (explainable micro-tips, rate-limited)
// C) Predictor (lightweight online model + heuristics; can be locked off for research)

(function(){
  'use strict';

  const WIN = window;

  function clamp(n,a,b){ n=+n; if(!Number.isFinite(n)) return a; return Math.max(a, Math.min(b,n)); }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  // stable sigmoid (avoid overflow)
  function sigmoid(z){
    z = clamp(z, -12, 12);
    return 1 / (1 + Math.exp(-z));
  }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(_){ return fallback; }
  }

  // ------------------------------------------------------------
  // Online predictor (tiny logistic-ish model)
  // ------------------------------------------------------------
  function createOnlinePredictor(opts){
    const cfg = Object.assign({
      enableLearning: true,
      lr: 0.06,
      // feature weights init (tuned for arcade feel)
      w: { b:-0.9, rt:0.9, missStreak:0.55, combo: -0.25, acc:-0.35, boss:0.35, fatigue:0.45 },
    }, opts||{});

    const state = {
      w: Object.assign({}, cfg.w),
      // running stats
      n: 0,
    };

    function score(feat){
      // features should be normalized 0..1-ish
      const z =
        state.w.b +
        state.w.rt        * (feat.rtN || 0) +
        state.w.missStreak* (feat.missStreakN || 0) +
        state.w.combo     * (feat.comboN || 0) +
        state.w.acc       * (feat.accN || 0) +
        state.w.boss      * (feat.isBoss ? 1 : 0) +
        state.w.fatigue   * (feat.fatigueN || 0);
      return sigmoid(z);
    }

    function update(feat, y){ // y: 1 = miss, 0 = hit
      if(!cfg.enableLearning) return;
      const p = score(feat);
      const err = (y - p);
      const lr = cfg.lr;

      // gradient step
      state.w.b += lr * err;
      state.w.rt += lr * err * (feat.rtN||0);
      state.w.missStreak += lr * err * (feat.missStreakN||0);
      state.w.combo += lr * err * (feat.comboN||0);
      state.w.acc += lr * err * (feat.accN||0);
      state.w.boss += lr * err * (feat.isBoss?1:0);
      state.w.fatigue += lr * err * (feat.fatigueN||0);

      // keep weights bounded
      Object.keys(state.w).forEach(k=> state.w[k] = clamp(state.w[k], -3.5, 3.5));
      state.n++;
    }

    return { score, update, getWeights: ()=>Object.assign({}, state.w) };
  }

  // ------------------------------------------------------------
  // AI Director + Coach + Predictor bundle
  // ------------------------------------------------------------
  function createAIHooks(options){
    const cfg = Object.assign({
      gameId: 'shadow-breaker',
      diff: 'normal',
      isResearch: false,
      seed: '',
      // base difficulty
      baseSpawnMs: 700,
      baseBossHp: 9,
      // crosshair assistance
      baseLockPx: 32,
      // safety bounds
      spawnBounds: [420, 980],
      bossHpBounds: [6, 16],
      lockPxBounds: [22, 44],
      // pacing
      coachCooldownMs: 2200,
      directorCooldownMs: 900,
      // allow adaptive outside research
      enableAdaptive: true,
      // learning stored per device+game
      storageKey: 'SB_AI_PROFILE_v1',
    }, options||{});

    const canAdapt = !!cfg.enableAdaptive && !cfg.isResearch;

    // profile persisted (skill estimate & weights)
    const profile = (function(){
      const raw = localStorage.getItem(cfg.storageKey);
      const base = {
        skill: 0.45,          // 0..1
        fatigue: 0.0,         // 0..1
        lastCoachAt: 0,
        lastDirectorAt: 0,
        w: null,              // predictor weights
      };
      if(!raw) return base;
      const p = safeJsonParse(raw, base);
      return Object.assign(base, p||{});
    })();

    function saveProfile(){
      try{
        localStorage.setItem(cfg.storageKey, JSON.stringify({
          skill: profile.skill,
          fatigue: profile.fatigue,
          lastCoachAt: profile.lastCoachAt,
          lastDirectorAt: profile.lastDirectorAt,
          w: profile.w,
        }));
      }catch(_){}
    }

    const predictor = createOnlinePredictor({
      enableLearning: canAdapt, // learning off in research
      lr: 0.06,
      w: profile.w || undefined
    });

    // rolling session stats
    const S = {
      // basic rolling
      hits: 0,
      miss: 0,
      bossHits: 0,
      bossMiss: 0,
      missStreak: 0,
      combo: 0,
      maxCombo: 0,
      // reaction times
      rtEma: 520,        // ms
      rtVarEma: 0,
      // time
      startAt: 0,
      lastEventAt: 0,
      // current director outputs
      spawnMs: cfg.baseSpawnMs,
      bossHp: cfg.baseBossHp,
      lockPx: cfg.baseLockPx,
      // helper state
      risk: 0,
      lastTip: '',
      // assist window (micro slow)
      assistUntil: 0,
    };

    function reset(){
      S.hits=0; S.miss=0; S.bossHits=0; S.bossMiss=0;
      S.missStreak=0; S.combo=0; S.maxCombo=0;
      S.rtEma=520; S.rtVarEma=0;
      S.startAt=now(); S.lastEventAt=S.startAt;
      S.spawnMs = cfg.baseSpawnMs;
      S.bossHp = cfg.baseBossHp;
      S.lockPx = cfg.baseLockPx;
      S.risk = 0;
      S.lastTip = '';
      S.assistUntil = 0;
    }

    function acc(){
      const a = S.hits + S.miss;
      return a>0 ? (S.hits/a) : 0;
    }

    function normalizeRt(rt){
      // rt 200..1400ms -> 0..1
      return clamp((rt - 200) / 1200, 0, 1);
    }

    function normalizeAcc(a){
      // 0.35..0.95 -> 0..1 (low acc => 1 high risk)
      return clamp((0.95 - a) / 0.60, 0, 1);
    }

    function normalizeCombo(c){
      // 0..12 -> 0..1 (higher combo => lower risk)
      return clamp(c / 12, 0, 1);
    }

    function normalizeMissStreak(m){
      // 0..6 -> 0..1
      return clamp(m / 6, 0, 1);
    }

    function updateFatigue(dtMs){
      // fatigue rises slightly with time + miss streak, falls with good streak
      const t = clamp(dtMs / 60000, 0, 0.06); // per minute small
      profile.fatigue = clamp(profile.fatigue + t + (S.missStreak>2 ? 0.02 : 0), 0, 1);
      // reduce when playing well
      if(S.combo >= 5 && acc() >= 0.7) profile.fatigue = clamp(profile.fatigue - 0.03, 0, 1);
    }

    function estimateSkill(){
      // quick skill estimate from acc + rt + combo
      const a = acc(); // 0..1
      const rtN = clamp(1 - normalizeRt(S.rtEma), 0, 1); // faster => higher
      const comboN = clamp(S.maxCombo / 14, 0, 1);
      const s = clamp(0.45*a + 0.35*rtN + 0.20*comboN, 0, 1);
      // EMA
      profile.skill = clamp(profile.skill*0.88 + s*0.12, 0, 1);
    }

    function directorTick(){
      const t = now();
      if(!canAdapt) return;
      if(t - profile.lastDirectorAt < cfg.directorCooldownMs) return;
      profile.lastDirectorAt = t;

      estimateSkill();

      // Difficulty target curve:
      // - if skill high -> faster spawn + less lock assistance + boss a bit tankier
      // - if fatigue high / risk high -> slight easing (but keep excitement)
      const skill = profile.skill;
      const fatigue = profile.fatigue;
      const risk = S.risk;

      // spawn multiplier (lower = harder)
      let mult = 1.0;
      mult *= (1.14 - 0.30*skill);           // skill↑ => mult↓
      mult *= (1.00 + 0.22*fatigue);         // fatigue↑ => mult↑
      mult *= (1.00 + 0.18*risk);            // risk↑ => mult↑ (micro ease)

      const targetSpawn = clamp(cfg.baseSpawnMs * mult, cfg.spawnBounds[0], cfg.spawnBounds[1]);

      // boss hp
      let hp = cfg.baseBossHp;
      hp += Math.round((skill - 0.5) * 6);   // -3..+3
      hp -= Math.round(fatigue * 3);         // fatigue reduces hp a bit
      hp = clamp(hp, cfg.bossHpBounds[0], cfg.bossHpBounds[1]);

      // lockPx assistance: more help when fatigue/risk high
      let lock = cfg.baseLockPx;
      lock += Math.round((0.55 - skill) * 10);  // skill low => more lock
      lock += Math.round(risk * 8);
      lock += Math.round(fatigue * 6);
      lock = clamp(lock, cfg.lockPxBounds[0], cfg.lockPxBounds[1]);

      // apply
      S.spawnMs = Math.round(targetSpawn);
      S.bossHp = hp;
      S.lockPx = lock;

      // micro-assist window: if risk high, give 1.2s “breathing room”
      if(risk >= 0.72){
        S.assistUntil = Math.max(S.assistUntil, t + 1200);
      }

      profile.w = predictor.getWeights();
      saveProfile();
    }

    function coachSay(kind, explain){
      const t = now();
      if(t - profile.lastCoachAt < cfg.coachCooldownMs) return null;
      profile.lastCoachAt = t;

      const tipsTH = {
        aim:     'เล็งกลางจอค้างไว้ แล้วค่อยแตะ/ยิง 👊',
        rhythm:  'จับจังหวะ: แตะเร็วขึ้นนิด แต่ไม่รีบจนหลุด 🎯',
        reset:   'คอมโบหลุดไม่เป็นไร กลับมาเริ่มใหม่ทีละเป้า 💪',
        boss:    'บอสเลือดหนา: โฟกัสเป้าเดียว อย่าไล่หลายจุด 🥊',
        breathe: 'เริ่มล้าแล้ว: ลดความรีบ 1–2 วินาที แล้วค่อยเร่งต่อ 🌿',
      };
      const tipsEN = {
        aim:     'Keep aim at center, then tap/shoot 👊',
        rhythm:  'Find a rhythm: faster, but stay accurate 🎯',
        reset:   'Combo broke—reset and rebuild 💪',
        boss:    'Boss is tanky: focus one target 🥊',
        breathe: 'Feeling fatigue: slow 1–2s, then push again 🌿',
      };

      const msg = (cfg.lang==='th' ? tipsTH[kind] : tipsEN[kind]) || '';
      if(!msg) return null;
      S.lastTip = msg;

      // Emit explainable tip (HHA-style)
      try{
        WIN.dispatchEvent(new CustomEvent('hha:coach', {
          detail: {
            text: msg,
            explain: explain || '',
            kind,
            risk: Number(S.risk.toFixed(3)),
            skill: Number(profile.skill.toFixed(3)),
            fatigue: Number(profile.fatigue.toFixed(3)),
            spawnMs: S.spawnMs,
            bossHp: S.bossHp,
            lockPx: S.lockPx
          }
        }));
      }catch(_){}

      saveProfile();
      return msg;
    }

    function chooseCoachTip(){
      const a = acc();
      const risk = S.risk;
      const fatigue = profile.fatigue;

      if(risk > 0.75 && fatigue > 0.45){
        return coachSay('breathe', 'fatigue↑ + risk↑ => give micro-breathing window');
      }
      if(S.missStreak >= 2){
        return coachSay('aim', 'miss streak detected => suggest center-aim & lock-in');
      }
      if(a < 0.55){
        return coachSay('rhythm', 'accuracy low => slow slightly, build consistent rhythm');
      }
      if(S.combo === 0 && (S.hits+S.miss) > 6){
        return coachSay('reset', 'combo broke => reset mindset and rebuild');
      }
      return null;
    }

    // feature builder (normalized)
    function buildFeat(payload){
      const rt = clamp(payload.rtMs || S.rtEma, 180, 1600);
      const a = acc();
      const dt = (S.lastEventAt ? (now() - S.lastEventAt) : 0);
      updateFatigue(dt);
      S.lastEventAt = now();

      const feat = {
        rtN: normalizeRt(rt),
        missStreakN: normalizeMissStreak(S.missStreak),
        comboN: normalizeCombo(S.combo),
        accN: normalizeAcc(a),
        isBoss: !!payload.isBoss,
        fatigueN: clamp(profile.fatigue, 0, 1)
      };
      return feat;
    }

    function observe(payload){
      // payload: { type:'hit'|'miss', rtMs, isBoss, combo, maxCombo }
      const isMiss = payload.type === 'miss';
      const isBoss = !!payload.isBoss;

      // update rt EMA
      if(Number.isFinite(payload.rtMs)){
        const rt = clamp(payload.rtMs, 180, 1600);
        const alpha = 0.12;
        const prev = S.rtEma;
        S.rtEma = prev*(1-alpha) + rt*alpha;
        const diff = rt - S.rtEma;
        S.rtVarEma = (S.rtVarEma*0.92) + (diff*diff*0.08);
      }

      // stats
      if(isMiss){
        S.miss++;
        S.missStreak++;
        S.combo = 0;
        if(isBoss) S.bossMiss++;
      }else{
        S.hits++;
        S.missStreak = 0;
        S.combo = (typeof payload.combo === 'number') ? payload.combo : (S.combo+1);
        if(isBoss) S.bossHits++;
      }
      if(typeof payload.maxCombo === 'number') S.maxCombo = Math.max(S.maxCombo, payload.maxCombo);

      // predict risk + update model
      const feat = buildFeat(payload);
      const risk = predictor.score(feat);
      S.risk = clamp(risk, 0, 1);

      if(canAdapt){
        predictor.update(feat, isMiss ? 1 : 0);
      }

      // Director decision
      directorTick();

      // Coach tip sometimes
      if(canAdapt){
        // only occasionally (not spam)
        if(S.risk > 0.72 || S.missStreak >= 2 || acc() < 0.55){
          chooseCoachTip();
        }
      }

      profile.w = predictor.getWeights();
      saveProfile();
    }

    function getSpawnMs(){
      // If assist window active => slightly slower spawns (breathing)
      const t = now();
      if(canAdapt && t < S.assistUntil){
        return clamp(S.spawnMs * 1.12, cfg.spawnBounds[0], cfg.spawnBounds[1]);
      }
      return S.spawnMs;
    }

    function getBossHp(baseHp){
      if(!canAdapt) return baseHp;
      // director boss hp overrides base (but keep base as floor)
      return Math.max(baseHp, S.bossHp);
    }

    function getLockPx(){
      return S.lockPx;
    }

    function setLang(lang){
      cfg.lang = (lang==='en') ? 'en' : 'th';
    }

    // init session
    reset();

    return {
      reset,
      observe,
      getSpawnMs,
      getBossHp,
      getLockPx,
      setLang,
      getState: ()=>({
        skill: profile.skill,
        fatigue: profile.fatigue,
        risk: S.risk,
        spawnMs: S.spawnMs,
        bossHp: S.bossHp,
        lockPx: S.lockPx,
        rtEma: S.rtEma,
        acc: acc()
      })
    };
  }

  WIN.SB_AI_HOOKS = {
    create: createAIHooks
  };

})();