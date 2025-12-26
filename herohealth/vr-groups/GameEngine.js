// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups — GameEngine (classic script) — PRODUCTION ALL-IN
// ✅ DOM targets w/ CSS vars --x/--y/--s (px)
// ✅ Types: food (good/wrong), junk (stun), decoy (trap), boss (multi-hit)
// ✅ Emits: hha:score, hha:time, hha:rank(grade+accuracy), hha:end(summary),
//          groups:group_change, groups:power, groups:lock, groups:stun, groups:panic
// ✅ No NaN counters, safe timers/raf, TTL cleanup
// ✅ Works with: groups-quests.js (createGroupsQuest) + groups-fx.js + groups-hud-quest.js

(function (root) {
  'use strict';

  const W = root;
  const doc = W.document;
  W.GroupsVR = W.GroupsVR || {};

  // ---------------- helpers ----------------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){
    return (W.performance && performance.now) ? performance.now() : Date.now();
  }
  function emit(name, detail){
    try{ W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // ---------------- difficulty tuning ----------------
  const DIFF = {
    easy: {
      spawnEvery: 720, maxOnScreen: 5,
      ttl: [2200, 3400],
      junkRate: .18, decoyRate: .07,
      bossEvery: 16, bossHP: 3, bossChance: .35,
      correctScore: 120, wrongPenalty: 120, junkPenalty: 180, decoyPenalty: 140, bossScore: 220,
      powerThreshold: 6,
      lockDist: 210, lockDur: 420
    },
    normal: {
      spawnEvery: 640, maxOnScreen: 6,
      ttl: [2100, 3300],
      junkRate: .20, decoyRate: .08,
      bossEvery: 14, bossHP: 3, bossChance: .35,
      correctScore: 130, wrongPenalty: 140, junkPenalty: 200, decoyPenalty: 160, bossScore: 240,
      powerThreshold: 7,
      lockDist: 210, lockDur: 420
    },
    hard: {
      spawnEvery: 560, maxOnScreen: 7,
      ttl: [2000, 3200],
      junkRate: .22, decoyRate: .10,
      bossEvery: 12, bossHP: 4, bossChance: .38,
      correctScore: 140, wrongPenalty: 160, junkPenalty: 230, decoyPenalty: 180, bossScore: 260,
      powerThreshold: 8,
      lockDist: 210, lockDur: 420
    }
  };

  // ---------------- groups data ----------------
  const GROUPS = [
    { id:1, label:'หมู่ 1', foods:['🥛','🥚','🫘','🍗'] },
    { id:2, label:'หมู่ 2', foods:['🍚','🍞','🥔','🍜'] },
    { id:3, label:'หมู่ 3', foods:['🥦','🥬','🥕','🌽'] },
    { id:4, label:'หมู่ 4', foods:['🍎','🍌','🍊','🍉'] },
    { id:5, label:'หมู่ 5', foods:['🥑','🧈','🥜','🫒'] }
  ];
  const JUNK = ['🍟','🍔','🍩','🧁','🥤'];

  function pickGroup(){ return GROUPS[(Math.random()*GROUPS.length)|0]; }

  // ---------------- spawn box (safe-zone + HUD) ----------------
  function getSpawnBox(){
    const w = W.innerWidth || 360;
    const h = W.innerHeight || 640;

    // base margins
    let left=18, right=18, top=18, bot=18;

    // safe-area from :root vars (strings like "20px")
    const cs = W.getComputedStyle(doc.documentElement);
    const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
    const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
    const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
    const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;

    left += sal; right += sar; top += sat; bot += sab;

    // reserve HUD actual height if exists
    const hud = doc.querySelector('.hud-top');
    if (hud){
      const r = hud.getBoundingClientRect();
      top = Math.max(top, r.bottom + 14);
    } else {
      top = Math.max(top, 120 + sat);
    }

    // reserve bottom for gesture bar / safe UI
    bot = Math.max(bot, 72 + sab);

    // usable region
    const x0 = left;
    const y0 = top;
    const x1 = Math.max(left + 60, w - right);
    const y1 = Math.max(top + 100, h - bot);

    return { x0, y0, x1, y1, w, h };
  }

  // ---------------- engine ----------------
  const Engine = {
    _layerEl: null,
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

    // accuracy stats
    _shots: 0,
    _hits: 0,

    _groupIdx: 0,
    _powerCharge: 0,

    _stunUntil: 0,

    _quest: null,
    _runMode: 'play',
    _seed: '',

    // boss pacing
    _correctHitsTotal: 0,

    // lock
    _lockActive: false,
    _lockEl: null,
    _lockStartAt: 0,
    _lockRAF: 0,

    // raf loop
    _raf: 0,
    _last: 0,

    setLayerEl(el){ this._layerEl = el; },
    setTimeLeft(sec){ this._timeLeft = Math.max(10, sec|0); },

    start(diff, opts){
      opts = opts || {};
      this._diff = (DIFF[String(diff).toLowerCase()] ? String(diff).toLowerCase() : 'normal');
      this._cfg = DIFF[this._diff];

      this._runMode = String(opts.runMode || 'play').toLowerCase();
      this._seed = String(opts.seed || '');

      this._running = true;

      this._timerAcc = 0;
      this._spawnAcc = 0;

      this._targets = [];
      this._score = 0;
      this._combo = 0;
      this._comboMax = 0;
      this._misses = 0;
      this._shots = 0;
      this._hits  = 0;

      this._powerCharge = 0;
      this._stunUntil = 0;
      this._correctHitsTotal = 0;

      this._stopLock();

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
        this._quest = null;
        emit('quest:update', { questOk:false, groupLabel: GROUPS[this._groupIdx].label });
      }

      this._bindInput();

      this._emitScore();
      this._emitTime();
      this._emitPower();

      this._last = now();
      try{ cancelAnimationFrame(this._raf); }catch(_){}
      this._raf = requestAnimationFrame(this._loop.bind(this));
    },

    stop(reason){
      if (!this._running) return;
      this._running = false;

      try{ cancelAnimationFrame(this._raf); }catch(_){}
      this._raf = 0;

      this._unbindInput();
      this._stopLock();

      // cleanup targets
      try{
        for (let i=0;i<this._targets.length;i++){
          const el = this._targets[i];
          if (el && el._ttlTimer) clearTimeout(el._ttlTimer);
          if (el && el.parentNode) el.parentNode.removeChild(el);
        }
      }catch(_){}
      this._targets = [];

      const acc = this._accuracy();
      const grade = this._grade(acc, this._comboMax, this._misses);

      // quest snapshot
      let q = null;
      try{ if (this._quest && typeof this._quest.snapshot === 'function') q = this._quest.snapshot(); }catch(_){}

      emit('hha:end', {
        reason: reason || 'stop',
        diff: this._diff,
        runMode: this._runMode,
        seed: (this._quest && this._quest.seed) ? this._quest.seed : this._seed,

        scoreFinal: this._score|0,
        comboMax: this._comboMax|0,
        misses: this._misses|0,
        shots: this._shots|0,
        hits: this._hits|0,
        accuracy: acc,
        grade: grade,

        groupIndexEnd: this._groupIdx|0,
        correctHitsTotal: this._correctHitsTotal|0,

        quest: q
      });
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

      const isStunned = (t < this._stunUntil);

      // spawn
      if (!isStunned){
        this._spawnAcc += dt * 1000;
        if (this._spawnAcc >= (this._cfg.spawnEvery|0)){
          this._spawnAcc = 0;
          this._maybeSpawn();
        }
      }

      // quest tick
      if (this._quest && typeof this._quest.tick === 'function'){
        this._quest.tick(dt);
      }

      // keep loop
      this._raf = requestAnimationFrame(this._loop.bind(this));
    },

    // ---------------- HUD emits ----------------
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

    _emitPower(){
      const g = GROUPS[this._groupIdx];
      const th = Math.max(1, this._cfg.powerThreshold|0);
      const c  = this._powerCharge|0;
      emit('groups:power', { groupName: g.label, charge: c, threshold: th });
    },

    _accuracy(){
      const shots = Math.max(1, this._shots|0);
      return Math.round(((this._hits|0) / shots) * 100);
    },

    _grade(acc, comboMax, misses){
      // SSS/SS/S/A/B/C
      if (acc>=92 && comboMax>=10 && misses<=6) return 'SSS';
      if (acc>=88 && comboMax>=8  && misses<=8) return 'SS';
      if (acc>=82 && comboMax>=6  && misses<=10) return 'S';
      if (acc>=74) return 'A';
      if (acc>=60) return 'B';
      return 'C';
    },

    // ---------------- input ----------------
    _bindInput(){
      if (this._onPointer) return;

      this._onPointer = (ev)=>{
        if (!this._running) return;
        if (now() < this._stunUntil) return;
        this._startLock(ev);
      };

      doc.addEventListener('pointerdown', this._onPointer, { passive:true });
    },

    _unbindInput(){
      if (!this._onPointer) return;
      doc.removeEventListener('pointerdown', this._onPointer);
      this._onPointer = null;
    },

    // ---------------- spawn + target lifecycle ----------------
    _maybeSpawn(){
      if (!this._layerEl) return;
      if (this._targets.length >= (this._cfg.maxOnScreen|0)) return;

      // boss pacing: every N correct hits, maybe boss
      const bossDue =
        (this._correctHitsTotal > 0) &&
        (this._correctHitsTotal % (this._cfg.bossEvery|0) === 0);
      const spawnBoss = bossDue && (Math.random() < (this._cfg.bossChance||.35));

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

      const el = doc.createElement('button');
      el.className = 'fg-target';
      el.type = 'button';
      el.setAttribute('aria-label', 'target');

      el.dataset.type = type;
      if (gid != null) el.dataset.gid = String(gid);

      if (type === 'boss'){
        el.dataset.hp = String(this._cfg.bossHP|0);

        const bar = doc.createElement('div');
        bar.className = 'bossbar';
        const fill = doc.createElement('div');
        fill.className = 'bossbar-fill';
        bar.appendChild(fill);
        el.appendChild(bar);

        el.classList.add('fg-boss');
      } else if (type === 'junk'){
        el.classList.add('fg-junk');
      } else if (type === 'decoy'){
        el.classList.add('fg-decoy');
      } else {
        const curId = GROUPS[this._groupIdx].id|0;
        if ((gid|0) === curId) el.classList.add('fg-good');
      }

      // emoji
      const span = doc.createElement('span');
      span.textContent = emoji;
      span.style.pointerEvents = 'none';
      el.insertBefore(span, el.firstChild);

      // pos
      const box = getSpawnBox();
      const x = box.x0 + Math.random() * Math.max(10, (box.x1 - box.x0));
      const y = box.y0 + Math.random() * Math.max(10, (box.y1 - box.y0));
      const s = 0.92 + Math.random()*0.22;

      el.style.setProperty('--x', Math.round(x) + 'px');
      el.style.setProperty('--y', Math.round(y) + 'px');
      el.style.setProperty('--s', String(s));

      // show
      el.classList.add('show','spawn');
      setTimeout(()=>{ try{ el.classList.remove('spawn'); }catch(_){} }, 220);

      // tap = immediate hit
      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        this._stopLock();
        this._hitTarget(el, 'tap');
      }, { passive:false });

      this._layerEl.appendChild(el);
      this._targets.push(el);

      // TTL
      const ttl = (this._cfg.ttl[0] + Math.random()*(this._cfg.ttl[1]-this._cfg.ttl[0]))|0;
      el._ttlTimer = setTimeout(()=>{
        if (!el.isConnected) return;
        this._expireTarget(el);
      }, ttl);
    },

    _expireTarget(el){
      // expire => miss (counts as wrong shot)
      this._misses++;
      this._combo = 0;
      this._shots++; // shot occurred but no hit
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
        setTimeout(()=>{
          try{ if (el && el.parentNode) el.parentNode.removeChild(el); }catch(_){}
        }, anim ? 220 : 0);
      }catch(_){}
    },

    // ---------------- lock system ----------------
    _closestTarget(x,y){
      let best=null, bestD=1e9;
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
      const x = (ev && ev.clientX!=null) ? ev.clientX : (W.innerWidth/2);
      const y = (ev && ev.clientY!=null) ? ev.clientY : (W.innerHeight/2);

      const near = this._closestTarget(x,y);
      const dist = (this._cfg.lockDist|0) || 210;

      if (!near.el || near.d2 > (dist*dist)){
        // miss shot
        this._shots++;
        this._misses++;
        this._combo = 0;
        this._emitScore();
        if (this._quest) this._quest.onShot({ correct:false, wrong:true, junk:false });
        emit('groups:lock', { on:false });
        return;
      }

      this._lockActive = true;
      this._lockEl = near.el;
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
      const dur = (this._cfg.lockDur|0) || 420;
      const prog = clamp((t - this._lockStartAt) / dur, 0, 1);

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
      if (this._lockRAF){
        try{ cancelAnimationFrame(this._lockRAF); }catch(_){}
      }
      this._lockRAF = 0;

      if (this._lockEl){
        try{ this._lockEl.classList.remove('lock'); }catch(_){}
      }
      this._lockEl = null;

      emit('groups:lock', { on:false });
    },

    // ---------------- hit logic ----------------
    _hitTarget(el, via){
      if (!el || !el.isConnected) return;

      const t = now();
      if (t < this._stunUntil) return;

      const type = String(el.dataset.type || 'food');
      const cur = GROUPS[this._groupIdx];
      const curId = cur.id|0;

      // count shot
      this._shots++;

      if (type === 'junk'){
        this._score -= (this._cfg.junkPenalty|0);
        this._misses++;
        this._combo = 0;

        // stun
        this._stunUntil = t + 800;
        emit('groups:stun', { on:true, ms:800 });

        doc.documentElement.classList.add('stunflash');
        setTimeout(()=>doc.documentElement.classList.remove('stunflash'), 220);

        if (navigator.vibrate){
          try{ navigator.vibrate([60,60,60]); }catch(_){}
        }

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

        // bossbar update
        const maxHP = (this._cfg.bossHP|0) || 3;
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

      // food
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

        // power ready => swap group
        if (this._powerCharge >= (this._cfg.powerThreshold|0)){
          this._powerCharge = 0;
          this._groupIdx = (this._groupIdx + 1) % GROUPS.length;
          const n = GROUPS[this._groupIdx];

          emit('groups:group_change', { label: n.label });

          doc.documentElement.classList.add('swapflash');
          setTimeout(()=>doc.documentElement.classList.remove('swapflash'), 240);

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
    }
  };

  // expose
  W.GroupsVR.GameEngine = Engine;

})(window);