// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups — GameEngine (classic script) — ALL-IN PATCHED
// ✅ CSS vars --x/--y/--s + classes fg-good/fg-junk/fg-decoy/fg-boss
// ✅ Multi-group targets: correct = current group, wrong = other group, junk = stun 0.8s
// ✅ FIX accuracy/grade counters (no NaN)
// ✅ Emits: hha:score, hha:time, quest:update (via groups-quests.js), groups:* , hha:rank, groups:lock

(function (root) {
  'use strict';

  const W = root;
  W.GroupsVR = W.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function emit(name, detail){
    try{ W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  // --- Difficulty tuning ---
  const DIFF = {
    easy:   { spawnEvery: 720, maxOnScreen: 5, ttl: [2200, 3400], junkRate:.18, decoyRate:.07, bossEvery: 16, bossHP: 3,
              correctScore: 120, wrongPenalty: 120, junkPenalty: 180, decoyPenalty: 140, bossScore: 220, powerThreshold: 6 },
    normal: { spawnEvery: 640, maxOnScreen: 6, ttl: [2100, 3300], junkRate:.20, decoyRate:.08, bossEvery: 14, bossHP: 3,
              correctScore: 130, wrongPenalty: 140, junkPenalty: 200, decoyPenalty: 160, bossScore: 240, powerThreshold: 7 },
    hard:   { spawnEvery: 560, maxOnScreen: 7, ttl: [2000, 3200], junkRate:.22, decoyRate:.10, bossEvery: 12, bossHP: 4,
              correctScore: 140, wrongPenalty: 160, junkPenalty: 230, decoyPenalty: 180, bossScore: 260, powerThreshold: 8 }
  };

  // --- Groups data ---
  const GROUPS = [
    { id:1, label:'หมู่ 1', foods:['🥛','🥚','🫘','🍗'] },
    { id:2, label:'หมู่ 2', foods:['🍚','🍞','🥔','🍜'] },
    { id:3, label:'หมู่ 3', foods:['🥦','🥬','🥕','🌽'] },
    { id:4, label:'หมู่ 4', foods:['🍎','🍌','🍊','🍉'] },
    { id:5, label:'หมู่ 5', foods:['🥑','🧈','🥜','🫒'] }
  ];
  const JUNK = ['🍟','🍔','🍩','🧁','🥤'];

  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function pickGroup(){ return GROUPS[(Math.random()*GROUPS.length)|0]; }

  // --- Safe spawn box based on HUD + safe-area ---
  function getSpawnBox(){
    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;

    let left  = 18, right = 18, top = 18, bot = 18;

    const cs = getComputedStyle(document.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
    const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;

    left += sal; right += sar; top += sat; bot += sab;

    const hud = document.querySelector('.hud-top');
    if (hud){
      const r = hud.getBoundingClientRect();
      top = Math.max(top, r.bottom + 14);
    } else {
      top = Math.max(top, 120 + sat);
    }

    bot = Math.max(bot, 72 + sab);

    return {
      x0: left,
      y0: top,
      x1: Math.max(left+40, w - right),
      y1: Math.max(top+80,  h - bot)
    };
  }

  // --- Engine ---
  const Engine = {
    _layerEl: null,
    _camEl: null,
    _running: false,

    _diff: 'normal',
    _cfg: DIFF.normal,

    _timeLeft: 90,
    _timerAcc: 0,

    _spawnAcc: 0,
    _targets: [],

    _score: 0,
    _combo: 0,
    _comboMax: 0,
    _misses: 0,

    _shots: 0,
    _hits: 0,

    _groupIdx: 0,
    _powerCharge: 0,

    _stunUntil: 0,

    _quest: null,
    _runMode: 'play',
    _seed: undefined,

    _correctHitsTotal: 0,

    _lockActive: false,
    _lockEl: null,
    _lockStartAt: 0,
    _lockDur: 420,
    _lockRAF: 0,

    setLayerEl(el){ this._layerEl = el; },
    setCameraEl(el){ this._camEl = el; },
    setTimeLeft(sec){ this._timeLeft = Math.max(10, sec|0); },

    start(diff, opts){
      opts = opts || {};
      this._diff = (DIFF[diff] ? diff : 'normal');
      this._cfg = DIFF[this._diff];

      this._runMode = String(opts.runMode || 'play').toLowerCase();
      this._seed = opts.seed;

      this._running = true;

      this._timerAcc = 0;
      this._spawnAcc = 0;
      this._targets = [];

      this._score = 0;
      this._combo = 0;
      this._comboMax = 0;
      this._misses = 0;

      this._shots = 0;
      this._hits = 0;

      this._powerCharge = 0;
      this._stunUntil = 0;
      this._correctHitsTotal = 0;

      this._lockActive = false;
      this._lockEl = null;

      if (this._layerEl) this._layerEl.innerHTML = '';

      this._groupIdx = 0;
      emit('groups:group_change', { label: GROUPS[this._groupIdx].label });

      // Quest init
      if (W.GroupsVR && typeof W.GroupsVR.createGroupsQuest === 'function'){
        this._quest = W.GroupsVR.createGroupsQuest({
          diff: this._diff,
          runMode: this._runMode,
          seed: this._seed
        });
        this._quest.start();
        this._quest.onGroupChange(GROUPS[this._groupIdx].label);
      } else {
        emit('quest:update', { questOk:false, groupLabel: GROUPS[this._groupIdx].label });
      }

      this._bindInput();

      this._emitScore();
      this._emitTime();
      this._emitPower();

      this._last = now();
      this._raf = requestAnimationFrame(this._loop.bind(this));
    },

    stop(reason){
      this._running = false;
      try{ cancelAnimationFrame(this._raf); }catch(_){}
      this._unbindInput();
      this._stopLock();
      emit('hha:end', { reason: reason || 'stop' });
    },

    _loop(t){
      if (!this._running) return;
      const dt = Math.min(0.05, Math.max(0.001, (t - this._last) / 1000));
      this._last = t;

      // timer
      this._timerAcc += dt;
      if (this._timerAcc >= 1){
        this._timerAcc -= 1;
        this._timeLeft = Math.max(0, (this._timeLeft|0) - 1);
        this._emitTime();
        if (this._timeLeft <= 0){
          this.stop('time');
          return;
        }
      }

      // spawn
      const isStunned = (t < this._stunUntil);
      if (!isStunned){
        this._spawnAcc += dt * 1000;
        if (this._spawnAcc >= this._cfg.spawnEvery){
          this._spawnAcc = 0;
          this._maybeSpawn();
        }
      }

      // quest tick
      if (this._quest) this._quest.tick(dt);

      requestAnimationFrame(this._loop.bind(this));
    },

    _bindInput(){
      if (this._onPointer) return;

      this._onPointer = (ev)=>{
        if (!this._running) return;
        if (now() < this._stunUntil) return;
        this._startLock(ev);
      };

      document.addEventListener('pointerdown', this._onPointer, { passive:true });
    },

    _unbindInput(){
      if (this._onPointer){
        document.removeEventListener('pointerdown', this._onPointer);
        this._onPointer = null;
      }
    },

    _emitScore(){
      emit('hha:score', {
        score: this._score|0,
        combo: this._combo|0,
        comboMax: this._comboMax|0,
        misses: this._misses|0
      });

      const acc = this._accuracy();
      const grade = this._grade(acc, this._comboMax, this._misses);
      emit('hha:rank', { grade, accuracy: acc });
    },

    _emitTime(){
      emit('hha:time', { left: this._timeLeft|0 });
    },

    _accuracy(){
      const shots = Math.max(1, this._shots|0);
      return Math.round(((this._hits|0) / shots) * 100);
    },

    _grade(acc, comboMax, misses){
      if (acc>=92 && comboMax>=10 && misses<=6) return 'SSS';
      if (acc>=88 && comboMax>=8  && misses<=8) return 'SS';
      if (acc>=82 && comboMax>=6  && misses<=10) return 'S';
      if (acc>=74) return 'A';
      if (acc>=60) return 'B';
      return 'C';
    },

    _maybeSpawn(){
      if (!this._layerEl) return;
      if (this._targets.length >= (this._cfg.maxOnScreen|0)) return;

      const bossDue = (this._correctHitsTotal > 0) && (this._correctHitsTotal % (this._cfg.bossEvery|0) === 0);
      const spawnBoss = bossDue && (Math.random() < 0.35);

      let type = 'food';
      let gid = null;
      let emoji = '🍎';

      const r = Math.random();

      if (spawnBoss){
        type = 'boss';
        gid = GROUPS[this._groupIdx].id;
        emoji = '🧠';
      } else if (r < this._cfg.junkRate){
        type = 'junk';
        emoji = pick(JUNK);
      } else if (r < (this._cfg.junkRate + this._cfg.decoyRate)){
        type = 'decoy';
        gid = GROUPS[this._groupIdx].id;
        emoji = pick(GROUPS[this._groupIdx].foods);
      } else {
        const g = pickGroup();
        gid = g.id;
        emoji = pick(g.foods);
      }

      const el = document.createElement('button');
      el.className = 'fg-target';
      el.type = 'button';
      el.setAttribute('aria-label', 'target');

      el.dataset.type = type;
      if (gid != null) el.dataset.gid = String(gid);

      if (type === 'boss'){
        el.dataset.hp = String(this._cfg.bossHP|0);
        const bar = document.createElement('div');
        bar.className = 'bossbar';
        const fill = document.createElement('div');
        fill.className = 'bossbar-fill';
        bar.appendChild(fill);
        el.appendChild(bar);
        el.classList.add('fg-boss');
      } else if (type === 'junk'){
        el.classList.add('fg-junk');
      } else if (type === 'decoy'){
        el.classList.add('fg-decoy');
      } else {
        const curId = GROUPS[this._groupIdx].id;
        if ((gid|0) === (curId|0)) el.classList.add('fg-good');
      }

      const span = document.createElement('span');
      span.textContent = emoji;
      span.style.pointerEvents = 'none';
      el.insertBefore(span, el.firstChild);

      const box = getSpawnBox();
      const x = box.x0 + Math.random() * Math.max(10, (box.x1 - box.x0));
      const y = box.y0 + Math.random() * Math.max(10, (box.y1 - box.y0));
      const s = 0.92 + Math.random()*0.22;

      el.style.setProperty('--x', Math.round(x) + 'px');
      el.style.setProperty('--y', Math.round(y) + 'px');
      el.style.setProperty('--s', String(s));

      el.classList.add('show','spawn');
      setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch{} }, 220);

      // tap hit immediately
      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        this._stopLock();
        this._hitTarget(el, 'tap');
      }, { passive:false });

      this._layerEl.appendChild(el);
      this._targets.push(el);

      const ttl = (this._cfg.ttl[0] + Math.random()*(this._cfg.ttl[1]-this._cfg.ttl[0]))|0;
      const timer = setTimeout(()=>{
        if (!el.isConnected) return;
        this._expireTarget(el);
      }, ttl);
      el._ttlTimer = timer;
    },

    _expireTarget(el){
      this._misses++;
      this._combo = 0;
      this._shots++;
      this._removeTarget(el, 'out');
      this._emitScore();
      if (this._quest) this._quest.onShot({ correct:false, wrong:true, junk:false });
    },

    _removeTarget(el, anim){
      try{ if (el && el._ttlTimer) clearTimeout(el._ttlTimer); }catch(_){}
      try{
        const i = this._targets.indexOf(el);
        if (i >= 0) this._targets.splice(i, 1);
      }catch(_){}
      try{
        if (anim) el.classList.add(anim);
        const kill = ()=>{ try{ if (el && el.parentNode) el.parentNode.removeChild(el); }catch(_){} };
        setTimeout(kill, anim ? 200 : 0);
      }catch(_){}
    },

    _closestTarget(x,y){
      let best = null, bestD = 1e9;
      for (let i=0;i<this._targets.length;i++){
        const el = this._targets[i];
        if (!el || !el.isConnected) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;
        const dx = cx - x, dy = cy - y;
        const d = dx*dx + dy*dy;
        if (d < bestD){ bestD = d; best = el; }
      }
      return { el: best, d2: bestD };
    },

    _startLock(ev){
      const x = (ev && ev.clientX!=null) ? ev.clientX : (window.innerWidth/2);
      const y = (ev && ev.clientY!=null) ? ev.clientY : (window.innerHeight/2);

      const c = this._closestTarget(x,y);
      if (!c.el || c.d2 > (210*210)){
        this._shots++;
        this._misses++;
        this._combo = 0;
        this._emitScore();
        if (this._quest) this._quest.onShot({ correct:false, wrong:true, junk:false });
        emit('groups:lock', { on:false });
        return;
      }

      this._lockActive = true;
      this._lockEl = c.el;
      this._lockStartAt = now();

      try{ this._lockEl.classList.add('lock'); }catch(_){}
      this._tickLock();
    },

    _tickLock(){
      if (!this._lockActive || !this._lockEl || !this._lockEl.isConnected){
        emit('groups:lock', { on:false });
        this._stopLock();
        return;
      }

      const t = now();
      const prog = clamp((t - this._lockStartAt) / (this._lockDur|0), 0, 1);

      const r = this._lockEl.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;

      const th = Math.max(1, this._cfg.powerThreshold|0);
      const charge = clamp((this._powerCharge|0) / th, 0, 1);

      emit('groups:lock', { on:true, x:cx, y:cy, prog, charge });

      if (prog >= 1){
        const hitEl = this._lockEl;
        this._stopLock();
        this._hitTarget(hitEl, 'lock');
        emit('groups:lock', { on:false });
        return;
      }

      this._lockRAF = requestAnimationFrame(()=>this._tickLock());
    },

    _stopLock(){
      this._lockActive = false;
      if (this._lockRAF){ try{ cancelAnimationFrame(this._lockRAF); }catch(_){ } }
      this._lockRAF = 0;

      if (this._lockEl){
        try{ this._lockEl.classList.remove('lock'); }catch(_){}
      }
      this._lockEl = null;

      emit('groups:lock', { on:false });
    },

    _hitTarget(el){
      if (!el || !el.isConnected) return;
      const t = now();
      if (t < this._stunUntil) return;

      const type = String(el.dataset.type || 'food');
      const cur = GROUPS[this._groupIdx];
      const curId = cur.id|0;

      this._shots++;

      if (type === 'junk'){
        this._score -= (this._cfg.junkPenalty|0);
        this._misses++;
        this._combo = 0;

        this._stunUntil = t + 800;
        emit('groups:stun', { on:true, ms:800 });

        document.documentElement.classList.add('stunflash');
        setTimeout(()=>document.documentElement.classList.remove('stunflash'), 220);

        if (navigator.vibrate) { try{ navigator.vibrate([60,60,60]); }catch(_){ } }

        try{ el.classList.add('hit'); }catch(_){}
        this._removeTarget(el, 'hit');

        if (this._quest) this._quest.onShot({ correct:false, wrong:false, junk:true });
        this._emitScore();
        return;
      }

      if (type === 'boss'){
        let hp = parseInt(el.dataset.hp || '1', 10) || 1;
        hp = Math.max(0, hp - 1);
        el.dataset.hp = String(hp);

        this._hits++;
        this._score += (this._cfg.bossScore|0);
        this._combo++;
        if (this._combo > this._comboMax) this._comboMax = this._combo;

        const maxHP = (this._cfg.bossHP|0);
        const fill = el.querySelector('.bossbar-fill');
        if (fill){
          const pct = clamp(hp / Math.max(1,maxHP), 0, 1);
          fill.style.width = Math.round(pct*100) + '%';
        }

        if (hp <= 0){
          try{ el.classList.add('hit'); }catch(_){}
          this._removeTarget(el, 'hit');
        } else {
          if (hp <= 1) { try{ el.classList.add('rage'); }catch(_){ } }
        }

        this._powerCharge++;
        this._emitPower();

        if (this._quest) this._quest.onShot({ correct:true, wrong:false, junk:false });
        this._emitScore();
        return;
      }

      if (type === 'decoy'){
        this._score -= (this._cfg.decoyPenalty|0);
        this._misses++;
        this._combo = 0;

        try{ el.classList.add('hit'); }catch(_){}
        this._removeTarget(el, 'hit');

        if (this._quest) this._quest.onShot({ correct:false, wrong:true, junk:false });
        this._emitScore();
        return;
      }

      // normal food
      const gid = parseInt(el.dataset.gid || '0', 10) || 0;
      const isCorrect = (gid|0) === (curId|0);

      if (isCorrect){
        this._hits++;
        this._correctHitsTotal++;

        this._score += (this._cfg.correctScore|0);
        this._combo++;
        if (this._combo > this._comboMax) this._comboMax = this._combo;

        this._powerCharge++;
        this._emitPower();

        if (this._powerCharge >= (this._cfg.powerThreshold|0)){
          this._powerCharge = 0;
          this._groupIdx = (this._groupIdx + 1) % GROUPS.length;
          const n = GROUPS[this._groupIdx];

          emit('groups:group_change', { label: n.label });
          document.documentElement.classList.add('swapflash');
          setTimeout(()=>document.documentElement.classList.remove('swapflash'), 240);

          if (this._quest) this._quest.onGroupChange(n.label);
          this._emitPower();
        }

        if (this._quest) this._quest.onShot({ correct:true, wrong:false, junk:false });
      } else {
        this._score -= (this._cfg.wrongPenalty|0);
        this._misses++;
        this._combo = 0;
        if (this._quest) this._quest.onShot({ correct:false, wrong:true, junk:false });
      }

      try{ el.classList.add('hit'); }catch(_){}
      this._removeTarget(el, 'hit');
      this._emitScore();
    },

    _emitPower(){
      const g = GROUPS[this._groupIdx];
      const th = Math.max(1, this._cfg.powerThreshold|0);
      const c = this._powerCharge|0;
      emit('groups:power', { groupName: g.label, charge: c, threshold: th });
    }
  };

  W.GroupsVR.GameEngine = Engine;

})(window);