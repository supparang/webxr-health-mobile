// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups — GameEngine (classic script)
// ✅ Works with groups-vr.html ALL-IN PACK
// ✅ Integrates GroupsQuest via window.GroupsVR.createGroupsQuest
// ✅ Emits required events: hha:score, hha:time, quest:update, groups:* , hha:rank
// ✅ STUN 0.8s

(function (root) {
  'use strict';

  const W = root;
  W.GroupsVR = W.GroupsVR || {};

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
  function emit(name, detail){
    try{ W.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch(_){}
  }

  // --- Difficulty tuning ---
  const DIFF = {
    easy:   { spawnEvery: 700, maxOnScreen: 5, correctScore: 120, wrongPenalty: 120, junkPenalty: 180, powerThreshold: 6 },
    normal: { spawnEvery: 620, maxOnScreen: 6, correctScore: 130, wrongPenalty: 140, junkPenalty: 200, powerThreshold: 7 },
    hard:   { spawnEvery: 540, maxOnScreen: 7, correctScore: 140, wrongPenalty: 160, junkPenalty: 230, powerThreshold: 8 }
  };

  // --- Food groups set (simple, you can swap to real dataset later) ---
  const GROUPS = [
    { id:1, label:'หมู่ 1', foods:['🥛','🥚','🫘','🍗'], junk:['🍩','🍟','🍔'] },
    { id:2, label:'หมู่ 2', foods:['🍚','🍞','🥔','🍜'], junk:['🍩','🍟','🍔'] },
    { id:3, label:'หมู่ 3', foods:['🥦','🥬','🥕','🌽'], junk:['🍩','🍟','🍔'] },
    { id:4, label:'หมู่ 4', foods:['🍎','🍌','🍊','🍉'], junk:['🍩','🍟','🍔'] },
    { id:5, label:'หมู่ 5', foods:['🥑','🧈','🥜','🫒'], junk:['🍩','🍟','🍔'] }
  ];

  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  // --- Engine ---
  const Engine = {
    _layerEl: null,
    _camEl: null,
    _running: false,

    _diff: 'normal',
    _cfg: DIFF.normal,

    _timeLeft: 90,
    _timerT: 0,

    _spawnT: 0,
    _targets: [],
    _score: 0,
    _combo: 0,
    _comboMax: 0,
    _misses: 0,

    _groupIdx: 0,
    _powerCharge: 0,
    _stunUntil: 0,

    _quest: null,
    _runMode: 'play',
    _seed: undefined,

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
      this._timerT = 0;
      this._spawnT = 0;
      this._targets = [];
      this._score = 0;
      this._combo = 0;
      this._comboMax = 0;
      this._misses = 0;
      this._powerCharge = 0;
      this._stunUntil = 0;

      // clear layer
      if (this._layerEl) this._layerEl.innerHTML = '';

      // init group
      this._groupIdx = 0;
      emit('groups:group_change', { label: GROUPS[this._groupIdx].label });

      // ✅ Quest init (สำคัญที่สุด)
      if (W.GroupsVR && typeof W.GroupsVR.createGroupsQuest === 'function'){
        this._quest = W.GroupsVR.createGroupsQuest({
          diff: this._diff,
          runMode: this._runMode,
          seed: this._seed
        });
        this._quest.start();
        this._quest.onGroupChange(GROUPS[this._groupIdx].label);
      } else {
        // if quest file not loaded
        emit('quest:update', { questOk:false, groupLabel: GROUPS[this._groupIdx].label });
      }

      // bind input
      this._bindInput();

      // fire HUD baseline
      this._emitScore();
      this._emitTime();

      // loop
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._loop.bind(this));
    },

    stop(reason){
      this._running = false;
      try{ cancelAnimationFrame(this._raf); }catch(_){}
      this._unbindInput();
      emit('hha:end', { reason: reason || 'stop' });
    },

    _bindInput(){
      if (!this._layerEl) return;
      if (this._onPointer) return;

      this._onPointer = (ev)=>{
        if (!this._running) return;
        this._shootAtEvent(ev);
      };

      // tap on layer or anywhere = shoot (mobile friendly)
      document.addEventListener('pointerdown', this._onPointer, { passive:true });
    },

    _unbindInput(){
      if (this._onPointer){
        document.removeEventListener('pointerdown', this._onPointer);
        this._onPointer = null;
      }
    },

    _loop(t){
      if (!this._running) return;
      const dt = Math.min(0.05, Math.max(0.001, (t - this._last) / 1000));
      this._last = t;

      // timer
      this._timerT += dt;
      if (this._timerT >= 1){
        this._timerT -= 1;
        this._timeLeft = Math.max(0, (this._timeLeft|0) - 1);
        this._emitTime();
        if (this._timeLeft <= 0){
          this.stop('time');
          return;
        }
      }

      // stun block
      const isStunned = (t < this._stunUntil);

      // spawn
      if (!isStunned){
        this._spawnT += dt * 1000;
        if (this._spawnT >= this._cfg.spawnEvery){
          this._spawnT = 0;
          this._maybeSpawn();
        }
      }

      // quest tick
      if (this._quest) this._quest.tick(dt);

      requestAnimationFrame(this._loop.bind(this));
    },

    _emitScore(){
      emit('hha:score', {
        score: this._score|0,
        combo: this._combo|0,
        comboMax: this._comboMax|0,
        misses: this._misses|0
      });
      // rank (simple)
      const acc = this._calcAcc();
      const grade = this._gradeFrom(acc, this._comboMax, this._misses);
      emit('hha:rank', { grade, accuracy: acc });
    },

    _emitTime(){
      emit('hha:time', { left: this._timeLeft|0 });
    },

    _calcAcc(){
      const shots = Math.max(1, (this._hit + this._miss)|0);
      return Math.round((Math.max(0,this._hit|0) / shots) * 100);
    },

    _gradeFrom(acc, comboMax, misses){
      // SSS/SS/S/A/B/C
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

      const g = GROUPS[this._groupIdx];
      const isJunk = (Math.random() < 0.22); // junk rate (ปรับได้)
      const emoji = isJunk ? pick(g.junk) : pick(g.foods);

      const el = document.createElement('button');
      el.className = 'fg-target';
      el.type = 'button';
      el.setAttribute('aria-label', 'target');

      // position (safe margins)
      const w = window.innerWidth || 360;
      const h = window.innerHeight || 640;

      const topSafe = 110;
      const botSafe = 120;
      const leftSafe = 24;
      const rightSafe = 24;

      const x = leftSafe + Math.random() * Math.max(10, (w - leftSafe - rightSafe));
      const y = topSafe  + Math.random() * Math.max(10, (h - topSafe - botSafe));

      el.style.left = Math.round(x) + 'px';
      el.style.top  = Math.round(y) + 'px';

      el.dataset.junk = isJunk ? '1' : '0';
      el.dataset.group = String(g.id);
      el.textContent = emoji;

      // click direct hit
      el.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        this._hitTarget(el);
      }, { passive:false });

      this._layerEl.appendChild(el);
      this._targets.push(el);

      // lifetime (miss if expire)
      const ttl = 2200 + Math.random()*900;
      setTimeout(()=>{
        if (!el.isConnected) return;
        // expire => count as miss
        this._misses++;
        this._combo = 0;
        this._removeTarget(el);
        this._emitScore();
        // quest treat as wrong (not junk)
        if (this._quest) this._quest.onShot({ correct:false, wrong:true, junk:false });
      }, ttl);
    },

    _removeTarget(el){
      try{
        const i = this._targets.indexOf(el);
        if (i >= 0) this._targets.splice(i,1);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }catch(_){}
    },

    _shootAtEvent(ev){
      // auto-aim = หาเป้าที่ใกล้จุดแตะสุด
      const x = (ev && ev.clientX!=null) ? ev.clientX : (window.innerWidth/2);
      const y = (ev && ev.clientY!=null) ? ev.clientY : (window.innerHeight/2);

      // stunned?
      const t = performance.now();
      if (t < this._stunUntil) return;

      let best = null, bestD = 1e9;
      for (let i=0;i<this._targets.length;i++){
        const el = this._targets[i];
        if (!el || !el.isConnected) continue;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;
        const dx = (cx - x), dy = (cy - y);
        const d = dx*dx + dy*dy;
        if (d < bestD){ bestD=d; best=el; }
      }
      if (best && bestD < 180*180){
        this._hitTarget(best);
      } else {
        // miss shot
        this._misses++;
        this._combo = 0;
        this._emitScore();
        if (this._quest) this._quest.onShot({ correct:false, wrong:true, junk:false });
      }
    },

    _hitTarget(el){
      if (!el || !el.isConnected) return;

      const isJunk = (el.dataset.junk === '1');
      const g = GROUPS[this._groupIdx];
      const isCorrectGroup = (!isJunk); // ในเกมนี้ “ถูกหมู่” = เป้าดี (ไม่ใช่ junk)
      // (ถ้าคุณอยากให้ “ถูกหมู่ปัจจุบัน” จริง ๆ แบบมีอาหารหลากหมู่บนจอ -> ผมจัดให้รอบถัดไป)

      if (isJunk){
        // JUNK HIT => stun 0.8s
        this._score -= (this._cfg.junkPenalty|0);
        this._misses++;
        this._combo = 0;

        // stun
        const t = performance.now();
        this._stunUntil = t + 800; // ✅ 0.8 วิ
        emit('groups:stun', { on:true, ms:800 });

        if (navigator.vibrate) { try{ navigator.vibrate([60,60,60]); }catch(_){ } }

        if (this._quest) this._quest.onShot({ correct:false, wrong:false, junk:true });
      } else if (isCorrectGroup){
        this._score += (this._cfg.correctScore|0);
        this._combo++;
        if (this._combo > this._comboMax) this._comboMax = this._combo;

        // power charge
        this._powerCharge++;
        const th = this._cfg.powerThreshold|0;
        emit('groups:power', {
          groupName: g.label,
          charge: this._powerCharge|0,
          threshold: th
        });

        // power ready => swap group drama
        if (this._powerCharge >= th){
          this._powerCharge = 0;
          this._groupIdx = (this._groupIdx + 1) % GROUPS.length;
          emit('groups:group_change', { label: GROUPS[this._groupIdx].label });
          if (this._quest) this._quest.onGroupChange(GROUPS[this._groupIdx].label);
        }

        if (this._quest) this._quest.onShot({ correct:true, wrong:false, junk:false });
      } else {
        this._score -= (this._cfg.wrongPenalty|0);
        this._misses++;
        this._combo = 0;
        if (this._quest) this._quest.onShot({ correct:false, wrong:true, junk:false });
      }

      this._removeTarget(el);
      this._emitScore();
    }
  };

  // expose
  W.GroupsVR.GameEngine = Engine;

})(window);