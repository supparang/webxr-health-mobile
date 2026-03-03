// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE — PRODUCTION (HUD-safe spawn + fair miss + easier pacing + mobile aim assist)
// FULL v20260303-GROUPS-SAFE-HUDMISS-EASIER-AIM
//
// ✅ HUD-safe spawn (avoid HUD rectangles on mobile/pc/cVR)
// ✅ Fair MISS: expiration over HUD does NOT count as miss
// ✅ Easier pacing: longer life + slower spawn + less crowded
// ✅ Mobile Aim Assist: wider lockPx auto on mobile/cVR
// ✅ Deterministic RNG (seed string)
// ✅ hha:shoot supported (cVR crosshair shoot)
// ✅ Emits: hha:time, hha:score, hha:rank, hha:coach, quest:update, groups:power, groups:group
// ✅ Telemetry scaffold + flush hooks
// ✅ AI hooks wired (window.GroupsAIHooks) prediction-only, optional
//
(function(){
  'use strict';

  const WIN = window, DOC = document;

  // ---------------- helpers ----------------
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail: detail||{} })); }catch(_){}
  }

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function hash32(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function makeRng(seedStr){
    let s = (hash32(seedStr) || 123456789) >>> 0;
    return function(){
      s ^= (s << 13); s >>>= 0;
      s ^= (s >>> 17); s >>>= 0;
      s ^= (s << 5);  s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  function rectsOverlap(a,b){
    return !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
  }

  function elRect(el){
    const r = el.getBoundingClientRect();
    return { l:r.left, t:r.top, r:r.right, b:r.bottom, w:r.width, h:r.height };
  }

  function rectInflate(rc, pad){
    return { l:rc.l-pad, t:rc.t-pad, r:rc.r+pad, b:rc.b+pad };
  }

  function toLayerRect(layerEl, rc){
    const L = layerEl.getBoundingClientRect();
    return { l: rc.l - L.left, t: rc.t - L.top, r: rc.r - L.left, b: rc.b - L.top };
  }

  function randBetween(rng, a,b){ return a + (b-a)*rng(); }

  function viewNow(){
    return String(DOC.body.getAttribute('data-view')||qs('view','mobile')||'mobile').toLowerCase();
  }

  // ---------------- content: Thai Food Groups mapping (fixed) ----------------
  const GROUPS = [
    { id:1, name:'หมู่ 1 โปรตีน',          good:['🍗','🥚','🥛','🫘'], bad:['🍚','🍞','🥬','🍎','🥑'] },
    { id:2, name:'หมู่ 2 คาร์โบไฮเดรต',   good:['🍚','🍞','🥔','🍠'], bad:['🍗','🥚','🥬','🍎','🥑'] },
    { id:3, name:'หมู่ 3 ผัก',            good:['🥬','🥦','🥕','🍄'], bad:['🍗','🍚','🍎','🥑','🍰'] },
    { id:4, name:'หมู่ 4 ผลไม้',           good:['🍎','🍌','🍇','🍉'], bad:['🍗','🍚','🥬','🥑','🍟'] },
    { id:5, name:'หมู่ 5 ไขมัน',           good:['🥑','🧈','🫒','🥜'], bad:['🍗','🍚','🥬','🍎','🍩'] },
  ];

  // ---------------- difficulty tuning (EASIER) ----------------
  // เป้าหมาย: “ตีทัน” บนมือถือ และไม่รู้สึกว่าเป้าหนี
  const DIFFS = {
    easy:   { spawnEveryMs: 980, lifeMs: 2600, maxOnScreen: 5,  scoreGood: 30, scoreBad:-10 },
    normal: { spawnEveryMs: 860, lifeMs: 2350, maxOnScreen: 6,  scoreGood: 35, scoreBad:-12 },
    hard:   { spawnEveryMs: 740, lifeMs: 2100, maxOnScreen: 7,  scoreGood: 40, scoreBad:-14 },
  };

  function calcGrade(accPct){
    accPct = Number(accPct)||0;
    if(accPct >= 92) return 'S';
    if(accPct >= 78) return 'A';
    if(accPct >= 62) return 'B';
    if(accPct >= 45) return 'C';
    return 'D';
  }

  // ---------------- engine ----------------
  const Engine = {
    _layer: null,
    _running: false,
    _t0: 0,
    _lastSpawn: 0,
    _raf: 0,
    _timer: null,

    _rng: null,
    _diffKey: 'normal',
    _ctx: null,

    _targets: [],
    _targetId: 1,

    // metrics
    _timeLeft: 0,
    _score: 0,
    _shots: 0,
    _goodShots: 0,
    _miss: 0,
    _combo: 0,
    _comboMax: 0,

    // quest
    _groupIdx: 0,
    _goalTotal: 12,
    _goalNow: 0,
    _miniTitle: 'คอมโบติดกัน 5 ครั้ง',
    _miniTotal: 5,
    _miniNow: 0,

    _power: 0,
    _powerNeed: 8,
    _bossCleared: false,

    // hud avoid rect cache
    _avoidRects: [],
    _avoidAt: 0,

    // shoot throttle (กัน miss จากการแตะรัว)
    _lastShootAt: 0,
    _shootCooldownMs: 65,

    setLayerEl(el){
      this._layer = el;
    },

    start(diffKey, ctx){
      this.stop();

      this._ctx = ctx || {};
      const seedStr = String(this._ctx.seed || Date.now());
      this._rng = makeRng(seedStr);

      // diff
      this._diffKey = (diffKey in DIFFS) ? diffKey : 'normal';

      // ✅ slow mode for demo/test: ?slow=1 forces easy
      const slow = String(qs('slow','0')||'0');
      if(slow === '1') this._diffKey = 'easy';

      this._running = true;
      this._t0 = nowMs();
      this._lastSpawn = this._t0;

      this._timeLeft = Number(this._ctx.time || 90) | 0;

      // reset metrics
      this._score = 0;
      this._shots = 0;
      this._goodShots = 0;
      this._miss = 0;
      this._combo = 0;
      this._comboMax = 0;

      this._targets = [];
      this._targetId = 1;

      this._groupIdx = 0;
      this._goalNow = 0;

      this._miniNow = 0;

      this._power = 0;
      this._bossCleared = false;

      this._avoidRects = [];
      this._avoidAt = 0;

      this._lastShootAt = 0;

      // AI enable (optional)
      const aiQ = String(qs('ai','0')||'0');
      const aiEnabled = (aiQ === '1' || aiQ === 'true' || this._ctx.aiEnabled === true);
      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.setEnabled === 'function'){
        WIN.GroupsAIHooks.setEnabled(aiEnabled);
      }

      this._clearLayer();
      this._emitAll();

      emit('hha:coach', { text:'เริ่มแล้ว! ยิงให้ถูก “หมู่” แล้วเก็บคอมโบ 🔥', mood:'neutral' });

      this._bindInputOnce();

      // countdown
      this._timer = setInterval(()=>{
        if(!this._running) return;
        this._timeLeft = Math.max(0, (this._timeLeft|0) - 1);
        emit('hha:time', { left: this._timeLeft });
        if(this._timeLeft <= 0) this._end('time');
      }, 1000);

      this._raf = requestAnimationFrame(this._tick.bind(this));
    },

    stop(){
      this._running = false;
      try{ if(this._raf) cancelAnimationFrame(this._raf); }catch(_){}
      this._raf = 0;
      try{ if(this._timer) clearInterval(this._timer); }catch(_){}
      this._timer = null;

      this._clearTargets();
      this._clearLayer();
    },

    _clearLayer(){
      const L = this._layer;
      if(!L) return;
      try{ L.querySelectorAll('.tgt').forEach(n=>n.remove()); }catch(_){}
    },

    _clearTargets(){
      try{
        this._targets.forEach(t=>{ try{ t.el && t.el.remove(); }catch(_){ } });
      }catch(_){}
      this._targets = [];
    },

    _tick(){
      if(!this._running) return;

      const cfg = DIFFS[this._diffKey];
      const now = nowMs();

      // refresh avoid rects
      if(now - this._avoidAt > 350){
        this._avoidRects = this._computeAvoidRects();
        this._avoidAt = now;
      }

      // spawn
      if(now - this._lastSpawn >= cfg.spawnEveryMs){
        this._lastSpawn = now;
        if(this._targets.length < cfg.maxOnScreen){
          this._spawnOne();
        }
      }

      // expire
      this._updateTargets(now);

      // AI tick
      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.onTick === 'function'){
        try{ WIN.GroupsAIHooks.onTick(this._ctx, { t: now, miss:this._miss, combo:this._combo, acc:this._accPct() }); }catch(_){}
      }

      this._raf = requestAnimationFrame(this._tick.bind(this));
    },

    _computeAvoidRects(){
      const L = this._layer;
      if(!L) return [];

      const out = [];
      const pushSel = (sel, pad)=>{
        try{
          const el = DOC.querySelector(sel);
          if(!el) return;
          const r = elRect(el);
          if(r.w < 8 || r.h < 8) return;
          out.push(toLayerRect(L, rectInflate(r, pad)));
        }catch(_){}
      };

      // HUD blocks
      pushSel('.topbar', 10);
      pushSel('.hudTop', 10);
      pushSel('#coachToast', 10);
      pushSel('.hudBottom', 10);
      pushSel('#endOverlay', 4);

      // bottom band for vr-ui
      try{
        const lr = L.getBoundingClientRect();
        const v = viewNow();
        const bandH = (v === 'cvr') ? 118 : 96;
        out.push({ l:0, r: lr.width, t: lr.height - bandH, b: lr.height });
      }catch(_){}

      // clamp
      try{
        const lr = L.getBoundingClientRect();
        const W = lr.width, H = lr.height;
        return out.map(rc=>({
          l: clamp(rc.l, -80, W+80),
          t: clamp(rc.t, -80, H+80),
          r: clamp(rc.r, -80, W+80),
          b: clamp(rc.b, -80, H+80),
        })).filter(rc=> (rc.r-rc.l) > 10 && (rc.b-rc.t) > 10);
      }catch(_){
        return out;
      }
    },

    _spawnOne(){
      const L = this._layer;
      if(!L) return;

      const cfg = DIFFS[this._diffKey];
      const group = GROUPS[this._groupIdx % GROUPS.length];

      // bias: ให้ของถูกหมู่เยอะขึ้นเล็กน้อย เพื่อ “สนุก-ทันมือ”
      const roll = this._rng();
      const icon = (roll < 0.72)
        ? pick(this._rng, group.good)
        : pick(this._rng, group.bad);

      const isGood = group.good.includes(icon);

      const el = DOC.createElement('div');
      el.className = 'tgt';
      el.textContent = icon;
      el.setAttribute('data-good', isGood ? '1' : '0');
      el.setAttribute('data-group', String(group.id));
      el.setAttribute('data-id', String(this._targetId++));

      const lr = L.getBoundingClientRect();
      const W = Math.max(1, lr.width);
      const H = Math.max(1, lr.height);

      const size = 74;
      const pad = 8;

      let x=pad, y=pad, nearHud=false;

      for(let i=0;i<28;i++){
        const tx = randBetween(this._rng, pad, Math.max(pad, W - size - pad));
        const ty = randBetween(this._rng, pad, Math.max(pad, H - size - pad));
        const rc = { l:tx, t:ty, r:tx+size, b:ty+size };

        let bad=false;
        for(const a of this._avoidRects){
          if(rectsOverlap(rc, a)){ bad=true; nearHud=true; break; }
        }
        if(!bad){ x=tx; y=ty; nearHud=false; break; }
      }

      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      L.appendChild(el);

      const born = nowMs();
      const target = {
        id: el.getAttribute('data-id'),
        el,
        icon,
        groupId: group.id,
        isGood,
        born,
        lifeMs: cfg.lifeMs,
        expired:false,
        nearHud: !!nearHud
      };

      this._targets.push(target);

      el.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        this._onHit(target, 'tap');
      }, { passive:false });

      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.onSpawn === 'function'){
        try{ WIN.GroupsAIHooks.onSpawn(this._ctx, { id:target.id, icon, isGood, groupId:group.id, nearHud:target.nearHud }); }catch(_){}
      }
    },

    _updateTargets(now){
      const keep = [];
      for(const t of this._targets){
        if(!t || !t.el) continue;

        const age = now - t.born;
        if(age >= t.lifeMs && !t.expired){
          t.expired = true;

          // ✅ Fair miss: if overlaps HUD at expiry, do not count
          const overHud = this._isTargetOverHud(t);
          const countedMiss = (!overHud);

          if(countedMiss){
            this._miss++;
            this._combo = 0;
            this._miniNow = 0;
            this._emitScore();
          }

          if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.onExpire === 'function'){
            try{ WIN.GroupsAIHooks.onExpire(this._ctx, { id:t.id, overHud, countedMiss }); }catch(_){}
          }

          try{ t.el.remove(); }catch(_){}
          continue;
        }

        keep.push(t);
      }
      this._targets = keep;
    },

    _isTargetOverHud(t){
      const L = this._layer;
      if(!L || !t || !t.el) return false;

      try{
        const tr = elRect(t.el);
        const Lr = elRect(L);
        const rc = { l: tr.l - Lr.l, t: tr.t - Lr.t, r: tr.r - Lr.l, b: tr.b - Lr.t };
        for(const a of this._avoidRects){
          if(rectsOverlap(rc, a)) return true;
        }
        return false;
      }catch(_){
        return false;
      }
    },

    _bindInputOnce(){
      if(this._bound) return;
      this._bound = true;

      // hha:shoot from vr-ui (crosshair/tap-to-shoot)
      WIN.addEventListener('hha:shoot', (ev)=>{
        if(!this._running) return;

        // shot throttle
        const tn = nowMs();
        if(tn - (this._lastShootAt||0) < this._shootCooldownMs) return;
        this._lastShootAt = tn;

        const d = ev?.detail || {};
        const x = Number(d.x), y = Number(d.y);
        if(!Number.isFinite(x) || !Number.isFinite(y)) return;

        // base lockPx from vr-ui, then widen on mobile/cVR
        let lockPx = Number(d.lockPx || 16);
        const v = viewNow();
        if(v === 'mobile') lockPx = Math.max(lockPx, 34);
        if(v === 'cvr')    lockPx = Math.max(lockPx, 26);

        const hit = this._pickTargetByPoint(x, y, lockPx);
        if(hit){
          this._onHit(hit, d.source || 'shoot');
        }else{
          // shot but no hit
          this._shots++;
          this._combo = 0;
          this._miniNow = 0;
          this._emitScore();
        }
      }, { passive:true });
    },

    _pickTargetByPoint(x,y, lockPx){
      const L = this._layer;
      if(!L) return null;

      const lr = L.getBoundingClientRect();
      const lx = x - lr.left;
      const ly = y - lr.top;

      let best=null, bestD=1e9;

      for(const t of this._targets){
        if(!t || !t.el || t.expired) continue;
        try{
          const r = elRect(t.el);
          const cx = (r.l + r.r)/2 - lr.left;
          const cy = (r.t + r.b)/2 - lr.top;
          const dx = cx - lx, dy = cy - ly;
          const d = Math.hypot(dx,dy);
          if(d <= lockPx && d < bestD){
            best = t;
            bestD = d;
          }
        }catch(_){}
      }
      return best;
    },

    _onHit(t, source){
      if(!this._running) return;
      if(!t || !t.el || t.expired) return;

      const cfg = DIFFS[this._diffKey];
      const group = GROUPS[this._groupIdx % GROUPS.length];

      // correct = good item of current group
      const isCorrect = (t.isGood === true) && (t.groupId === group.id);

      this._shots++;

      if(isCorrect){
        this._goodShots++;
        this._combo++;
        this._comboMax = Math.max(this._comboMax, this._combo);
        this._miniNow = Math.min(this._miniTotal, this._miniNow + 1);

        this._goalNow = Math.min(this._goalTotal, this._goalNow + 1);
        this._power = Math.min(this._powerNeed, this._power + 1);

        this._score += cfg.scoreGood + Math.min(14, this._combo|0);

        if(this._miniNow >= this._miniTotal){
          emit('hha:coach', { text:'MINI สำเร็จ! +โบนัส 🔥', mood:'happy' });
          this._score += 45;
          this._miniNow = 0;
        }

        if(this._goalNow >= this._goalTotal){
          this._goalNow = 0;
          this._groupIdx = (this._groupIdx + 1) % GROUPS.length;
          const ng = GROUPS[this._groupIdx];
          emit('hha:coach', { text:`สลับเป็น ${ng.name} ✨`, mood:'neutral' });
          emit('groups:group', { id:ng.id, name: ng.name });
        }

        if(this._power >= this._powerNeed && !this._bossCleared){
          this._bossCleared = true;
          emit('hha:coach', { text:'POWER เต็ม! ผ่านช่วงยาก ✅', mood:'happy' });
        }
      }else{
        this._combo = 0;
        this._miniNow = 0;
        this._score += cfg.scoreBad;
        emit('hha:coach', { text:'ผิดหมู่! ดูชื่อหมู่ก่อนยิงนะ', mood:'neutral' });
      }

      try{ t.el.remove(); }catch(_){}
      t.expired = true;
      this._targets = this._targets.filter(x=>x!==t);

      this._emitScore();
      this._emitQuest();
      emit('groups:power', { charge:this._power, threshold:this._powerNeed });

      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.onHit === 'function'){
        try{ WIN.GroupsAIHooks.onHit(this._ctx, { id:t.id, correct:isCorrect, groupId:t.groupId, icon:t.icon, source }); }catch(_){}
      }
    },

    _accPct(){
      const s = this._shots|0;
      if(s <= 0) return 0;
      return Math.round((this._goodShots / Math.max(1,s))*100);
    },

    _emitScore(){
      emit('hha:score', {
        score:this._score|0,
        combo:this._combo|0,
        miss:this._miss|0,
        misses:this._miss|0,
        shots:this._shots|0,
        goodShots:this._goodShots|0,
        accuracyPct:this._accPct()
      });
      emit('hha:rank', { grade: calcGrade(this._accPct()) });
    },

    _emitQuest(){
      const g = GROUPS[this._groupIdx % GROUPS.length];
      emit('quest:update', {
        goalTitle: `ยิงให้ถูก: ${g.name}`,
        goalNow: this._goalNow,
        goalTotal: this._goalTotal,
        groupName: g.name,
        miniTitle: this._miniTitle,
        miniNow: this._miniNow,
        miniTotal: this._miniTotal,
        miniTimeLeftSec: 0
      });
      emit('groups:group', { id:g.id, name:g.name });
    },

    _emitAll(){
      emit('hha:time', { left: this._timeLeft|0 });
      this._emitScore();
      this._emitQuest();
      emit('groups:power', { charge:this._power|0, threshold:this._powerNeed|0 });
    },

    _end(reason){
      if(!this._running) return;
      this._running = false;

      try{ if(this._timer) clearInterval(this._timer); }catch(_){}
      this._timer = null;

      const acc = this._accPct();
      const summary = {
        reason: reason || 'time',
        scoreFinal: this._score|0,
        miss: this._miss|0,
        shots: this._shots|0,
        goodShots: this._goodShots|0,
        accuracyPct: acc,
        grade: calcGrade(acc),
        seed: String(this._ctx && this._ctx.seed || ''),
        runMode: String(this._ctx && this._ctx.runMode || 'play'),
        diff: String(this._diffKey),
        style: 'mix',
        view: viewNow(),
        comboMax: this._comboMax|0,
        miniCleared: (this._comboMax >= 5),
        bossCleared: !!this._bossCleared,
        aiEnabled: !!(String(qs('ai','0')) === '1')
      };

      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.onEnd === 'function'){
        try{ WIN.GroupsAIHooks.onEnd(this._ctx, summary); }catch(_){}
      }

      emit('hha:end', summary);
      this._clearTargets();
    }
  };

  // ---------------- telemetry (local scaffold) ----------------
  const Telemetry = {
    _lastFlushAt: 0,
    flush(summary){
      this._lastFlushAt = Date.now();
      return true;
    }
  };

  function bindFlushOnLeave(getSummary){
    const flush = ()=>{
      try{
        const s = (typeof getSummary === 'function') ? getSummary() : null;
        Telemetry.flush(s || null);
      }catch(_){}
    };
    WIN.addEventListener('pagehide', flush, { passive:true });
    WIN.addEventListener('beforeunload', flush, { passive:true });
    DOC.addEventListener('visibilitychange', ()=>{
      if(DOC.visibilityState === 'hidden') flush();
    });
  }

  // expose API
  WIN.GroupsVR = {
    version: 'v20260303-GROUPS-SAFE-HUDMISS-EASIER-AIM',
    GameEngine: Engine,
    Telemetry,
    bindFlushOnLeave
  };

  try{
    const dbg = String(qs('debug','0')||'0');
    if(dbg === '1') console.log('[GroupsVR] loaded', WIN.GroupsVR.version);
  }catch(_){}
})();