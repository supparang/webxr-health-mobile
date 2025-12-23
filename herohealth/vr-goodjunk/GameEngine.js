// === /herohealth/vr-goodjunk/GameEngine.js ===
// HeroHealth — GoodJunkVR PRODUCTION GAME ENGINE (ALL MODES)
// ✅ Modes: run=play|research  (research = deterministic RNG + protocol lock)
// ✅ Diff: easy|normal|hard
// ✅ Challenge: rush|survival|boss
// ✅ MISS (ตามนิยามล่าสุด): miss = good expired + junk hit (shield block ไม่นับ miss)
// ✅ Emits (HUD compat): hha:score / hha:time / quest:update / hha:coach / hha:fever / hha:judge / hha:end / hha:adaptive
// ✅ Safezone: safeMargins (กันทับ HUD) + layer offset (__GJ_LAYER_OFFSET__) + aim point (__GJ_AIM_POINT__)
// ✅ Double-bine (โหด): combo streak → spawn 2 เป้าซ้อนจังหวะ + คะแนนคูณ + FX/tick

'use strict';

import { Difficulty } from './difficulty.js';
import { makeQuestDirector } from './quest-director-goodjunk.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

// -------- Root modules (IIFE global) --------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { burstAt(){}, scorePop(){}, celebrate(){}, toast(){} };

const Coach =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Coach) ||
  ROOT.Coach ||
  { say(){}, mood(){} };

// -------- Helpers --------
const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
const now = ()=> (performance?.now ? performance.now() : Date.now());
const safeDispatch = (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} };

function getAimPoint(){
  const ap = ROOT.__GJ_AIM_POINT__;
  if (ap && Number.isFinite(ap.x) && Number.isFinite(ap.y)) return { x: ap.x|0, y: ap.y|0 };
  return { x: (innerWidth*0.5)|0, y: (innerHeight*0.62)|0 };
}
function getLayerOffset(){
  const o = ROOT.__GJ_LAYER_OFFSET__;
  if (o && Number.isFinite(o.x) && Number.isFinite(o.y)) return { x:o.x, y:o.y };
  return { x:0, y:0 };
}
function toLayerPt(xScreen,yScreen){
  const o = getLayerOffset();
  return { x:(xScreen - o.x), y:(yScreen - o.y) };
}
function toScreenPt(xLayer,yLayer){
  const o = getLayerOffset();
  return { x:(xLayer + o.x), y:(yLayer + o.y) };
}
function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; }
function lerp(a,b,t){ return a + (b-a)*t; }

// -------- RNG (deterministic for research) --------
function mulberry32(seed){
  let a = (seed>>>0) || 0x12345678;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -------- Emoji pools --------
const POOL_GOOD = ['🥦','🥕','🍎','🍌','🥬','🍇','🍊','🍉','🥜','🐟','🥛'];
const POOL_JUNK = ['🍟','🍕','🍔','🍩','🍭','🥤','🍰','🍫','🧁'];
const POOL_TRAP = ['😈','🪤','☠️','🧨'];

const EMO_GOLD  = '🟡';
const EMO_MAG   = '🧲';
const EMO_TIME  = '⏳';
const EMO_SHLD  = '🛡️';

function pick(arr, rnd){ return arr[(rnd()*arr.length)|0]; }
function randi(a,b,rnd){ return a + ((rnd()*(b-a+1))|0); }

// -------- DOM target helpers --------
function createEl(layer, xL, yL, emoji, cls){
  const el = document.createElement('div');
  el.className = `gj-target ${cls||''}`;
  el.textContent = emoji;
  el.style.left = (xL|0)+'px';
  el.style.top  = (yL|0)+'px';
  layer.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('spawn'));
  return el;
}
function killEl(el){
  try{
    el.classList.add('gone');
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 160);
  }catch(_){}
}
function burstFX(xS,yS,mode){
  try{ Particles.burstAt && Particles.burstAt(xS,yS,mode||'good'); }catch(_){}
}
function scorePop(xS,yS,txt,label){
  try{ Particles.scorePop && Particles.scorePop(xS,yS,txt,label||''); }catch(_){}
}

// -------- Engine --------
export class GameEngine {
  constructor(opts = {}){
    // ---- inputs ----
    this.layer = opts.layerEl || document.getElementById('gj-layer');
    if (!this.layer) throw new Error('[GoodJunk GameEngine] layerEl missing');

    this.diffKey = String(opts.diff || 'normal').toLowerCase();
    this.challenge = String(opts.challenge || 'rush').toLowerCase();
    this.runMode = String(opts.run || 'play').toLowerCase();
    this.durationSec = clamp(opts.time ?? 60, 20, 180)|0;

    // protocol lock (research)
    this.protocol = String(opts.protocol || '');
    this.pid = String(opts.pid || '');

    // safe margins from HTML calcSafeMargins()
    const m = opts.safeMargins || {};
    this.SM = {
      top:    Math.max(0, (m.top|0) || 130),
      bottom: Math.max(0, (m.bottom|0) || 170),
      left:   Math.max(0, (m.left|0) || 26),
      right:  Math.max(0, (m.right|0) || 26),
    };

    // ---- difficulty ----
    this.DF = new Difficulty();
    this.DF.level = (this.diffKey==='easy'||this.diffKey==='hard') ? this.diffKey : 'normal';

    // ---- RNG ----
    const seed =
      (opts.seed != null) ? (Number(opts.seed)>>>0) :
      (this.runMode==='research')
        ? (this._hash32(`${this.pid}|${this.protocol}|${this.diffKey}|${this.challenge}`)>>>0)
        : ((Math.random()*1e9)>>>0);

    this.rnd = (this.runMode==='research') ? mulberry32(seed) : Math.random;

    // ---- state ----
    const t0 = now();
    this.S = {
      running:true,
      startedAt:t0,
      endAt:t0 + this.durationSec*1000,
      timeLeft:this.durationSec,

      score:0,
      goodHits:0,
      misses:0,          // miss = good expired + junk hit (shield block not count)
      combo:0,
      comboMax:0,

      // fever/shield
      fever:0,
      feverDecayPerSec: 9.5,
      shield:0,

      // magnet/power
      magnet:false,
      magnetEndsAt:0,

      // streak
      streakGood:0,
      goldHitsThisMini:false,
      safeNoJunkSeconds:0,
      _noJunkT0: t0,

      // double-bine
      dbActive:false,
      dbEndsAt:0,
      dbStacks:0,
      dbNextAt:0,

      // spawn
      lastSpawnAt:0,
      nextId:1,
      targets:new Map(),

      // boss (light)
      bossAlive:false,
      bossHp:0,
      bossHpMax:0,
      bossSpawned:false,
    };

    // quest director (GOODJUNK)
    this.qState = {
      goodHits:0,
      comboMax:0,
      streakGood:0,
      goldHitsThisMini:false,
      safeNoJunkSeconds:0
    };
    this.qDir = makeQuestDirector({
      diff:this.diffKey,
      goalDefs:GOODJUNK_GOALS,
      miniDefs:GOODJUNK_MINIS,
      maxGoals:2,
      maxMini:999
    });

    // bind loop
    this._raf = 0;
    this._loop = this._loop.bind(this);
  }

  // -------- public --------
  start(){
    // start quest
    try{ this.qDir.start?.(); }catch(_){}

    // initial emits (HUD ไม่ว่าง)
    this._emitAll(true);

    // coach greeting
    safeDispatch('hha:coach', { text:'เริ่มเลย! เก็บของดี เลี่ยงขยะ 💪', mood:'neutral' });

    // start loop
    this._raf = requestAnimationFrame(this._loop);
    return this;
  }

  stop(){
    this._endGame('stop');
  }

  // -------- scoring helpers --------
  _comboMul(c){
    const m = 1 + Math.min(1.35, (c|0)*0.07);
    // double-bine buff
    const db = this.S.dbActive ? (1.22 + Math.min(0.18, this.S.dbStacks*0.03)) : 1.0;
    return Math.round(m*db*100)/100;
  }
  _gain(base){
    const mul = this._comboMul(this.S.combo);
    return Math.round(base * mul);
  }
  _setCombo(v){
    this.S.combo = Math.max(0, v|0);
    if (this.S.combo > this.S.comboMax) this.S.comboMax = this.S.combo;
  }
  _addFever(d){ this.S.fever = clamp((this.S.fever||0)+(d||0), 0, 100); }

  // -------- geometry --------
  _safeRect(){
    const left = this.SM.left;
    const right = Math.max(left+10, innerWidth - this.SM.right);
    const top = this.SM.top;
    const bottom = Math.max(top+10, innerHeight - this.SM.bottom);
    return { left, right, top, bottom };
  }

  // -------- spawn rules --------
  _spawnGapMs(){
    // base from Difficulty table (keep your old numbers stable)
    const base = this.diffKey==='easy' ? 880 : this.diffKey==='hard' ? 640 : 760;

    // challenge shaping
    const ch = this.challenge;
    let mul = 1.0;
    if (ch==='survival') mul *= 0.86;
    if (ch==='boss')     mul *= 0.92;

    // double-bine makes it nastier
    if (this.S.dbActive) mul *= 0.78;

    // fever/panic light scaling
    const feverMul = 1.0 - (Math.min(0.42, (this.S.fever/100)*0.25));
    mul *= clamp(feverMul, 0.72, 1.0);

    return Math.round(base * mul);
  }

  _pickKind(){
    const r = this.rnd();
    const ch = this.challenge;

    // boss mode: more traps
    if (ch==='boss' && this.S.bossAlive){
      if (r < 0.46) return 'junk';
      if (r < 0.58) return 'trap';
      if (r < 0.78) return 'good';
      if (r < 0.88) return 'gold';
      return 'power';
    }

    // survival: junk heavier
    if (ch==='survival'){
      if (r < 0.44) return 'junk';
      if (r < 0.55) return 'trap';
      if (r < 0.82) return 'good';
      if (r < 0.90) return 'gold';
      return 'power';
    }

    // rush default
    if (r < (this.diffKey==='easy'?0.34:this.diffKey==='hard'?0.46:0.40)) return 'junk';
    if (r < 0.52) return 'trap';
    if (r < 0.82) return 'good';
    if (r < 0.90) return 'gold';
    return 'power';
  }

  _spawn(kind, posScreen=null){
    if (!this.S.running) return null;

    const maxActive = this.diffKey==='easy'?6 : this.diffKey==='hard'?8 : 7;
    if (this.S.targets.size >= maxActive && kind!=='boss') return null;

    const R = this._safeRect();

    let xs = posScreen ? (posScreen.x|0) : randi(R.left, R.right, this.rnd);
    let ys = posScreen ? (posScreen.y|0) : randi(R.top,  R.bottom, this.rnd);

    xs = clamp(xs, R.left, R.right);
    ys = clamp(ys, R.top,  R.bottom);

    // convert to layer coords
    const pL = toLayerPt(xs, ys);

    let emoji='❓', cls='', ttl = (this.diffKey==='easy'?2100:this.diffKey==='hard'?1700:1900);

    if (kind==='good'){
      emoji = pick(POOL_GOOD, this.rnd);
    } else if (kind==='junk'){
      emoji = pick(POOL_JUNK, this.rnd);
      cls='gj-junk';
    } else if (kind==='trap'){
      emoji = pick(POOL_TRAP, this.rnd);
      cls='gj-fake';
      ttl = Math.round(ttl*0.92);
    } else if (kind==='gold'){
      emoji = EMO_GOLD;
      cls='gj-gold';
      ttl = Math.round(ttl*0.95);
    } else if (kind==='power'){
      const p = 1 + ((this.rnd()*3)|0);
      emoji = (p===1)?EMO_MAG:(p===2)?EMO_TIME:EMO_SHLD;
      cls='gj-power';
      ttl = Math.round(ttl*0.92);
    } else if (kind==='boss'){
      emoji = '👑';
      cls='gj-boss';
      ttl = 999999;
    }

    const el = createEl(this.layer, pL.x, pL.y, emoji, cls);

    const id = this.S.nextId++;
    const t = {
      id, kind, el,
      x:pL.x, y:pL.y,           // layer coords
      bornAt: now(),
      expiresAt: now()+ttl
    };
    this.S.targets.set(id, t);

    el.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault?.(); ev.stopPropagation?.();
      this._onHit(t);
    }, { passive:false });

    return t;
  }

  // -------- hits --------
  _onHit(t){
    if (!this.S.running) return;

    const rect = t.el.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;

    if (t.kind === 'good'){
      this.S.goodHits++;
      this.S.streakGood++;
      this._setCombo(this.S.combo + 1);
      this._addFever(8);

      const pts = this._gain(20);
      this.S.score += pts;

      scorePop(cx,cy,`+${pts}`, (this.S.combo>=10?'PERFECT!':'GOOD!'));
      burstFX(cx,cy,'good');
      safeDispatch('quest:goodHit',{kind:'good'});

      killEl(t.el); this.S.targets.delete(t.id);

      // double-bine trigger (โหด)
      this._maybeDoubleBine();

    } else if (t.kind === 'gold'){
      this.S.goodHits++;
      this.S.goldHitsThisMini = true;
      this._setCombo(this.S.combo + 1);
      this._addFever(12);

      const pts = this._gain(90);
      this.S.score += pts;

      scorePop(cx,cy,`+${pts}`,'GOLD!');
      burstFX(cx,cy,'gold');
      safeDispatch('quest:goodHit',{kind:'gold'});
      safeDispatch('quest:power',{power:'gold'});

      killEl(t.el); this.S.targets.delete(t.id);

      this._maybeDoubleBine(true);

    } else if (t.kind === 'power'){
      this._addFever(6);

      const emo = t.el.textContent;
      if (emo === EMO_MAG) this._activateMagnet();
      else if (emo === EMO_TIME) this._addTime();
      else this._addShield();

      scorePop(cx,cy,'','POWER!');
      burstFX(cx,cy,'power');
      safeDispatch('quest:goodHit',{kind:'power'});

      killEl(t.el); this.S.targets.delete(t.id);

    } else if (t.kind === 'junk' || t.kind === 'trap'){
      // ✅ Shield block = NO MISS (ตามนิยาม)
      if ((this.S.shield|0) > 0){
        this.S.shield = Math.max(0, (this.S.shield|0) - 1);
        scorePop(cx,cy,'🛡️','BLOCK!');
        burstFX(cx,cy,'power');
        safeDispatch('quest:block',{});
        safeDispatch('hha:fx',{type:'kick', intensity:0.65});
      } else {
        this.S.misses++;
        this._setCombo(0);
        this.S.streakGood = 0; // reset streak
        this._addFever(-12);
        scorePop(cx,cy,'','MISS!');
        burstFX(cx,cy,'trap');
        safeDispatch('quest:badHit',{kind:t.kind});
        safeDispatch('hha:fx',{type:'kick', intensity:1.15});
        safeDispatch('hha:fx',{type:'chroma', ms:170});
      }

      killEl(t.el); this.S.targets.delete(t.id);
    }

    this._emitAll(false);
  }

  // -------- powerups --------
  _activateMagnet(){
    this.S.magnet = true;
    this.S.magnetEndsAt = now() + 5200;
    safeDispatch('quest:power',{power:'magnet'});
    safeDispatch('hha:judge',{label:'MAGNET!'});
    const ap = getAimPoint();
    burstFX(ap.x, ap.y, 'power');
  }
  _addTime(){
    this.S.endAt += 3000;
    safeDispatch('quest:power',{power:'time'});
    safeDispatch('hha:judge',{label:'+TIME!'});
    const ap = getAimPoint();
    burstFX(ap.x, ap.y, 'power');
  }
  _addShield(){
    this.S.shield = clamp((this.S.shield|0) + 1, 0, 5);
    safeDispatch('quest:power',{power:'shield'});
    safeDispatch('hha:judge',{label:'+SHIELD!'});
  }

  // -------- double-bine (โหด) --------
  _maybeDoubleBine(fromGold=false){
    const t = now();
    const need = (this.diffKey==='easy') ? 10 : (this.diffKey==='hard') ? 7 : 9;

    if (fromGold || (this.S.combo|0) >= need){
      // refresh / stack
      this.S.dbActive = true;
      this.S.dbEndsAt = t + 2200;
      this.S.dbStacks = clamp((this.S.dbStacks||0) + 1, 0, 6);

      safeDispatch('hha:tick',{kind:'double-bine', intensity:1.6});
      try{ Particles.toast && Particles.toast('⚡ DOUBLE-BINE!', 'H+'); }catch(_){}
      safeDispatch('hha:fx',{type:'kick', intensity:1.0});
      safeDispatch('hha:fx',{type:'chroma', ms:120});
    }
  }

  // -------- quest feed (ALWAYS emits) --------
  _questTick(){
    // update qState from engine state
    const t = now();
    this.qState.goodHits = this.S.goodHits|0;
    this.qState.comboMax = this.S.comboMax|0;
    this.qState.streakGood = this.S.streakGood|0;
    this.qState.goldHitsThisMini = !!this.S.goldHitsThisMini;
    this.qState.safeNoJunkSeconds = this.S.safeNoJunkSeconds|0;

    try{
      // director.js ของคุณจะ dispatch quest:update เอง
      // แต่กันหลุด: เรียก tick เสมอ
      this.qDir.tick?.(this.qState);
    }catch(_){}

    // ✅ fallback: ถ้าไม่มี quest director ในบาง build ก็ยังส่ง quest:update ให้ HUD ไม่ว่าง
    safeDispatch('quest:update', {
      questOk: true,
      title: (this.qDir?.activeGoal?.label) || (this.qDir?.getActive?.()?.goal?.label) || '',
      progressPct: 0,
      miniText: '',
      miniCleared: 0,
      miniLeft: 0
    });
  }

  // -------- HUD emits --------
  _emitScore(){
    safeDispatch('hha:score', {
      score:this.S.score|0,
      goodHits:this.S.goodHits|0,
      misses:this.S.misses|0,
      comboMax:this.S.comboMax|0,
      multiplier:this._comboMul(this.S.combo|0),

      // debug
      dbActive: !!this.S.dbActive,
      dbStacks: this.S.dbStacks|0
    });
  }
  _emitTime(){ safeDispatch('hha:time',{sec:this.S.timeLeft|0}); }
  _emitFever(){
    safeDispatch('hha:fever',{
      fever: clamp(this.S.fever,0,100),
      shield: this.S.shield|0,
      stunActive:false,
      slow:1
    });
  }
  _emitAll(force){
    this._emitScore();
    this._emitTime();
    this._emitFever();
    if (force) this._questTick();
  }

  // -------- motion systems --------
  _magnetTick(){
    if (!this.S.magnet) return;
    const t = now();
    if (t >= this.S.magnetEndsAt){
      this.S.magnet = false;
      return;
    }

    const apS = getAimPoint();
    const apL = toLayerPt(apS.x, apS.y);

    const strength = (this.diffKey==='hard'?0.11:this.diffKey==='easy'?0.08:0.095);
    const swirl = 0.035 + (this.S.dbActive ? 0.03 : 0);

    for (const trg of this.S.targets.values()){
      if (trg.kind!=='good' && trg.kind!=='gold' && trg.kind!=='power') continue;

      const dx = apL.x - trg.x;
      const dy = apL.y - trg.y;

      trg.x = lerp(trg.x, apL.x, strength);
      trg.y = lerp(trg.y, apL.y, strength);

      trg.x += (-dy) * swirl * 0.002;
      trg.y += ( dx) * swirl * 0.002;

      trg.el.style.left = (trg.x|0)+'px';
      trg.el.style.top  = (trg.y|0)+'px';
    }
  }

  _doubleBineTick(){
    if (!this.S.dbActive) return;
    const t = now();
    if (t >= this.S.dbEndsAt){
      this.S.dbActive = false;
      this.S.dbStacks = 0;
      return;
    }

    // spawn 2-in-1 burst every ~520ms while active
    if (t >= (this.S.dbNextAt||0)){
      this.S.dbNextAt = t + 520;
      const R = this._safeRect();
      const ap = getAimPoint();

      // spawn 2 targets near aim area (โหดขึ้น)
      const p1 = { x: clamp(ap.x + randi(-140,140,this.rnd), R.left, R.right),
                   y: clamp(ap.y + randi(-100,100,this.rnd), R.top,  R.bottom) };
      const p2 = { x: clamp(ap.x + randi(-160,160,this.rnd), R.left, R.right),
                   y: clamp(ap.y + randi(-120,120,this.rnd), R.top,  R.bottom) };

      // mix: one bad one good (pressure)
      if (this.rnd() < 0.55){
        this._spawn('junk', p1);
        this._spawn('good', p2);
      } else {
        this._spawn('trap', p1);
        this._spawn('gold', p2);
      }

      safeDispatch('hha:tick',{kind:'double-bine', intensity:1.9});
      safeDispatch('hha:fx',{type:'kick', intensity:1.2});
    }
  }

  // -------- expire rules (MISS from good expired) --------
  _expireTick(){
    const t = now();
    for (const trg of Array.from(this.S.targets.values())){
      if (trg.kind==='boss') continue;
      if (t >= trg.expiresAt){
        // ✅ Good expired counts as miss (ตามนิยาม)
        if (trg.kind==='good' || trg.kind==='gold'){
          this.S.misses++;
          this._setCombo(Math.max(0, (this.S.combo|0) - 2));
          safeDispatch('quest:missGoodExpired', { kind: trg.kind });
        }
        killEl(trg.el);
        this.S.targets.delete(trg.id);
      }
    }
  }

  // -------- boss (light) --------
  _maybeSpawnBoss(){
    if (this.challenge!=='boss') return;
    if (this.S.bossSpawned) return;
    if ((this.S.timeLeft|0) > 22) return;

    this.S.bossSpawned = true;
    this.S.bossAlive = true;
    this.S.bossHpMax = (this.diffKey==='easy'?6:this.diffKey==='hard'?10:8);
    this.S.bossHp = this.S.bossHpMax;

    this._spawn('boss');
    safeDispatch('hha:judge',{label:'BOSS!'});
    try{ Particles.celebrate && Particles.celebrate({kind:'BOSS_SPAWN', intensity:1.4}); }catch(_){}
  }

  // -------- safe no junk seconds --------
  _noJunkTick(){
    // count seconds since last junk hit (shield block = not junk hit)
    // reset happens only on real junk/trap hit without shield
    // (we reset in _onHit when miss happens)
    const t = now();
    const sec = ((t - this.S._noJunkT0)/1000);
    this.S.safeNoJunkSeconds = Math.max(0, sec|0);
  }

  // -------- loop --------
  _loop(){
    if (!this.S.running) return;

    const t = now();
    const remainMs = Math.max(0, this.S.endAt - t);
    const remainSec = Math.ceil(remainMs/1000);

    if (remainSec !== (this.S.timeLeft|0)){
      this.S.timeLeft = remainSec|0;
      this._emitTime();

      // adrenaline ticks
      if (this.S.timeLeft <= 8){
        safeDispatch('hha:panic',{level: clamp((8-this.S.timeLeft)/8, 0.2, 1), ms:650});
        if (this.S.timeLeft <= 5) safeDispatch('hha:tick',{kind:'final', intensity:1.7});
      }
    }

    if (remainMs <= 0){
      this._endGame('time');
      return;
    }

    // fever decay
    const decay = (this.S.feverDecayPerSec/60);
    this.S.fever = Math.max(0, (this.S.fever||0) - decay);

    // boss
    this._maybeSpawnBoss();

    // spawn cadence
    const gap = this._spawnGapMs();
    if (t - this.S.lastSpawnAt >= gap){
      this.S.lastSpawnAt = t;

      // double-bine can spawn extra inside _doubleBineTick
      const k = this._pickKind();
      this._spawn(k);
    }

    // systems
    this._doubleBineTick();
    this._magnetTick();
    this._expireTick();
    this._noJunkTick();

    // quest + HUD
    this._questTick();
    // send fever/score sometimes (ลดงาน)
    if ((this.rnd() < 0.08)) this._emitFever();
    if ((this.rnd() < 0.08)) this._emitScore();

    this._raf = requestAnimationFrame(this._loop);
  }

  // -------- end --------
  _endGame(reason='time'){
    if (!this.S.running) return;
    this.S.running = false;

    cancelAnimationFrame(this._raf);
    this._raf = 0;

    for (const trg of this.S.targets.values()){
      try{ killEl(trg.el); }catch(_){}
    }
    this.S.targets.clear();

    safeDispatch('hha:end', {
      reason,
      score:this.S.score|0,
      goodHits:this.S.goodHits|0,
      misses:this.S.misses|0,
      comboMax:this.S.comboMax|0,
      durationSec:this.durationSec|0,
      diff:this.diffKey,
      challenge:this.challenge,
      runMode:this.runMode,
      protocol:this.protocol,
      pid:this.pid
    });
  }

  // -------- small hash --------
  _hash32(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
}

// ---- Convenience: static start like your older style ----
export function startGame(opts){
  const eng = new GameEngine(opts);
  return eng.start();
}