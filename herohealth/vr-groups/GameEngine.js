/* === /herohealth/vr-groups/GameEngine.js ===
Food Groups VR — GameEngine (DOM targets)
✅ Core: อาหารหลัก 5 หมู่ของไทย (ไม่แปลผัน) + เพลง/สคริปต์โค้ช
✅ Stage = หมู่ 1→5 (ต้องผ่านครบ) + Goal/Mini (ยิง quest:update)
✅ Spawn กระจายจริง + กันเกิดจุดเดิม + safe-zone กันทับ HUD/Power
✅ VR-feel: gyro + drag -> translate เลเยอร์ (เป้าเลื่อนตามการเลื่อนจอ)
✅ Difficulty: easy/normal/hard + style feel/mix/hard
✅ Adaptive (play mode เท่านั้น), research mode = fixed ตาม diff
✅ Metrics + End summary (accuracyGoodPct, comboMax, misses, spawn/hit/expire)
✅ Logger optional: window.HHACloudLogger?.log/.end/.flush
*/

(function (root) {
  'use strict';

  // ------------------------- helpers -------------------------
  const DOC = root.document;
  if (!DOC) return;

  function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); }
  function now(){ return (root.performance && performance.now) ? performance.now() : Date.now(); }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
  }

  function seededRng(seedStr){
    // xmur3 + sfc32
    const str = String(seedStr || 'seed');
    function xmur3(s){
      let h = 1779033703 ^ s.length;
      for (let i=0;i<s.length;i++){
        h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function(){
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= (h >>> 16)) >>> 0;
      };
    }
    const seed = xmur3(str);
    let a = seed(), b = seed(), c = seed(), d = seed();
    function sfc32(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    }
    return sfc32;
  }

  function pick(arr, r){
    if (!arr || !arr.length) return null;
    return arr[Math.floor(r() * arr.length)];
  }

  function el(tag, cls){
    const n = DOC.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  // ------------------------- Food data (TH 5 groups) -------------------------
  // หมู่ 1: เนื้อ นม ไข่ ถั่วเมล็ด
  // หมู่ 2: ข้าว แป้ง เผือก มัน น้ำตาล
  // หมู่ 3: ผักต่างๆ
  // หมู่ 4: ผลไม้
  // หมู่ 5: ไขมัน
  const FOOD_GROUPS = {
    1: { name: 'หมู่ 1', title: 'โปรตีน',  song: 'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน 💪',
         foods: ['🥚','🥛','🍗','🐟','🫘','🧀','🥜'] },
    2: { name: 'หมู่ 2', title: 'คาร์บ',     song: 'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง ⚡',
         foods: ['🍚','🍞','🍜','🥔','🌽','🍠','🍙'] },
    3: { name: 'หมู่ 3', title: 'ผัก',       song: 'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ 🥦',
         foods: ['🥦','🥬','🥕','🥒','🫑','🍅','🧄'] },
    4: { name: 'หมู่ 4', title: 'ผลไม้',     song: 'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน 🍎',
         foods: ['🍎','🍌','🍊','🍉','🍇','🍍','🥭'] },
    5: { name: 'หมู่ 5', title: 'ไขมัน',     song: 'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย 🥑',
         foods: ['🥑','🧈','🫒','🥜','🧀','🍳','🌰'] },
  };

  // ------------------------- difficulty presets -------------------------
  function baseCfg(diff, style){
    diff = String(diff || 'normal').toLowerCase();
    style = String(style || 'mix').toLowerCase();

    const D = {
      easy:   { spawnEveryMs: 950, ttlMs: 3200, sizeMin: 0.92, sizeMax: 1.15, goodBias: 0.68, powerThr: 10, goalHits: 8  },
      normal: { spawnEveryMs: 780, ttlMs: 2900, sizeMin: 0.85, sizeMax: 1.10, goodBias: 0.62, powerThr: 10, goalHits: 10 },
      hard:   { spawnEveryMs: 640, ttlMs: 2600, sizeMin: 0.78, sizeMax: 1.05, goodBias: 0.56, powerThr: 11, goalHits: 12 },
    }[diff] || null;

    const S = {
      feel: { goodBiasAdd: +0.06, spawnMul: 1.06, ttlMul: 1.10, scoreMul: 1.00 },
      mix:  { goodBiasAdd: +0.00, spawnMul: 1.00, ttlMul: 1.00, scoreMul: 1.05 },
      hard: { goodBiasAdd: -0.05, spawnMul: 0.92, ttlMul: 0.94, scoreMul: 1.12 },
    }[style] || { goodBiasAdd:0, spawnMul:1, ttlMul:1, scoreMul:1 };

    const cfg = Object.assign({}, D);
    cfg.spawnEveryMs = Math.max(320, Math.round(cfg.spawnEveryMs * (1 / S.spawnMul)));
    cfg.ttlMs = Math.max(1200, Math.round(cfg.ttlMs * S.ttlMul));
    cfg.goodBias = clamp(cfg.goodBias + S.goodBiasAdd, 0.40, 0.85);
    cfg.scoreMul = S.scoreMul;
    cfg.diff = diff;
    cfg.style = style;
    cfg.stageCount = 5;

    return cfg;
  }

  // ------------------------- FX helpers (optional) -------------------------
  const Particles =
    (root.GAME_MODULES && root.GAME_MODULES.Particles) ||
    root.Particles ||
    { scorePop(){}, burstAt(){}, celebrate(){ } };

  function flash(kind){
    // lightweight screen feedback without CSS dependency
    try{
      const b = DOC.body;
      b.classList.add('fg-flash-' + kind);
      setTimeout(()=>b.classList.remove('fg-flash-' + kind), 120);
    }catch{}
  }

  // ------------------------- Engine -------------------------
  const Engine = {
    _layer: null,
    _running: false,
    _cfg: null,
    _rng: null,
    _seed: '',
    _runMode: 'play',
    _timeTotal: 90,
    _tLeft: 90,
    _timerId: null,
    _spawnId: null,
    _raf: 0,

    // state
    _stage: 1,
    _stageHit: 0,
    _goalHits: 10,
    _miniActive: null, // {type:'streak', need, cur}
    _miniDone: 0,
    _miniTotal: 5,

    // stats
    _score: 0,
    _combo: 0,
    _comboMax: 0,
    _misses: 0,
    _goodHits: 0,
    _badHits: 0,
    _expired: 0,
    _spawned: 0,
    _spawnedGood: 0,
    _spawnedBad: 0,

    // power
    _power: 0,
    _powerThr: 10,

    // spawn bookkeeping
    _targets: new Map(), // id -> {el, born, ttl, x, y, group, isGood, emoji}
    _uid: 0,
    _lastSpots: [],

    // view offsets
    _vx: 0, _vy: 0,
    _dragOn: false,
    _dragSX: 0, _dragSY: 0,
    _dragBX: 0, _dragBY: 0,
    _gyroX: 0, _gyroY: 0,

    setLayerEl(layer){
      this._layer = layer;
      return this;
    },

    start(diff, opts){
      opts = opts || {};
      if (!this._layer) throw new Error('GameEngine: layer not set');

      // stop previous
      this.stop('restart');

      this._runMode = String(opts.runMode || 'play').toLowerCase();
      const style = String(opts.style || 'mix').toLowerCase();
      this._seed = String(opts.seed || Date.now());
      this._rng = seededRng(this._seed);

      this._timeTotal = clamp(opts.time || 90, 30, 180);
      this._tLeft = this._timeTotal;

      this._cfg = baseCfg(diff, style);
      this._goalHits = this._cfg.goalHits;
      this._powerThr = this._cfg.powerThr;

      // reset
      this._running = true;
      this._stage = 1;
      this._stageHit = 0;
      this._miniDone = 0;
      this._score = 0;
      this._combo = 0;
      this._comboMax = 0;
      this._misses = 0;
      this._goodHits = 0;
      this._badHits = 0;
      this._expired = 0;
      this._spawned = 0;
      this._spawnedGood = 0;
      this._spawnedBad = 0;
      this._power = 0;
      this._targets.clear();
      this._uid = 0;
      this._lastSpots = [];

      // wipe layer
      try{ this._layer.innerHTML = ''; }catch{}

      // input + gyro
      this._bindInput();
      this._bindGyro();

      // announce
      emit('groups:power', { charge: this._power, threshold: this._powerThr });
      this._emitScore();
      emit('hha:time', { left: this._tLeft, total: this._timeTotal });

      this._coachStageIntro(true);
      this._startMini(); // start first mini

      // optional logger
      this._loggerStart(diff, style);

      // loops
      this._timerId = setInterval(()=> this._tickSecond(), 1000);
      this._spawnId = setInterval(()=> this._spawnOne(), this._cfg.spawnEveryMs);
      this._raf = requestAnimationFrame(()=> this._loop());

      // initial rank
      emit('hha:rank', { grade: this._gradeNow() });

      return this;
    },

    stop(reason){
      if (!this._running) return;

      this._running = false;
      if (this._timerId) { clearInterval(this._timerId); this._timerId = null; }
      if (this._spawnId) { clearInterval(this._spawnId); this._spawnId = null; }
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }

      this._unbindInput();
      this._unbindGyro();

      // cleanup targets
      try{
        for (const it of this._targets.values()){
          if (it && it.el && it.el.parentNode) it.el.parentNode.removeChild(it.el);
        }
      }catch{}
      this._targets.clear();

      // end summary
      const accuracy = this._goodHits + this._badHits > 0
        ? Math.round((this._goodHits / (this._goodHits + this._badHits)) * 100)
        : 0;

      const grade = this._gradeNowFinal(accuracy);

      const detail = {
        reason: reason || 'stop',
        // HHA-ish fields (ใช้กับหน้า Run)
        scoreFinal: Math.round(this._score),
        comboMax: this._comboMax,
        misses: this._misses,
        accuracyGoodPct: accuracy,
        grade,

        // counts
        nTargetSpawned: this._spawned,
        nTargetGoodSpawned: this._spawnedGood,
        nTargetBadSpawned: this._spawnedBad,
        nHitGood: this._goodHits,
        nHitBad: this._badHits,
        nExpire: this._expired,

        // progression
        stageCleared: this._stage - 1,
        stageTotal: 5,
        goalHitsPerStage: this._goalHits,
        miniCleared: this._miniDone,
        miniTotal: this._miniTotal,

        // params snapshot
        runMode: this._runMode,
        diff: this._cfg ? this._cfg.diff : '',
        style: this._cfg ? this._cfg.style : '',
        timePlannedSec: this._timeTotal,
        timePlayedSec: this._timeTotal - this._tLeft,
        seed: this._seed,
      };

      emit('hha:end', detail);

      // logger
      this._loggerEnd(detail);

      // flush
      try{ root.HHACloudLogger?.flush?.(); }catch{}
    },

    // ------------------ internal loops ------------------
    _tickSecond(){
      if (!this._running) return;
      this._tLeft = Math.max(0, this._tLeft - 1);
      emit('hha:time', { left: this._tLeft, total: this._timeTotal });

      // rank update occasionally
      if (this._tLeft % 2 === 0){
        emit('hha:rank', { grade: this._gradeNow() });
      }

      // last 5 seconds hint
      if (this._tLeft <= 5 && this._tLeft > 0){
        emit('hha:coach', { text: `⏳ อีก ${this._tLeft} วิ! เร่งเลย!`, mood: 'sad' });
      }

      if (this._tLeft <= 0){
        this.stop('time_up');
      }
    },

    _loop(){
      if (!this._running) return;

      // expire targets
      const t = now();
      for (const [id, it] of this._targets.entries()){
        if (!it) continue;
        if (t - it.born >= it.ttl){
          this._expired++;
          this._targets.delete(id);
          try{
            it.el.classList.add('out');
            setTimeout(()=>{ try{ it.el.remove(); }catch{} }, 160);
          }catch{}
          // expire = miss only if it was good for current stage
          if (it.isGood){
            this._miss('expire');
          }
        }
      }

      // apply view offsets (gyro + drag)
      this._applyView();

      // adaptive (play only)
      if (this._runMode === 'play'){
        this._adaptiveTick();
      }

      this._raf = requestAnimationFrame(()=> this._loop());
    },

    // ------------------ spawn ------------------
    _spawnOne(){
      if (!this._running || !this._layer) return;

      const cfg = this._cfg;
      const r = this._rng;

      const stageGroup = this._stage;
      const area = this._spawnRect();
      if (!area) return;

      // choose good vs bad for this stage
      const isGood = (r() < cfg.goodBias);
      const g = isGood ? stageGroup : this._pickOtherGroup(stageGroup);

      const emoji = pick(FOOD_GROUPS[g].foods, r) || '🍽️';
      const s = cfg.sizeMin + (cfg.sizeMax - cfg.sizeMin) * r();

      // position (avoid repeating same spot)
      const pos = this._pickSpot(area, r);
      if (!pos) return;

      const id = String(++this._uid);
      const node = el('div', 'fg-target');
      node.dataset.id = id;
      node.dataset.emoji = emoji;
      node.dataset.group = String(g);
      node.dataset.good = isGood ? '1' : '0';

      node.style.setProperty('--x', pos.x + 'px');
      node.style.setProperty('--y', pos.y + 'px');
      node.style.setProperty('--s', String(s.toFixed(3)));

      // pointer
      node.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        this._hit(id, ev);
      }, { passive:false });

      // append
      this._layer.appendChild(node);

      // register
      const ttl = cfg.ttlMs * (0.85 + 0.35 * r());
      this._targets.set(id, {
        id,
        el: node,
        born: now(),
        ttl,
        x: pos.x, y: pos.y,
        group: g,
        isGood,
        emoji
      });

      this._spawned++;
      if (isGood) this._spawnedGood++; else this._spawnedBad++;

      // progress hook
      emit('groups:progress', {
        type: 'spawn',
        stage: this._stage,
        group: g,
        isGood,
        tLeft: this._tLeft,
        score: this._score,
        combo: this._combo
      });
    },

    _pickOtherGroup(stageGroup){
      const arr = [1,2,3,4,5].filter(x=>x!==stageGroup);
      return arr[Math.floor(this._rng() * arr.length)] || 1;
    },

    _spawnRect(){
      const W = root.innerWidth || DOC.documentElement.clientWidth || 360;
      const H = root.innerHeight || DOC.documentElement.clientHeight || 640;

      let top = 12;
      let left = 12;
      let right = W - 12;
      let bottom = H - 12;

      // avoid HUD areas if present
      const hud = DOC.querySelector('.hud');
      const topBar = DOC.querySelector('.centerTop');
      const power = DOC.querySelector('.powerWrap');

      try{
        if (hud){
          const r = hud.getBoundingClientRect();
          top = Math.max(top, r.bottom + 10);
        }
        if (topBar){
          const r = topBar.getBoundingClientRect();
          top = Math.max(top, r.bottom + 10);
        }
        if (power){
          const r = power.getBoundingClientRect();
          bottom = Math.min(bottom, r.top - 12);
        }
      }catch{}

      // clamp
      const minW = 160, minH = 260;
      if ((right-left) < minW || (bottom-top) < minH){
        // relax a bit if screen is tight
        left = 8; right = W - 8;
        top = Math.min(top, 120);
        bottom = Math.max(bottom, H - 140);
      }

      if (right <= left + 40 || bottom <= top + 40) return null;

      return { left, top, right, bottom };
    },

    _pickSpot(area, r){
      const tries = 18;
      const minDist = 86; // keep away from last spots
      for (let i=0;i<tries;i++){
        const x = area.left + (area.right - area.left) * r();
        const y = area.top  + (area.bottom - area.top) * r();

        let ok = true;
        for (let k = Math.max(0, this._lastSpots.length - 10); k < this._lastSpots.length; k++){
          const p = this._lastSpots[k];
          const dx = x - p.x, dy = y - p.y;
          if ((dx*dx + dy*dy) < (minDist*minDist)){
            ok = false; break;
          }
        }
        if (!ok) continue;

        this._lastSpots.push({ x, y });
        if (this._lastSpots.length > 30) this._lastSpots.shift();
        return { x: Math.round(x), y: Math.round(y) };
      }
      return null;
    },

    // ------------------ hit / miss ------------------
    _hit(id, ev){
      if (!this._running) return;
      const it = this._targets.get(id);
      if (!it) return;

      this._targets.delete(id);

      const correct = (it.group === this._stage);

      // FX pos (screen)
      let bx = it.x, by = it.y;
      try{
        const rect = it.el.getBoundingClientRect();
        bx = rect.left + rect.width/2;
        by = rect.top + rect.height/2;
      }catch{}

      try{
        it.el.classList.add('hit');
        setTimeout(()=>{ try{ it.el.remove(); }catch{} }, 160);
      }catch{}

      if (correct){
        this._goodHits++;
        this._combo++;
        this._comboMax = Math.max(this._comboMax, this._combo);

        // scoring
        const base = 10;
        const bonus = Math.min(18, this._combo); // combo bonus
        this._score += (base + bonus) * (this._cfg.scoreMul || 1);

        // power
        this._power = Math.min(this._powerThr, this._power + 1);
        emit('groups:power', { charge: this._power, threshold: this._powerThr });

        // stage progress
        this._stageHit++;
        this._miniProgress(true);

        Particles.burstAt(bx, by, 'GOOD');
        Particles.scorePop(bx, by, '+' + Math.round((base+bonus) * (this._cfg.scoreMul||1)));

        emit('hha:coach', { text: this._coachHitText(), mood: 'happy' });

        // quest/update
        this._emitQuestUpdate('hit');

        // stage complete?
        if (this._stageHit >= this._goalHits){
          this._stageComplete();
        }

      } else {
        this._badHits++;
        this._miss('wrong');
        this._miniProgress(false);

        Particles.burstAt(bx, by, 'BAD');
        flash('bad');

        emit('hha:coach', { text: 'อุ๊บ! ต้องเป็นอาหาร “หมู่ที่กำลังฝึก” นะ 😅', mood: 'sad' });
        this._emitQuestUpdate('miss');
      }

      // progress hook
      emit('groups:progress', {
        type: 'hit',
        correct,
        stage: this._stage,
        targetGroup: it.group,
        stageGroup: this._stage,
        emoji: it.emoji,
        combo: this._combo,
        comboMax: this._comboMax,
        misses: this._misses,
        score: Math.round(this._score),
        tLeft: this._tLeft,
        power: this._power,
        powerThr: this._powerThr,
        stageHit: this._stageHit,
        goalHits: this._goalHits,
        mini: this._miniActive ? { type:this._miniActive.type, need:this._miniActive.need, cur:this._miniActive.cur } : null
      });

      this._emitScore();
    },

    _miss(why){
      this._misses++;
      this._combo = 0;
      emit('hha:judge', { kind: 'MISS', why: why || 'miss' });
      this._emitScore();
    },

    _emitScore(){
      emit('hha:score', {
        score: Math.round(this._score),
        combo: this._combo,
        comboMax: this._comboMax,
        misses: this._misses
      });
    },

    // ------------------ stage / quests ------------------
    _coachStageIntro(first){
      const g = FOOD_GROUPS[this._stage];
      if (!g) return;
      const title = `${g.name} — ${g.title}`;
      const line = g.song;

      emit('hha:coach', { text: (first ? 'เริ่มเลย! ' : 'ไปต่อ! ') + title, mood: 'neutral' });
      emit('hha:coach', { text: line, mood: 'neutral' });

      // quest update (goal)
      this._emitQuestUpdate('stage');
    },

    _stageComplete(){
      const g = FOOD_GROUPS[this._stage];
      Particles.celebrate && Particles.celebrate('GOAL');
      emit('hha:coach', { text: `✅ ผ่าน ${g.name} แล้ว! เก่งมาก!`, mood: 'happy' });

      // mini complete check
      if (this._miniActive && this._miniActive.cur >= this._miniActive.need){
        this._miniDone++;
        Particles.celebrate && Particles.celebrate('MINI');
        emit('hha:coach', { text: `🎉 Mini สำเร็จ (${this._miniDone}/${this._miniTotal})!`, mood: 'happy' });
        this._startMini(); // next mini
      }

      // next stage
      this._stage++;
      this._stageHit = 0;

      if (this._stage > 5){
        Particles.celebrate && Particles.celebrate('ALL');
        emit('hha:coach', { text: '🏆 ครบอาหารหลัก 5 หมู่แล้ว! สุดยอด!', mood: 'happy' });
        this.stop('all_goals');
        return;
      }

      // reset power small reward
      this._power = Math.min(this._powerThr, this._power + 2);
      emit('groups:power', { charge: this._power, threshold: this._powerThr });

      this._coachStageIntro(false);
    },

    _emitQuestUpdate(kind){
      const g = FOOD_GROUPS[this._stage];
      const goalTitle = `Goal: ${g.name} (${g.title})`;
      const goalDesc  = `แตะอาหารของ ${g.name} ให้ครบ ${this._goalHits} ครั้ง`;
      const goalNow   = this._stageHit;
      const goalTot   = this._goalHits;

      const mini = this._miniActive;
      const miniTitle = mini ? `Mini: ${mini.label}` : 'Mini: -';
      const miniNow   = mini ? mini.cur : 0;
      const miniTot   = mini ? mini.need : 0;

      emit('quest:update', {
        kind: kind || 'update',
        goal: { title: goalTitle, desc: goalDesc, now: goalNow, total: goalTot, index: this._stage, max: 5 },
        mini: { title: miniTitle, now: miniNow, total: miniTot, cleared: this._miniDone, max: this._miniTotal }
      });
    },

    _startMini(){
      // 5 minis แบบ “สั้น-มันส์” (วน): streak / speed / no-miss
      const pickType = (this._miniDone % 3);
      const stage = this._stage;

      if (pickType === 0){
        this._miniActive = { type:'streak', need: (stage<=2? 5 : 6), cur:0, label:`Streak ${stage<=2?5:6} ครั้งติด` };
      } else if (pickType === 1){
        this._miniActive = { type:'speed', need: (stage<=2? 6 : 7), cur:0, label:`เร็ว! แตะให้ได้ ${stage<=2?6:7} ครั้ง (ภายใน 10 วิ)` , windowSec:10, startedAt: now() };
      } else {
        this._miniActive = { type:'nomiss', need: (stage<=2? 7 : 8), cur:0, label:`ห้ามพลาด! ถูก ${stage<=2?7:8} ครั้งก่อนพลาด` };
      }

      this._emitQuestUpdate('mini');
    },

    _miniProgress(correct){
      const m = this._miniActive;
      if (!m) return;

      if (m.type === 'streak'){
        if (correct) m.cur++; else m.cur = 0;
      } else if (m.type === 'speed'){
        const t = now();
        if (t - m.startedAt > (m.windowSec * 1000)){
          // reset window
          m.startedAt = t;
          m.cur = 0;
        }
        if (correct) m.cur++;
      } else if (m.type === 'nomiss'){
        if (correct) m.cur++; else m.cur = 0;
      }

      this._emitQuestUpdate('mini_prog');
    },

    _coachHitText(){
      // small variety
      const r = this._rng;
      const opts = [
        'ดีมาก! ✅',
        'ใช่เลย! 🎯',
        'แม่นมาก! ✨',
        'เก่งสุด ๆ! 💚',
        'ไปต่อ! 🔥'
      ];
      return opts[Math.floor(r()*opts.length)] || 'เยี่ยม!';
    },

    // ------------------ grade ------------------
    _gradeNow(){
      // realtime rough grade
      const hit = this._goodHits + this._badHits;
      const acc = hit ? (this._goodHits / hit) * 100 : 0;
      return this._gradeNowFinal(Math.round(acc));
    },

    _gradeNowFinal(accPct){
      const m = this._misses;

      // SSS, SS, S, A, B, C
      if (accPct >= 95 && m <= 2) return 'SSS';
      if (accPct >= 90 && m <= 4) return 'SS';
      if (accPct >= 85 && m <= 6) return 'S';
      if (accPct >= 75) return 'A';
      if (accPct >= 60) return 'B';
      return 'C';
    },

    // ------------------ adaptive ------------------
    _adaptiveTick(){
      // adjust every ~2 seconds using simple performance signals
      // (ไม่ใช้เวลาจริงมาก—เอาให้ “รู้สึก” ว่าปรับตามผู้เล่น)
      if (!this._cfg) return;

      const played = this._timeTotal - this._tLeft;
      if (played < 8) return;
      if (played % 2 !== 0) return;

      const hit = this._goodHits + this._badHits;
      const acc = hit ? (this._goodHits / hit) : 0;
      const m = this._misses;

      // target: acc ~0.78–0.88
      let spawnEvery = this._cfg.spawnEveryMs;
      let ttl = this._cfg.ttlMs;
      let bias = this._cfg.goodBias;

      // doing well -> harder
      if (acc > 0.88 && m <= 3){
        spawnEvery = Math.max(360, spawnEvery - 18);
        ttl = Math.max(1500, ttl - 14);
        bias = clamp(bias - 0.005, 0.45, 0.85);
      }
      // struggling -> easier
      if (acc < 0.70 || m >= 8){
        spawnEvery = Math.min(1100, spawnEvery + 22);
        ttl = Math.min(3800, ttl + 18);
        bias = clamp(bias + 0.007, 0.45, 0.85);
      }

      // apply gently
      const newSpawn = Math.round(spawnEvery);
      if (Math.abs(newSpawn - this._cfg.spawnEveryMs) >= 40 && this._spawnId){
        this._cfg.spawnEveryMs = newSpawn;
        clearInterval(this._spawnId);
        this._spawnId = setInterval(()=> this._spawnOne(), this._cfg.spawnEveryMs);
        emit('hha:adaptive', { spawnEveryMs: this._cfg.spawnEveryMs });
      }
      this._cfg.ttlMs = Math.round(ttl);
      this._cfg.goodBias = bias;
    },

    // ------------------ input: drag + gyro ------------------
    _bindInput(){
      const layer = this._layer;
      const self = this;

      self._dragOn = false;

      self._onPointerDown = function(e){
        if (!self._running) return;
        self._dragOn = true;
        self._dragSX = e.clientX;
        self._dragSY = e.clientY;
        self._dragBX = self._vx;
        self._dragBY = self._vy;
        try{ layer.setPointerCapture(e.pointerId); }catch{}
      };

      self._onPointerMove = function(e){
        if (!self._running || !self._dragOn) return;
        const dx = (e.clientX - self._dragSX);
        const dy = (e.clientY - self._dragSY);
        // stronger VR feel
        self._vx = clamp(self._dragBX + dx * 0.55, -140, 140);
        self._vy = clamp(self._dragBY + dy * 0.55, -160, 160);
      };

      self._onPointerUp = function(e){
        self._dragOn = false;
        try{ layer.releasePointerCapture(e.pointerId); }catch{}
      };

      layer.addEventListener('pointerdown', self._onPointerDown, { passive:true });
      layer.addEventListener('pointermove', self._onPointerMove, { passive:true });
      layer.addEventListener('pointerup', self._onPointerUp, { passive:true });
      layer.addEventListener('pointercancel', self._onPointerUp, { passive:true });
      layer.addEventListener('lostpointercapture', self._onPointerUp, { passive:true });
    },

    _unbindInput(){
      const layer = this._layer;
      if (!layer) return;
      if (this._onPointerDown) layer.removeEventListener('pointerdown', this._onPointerDown);
      if (this._onPointerMove) layer.removeEventListener('pointermove', this._onPointerMove);
      if (this._onPointerUp)   layer.removeEventListener('pointerup', this._onPointerUp);
      if (this._onPointerUp)   layer.removeEventListener('pointercancel', this._onPointerUp);
      if (this._onPointerUp)   layer.removeEventListener('lostpointercapture', this._onPointerUp);
      this._onPointerDown = this._onPointerMove = this._onPointerUp = null;
      this._dragOn = false;
    },

    _bindGyro(){
      const self = this;
      self._gyroX = 0; self._gyroY = 0;

      self._onDeviceOri = function(e){
        // gamma [-90..90] (left-right), beta [-180..180] (front-back)
        const g = Number(e.gamma); // x-ish
        const b = Number(e.beta);  // y-ish
        if (!Number.isFinite(g) || !Number.isFinite(b)) return;

        // map to pixels
        const gx = clamp(g / 30, -1.2, 1.2);
        const gy = clamp((b - 25) / 35, -1.2, 1.2); // neutral at ~25deg
        self._gyroX = gx * 42;
        self._gyroY = gy * 52;
      };

      try{
        root.addEventListener('deviceorientation', self._onDeviceOri, true);
      }catch{}
    },

    _unbindGyro(){
      if (this._onDeviceOri){
        try{ root.removeEventListener('deviceorientation', this._onDeviceOri, true); }catch{}
      }
      this._onDeviceOri = null;
    },

    _applyView(){
      if (!this._layer) return;
      // combine drag + gyro (smooth)
      const tx = clamp(this._vx + (this._gyroX || 0), -170, 170);
      const ty = clamp(this._vy + (this._gyroY || 0), -190, 190);
      try{
        this._layer.style.setProperty('--vx', tx.toFixed(1) + 'px');
        this._layer.style.setProperty('--vy', ty.toFixed(1) + 'px');
      }catch{}
    },

    // ------------------ logger (optional) ------------------
    _loggerStart(diff, style){
      try{
        const L = root.HHACloudLogger;
        if (!L || typeof L.log !== 'function') return;
        L.log('session_start', {
          timestampIso: new Date().toISOString(),
          projectTag: 'HeroHealth',
          game: 'GroupsVR',
          runMode: this._runMode,
          diff: String(diff||''),
          style: String(style||''),
          seed: this._seed,
          timePlannedSec: this._timeTotal
        });
      }catch{}
    },

    _loggerEnd(summary){
      try{
        const L = root.HHACloudLogger;
        if (!L || typeof L.log !== 'function') return;
        L.log('session_end', summary || {});
      }catch{}
    }
  };

  // expose
  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.GameEngine = Engine;

})(typeof window !== 'undefined' ? window : globalThis);