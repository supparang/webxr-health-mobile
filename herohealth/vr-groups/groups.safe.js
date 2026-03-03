// === /herohealth/vr-groups/groups.safe.js ===
// GroupsVR SAFE — PRODUCTION (HUD-safe spawn + fair miss + deterministic + hha:shoot + summary hardened)
// FULL v20260303-GROUPS-SAFE-HUDMISS-HARDEN
//
// ✅ HUD-safe spawn (avoid HUD rectangles on mobile/pc/cVR)
// ✅ Fair MISS: expiration over HUD does NOT count as miss (prevents "feel correct but miss huge")
// ✅ Deterministic RNG (seed string)
// ✅ hha:shoot supported (cVR crosshair shoot)
// ✅ Emits: hha:time, hha:score, hha:rank, hha:coach, quest:update, groups:power, groups:group
// ✅ Telemetry scaffold (local-only) + flush hooks
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
    // xorshift32
    return function(){
      s ^= (s << 13); s >>>= 0;
      s ^= (s >>> 17); s >>>= 0;
      s ^= (s << 5);  s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  function pick(rng, arr){
    return arr[(rng()*arr.length)|0];
  }

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
    // convert viewport rect -> layer-local coordinates
    const L = layerEl.getBoundingClientRect();
    return { l: rc.l - L.left, t: rc.t - L.top, r: rc.r - L.left, b: rc.b - L.top };
  }

  function randBetween(rng, a,b){ return a + (b-a)*rng(); }

  // ---------------- content: Thai Food Groups mapping (fixed) ----------------
  // (ตามที่คุณย้ำไว้: หมู่ 1 โปรตีน, 2 คาร์บ, 3 ผัก, 4 ผลไม้, 5 ไขมัน)
  const GROUPS = [
    { id:1, name:'หมู่ 1 โปรตีน',   icons:['🍗','🥚','🥛','🫘'], good:['🍗','🥚','🥛','🫘'], bad:['🍚','🍞','🥬','🍎','🥑'] },
    { id:2, name:'หมู่ 2 คาร์โบไฮเดรต', icons:['🍚','🍞','🥔','🍠'], good:['🍚','🍞','🥔','🍠'], bad:['🍗','🥚','🥬','🍎','🥑'] },
    { id:3, name:'หมู่ 3 ผัก',     icons:['🥬','🥦','🥕','🍄'], good:['🥬','🥦','🥕','🍄'], bad:['🍗','🍚','🍎','🥑','🍰'] },
    { id:4, name:'หมู่ 4 ผลไม้',    icons:['🍎','🍌','🍇','🍉'], good:['🍎','🍌','🍇','🍉'], bad:['🍗','🍚','🥬','🥑','🍟'] },
    { id:5, name:'หมู่ 5 ไขมัน',    icons:['🥑','🧈','🫒','🥜'], good:['🥑','🧈','🫒','🥜'], bad:['🍗','🍚','🥬','🍎','🍩'] },
  ];

  // ---------------- difficulty tuning ----------------
  const DIFFS = {
    easy:   { spawnEveryMs: 750, lifeMs: 1800, maxOnScreen: 6,  scoreGood: 30, scoreBad:-15 },
    normal: { spawnEveryMs: 620, lifeMs: 1550, maxOnScreen: 7,  scoreGood: 35, scoreBad:-18 },
    hard:   { spawnEveryMs: 520, lifeMs: 1350, maxOnScreen: 8,  scoreGood: 40, scoreBad:-22 },
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
    _lastTick: 0,
    _lastSpawn: 0,
    _raf: 0,
    _timer: null,

    _rng: null,
    _diffKey: 'normal',
    _cfg: null,
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

    // quest/boss-ish
    _groupIdx: 0,
    _goalTotal: 12,
    _goalNow: 0,
    _miniTitle: 'คอมโบติดกัน 5 ครั้ง',
    _miniTotal: 5,
    _miniNow: 0,
    _miniTimeLeft: 0,

    _power: 0,
    _powerNeed: 8,
    _bossCleared: false,

    // hud avoid rect cache
    _avoidRects: [],
    _avoidAt: 0,

    setLayerEl(el){
      this._layer = el;
    },

    start(diffKey, ctx){
      this.stop();

      this._diffKey = (diffKey in DIFFS) ? diffKey : 'normal';
      this._ctx = ctx || {};
      const seedStr = String(this._ctx.seed || Date.now());
      this._rng = makeRng(seedStr);

      this._running = true;
      this._t0 = nowMs();
      this._lastTick = this._t0;
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
      this._miniTimeLeft = 0;

      this._power = 0;
      this._bossCleared = false;

      // AI enable: explicit query ai=1 or ctx.aiEnabled
      const aiQ = String(qs('ai','0')||'0');
      const aiEnabled = (aiQ === '1' || aiQ === 'true' || this._ctx.aiEnabled === true);
      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.setEnabled === 'function'){
        WIN.GroupsAIHooks.setEnabled(aiEnabled);
      }

      this._clearLayer();
      this._emitAll();

      emit('hha:coach', { text:'เริ่มแล้ว! ยิงให้ถูก “หมู่” แล้วเก็บคอมโบ 🔥', mood:'neutral' });

      this._bindInputOnce();

      // timer: countdown each second
      this._timer = setInterval(()=>{
        if(!this._running) return;
        this._timeLeft = Math.max(0, (this._timeLeft|0) - 1);
        emit('hha:time', { left: this._timeLeft });
        if(this._timeLeft <= 0){
          this._end('time');
        }
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
      // keep layer but remove remnants
      this._clearLayer();
    },

    _clearLayer(){
      const L = this._layer;
      if(!L) return;
      try{
        // remove only targets we created
        const nodes = L.querySelectorAll('.tgt');
        nodes.forEach(n=>n.remove());
      }catch(_){}
    },

    _clearTargets(){
      try{
        this._targets.forEach(t=>{
          try{ if(t.el) t.el.remove(); }catch(_){}
        });
      }catch(_){}
      this._targets = [];
    },

    _tick(t){
      if(!this._running) return;

      const cfg = DIFFS[this._diffKey];
      const now = nowMs();

      // refresh HUD avoid rects every ~350ms (cheap enough)
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

      // update targets
      this._updateTargets(now);

      // AI tick hook
      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.onTick === 'function'){
        try{ WIN.GroupsAIHooks.onTick(this._ctx, { t: now, miss:this._miss, combo:this._combo, acc:this._accPct() }); }catch(_){}
      }

      this._raf = requestAnimationFrame(this._tick.bind(this));
    },

    _computeAvoidRects(){
      const L = this._layer;
      if(!L) return [];

      // These are the actual HUD blocks in your groups-vr.html
      const ids = ['.topbar', '.hudTop'];
      // mobile hides hudBottom; still safe to include if present
      const maybe = ['.hudBottom', '#coachToast'];

      const out = [];
      const pushEl = (sel, pad)=>{
        try{
          const el = DOC.querySelector(sel);
          if(!el) return;
          const r = elRect(el);
          if(r.w < 4 || r.h < 4) return;
          const infl = rectInflate(r, pad);
          out.push(toLayerRect(L, infl));
        }catch(_){}
      };

      ids.forEach(sel=>pushEl(sel, 10));
      maybe.forEach(sel=>pushEl(sel, 8));

      // also avoid bottom vr-ui buttons area (ENTER VR / RECENTER)
      // estimate: bottom band height 86 (mobile) / 106 (cVR)
      try{
        const lr = L.getBoundingClientRect();
        const view = String(DOC.body.getAttribute('data-view')||'').toLowerCase();
        const bandH = (view === 'cvr') ? 112 : 92;
        out.push({ l: 0, r: lr.width, t: lr.height - bandH, b: lr.height });
      }catch(_){}

      // sanitize: keep only rects that intersect layer bounds
      const Lr = elRect(L);
      const W = Lr.w, H = Lr.h;
      return out
        .map(rc=>({
          l: clamp(rc.l, -80, W+80),
          t: clamp(rc.t, -80, H+80),
          r: clamp(rc.r, -80, W+80),
          b: clamp(rc.b, -80, H+80),
        }))
        .filter(rc=> (rc.r-rc.l) > 10 && (rc.b-rc.t) > 10);
    },

    _spawnOne(){
      const L = this._layer;
      if(!L) return;

      const cfg = DIFFS[this._diffKey];

      const group = GROUPS[this._groupIdx % GROUPS.length];
      const icon = pick(this._rng, group.good.concat(group.bad));
      const isGood = group.good.includes(icon);

      // create element
      const el = DOC.createElement('div');
      el.className = 'tgt';
      el.textContent = icon;
      el.setAttribute('data-good', isGood ? '1' : '0');
      el.setAttribute('data-group', String(group.id));
      el.setAttribute('data-id', String(this._targetId++));

      // position (HUD-safe)
      const lr = L.getBoundingClientRect();
      const W = Math.max(1, lr.width);
      const H = Math.max(1, lr.height);

      const size = 74; // css matches
      const pad = 8;
      const tries = 24;

      let x=pad, y=pad, ok=false, nearHud=false;

      for(let i=0;i<tries;i++){
        x = randBetween(this._rng, pad, Math.max(pad, W - size - pad));
        y = randBetween(this._rng, pad, Math.max(pad, H - size - pad));

        const rc = { l:x, t:y, r:x+size, b:y+size };
        let bad=false;
        for(const a of this._avoidRects){
          if(rectsOverlap(rc, a)){ bad=true; nearHud=true; break; }
        }
        if(!bad){ ok=true; break; }
      }

      // if still not ok, place but mark nearHud
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

      // click handler (tap to shoot on pc/mobile)
      el.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        this._onHit(target, 'tap');
      }, { passive:false });

      // AI hook
      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.onSpawn === 'function'){
        try{ WIN.GroupsAIHooks.onSpawn(this._ctx, { id:target.id, icon, isGood, groupId:group.id, nearHud:target.nearHud }); }catch(_){}
      }
    },

    _updateTargets(now){
      const L = this._layer;
      if(!L) return;

      const keep = [];
      for(const t of this._targets){
        if(!t || !t.el) continue;

        const age = now - t.born;
        if(age >= t.lifeMs && !t.expired){
          t.expired = true;

          // MISS fairness: if target overlaps HUD at expiry -> do NOT count miss
          const overHud = this._isTargetOverHud(t);

          const countedMiss = (!overHud);
          if(countedMiss){
            this._miss++;
            this._combo = 0;
            this._miniNow = 0;
            emit('hha:coach', { text:'พลาด! ลองช้าลงนิด แล้วดูหมู่ก่อนยิง', mood:'neutral' });
            this._emitScore();
          } else {
            // silently ignore (HUD-blocked)
            // optional: coach only if frequent
          }

          // AI hook
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
        const d = ev?.detail || {};
        const x = Number(d.x), y = Number(d.y);
        if(!Number.isFinite(x) || !Number.isFinite(y)) return;

        // choose nearest target within lockPx
        const lockPx = Number(d.lockPx || 16);
        const hit = this._pickTargetByPoint(x, y, lockPx);
        if(hit){
          this._onHit(hit, d.source || 'shoot');
        } else {
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

      // layer coords expected from vr-ui? (typically viewport center)
      // convert viewport coords -> layer coords
      const lr = L.getBoundingClientRect();
      const lx = x - lr.left;
      const ly = y - lr.top;

      let best=null, bestD=1e9;
      for(const t of this._targets){
        if(!t || !t.el || t.expired) continue;
        try{
          const r = elRect(t.el);
          const cx = (r.left + r.right)/2 - lr.left;
          const cy = (r.top + r.bottom)/2 - lr.top;
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
      const shouldBeGood = true; // correct = shoot good of current group
      const isCorrect = (t.isGood === shouldBeGood) && (t.groupId === group.id);

      this._shots++;

      if(isCorrect){
        this._goodShots++;
        this._combo++;
        this._comboMax = Math.max(this._comboMax, this._combo);
        this._miniNow = Math.min(this._miniTotal, this._miniNow + 1);

        // quest progress
        this._goalNow = Math.min(this._goalTotal, this._goalNow + 1);

        // power build
        this._power = Math.min(this._powerNeed, this._power + 1);

        this._score += cfg.scoreGood + Math.min(15, this._combo|0);

        // clear mini when reached
        if(this._miniNow >= this._miniTotal){
          emit('hha:coach', { text:'MINI สำเร็จ! คอมโบมาแล้ว 🔥', mood:'happy' });
          this._miniNow = 0;
        }

        // group switch when goal done
        if(this._goalNow >= this._goalTotal){
          this._goalNow = 0;
          this._groupIdx = (this._groupIdx + 1) % GROUPS.length;
          const ng = GROUPS[this._groupIdx];
          emit('hha:coach', { text:`สลับเป็น ${ng.name} ✨`, mood:'neutral' });
          emit('groups:group', { id:ng.id, name: ng.name });
        }

        // boss-ish clear when power full
        if(this._power >= this._powerNeed && !this._bossCleared){
          this._bossCleared = true;
          emit('hha:coach', { text:'POWER เต็ม! ผ่านช่วงยาก ✅', mood:'happy' });
        }

      } else {
        // wrong hit
        this._combo = 0;
        this._miniNow = 0;
        this._score += cfg.scoreBad;
        emit('hha:coach', { text:'ผิดหมู่! ดูชื่อหมู่ก่อนยิงนะ', mood:'neutral' });
      }

      // remove target
      try{ t.el.remove(); }catch(_){}
      t.expired = true;
      this._targets = this._targets.filter(x=>x!==t);

      // emits
      this._emitScore();
      this._emitQuest();
      emit('groups:power', { charge:this._power, threshold:this._powerNeed });

      // AI hook
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
      emit('hha:score', { score:this._score|0, combo:this._combo|0, miss:this._miss|0, misses:this._miss|0, shots:this._shots|0, goodShots:this._goodShots|0, accuracyPct:this._accPct() });
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

      // summarize
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
        view: String(DOC.body.getAttribute('data-view')||qs('view','mobile')||'mobile'),
        comboMax: this._comboMax|0,
        miniCleared: this._bossCleared ? true : (this._comboMax >= 5),
        bossCleared: !!this._bossCleared,
        aiEnabled: !!(WIN.GroupsAIHooks && WIN.GroupsAIHooks.enabled)
      };

      // AI hook end
      if(WIN.GroupsAIHooks && typeof WIN.GroupsAIHooks.onEnd === 'function'){
        try{ WIN.GroupsAIHooks.onEnd(this._ctx, summary); }catch(_){}
      }

      emit('hha:end', summary);

      // cleanup targets after end screen triggers
      this._clearTargets();
    }
  };

  // ---------------- telemetry (local scaffold) ----------------
  const Telemetry = {
    _lastFlushAt: 0,
    flush(summary){
      // placeholder: your cloud logger can hook here later
      this._lastFlushAt = Date.now();
      // (no network in this patch)
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
    version: 'v20260303-GROUPS-SAFE-HUDMISS-HARDEN',
    GameEngine: Engine,
    Telemetry,
    bindFlushOnLeave
  };

  // optional debug ping
  try{
    const dbg = String(qs('debug','0')||'0');
    if(dbg === '1'){
      console.log('[GroupsVR] loaded', WIN.GroupsVR.version);
    }
  }catch(_){}
})();