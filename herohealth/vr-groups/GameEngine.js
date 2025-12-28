/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — DOM Engine (PRODUCTION ++ STAR/DIAMOND/SHIELD/BOSS BAR/MINI TICK)
Exports: window.GroupsVR.GameEngine
Events:
- hha:score {score,combo,comboMax,misses,correct,wrong}
- hha:time  {left,elapsed,total}
- groups:power {charge,threshold,fever,isFever}
- groups:shield {active,leftMs,usesLeft}
- groups:boss {active,hp,maxHp,ragePct}
- hha:rank {grade}
- quest:update {goal:{...}, mini:{...}}
- hha:coach {text,mood}
- hha:judge {kind,text}
- hha:end {...metrics}
*/

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // ------------------ utilities ------------------
  function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b,v)); }
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function mulberry32(seed){
    let a = seed >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{}
  }

  // tiny FX fallback
  function fxPop(text, x, y){
    try{
      const el = doc.createElement('div');
      el.textContent = text;
      Object.assign(el.style,{
        position:'fixed',
        left: x+'px',
        top: y+'px',
        transform:'translate(-50%,-50%) scale(1)',
        fontWeight:'900',
        fontSize:'14px',
        color:'#e5e7eb',
        textShadow:'0 10px 24px rgba(0,0,0,.55)',
        pointerEvents:'none',
        zIndex:120
      });
      doc.body.appendChild(el);
      const t0 = now();
      const dur = 540;
      (function tick(){
        const p = (now()-t0)/dur;
        if (p>=1){ el.remove(); return; }
        el.style.opacity = String(1 - p);
        el.style.transform = `translate(-50%,-50%) translateY(${(-20*p).toFixed(1)}px) scale(${(1+0.28*p).toFixed(2)})`;
        requestAnimationFrame(tick);
      })();
    }catch{}
  }

  function bodyFlash(cls, ms){
    try{
      doc.body.classList.add(cls);
      setTimeout(()=>doc.body.classList.remove(cls), ms||220);
    }catch{}
  }

  // beep (mini tick)
  let _ac = null;
  function beep(freq, ms, gain){
    try{
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return;
      if (!_ac) _ac = new AC();
      const o = _ac.createOscillator();
      const g = _ac.createGain();
      o.frequency.value = freq || 880;
      g.gain.value = gain==null ? 0.03 : gain;
      o.connect(g); g.connect(_ac.destination);
      o.start();
      setTimeout(()=>{ try{o.stop();}catch{} }, ms||80);
    }catch{}
  }

  // ------------------ data: Thai 5 groups (fixed, no variation) ------------------
  const GROUPS_TH = [
    { id:1, name:'หมู่ 1', hint:'กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน', emoji:['🥩','🥚','🥛','🫘','🐟'] },
    { id:2, name:'หมู่ 2', hint:'ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง', emoji:['🍚','🍞','🥔','🍠','🍜'] },
    { id:3, name:'หมู่ 3', hint:'กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ', emoji:['🥦','🥬','🥕','🌽','🥒'] },
    { id:4, name:'หมู่ 4', hint:'กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน', emoji:['🍎','🍌','🍊','🍉','🍍'] },
    { id:5, name:'หมู่ 5', hint:'อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย', emoji:['🥑','🫒','🥥','🧈','🧀'] },
  ];

  const JUNK = ['🍩','🍟','🍔','🍕','🥤','🍰','🍫'];
  const STAR = '⭐';
  const DIAMOND = '💎';
  const SHIELD = '🛡️';

  // grade thresholds
  function calcGrade(score, acc, misses){
    const eff = score + (acc*2) - (misses*6);
    if (eff >= 1400 && acc >= 90 && misses <= 3) return 'SSS';
    if (eff >= 1050 && acc >= 86) return 'SS';
    if (eff >= 780  && acc >= 79) return 'S';
    if (eff >= 520  && acc >= 68) return 'A';
    if (eff >= 260  && acc >= 55) return 'B';
    return 'C';
  }

  // ------------------ difficulty presets ------------------
  function preset(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy'){
      return {
        spawnEveryMs: 780,
        ttlMs: 2500,
        junkBias: 0.16,
        size: 1.04,
        goalHits: 6,
        miniEveryHits: 8,
        powerThr: 10,
        bossChance: 0.06,
        decoyChance: 0.10,
        starChance: 0.06,
        diamondChance: 0.018,
        shieldChance: 0.028,
        bossHp: 3,
      };
    }
    if (diff === 'hard'){
      return {
        spawnEveryMs: 520,
        ttlMs: 1900,
        junkBias: 0.32,
        size: 0.92,
        goalHits: 9,
        miniEveryHits: 7,
        powerThr: 12,
        bossChance: 0.10,
        decoyChance: 0.14,
        starChance: 0.05,
        diamondChance: 0.020,
        shieldChance: 0.020,
        bossHp: 4,
      };
    }
    return {
      spawnEveryMs: 650,
      ttlMs: 2200,
      junkBias: 0.24,
      size: 0.98,
      goalHits: 8,
      miniEveryHits: 7,
      powerThr: 11,
      bossChance: 0.08,
      decoyChance: 0.12,
      starChance: 0.055,
      diamondChance: 0.019,
      shieldChance: 0.024,
      bossHp: 3,
    };
  }

  // ------------------ HUD inject (boss bar + quest bars optional) ------------------
  function ensureBossBar(){
    let wrap = doc.querySelector('.fg-bossbar');
    if (wrap) return wrap;

    wrap = doc.createElement('div');
    wrap.className = 'fg-bossbar';
    Object.assign(wrap.style,{
      position:'fixed',
      left:'50%',
      transform:'translateX(-50%)',
      top:'calc(58px + env(safe-area-inset-top, 0px))',
      zIndex:58,
      width:'min(520px, 92vw)',
      pointerEvents:'none',
      display:'none'
    });

    const bar = doc.createElement('div');
    Object.assign(bar.style,{
      height:'12px',
      borderRadius:'999px',
      border:'1px solid rgba(148,163,184,.22)',
      background:'rgba(15,23,42,.62)',
      overflow:'hidden',
      boxShadow:'0 16px 40px rgba(0,0,0,.35)'
    });

    const fill = doc.createElement('i');
    fill.className = 'fg-bossfill';
    Object.assign(fill.style,{
      display:'block',
      height:'100%',
      width:'0%',
      background:'linear-gradient(90deg, rgba(244,63,94,.90), rgba(251,191,36,.90))'
    });

    const label = doc.createElement('div');
    label.className = 'fg-bosslabel';
    Object.assign(label.style,{
      marginTop:'6px',
      fontSize:'12px',
      color:'rgba(229,231,235,.92)',
      textAlign:'center',
      textShadow:'0 10px 24px rgba(0,0,0,.55)'
    });
    label.textContent = 'BOSS';

    bar.appendChild(fill);
    wrap.appendChild(bar);
    wrap.appendChild(label);
    doc.body.appendChild(wrap);
    return wrap;
  }

  function setBossBar(active, hp, maxHp, ragePct){
    const w = ensureBossBar();
    w.style.display = active ? 'block' : 'none';
    const fill = w.querySelector('.fg-bossfill');
    const label = w.querySelector('.fg-bosslabel');
    if (fill){
      const p = (maxHp>0) ? clamp(hp/maxHp, 0, 1) : 0;
      fill.style.width = (p*100).toFixed(1)+'%';
      // rage glow on low hp
      if (p <= 0.34) bodyFlash('fg-rage', 180);
    }
    if (label){
      label.textContent = active ? `BOSS HP ${hp}/${maxHp} • RAGE ${(ragePct*100).toFixed(0)}%` : 'BOSS';
    }
  }

  // ------------------ Engine ------------------
  const Engine = {
    _layer: null,
    _running: false,
    _cfg: null,
    _rng: null,
    _t0: 0,
    _lastSpawnAt: 0,
    _raf: 0,
    _timer: 0,
    _vx: 0,
    _vy: 0,
    _drag: {on:false, x:0, y:0, vx:0, vy:0, last:0},
    _gyro: {vx:0, vy:0, on:false},

    // state
    S: {
      score: 0,
      combo: 0,
      comboMax: 0,
      misses: 0,
      correct: 0,
      wrong: 0,

      // quest
      goalIndex: 0,
      goalNow: 0,
      goalsCleared: 0,
      goalsTotal: 5,

      // mini
      miniActive: null,
      miniNow: 0,
      miniTotal: 0,
      miniCleared: 0,
      miniTotalAll: 999,
      miniStartAt: 0,

      // power/fever
      power: 0,
      powerThr: 10,
      feverUntil: 0,

      // shield
      shieldUntil: 0,
      shieldUses: 0, // durability per activation

      // penalties
      stunnedUntil: 0,
      panicUntil: 0,

      // boss state
      bossActive: false,
      bossHp: 0,
      bossMaxHp: 0,
      bossRage: 0,

      // metrics
      nTargetGoodSpawned: 0,
      nTargetJunkSpawned: 0,
      nTargetBossSpawned: 0,
      nTargetDecoySpawned: 0,
      nTargetStarSpawned: 0,
      nTargetDiamondSpawned: 0,
      nTargetShieldSpawned: 0,

      nHitGood: 0,
      nHitJunk: 0,
      nHitJunkGuard: 0,
      nExpireGood: 0,
    },

    setLayerEl(el){
      this._layer = el;
    },

    start(diff, opts){
      opts = opts || {};
      const runMode = String(opts.runMode || 'play').toLowerCase();
      const style = String(opts.style || 'mix').toLowerCase();
      const totalSec = Math.max(30, Math.min(180, Number(opts.time || 90)));
      const seedStr = String(opts.seed || Date.now());

      this.stop('restart');

      const base = preset(diff);
      const allowAdaptive = (runMode === 'play');

      this._cfg = {
        diff: String(diff||'normal').toLowerCase(),
        runMode,
        style,
        totalSec,
        seedStr,
        allowAdaptive,

        spawnEveryMs: base.spawnEveryMs,
        ttlMs: base.ttlMs,
        junkBias: base.junkBias,
        size: base.size,
        goalHits: base.goalHits,
        miniEveryHits: base.miniEveryHits,
        powerThr: base.powerThr,

        bossChance: base.bossChance,
        decoyChance: base.decoyChance,

        starChance: base.starChance,
        diamondChance: base.diamondChance,
        shieldChance: base.shieldChance,

        bossHpBase: base.bossHp,
      };

      // style tuning
      if (style === 'feel'){
        this._cfg.junkBias = clamp(this._cfg.junkBias - 0.05, 0.08, 0.40);
        this._cfg.spawnEveryMs = Math.round(this._cfg.spawnEveryMs * 1.05);
        this._cfg.starChance = clamp(this._cfg.starChance + 0.02, 0, 0.12);
        this._cfg.shieldChance = clamp(this._cfg.shieldChance + 0.01, 0, 0.09);
      } else if (style === 'hard'){
        this._cfg.junkBias = clamp(this._cfg.junkBias + 0.06, 0.08, 0.46);
        this._cfg.spawnEveryMs = Math.round(this._cfg.spawnEveryMs * 0.92);
        this._cfg.decoyChance = clamp(this._cfg.decoyChance + 0.04, 0, 0.30);
        this._cfg.bossChance = clamp(this._cfg.bossChance + 0.02, 0, 0.20);
        this._cfg.shieldChance = clamp(this._cfg.shieldChance - 0.006, 0, 0.06);
      }

      this._rng = mulberry32(hashSeed(seedStr));
      this._running = true;
      this._t0 = now();
      this._lastSpawnAt = 0;

      // reset state
      const S = this.S;
      Object.assign(S,{
        score:0, combo:0, comboMax:0, misses:0, correct:0, wrong:0,
        goalIndex:0, goalNow:0, goalsCleared:0, goalsTotal:5,
        miniActive:null, miniNow:0, miniTotal:0, miniCleared:0, miniTotalAll:999, miniStartAt:0,
        power:0, powerThr:this._cfg.powerThr, feverUntil:0,
        shieldUntil:0, shieldUses:0,
        stunnedUntil:0, panicUntil:0,
        bossActive:false, bossHp:0, bossMaxHp:0, bossRage:0,
        nTargetGoodSpawned:0, nTargetJunkSpawned:0, nTargetBossSpawned:0, nTargetDecoySpawned:0,
        nTargetStarSpawned:0, nTargetDiamondSpawned:0, nTargetShieldSpawned:0,
        nHitGood:0, nHitJunk:0, nHitJunkGuard:0, nExpireGood:0
      });

      // ensure layer
      if (!this._layer){
        this._layer = doc.getElementById('fg-layer');
      }
      if (!this._layer){
        console.warn('GroupsVR: no layer element');
        return;
      }
      this._layer.innerHTML = '';

      this._bindInput();

      // open with coach
      this._coach(`เริ่มเลย! เป้าหมาย: ${GROUPS_TH[0].name} ✅`, 'neutral');
      this._pushQuest();

      // init HUD extras
      setBossBar(false,0,0,0);
      emit('groups:shield', {active:false,leftMs:0,usesLeft:0});

      // tick timer
      this._timer = setInterval(()=>this._tickTime(), 120);

      // main loop
      const loop = ()=>{
        if (!this._running) return;
        this._step();
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);

      // initial events
      emit('hha:score', {score:0, combo:0, comboMax:0, misses:0, correct:0, wrong:0});
      emit('groups:power', {charge:0, threshold:S.powerThr, fever:0, isFever:false});
      emit('hha:rank', {grade:'C'});
      emit('hha:time', {left: this._cfg.totalSec, elapsed:0, total:this._cfg.totalSec});
    },

    stop(reason){
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
      if (this._timer) clearInterval(this._timer);
      this._timer = 0;
      try{ this._unbindInput(); }catch{}
      if (this._layer) this._layer.innerHTML = '';
      setBossBar(false,0,0,0);
      return reason;
    },

    // ------------------ input (drag + gyro) ------------------
    _bindInput(){
      const layer = this._layer;
      const drag = this._drag;
      drag.on = false;

      const onDown = (ev)=>{
        if (!this._running) return;
        drag.on = true;
        const p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        drag.x = p.clientX; drag.y = p.clientY;
        drag.vx = this._vx; drag.vy = this._vy;
        drag.last = now();
      };
      const onMove = (ev)=>{
        if (!drag.on) return;
        const p = (ev.touches && ev.touches[0]) ? ev.touches[0] : ev;
        const dx = p.clientX - drag.x;
        const dy = p.clientY - drag.y;
        // VR feel: small parallax
        this._vx = clamp(drag.vx + dx*0.12, -42, 42);
        this._vy = clamp(drag.vy + dy*0.12, -52, 52);
        this._applyViewShift();
      };
      const onUp = ()=>{ drag.on = false; };

      // hit target
      const onClick = (ev)=>{
        const t = ev.target;
        if (!t) return;
        if (!t.classList || !t.classList.contains('fg-target')) return;
        ev.preventDefault();
        ev.stopPropagation();
        this._hitTarget(t, ev);
      };

      this._onDown = onDown;
      this._onMove = onMove;
      this._onUp = onUp;
      this._onClick = onClick;

      layer.addEventListener('pointerdown', onDown, {passive:true});
      root.addEventListener('pointermove', onMove, {passive:true});
      root.addEventListener('pointerup', onUp, {passive:true});
      root.addEventListener('pointercancel', onUp, {passive:true});

      layer.addEventListener('touchstart', onDown, {passive:true});
      layer.addEventListener('touchmove', onMove, {passive:true});
      layer.addEventListener('touchend', onUp, {passive:true});
      layer.addEventListener('touchcancel', onUp, {passive:true});

      layer.addEventListener('click', onClick, true);

      // gyro (optional)
      const onOri = (e)=>{
        const g = Number(e.gamma)||0;
        const b = Number(e.beta)||0;
        this._gyro.on = true;
        this._gyro.vx = clamp(g*0.35, -18, 18);
        this._gyro.vy = clamp((b-25)*0.22, -18, 18);
      };
      this._onOri = onOri;
      root.addEventListener('deviceorientation', onOri, true);
    },

    _unbindInput(){
      const layer = this._layer;
      if (!layer) return;

      layer.removeEventListener('pointerdown', this._onDown);
      root.removeEventListener('pointermove', this._onMove);
      root.removeEventListener('pointerup', this._onUp);
      root.removeEventListener('pointercancel', this._onUp);

      layer.removeEventListener('touchstart', this._onDown);
      layer.removeEventListener('touchmove', this._onMove);
      layer.removeEventListener('touchend', this._onUp);
      layer.removeEventListener('touchcancel', this._onUp);

      layer.removeEventListener('click', this._onClick, true);

      root.removeEventListener('deviceorientation', this._onOri, true);
    },

    _applyViewShift(){
      const layer = this._layer;
      if (!layer) return;
      const gvx = this._gyro.on ? this._gyro.vx : 0;
      const gvy = this._gyro.on ? this._gyro.vy : 0;
      const vx = clamp(this._vx + gvx, -52, 52);
      const vy = clamp(this._vy + gvy, -62, 62);
      layer.style.setProperty('--vx', vx.toFixed(1)+'px');
      layer.style.setProperty('--vy', vy.toFixed(1)+'px');
    },

    // ------------------ spawning and step ------------------
    _step(){
      const t = now();
      const S = this.S;
      const cfg = this._cfg;
      if (!cfg) return;

      // fever
      const isFever = (t < S.feverUntil);

      // shield status
      const shieldActive = (t < S.shieldUntil) && (S.shieldUses > 0);
      if (!shieldActive && (S.shieldUntil || S.shieldUses)){
        S.shieldUntil = 0;
        S.shieldUses = 0;
        emit('groups:shield', {active:false,leftMs:0,usesLeft:0});
      } else if (shieldActive && (t % 300) < 17){
        emit('groups:shield', {active:true,leftMs: Math.max(0, S.shieldUntil - t), usesLeft:S.shieldUses});
      }

      // mini rush tick/flash near end
      if (S.miniActive && S.miniActive.timeLimitMs){
        const elapsed = t - (S.miniStartAt || t);
        const leftMs = Math.max(0, S.miniActive.timeLimitMs - elapsed);

        if (leftMs <= 2500 && leftMs > 0){
          // subtle shake + flash + beep
          if ((leftMs % 500) < 18){
            bodyFlash('fg-mini-urgent', 140);
            beep(880, 60, 0.025);
          }
        }
        if (leftMs <= 900 && leftMs > 0){
          if ((leftMs % 220) < 18){
            bodyFlash('fg-mini-urgent2', 120);
            beep(1100, 50, 0.03);
          }
        }
      }

      // adaptive (play mode only)
      if (cfg.allowAdaptive && (t - this._t0) > 1800 && (t % 900) < 17){
        const totalHits = S.correct + S.wrong;
        const acc = totalHits ? (S.correct/totalHits)*100 : 0;
        let se = cfg.spawnEveryMs;
        let ttl = cfg.ttlMs;
        let jb = cfg.junkBias;

        if (acc > 85 && S.misses <= 3){
          se = Math.max(430, se - 30);
          ttl = Math.max(1550, ttl - 35);
          jb = clamp(jb + 0.015, 0.12, 0.44);
        } else if (acc < 60 || S.misses > 7){
          se = Math.min(920, se + 35);
          ttl = Math.min(2700, ttl + 40);
          jb = clamp(jb - 0.015, 0.10, 0.40);
        }
        cfg.spawnEveryMs = se;
        cfg.ttlMs = ttl;
        cfg.junkBias = jb;

        emit('hha:adaptive', {spawnEveryMs: se, ttlMs: ttl, junkBias: jb});
      }

      // spawn rate (fever spawns faster)
      const spawnEvery = isFever ? Math.max(320, cfg.spawnEveryMs * 0.72) : cfg.spawnEveryMs;
      if (!this._lastSpawnAt || (t - this._lastSpawnAt) >= spawnEvery){
        this._lastSpawnAt = t;

        // boss chance
        if (this._rng() < cfg.bossChance) this._spawnBoss();
        else this._spawnOne();
      }

      // expire handling
      const layer = this._layer;
      if (layer){
        const nodes = layer.querySelectorAll('.fg-target');
        const tt = now();
        for (const n of nodes){
          const exp = Number(n.dataset.exp || 0);
          if (exp && tt > exp){
            const good = (n.dataset.good === '1');
            const kind = n.dataset.kind || 'normal';

            n.classList.add('out');
            setTimeout(()=> n.remove(), 160);

            // expired good (only normal good) counts miss
            if (good && (kind === 'good')){
              S.misses++;
              S.combo = 0;
              S.nExpireGood++;
              emit('hha:judge', {kind:'MISS', text:'หมดเวลา!'});
              bodyFlash('fg-flash-bad', 220);
              this._emitScore();
              this._emitRank();
            }
          }
        }
      }

      // continuous view shift (gyro)
      this._applyViewShift();
    },

    _safeRect(){
      const w = root.innerWidth || doc.documentElement.clientWidth;
      const h = root.innerHeight || doc.documentElement.clientHeight;

      const pad = 14;
      let top = pad;
      let bottom = h - pad;
      let left = pad;
      let right = w - pad;

      // HUD blocks (top)
      const hud = doc.querySelector('.hud');
      const ct = doc.querySelector('.centerTop');
      const topCandidates = [];

      if (hud){
        const r = hud.getBoundingClientRect();
        topCandidates.push(r.bottom + 10);
      }
      if (ct){
        const r = ct.getBoundingClientRect();
        topCandidates.push(r.bottom + 10);
      }
      // boss bar zone
      const bb = doc.querySelector('.fg-bossbar');
      if (bb && bb.style.display !== 'none'){
        const r = bb.getBoundingClientRect();
        topCandidates.push(r.bottom + 10);
      }

      if (topCandidates.length) top = Math.max(top, ...topCandidates);

      // power bar blocks (bottom)
      const pw = doc.querySelector('.powerWrap');
      if (pw){
        const r = pw.getBoundingClientRect();
        bottom = Math.min(bottom, r.top - 12);
      }

      // clamp if too small (auto relax)
      const minW = 220, minH = 240;
      if ((right-left) < minW){
        const mid = w/2;
        left = mid - minW/2;
        right = mid + minW/2;
      }
      if ((bottom-top) < minH){
        const mid = h*0.58;
        top = mid - minH/2;
        bottom = mid + minH/2;
      }

      return {left, top, right, bottom, w, h};
    },

    _spawnOne(){
      const S = this.S;
      const cfg = this._cfg;
      const rect = this._safeRect();

      const x = rect.left + (rect.right-rect.left)*this._rng();
      const y = rect.top + (rect.bottom-rect.top)*this._rng();

      const goalG = GROUPS_TH[S.goalIndex];

      // special drops first (rare)
      const r = this._rng();
      const isDiamond = (r < cfg.diamondChance);
      const isStar = (!isDiamond && (r < cfg.diamondChance + cfg.starChance));
      const isShield = (!isDiamond && !isStar && (this._rng() < cfg.shieldChance));

      if (isDiamond){
        S.nTargetDiamondSpawned++;
        const el = this._mkTarget({x,y,emoji:DIAMOND, good:true, kind:'diamond', ttl: cfg.ttlMs*1.15, scale: cfg.size*1.05});
        el.classList.add('is-diamond');
        this._layer.appendChild(el);
        return;
      }
      if (isStar){
        S.nTargetStarSpawned++;
        const el = this._mkTarget({x,y,emoji:STAR, good:true, kind:'star', ttl: cfg.ttlMs*1.05, scale: cfg.size*1.02});
        el.classList.add('is-star');
        this._layer.appendChild(el);
        return;
      }
      if (isShield){
        S.nTargetShieldSpawned++;
        const el = this._mkTarget({x,y,emoji:SHIELD, good:true, kind:'shield', ttl: cfg.ttlMs*1.10, scale: cfg.size*1.08});
        el.classList.add('is-shield');
        this._layer.appendChild(el);
        return;
      }

      // normal/junk/decoy
      const isDecoy = (this._rng() < cfg.decoyChance);
      const isJunk  = (!isDecoy) && (this._rng() < cfg.junkBias);

      let emoji = '🍽️';
      let good = true;
      let kind = 'normal';

      if (isJunk){
        emoji = JUNK[Math.floor(this._rng()*JUNK.length)];
        good = false;
        kind = 'junk';
        S.nTargetJunkSpawned++;
      } else if (isDecoy){
        emoji = goalG.emoji[Math.floor(this._rng()*goalG.emoji.length)];
        good = false;
        kind = 'decoy';
        S.nTargetDecoySpawned++;
      } else {
        emoji = goalG.emoji[Math.floor(this._rng()*goalG.emoji.length)];
        good = true;
        kind = 'good';
        S.nTargetGoodSpawned++;
      }

      const ttl = cfg.ttlMs * (0.92 + this._rng()*0.22);
      const el = this._mkTarget({x,y,emoji, good, kind, ttl, scale: cfg.size*(0.92 + this._rng()*0.22)});
      if (kind === 'junk') el.classList.add('is-junk');
      if (kind === 'decoy') el.classList.add('is-decoy');
      this._layer.appendChild(el);
    },

    _spawnBoss(){
      const S = this.S;
      const cfg = this._cfg;

      const rect = this._safeRect();
      const x = rect.left + (rect.right-rect.left)*this._rng();
      const y = rect.top + (rect.bottom-rect.top)*this._rng();

      const goalG = GROUPS_TH[S.goalIndex];
      const emoji = goalG.emoji[Math.floor(this._rng()*goalG.emoji.length)];
      const ttl = Math.max(1700, cfg.ttlMs * 1.35);

      const el = this._mkTarget({
        x,y,emoji,
        good:true,
        kind:'boss',
        ttl,
        scale: cfg.size*1.52
      });
      el.classList.add('is-boss');

      // boss HP scales a bit with progress + style
      const progress = (S.goalsCleared / Math.max(1,S.goalsTotal));
      let hp = cfg.bossHpBase + (progress > 0.5 ? 1 : 0);
      if (cfg.style === 'hard') hp += 1;
      hp = clamp(hp, 3, 6);

      el.dataset.hp = String(hp);
      el.dataset.maxhp = String(hp);

      S.bossActive = true;
      S.bossHp = hp;
      S.bossMaxHp = hp;
      S.bossRage = 0;

      S.nTargetBossSpawned++;
      emit('hha:judge', {kind:'BOSS', text:'Boss!'});
      this._coach('บอสมาแล้ว! ตีให้หมดก่อนมันหนี! 👊', 'neutral');

      setBossBar(true, hp, hp, 0);
      emit('groups:boss', {active:true,hp, maxHp:hp, ragePct:0});

      this._layer.appendChild(el);
    },

    _mkTarget(o){
      const el = doc.createElement('div');
      el.className = 'fg-target';
      el.dataset.emoji = String(o.emoji);
      el.dataset.good = o.good ? '1' : '0';
      el.dataset.kind = String(o.kind || 'normal');
      el.dataset.exp  = String(now() + Number(o.ttl||2000));

      el.style.setProperty('--x', (Number(o.x)||0).toFixed(1)+'px');
      el.style.setProperty('--y', (Number(o.y)||0).toFixed(1)+'px');
      el.style.setProperty('--s', (Number(o.scale)||1).toFixed(2));

      el.style.left = 'var(--x)';
      el.style.top  = 'var(--y)';
      return el;
    },

    // ------------------ hit logic ------------------
    _hitTarget(el, ev){
      const t = now();
      const S = this.S;
      const cfg = this._cfg;
      if (!cfg) return;

      if (t < S.stunnedUntil) return;

      const kind = el.dataset.kind || 'normal';
      const good = (el.dataset.good === '1');

      const p = (ev && (ev.touches && ev.touches[0])) ? ev.touches[0] : ev;
      const px = p ? p.clientX : (root.innerWidth*0.5);
      const py = p ? p.clientY : (root.innerHeight*0.5);

      // boss
      if (kind === 'boss'){
        let hp = Math.max(0, Number(el.dataset.hp||0));
        const maxhp = Math.max(1, Number(el.dataset.maxhp||hp||1));
        hp = hp - 1;
        el.dataset.hp = String(hp);

        // rage increases when low
        const rage = clamp(1 - (hp/maxhp), 0, 1);
        S.bossRage = rage;

        fxPop(`👊 -1`, px, py);
        this._scoreAdd(this._isFever()? 34 : 26, true);

        if (hp <= 0){
          // clear boss
          el.classList.add('hit');
          setTimeout(()=>el.remove(), 180);

          S.bossActive = false;
          S.bossHp = 0;
          S.bossMaxHp = 0;
          S.bossRage = 0;

          setBossBar(false,0,0,0);
          emit('groups:boss', {active:false,hp:0,maxHp:0,ragePct:0});

          this._scoreAdd(220, true);
          this._powerAdd(3);
          this._goalHit(); // boss counts as a goal hit
          emit('hha:judge', {kind:'BOSS', text:'Boss cleared!'});
          this._coach('สุดยอด! ล้มบอสได้แล้ว! 🏆', 'happy');
          return;
        }

        // still alive -> show bar + rage effect
        S.bossHp = hp;
        setBossBar(true, hp, maxhp, rage);
        emit('groups:boss', {active:true,hp, maxHp:maxhp, ragePct:rage});

        if (rage > 0.6 && (t % 420) < 18){
          bodyFlash('fg-rage', 160);
          beep(740, 55, 0.02);
        }
        return;
      }

      // collect specials
      if (kind === 'star'){
        el.classList.add('hit');
        setTimeout(()=>el.remove(), 160);
        fxPop('⭐ BONUS!', px, py);
        this._scoreAdd(90, true);
        this._powerAdd(2);
        this._coach('เก็บ STAR! โบนัสแรงขึ้น ⭐', 'happy');
        return;
      }

      if (kind === 'diamond'){
        el.classList.add('hit');
        setTimeout(()=>el.remove(), 160);
        fxPop('💎 MEGA!', px, py);
        this._scoreAdd(160, true);
        this._powerAdd(3);
        // extend fever slightly if already in fever
        if (this._isFever()) this.S.feverUntil += 900;
        this._coach('💎 DIAMOND! โคตรแรง! +Power', 'happy');
        return;
      }

      if (kind === 'shield'){
        el.classList.add('hit');
        setTimeout(()=>el.remove(), 160);
        this._shieldOn();
        fxPop('🛡️ SHIELD!', px, py);
        this._scoreAdd(40, true);
        this._coach('เปิดโล่แล้ว! กันพลาดได้ 🛡️', 'happy');
        return;
      }

      // normal/junk/decoy
      el.classList.add('hit');
      setTimeout(()=>el.remove(), 160);

      if (good){
        S.nHitGood++;
        this._scoreAdd(this._isFever()? 28 : 18, true);
        this._powerAdd(1);
        this._goalHit();
        this._miniHit(true);
      } else {
        // SHIELD blocks miss from wrong hits (junk/decoy)
        if (this._shieldBlock()){
          S.nHitJunkGuard++;
          fxPop('🛡️ BLOCK', px, py);
          emit('hha:judge', {kind:'GUARD', text:'Shield block!'});
          // keep combo (feel good), tiny score
          this._scoreAdd(6, true);
          // still counts as "wrong hit" for accuracy? -> we keep wrong++ to be honest
          S.wrong++;
          this._emitScore();
          this._emitRank();
          return;
        }

        S.nHitJunk++;
        this._scoreAdd(-8, false);
        this._miss(kind === 'decoy' ? 'DECOY' : 'JUNK');
        this._miniHit(false);
      }
    },

    _shieldOn(){
      const S = this.S;
      const t = now();
      S.shieldUntil = t + 7200; // 7.2s
      S.shieldUses = 2;         // durability
      emit('groups:shield', {active:true,leftMs: S.shieldUntil - t, usesLeft:S.shieldUses});
      bodyFlash('fg-shield', 220);
      beep(660, 80, 0.02);
    },

    _shieldBlock(){
      const S = this.S;
      const t = now();
      const active = (t < S.shieldUntil) && (S.shieldUses > 0);
      if (!active) return false;

      S.shieldUses = Math.max(0, S.shieldUses - 1);
      emit('groups:shield', {active:true,leftMs: Math.max(0, S.shieldUntil - t), usesLeft:S.shieldUses});

      // if uses run out, end shield early
      if (S.shieldUses <= 0){
        S.shieldUntil = 0;
        emit('groups:shield', {active:false,leftMs:0,usesLeft:0});
      }
      bodyFlash('fg-shield', 180);
      beep(520, 55, 0.018);
      return true;
    },

    _scoreAdd(delta, correct){
      const S = this.S;
      const fever = this._isFever();

      if (correct){
        S.correct++;
        S.combo++;
        S.comboMax = Math.max(S.comboMax, S.combo);
        const mult = fever ? 1.35 : 1.0;
        S.score = Math.max(0, Math.round(S.score + delta*mult));
      } else {
        S.wrong++;
        S.combo = 0;
        S.score = Math.max(0, Math.round(S.score + delta));
      }

      fxPop(correct ? `+${Math.max(1,Math.round(delta))}` : `${delta}`, root.innerWidth*0.5, root.innerHeight*0.45);

      this._emitScore();
      this._emitRank();
    },

    _emitScore(){
      const S = this.S;
      emit('hha:score', {
        score: S.score,
        combo: S.combo,
        comboMax: S.comboMax,
        misses: S.misses,
        correct: S.correct,
        wrong: S.wrong
      });
    },

    _emitRank(){
      const S = this.S;
      const total = S.correct + S.wrong;
      const acc = total ? (S.correct/total)*100 : 0;
      const grade = calcGrade(S.score, acc, S.misses);
      emit('hha:rank', {grade});
    },

    _isFever(){
      return now() < this.S.feverUntil;
    },

    _powerAdd(n){
      const S = this.S;
      const cfg = this._cfg;
      S.powerThr = cfg.powerThr;

      S.power = clamp(S.power + (Number(n)||0), 0, S.powerThr);
      emit('groups:power', {charge:S.power, threshold:S.powerThr, fever: Math.max(0, S.feverUntil - now()), isFever:this._isFever()});

      // trigger fever when full
      if (S.power >= S.powerThr){
        S.power = 0;
        S.feverUntil = now() + 6500;
        emit('groups:power', {charge:S.power, threshold:S.powerThr, fever: Math.max(0, S.feverUntil - now()), isFever:true});
        emit('hha:judge', {kind:'FEVER', text:'FEVER!'});
        this._coach('🔥 FEVER MODE! คะแนนคูณ + เป้าออกถี่!', 'fever');
        bodyFlash('fg-fever', 220);
        beep(980, 90, 0.025);
      }
    },

    _miss(kind){
      const S = this.S;
      S.misses++;
      S.combo = 0;

      emit('hha:judge', {kind:'MISS', text:'พลาด!'});
      bodyFlash('fg-flash-bad', 220);

      // panic
      if (S.misses % 4 === 0){
        S.panicUntil = now() + 700;
        this._coach('ใจเย็น! ตั้งหลักใหม่ แล้วค่อยยิง 🎯', 'sad');
      }

      // stun on decoy
      if (kind === 'DECOY'){
        S.stunnedUntil = now() + 900;
        emit('hha:judge', {kind:'STUN', text:'โดนหลอก!'});
        bodyFlash('fg-stun', 260);
        beep(420, 80, 0.02);
      }

      this._emitScore();
      this._emitRank();
    },

    // ------------------ Quest: Goals (5 groups) ------------------
    _goalHit(){
      const S = this.S;
      const cfg = this._cfg;
      S.goalNow++;

      if (S.goalNow >= cfg.goalHits){
        S.goalsCleared++;
        const clearedGroup = GROUPS_TH[S.goalIndex];

        this._coach(`เคลียร์ ${clearedGroup.name} แล้ว! ✅`, 'happy');

        S.goalIndex++;
        S.goalNow = 0;

        if (S.goalIndex >= GROUPS_TH.length){
          S.goalIndex = GROUPS_TH.length - 1;
          this._scoreAdd(260, true);
          this._powerAdd(2);
          this._coach('ครบทั้ง 5 หมู่แล้ว! โหดมาก! 🏆', 'happy');
          bodyFlash('fg-win', 260);
          beep(1200, 110, 0.03);
        }
      } else {
        const g = GROUPS_TH[S.goalIndex];
        if (S.goalNow === 1 || S.goalNow === Math.floor(cfg.goalHits/2)){
          this._coach(g.hint, 'neutral');
        }
      }

      this._pushQuest();
    },

    // ------------------ Mini quests (chain) ------------------
    _miniPick(){
      const r = Math.floor(this._rng()*3);
      if (r === 0){
        return { id:'STREAK', title:'Mini: Streak', desc:'ยิงถูกติดกันให้ครบ', total: 5, now:0, failOnWrong:true };
      }
      if (r === 1){
        return { id:'RUSH', title:'Mini: Rush', desc:'ยิงถูกให้ครบภายใน 8 วิ (ห้ามพลาด)', total: 5, now:0, failOnWrong:true, timeLimitMs: 8000 };
      }
      return { id:'CLEAN', title:'Mini: Clean', desc:'ห้ามพลาดระหว่างทำ (ยิงถูก 4 ครั้ง)', total: 4, now:0, failOnWrong:true };
    },

    _miniEnsure(){
      const S = this.S;
      const cfg = this._cfg;
      if (!S.miniActive && (S.correct + S.wrong) >= cfg.miniEveryHits){
        S.miniActive = this._miniPick();
        S.miniNow = 0;
        S.miniTotal = S.miniActive.total;
        S.miniStartAt = now();
        this._coach(`${S.miniActive.title} เริ่ม! ${S.miniActive.desc} ⚡`, 'neutral');
        bodyFlash('fg-mini', 180);
        beep(980, 70, 0.02);
      }
    },

    _miniHit(isCorrect){
      const S = this.S;

      this._miniEnsure();
      if (!S.miniActive) { this._pushQuest(); return; }

      const m = S.miniActive;

      // time limit
      if (m.timeLimitMs){
        const elapsed = now() - (S.miniStartAt || now());
        if (elapsed > m.timeLimitMs){
          this._coach('หมดเวลามินิ! ลองใหม่ เดี๋ยวมีมาอีก 💥', 'sad');
          S.miniActive = null; S.miniNow = 0; S.miniTotal = 0;
          this._pushQuest();
          return;
        }
      }

      if (!isCorrect && m.failOnWrong){
        this._coach('พลาดระหว่าง Mini! รีเซ็ตมินิ 😤', 'sad');
        S.miniActive = null; S.miniNow = 0; S.miniTotal = 0;
        bodyFlash('fg-mini-fail', 220);
        this._pushQuest();
        return;
      }

      if (isCorrect){
        S.miniNow++;
        if (S.miniNow >= m.total){
          S.miniCleared++;
          this._scoreAdd(160, true);
          this._powerAdd(2);
          this._coach('Mini สำเร็จ! +โบนัส 💎', 'happy');
          bodyFlash('fg-mini-win', 260);
          beep(1320, 90, 0.03);

          S.miniActive = null; S.miniNow = 0; S.miniTotal = 0;
        }
      }

      this._pushQuest();
    },

    _pushQuest(){
      const S = this.S;
      const cfg = this._cfg;
      const g = GROUPS_TH[S.goalIndex] || GROUPS_TH[GROUPS_TH.length-1];

      const goal = { title:`Goal: ${g.name}`, desc:g.hint, now:S.goalNow, total:cfg.goalHits };
      const mini = S.miniActive
        ? { title:S.miniActive.title, now:S.miniNow, total:S.miniActive.total, cleared:S.miniCleared, max:S.miniTotalAll }
        : { title:'Mini: —', now:0, total:1, cleared:S.miniCleared, max:S.miniTotalAll };

      emit('quest:update', {goal, mini});
    },

    _coach(text, mood){
      emit('hha:coach', {text:String(text||''), mood:String(mood||'neutral')});
    },

    // ------------------ time / end ------------------
    _tickTime(){
      if (!this._running) return;
      const cfg = this._cfg;
      const t = now();
      const elapsed = (t - this._t0) / 1000;
      const left = Math.max(0, Math.ceil(cfg.totalSec - elapsed));

      emit('hha:time', {left, elapsed: Math.min(cfg.totalSec, Math.floor(elapsed)), total: cfg.totalSec});

      if (left <= 0){
        this._end('timeout');
      }
    },

    _end(reason){
      if (!this._running) return;
      const S = this.S;
      const total = S.correct + S.wrong;
      const acc = total ? (S.correct/total)*100 : 0;
      const grade = calcGrade(S.score, acc, S.misses);

      this.stop(reason);

      const payload = {
        reason,
        scoreFinal: S.score,
        comboMax: S.comboMax,
        misses: S.misses,
        accuracyGoodPct: Math.round(acc*10)/10,
        grade,
        goalsCleared: S.goalsCleared,
        goalsTotal: S.goalsTotal,
        miniCleared: S.miniCleared,
        miniTotal: S.miniTotalAll,

        nTargetGoodSpawned: S.nTargetGoodSpawned,
        nTargetJunkSpawned: S.nTargetJunkSpawned,
        nTargetBossSpawned: S.nTargetBossSpawned,
        nTargetDecoySpawned: S.nTargetDecoySpawned,
        nTargetStarSpawned: S.nTargetStarSpawned,
        nTargetDiamondSpawned: S.nTargetDiamondSpawned,
        nTargetShieldSpawned: S.nTargetShieldSpawned,

        nHitGood: S.nHitGood,
        nHitJunk: S.nHitJunk,
        nHitJunkGuard: S.nHitJunkGuard,
        nExpireGood: S.nExpireGood,

        diff: this._cfg ? this._cfg.diff : undefined,
        runMode: this._cfg ? this._cfg.runMode : undefined,
        style: this._cfg ? this._cfg.style : undefined,
        seed: this._cfg ? this._cfg.seedStr : undefined
      };

      emit('hha:end', payload);
    }
  };

  // expose
  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.GameEngine = Engine;

})(typeof window !== 'undefined' ? window : globalThis);