/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — DOM Engine (PRODUCTION)
Exports: window.GroupsVR.GameEngine
Events:
- hha:score {score,combo,comboMax,misses,correct,wrong}
- hha:time  {left,elapsed,total}
- groups:power {charge,threshold,fever,isFever}
- hha:rank {grade}
- quest:update {goal:{...}, mini:{...}}
- hha:coach {text,mood}
- hha:judge {kind,text}
- hha:end {reason,scoreFinal,comboMax,misses,accuracyGoodPct,grade,goalsCleared,goalsTotal,miniCleared,miniTotal, ...metrics}
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
      const dur = 520;
      (function tick(){
        const p = (now()-t0)/dur;
        if (p>=1){ el.remove(); return; }
        el.style.opacity = String(1 - p);
        el.style.transform = `translate(-50%,-50%) translateY(${(-18*p).toFixed(1)}px) scale(${(1+0.25*p).toFixed(2)})`;
        requestAnimationFrame(tick);
      })();
    }catch{}
  }

  function bodyFlashBad(){
    doc.body.classList.add('fg-flash-bad');
    setTimeout(()=>doc.body.classList.remove('fg-flash-bad'), 220);
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

  // grade thresholds (tuned for mobile quick play)
  function calcGrade(score, acc, misses){
    // score main + punish misses a bit
    const eff = score + (acc*2) - (misses*6);
    if (eff >= 1200 && acc >= 90 && misses <= 3) return 'SSS';
    if (eff >= 900  && acc >= 85) return 'SS';
    if (eff >= 650  && acc >= 78) return 'S';
    if (eff >= 420  && acc >= 68) return 'A';
    if (eff >= 220  && acc >= 55) return 'B';
    return 'C';
  }

  // ------------------ difficulty presets ------------------
  function preset(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff === 'easy'){
      return {
        spawnEveryMs: 780,
        ttlMs: 2400,
        junkBias: 0.18,
        size: 1.02,
        goalHits: 6,
        miniEveryHits: 8,
        powerThr: 10,
        bossChance: 0.06,
        decoyChance: 0.10,
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
      };
    }
    return {
      spawnEveryMs: 650,
      ttlMs: 2150,
      junkBias: 0.25,
      size: 0.97,
      goalHits: 8,
      miniEveryHits: 7,
      powerThr: 11,
      bossChance: 0.08,
      decoyChance: 0.12,
    };
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
      goalIndex: 0,     // 0..4
      goalNow: 0,
      goalsCleared: 0,
      goalsTotal: 5,
      // mini
      miniActive: null,
      miniNow: 0,
      miniTotal: 0,
      miniCleared: 0,
      miniTotalAll: 999, // open ended but we report cleared count
      // power
      power: 0,
      powerThr: 10,
      feverUntil: 0,
      // anti spam
      stunnedUntil: 0,
      panicUntil: 0,
      // metrics
      nTargetGoodSpawned: 0,
      nTargetJunkSpawned: 0,
      nTargetBossSpawned: 0,
      nTargetDecoySpawned: 0,
      nHitGood: 0,
      nHitJunk: 0,
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
      // research: no adaptive; play: adaptive ok
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
      };

      this._rng = mulberry32(hashSeed(seedStr));
      this._running = true;
      this._t0 = now();
      this._lastSpawnAt = 0;

      // reset state
      const S = this.S;
      for (const k of Object.keys(S)){
        // keep totals
      }
      Object.assign(S,{
        score:0, combo:0, comboMax:0, misses:0, correct:0, wrong:0,
        goalIndex:0, goalNow:0, goalsCleared:0, goalsTotal:5,
        miniActive:null, miniNow:0, miniTotal:0, miniCleared:0, miniTotalAll:999,
        power:0, powerThr:this._cfg.powerThr, feverUntil:0,
        stunnedUntil:0, panicUntil:0,
        nTargetGoodSpawned:0, nTargetJunkSpawned:0, nTargetBossSpawned:0, nTargetDecoySpawned:0,
        nHitGood:0, nHitJunk:0, nExpireGood:0
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

      // input
      this._bindInput();

      // open with coach
      this._coach(`เริ่มเลย! เป้าหมาย: ${GROUPS_TH[0].name} ✅`, 'neutral');
      this._pushQuest();

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
      const onUp = ()=>{
        drag.on = false;
      };

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
        // gamma: left/right, beta: front/back
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

      // fever decay
      const isFever = (t < S.feverUntil);

      // adaptive (play mode only)
      if (cfg.allowAdaptive && (t - this._t0) > 1800 && (t % 900) < 17){
        // simple adjust by accuracy
        const totalHits = S.correct + S.wrong;
        const acc = totalHits ? (S.correct/totalHits)*100 : 0;
        let se = cfg.spawnEveryMs;
        let ttl = cfg.ttlMs;
        let jb = cfg.junkBias;

        if (acc > 85 && S.misses <= 3){
          se = Math.max(430, se - 30);
          ttl = Math.max(1550, ttl - 35);
          jb = clamp(jb + 0.015, 0.12, 0.42);
        } else if (acc < 60 || S.misses > 7){
          se = Math.min(920, se + 35);
          ttl = Math.min(2600, ttl + 40);
          jb = clamp(jb - 0.015, 0.10, 0.38);
        }
        cfg.spawnEveryMs = se;
        cfg.ttlMs = ttl;
        cfg.junkBias = jb;

        emit('hha:adaptive', {spawnEveryMs: se, ttlMs: ttl, junkBias: jb});
      }

      // spawn
      const spawnEvery = isFever ? Math.max(320, cfg.spawnEveryMs * 0.72) : cfg.spawnEveryMs;
      if (!this._lastSpawnAt || (t - this._lastSpawnAt) >= spawnEvery){
        this._lastSpawnAt = t;
        // occasionally boss
        const rBoss = this._rng();
        if (rBoss < cfg.bossChance) this._spawnBoss();
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
            // expired
            const good = (n.dataset.good === '1');
            const kind = n.dataset.kind || 'normal';

            n.classList.add('out');
            setTimeout(()=> n.remove(), 160);

            if (good && kind !== 'boss'){
              // miss rule: good expired counts as miss
              S.misses++;
              S.combo = 0;
              S.nExpireGood++;
              emit('hha:judge', {kind:'MISS', text:'หมดเวลา!'});
              bodyFlashBad();
            }
            this._emitScore();
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
      const qw = doc.querySelector('.fg-questwrap');
      const topCandidates = [];

      if (hud){
        const r = hud.getBoundingClientRect();
        topCandidates.push(r.bottom + 10);
      }
      if (ct){
        const r = ct.getBoundingClientRect();
        topCandidates.push(r.bottom + 10);
      }
      if (qw){
        const r = qw.getBoundingClientRect();
        topCandidates.push(r.bottom + 10);
      }
      if (topCandidates.length){
        top = Math.max(top, ...topCandidates);
      }

      // power bar blocks (bottom)
      const pw = doc.querySelector('.powerWrap');
      if (pw){
        const r = pw.getBoundingClientRect();
        bottom = Math.min(bottom, r.top - 12);
      }

      // side safety (keep away from screen edges)
      left = Math.max(left, 12);
      right = Math.min(right, w - 12);

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
      const t = now();

      const rect = this._safeRect();
      const x = rect.left + (rect.right-rect.left)*this._rng();
      const y = rect.top + (rect.bottom-rect.top)*this._rng();

      // decide correct group vs junk/decoy
      const goalG = GROUPS_TH[S.goalIndex];
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
        // decoy looks like correct group but is WRONG
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
      const ttl = Math.max(1500, cfg.ttlMs * 1.25);

      const el = this._mkTarget({
        x,y,emoji,
        good:true,
        kind:'boss',
        ttl,
        scale: cfg.size*1.45
      });

      el.dataset.hitsNeed = '3';
      el.dataset.hitsNow = '0';

      S.nTargetBossSpawned++;
      emit('hha:judge', {kind:'BOSS', text:'Boss!'});
      this._coach('บอสมาแล้ว! กดให้ครบ 3 ครั้งก่อนมันหนี! 👊', 'neutral');

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

      // help hitbox on mobile
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

      if (t < S.stunnedUntil) return; // stunned lock
      const kind = el.dataset.kind || 'normal';
      const good = (el.dataset.good === '1');

      // boss needs multi hits
      if (kind === 'boss'){
        const need = Math.max(2, Number(el.dataset.hitsNeed||3));
        const cur = Number(el.dataset.hitsNow||0) + 1;
        el.dataset.hitsNow = String(cur);

        // tiny pop
        const p = (ev && (ev.touches && ev.touches[0])) ? ev.touches[0] : ev;
        fxPop(`👊 ${cur}/${need}`, p ? p.clientX : (root.innerWidth*0.5), p ? p.clientY : (root.innerHeight*0.5));

        if (cur < need){
          // reward small
          this._scoreAdd(12, true);
          emit('groups:progress', {type:'hit', correct:true, kind:'boss', stage:cur});
          return;
        }
        // boss cleared
        el.classList.add('hit');
        setTimeout(()=>el.remove(), 180);
        this._scoreAdd(120, true);
        this._powerAdd(3);
        this._goalHit(); // boss counts as a goal hit
        emit('hha:judge', {kind:'BOSS', text:'Boss cleared!'});
        this._coach('สุดยอด! ล้มบอสได้แล้ว! 🏆', 'happy');
        emit('groups:progress', {type:'hit', correct:true, kind:'boss', stage:need});
        return;
      }

      // normal/junk/decoy
      el.classList.add('hit');
      setTimeout(()=>el.remove(), 160);

      if (good){
        S.nHitGood++;
        this._scoreAdd(this._isFever()? 26 : 18, true);
        this._powerAdd(1);
        this._goalHit();
        this._miniHit(true);
        emit('groups:progress', {type:'hit', correct:true, kind});
      } else {
        S.nHitJunk++;
        this._scoreAdd(-8, false);
        this._miss(kind === 'decoy' ? 'DECOY' : 'JUNK');
        this._miniHit(false);
        emit('groups:progress', {type:'hit', correct:false, kind});
      }
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

      // FX pop
      const cx = root.innerWidth*0.5;
      const cy = root.innerHeight*0.45;
      fxPop(correct ? `+${Math.max(1,Math.round(delta))}` : `${delta}`, cx, cy);

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

      // auto trigger fever when full
      if (S.power >= S.powerThr){
        S.power = 0;
        S.feverUntil = now() + 6500; // 6.5s fever
        emit('groups:power', {charge:S.power, threshold:S.powerThr, fever: Math.max(0, S.feverUntil - now()), isFever:true});
        emit('hha:judge', {kind:'FEVER', text:'FEVER!'});
        this._coach('🔥 FEVER MODE! คะแนนคูณ + เป้าออกถี่!', 'fever');
      }
    },

    _miss(kind){
      const S = this.S;
      S.misses++;
      S.combo = 0;

      emit('hha:judge', {kind:'MISS', text:'พลาด!'});
      bodyFlashBad();

      // panic if miss too many
      if (S.misses % 4 === 0){
        S.panicUntil = now() + 700;
        this._coach('ใจเย็น! ตั้งหลักใหม่ แล้วค่อยยิง 🎯', 'sad');
      }

      // stun on decoy (strong penalty)
      if (kind === 'DECOY'){
        S.stunnedUntil = now() + 900;
        emit('hha:judge', {kind:'STUN', text:'โดนหลอก!'});
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
        // clear goal
        S.goalsCleared++;
        const clearedGroup = GROUPS_TH[S.goalIndex];

        this._coach(`เคลียร์ ${clearedGroup.name} แล้ว! ✅`, 'happy');

        S.goalIndex++;
        S.goalNow = 0;

        if (S.goalIndex >= GROUPS_TH.length){
          // all goals complete -> continue loop but bonus
          S.goalIndex = GROUPS_TH.length - 1;
          // huge bonus and keep last group
          this._scoreAdd(220, true);
          this._powerAdd(2);
          this._coach('ครบทั้ง 5 หมู่แล้ว! โหดมาก! 🏆', 'happy');
        }
      } else {
        // occasional hint lines (Thai song style)
        const g = GROUPS_TH[S.goalIndex];
        if (S.goalNow === 1 || S.goalNow === Math.floor(cfg.goalHits/2)){
          this._coach(g.hint, 'neutral');
        }
      }

      this._pushQuest();
    },

    // ------------------ Mini quests (chain) ------------------
    _miniPick(){
      // rotate minis: streak, speed, no-miss window
      const S = this.S;
      const r = Math.floor(this._rng()*3);
      if (r === 0){
        return { id:'STREAK', title:'Mini: Streak', desc:'ยิงถูกติดกันให้ครบ', total: 5, now:0, failOnWrong:true };
      }
      if (r === 1){
        return { id:'RUSH', title:'Mini: Rush', desc:'ยิงถูกให้ครบภายใน 8 วิ', total: 5, now:0, failOnWrong:true, timeLimitMs: 8000 };
      }
      return { id:'CLEAN', title:'Mini: Clean', desc:'ห้ามพลาดระหว่างทำ (ยิงถูก 4 ครั้ง)', total: 4, now:0, failOnWrong:true };
    },

    _miniEnsure(){
      const S = this.S;
      const cfg = this._cfg;
      // start first mini after some hits
      if (!S.miniActive && (S.correct + S.wrong) >= cfg.miniEveryHits){
        S.miniActive = this._miniPick();
        S.miniNow = 0;
        S.miniTotal = S.miniActive.total;
        S.miniStartAt = now();
        this._coach(`${S.miniActive.title} เริ่ม! ${S.miniActive.desc} ⚡`, 'neutral');
      }
    },

    _miniHit(isCorrect){
      const S = this.S;
      const cfg = this._cfg;

      this._miniEnsure();
      if (!S.miniActive) { this._pushQuest(); return; }

      const m = S.miniActive;
      // time limit check
      if (m.timeLimitMs){
        const elapsed = now() - (S.miniStartAt || now());
        if (elapsed > m.timeLimitMs){
          // fail and reroll later
          this._coach('หมดเวลามินิ! ลองใหม่ เดี๋ยวมีมาอีก 💥', 'sad');
          S.miniActive = null;
          S.miniNow = 0;
          S.miniTotal = 0;
          this._pushQuest();
          return;
        }
      }

      if (!isCorrect && m.failOnWrong){
        this._coach('พลาดระหว่าง Mini! รีเซ็ตมินิ 😤', 'sad');
        S.miniActive = null;
        S.miniNow = 0;
        S.miniTotal = 0;
        this._pushQuest();
        return;
      }

      if (isCorrect){
        S.miniNow++;
        if (S.miniNow >= m.total){
          S.miniCleared++;
          this._scoreAdd(140, true);
          this._powerAdd(2);
          this._coach(`Mini สำเร็จ! +โบนัส 💎`, 'happy');
          // next mini later
          S.miniActive = null;
          S.miniNow = 0;
          S.miniTotal = 0;
        }
      }

      this._pushQuest();
    },

    _pushQuest(){
      const S = this.S;
      const cfg = this._cfg;
      const g = GROUPS_TH[S.goalIndex] || GROUPS_TH[GROUPS_TH.length-1];

      const goal = {
        title: `Goal: ${g.name}`,
        desc: g.hint,
        now: S.goalNow,
        total: cfg.goalHits
      };

      const mini = S.miniActive
        ? { title: S.miniActive.title, now: S.miniNow, total: S.miniActive.total, cleared:S.miniCleared, max:S.miniTotalAll }
        : { title: 'Mini: —', now: 0, total: 1, cleared:S.miniCleared, max:S.miniTotalAll };

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
        nHitGood: S.nHitGood,
        nHitJunk: S.nHitJunk,
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