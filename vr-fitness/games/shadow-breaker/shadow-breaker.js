// === Shadow Breaker — v2.1 (P5 + Rabbit Coach + Research-ready) ============
// Mechanics (เด็ก ป.5):
// - เป้าสีต่าง ๆ โผล่ขึ้นมาทั่วจอ → แตะ/คลิกให้ทันก่อนหายไป = HIT
// - พลาด/หมดเวลา/กดผิดเป้า = MISS
// - COMBO ต่อเนื่อง → เข้า FEVER PUNCH!! คะแนนพุ่ง
// - รองรับโหมด timed (time=xx) + diff=easy/normal/hard
// - สรุปผล + Hybrid save → Google Sheets / Backend (ผ่าน SHEET_API)
// ============================================================================

// ---------------------------------------------------------------------------
// CONFIG ENDPOINT (ตั้งค่า SHEET_API เป็น Web App ของ Google Apps Script)
// ---------------------------------------------------------------------------
// ตัวอย่าง JSON summary:
//
// {
//   profile: {...},
//   game: "shadow-breaker",
//   diff: "normal",
//   duration: 89.7,
//   score: 1250,
//   hits: 90,
//   miss: 10,
//   comboMax: 22,
//   accuracy: 0.90,
//   notesPerSec: 1.12,
//   notesPerMin: 67.2,
//   rank: "A",
//   device: "Mobile",
//   timestamp: "2025-11-16T08:12:00.000Z"
// }
// ---------------------------------------------------------------------------
const FIREBASE_API = ''; // ถ้ามี backend อื่น
const SHEET_API    = ''; // ← ใส่ URL Web App ของ Google Sheets ที่นี่
const PDF_API      = ''; // ถ้ามี API สร้าง PDF
const LB_API       = ''; // ถ้ามี leaderboard

const LS_PROFILE = 'fitness_profile_v1';
const LS_QUEUE   = 'fitness_offline_queue_v1';

// ---------------------------------------------------------------------------
// STRINGS (โค้ช "พุ่ง" กระต่าย) — P.5 Friendly
// ---------------------------------------------------------------------------
const STR = {
  th: {
    msgReady : 'โค้ชพุ่ง: เตรียมกำหมัดให้พร้อม! เป้าจะโผล่มาทั่วจอเลยนะ 🐰🥊',
    msgGo    : 'GO! แตะ/คลิกเป้าสีที่โผล่ขึ้นมาให้ทัน ยิ่งต่อเนื่อง คอมโบยิ่งแรง! ⚡',
    msgPaused: 'พักแขนแป๊บนึง ดื่มน้ำ หายใจลึก ๆ ก่อนค่อยลุยต่อนะ 😄',
    msgResume: 'พร้อมต่อยต่อยัง? กลับไปล่าคอมโบให้ถึง FEVER PUNCH กันเลย! 🔥',
    msgEnd   : 'จบรอบแล้ว! มาดูว่าหมัดของเราพลังแค่ไหนกันนะ 🎉'
  }
};

// ---------------------------------------------------------------------------
// PROFILE (ใช้ร่วมกับทุกเกมใน VR-Fitness)
// ---------------------------------------------------------------------------
function getProfile(){
  try{
    const raw = localStorage.getItem(LS_PROFILE);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
function saveProfile(p){
  try{ localStorage.setItem(LS_PROFILE, JSON.stringify(p)); }catch{}
}
function ensureProfile(){
  let p = getProfile();
  if (p) return p;
  const studentId = prompt('Student ID:');
  const name      = prompt('ชื่อที่ใช้ในเกม (เช่น น้องพุ่ง):');
  const school    = prompt('โรงเรียน / หน่วยงาน:');
  const klass     = prompt('ห้องเรียน เช่น ป.5/1:');
  p = { studentId, name, school, class: klass, lang:'th' };
  saveProfile(p);
  return p;
}

// ---------------------------------------------------------------------------
// SIMPLE SFX (คาเฟ่ + ปิ๊งป่อง) — เพิ่มไฟล์ใน ./sfx ตามชื่อถ้าต้องการเสียง
// ---------------------------------------------------------------------------
const SFX = (() => {
  function load(src){
    if (!src) return null;
    const a = new Audio(src);
    a.preload = 'auto';
    return a;
  }
  const hitGood  = load('./sfx/punch-good.mp3'); // HIT ปกติ
  const hitCrit  = load('./sfx/punch-crit.mp3'); // HIT ทอง / FEVER
  const missSfx  = load('./sfx/miss.mp3');       // MISS
  const feverSfx = load('./sfx/fever.mp3');      // FEVER!!
  const endSfx   = load('./sfx/end.mp3');        // จบเกม
  return {
    hit(normal=true){
      try{
        const a = normal ? hitGood : hitCrit;
        if (a){ a.currentTime = 0; a.play(); }
      }catch{}
    },
    miss(){
      try{ if (missSfx){ missSfx.currentTime = 0; missSfx.play(); } }catch{}
    },
    fever(){
      try{ if (feverSfx){ feverSfx.currentTime = 0; feverSfx.play(); } }catch{}
    },
    end(){
      try{ if (endSfx){ endSfx.currentTime = 0; endSfx.play(); } }catch{}
  };
})();

// ---------------------------------------------------------------------------
// QUEUE + HYBRID SAVE (ต่อ Google Sheets + Backend)
// ---------------------------------------------------------------------------
function loadQueue(){
  try{
    const raw = localStorage.getItem(LS_QUEUE);
    return raw ? JSON.parse(raw) : [];
  }catch{ return []; }
}
function saveQueue(q){
  try{ localStorage.setItem(LS_QUEUE, JSON.stringify(q)); }catch{}
}
async function flushQueue(){
  const q = loadQueue();
  if (!q.length) return;
  const remain = [];
  for (const item of q){
    try{
      await hybridSaveSession(item,false);
    }catch{
      remain.push(item);
    }
  }
  saveQueue(remain);
}

async function hybridSaveSession(summary, allowQueue = true){
  const body = JSON.stringify(summary);
  const headers = { 'Content-Type':'application/json' };
  let ok = true;
  try{
    const tasks = [];
    if (FIREBASE_API) tasks.push(fetch(FIREBASE_API,{ method:'POST', headers, body }));
    if (SHEET_API)    tasks.push(fetch(SHEET_API   ,{ method:'POST', headers, body }));
    if (tasks.length) await Promise.all(tasks);
  }catch(e){
    console.warn('ShadowBreaker save fail', e);
    ok = false;
  }
  if (!ok && allowQueue){
    const q = loadQueue();
    q.push(summary);
    saveQueue(q);
  }
}

// ---------------------------------------------------------------------------
// PDF + CSV (ส่งให้ครู / เก็บรายงาน)
// ---------------------------------------------------------------------------
async function exportPDF(summary){
  if (!PDF_API){
    alert('ยังไม่ได้ตั้งค่า PDF_API ค่ะ โค้ชพุ่งยังไม่มีโรงพิมพ์ 🤏');
    return;
  }
  try{
    const res = await fetch(PDF_API,{
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify(summary)
    });
    if (!res.ok) throw new Error('PDF API error');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `ShadowBreaker_Report_${summary.profile.studentId || 'user'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    alert('สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้งนะคะ');
  }
}

function downloadCSVRow(summary){
  const headers = [
    'timestamp','studentId','name','school','class',
    'game','diff','score','hits','miss','accuracy',
    'comboMax','notesPerMin','rank','device'
  ];
  const p = summary.profile || {};
  const row = [
    summary.timestamp,
    p.studentId || '',
    p.name || '',
    p.school || '',
    p.class || '',
    summary.game,
    summary.diff || '',
    summary.score ?? '',
    summary.hits ?? '',
    summary.miss ?? '',
    (summary.accuracy*100).toFixed(1),
    summary.comboMax ?? '',
    summary.notesPerMin != null ? summary.notesPerMin.toFixed(2) : '',
    summary.rank || '',
    summary.device || ''
  ];

  const csv = headers.join(',') + '\n' + row.join(',');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `ShadowBreaker_${p.studentId||'user'}_${summary.timestamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// DEVICE
// ---------------------------------------------------------------------------
function detectDevice(){
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Pico|Vive|VR/i.test(ua)) return 'VR';
  if (/Mobile|Android|iPhone/i.test(ua))     return 'Mobile';
  return 'PC';
}

// ============================================================================
// GAME CONFIG
// ============================================================================
const DIFF = {
  easy: {
    spawnInterval: 0.9,   // วินาทีระหว่างเป้า
    targetLife   : 1.5,   // อายุเป้า
    baseScore    : 20
  },
  normal: {
    spawnInterval: 0.7,
    targetLife   : 1.25,
    baseScore    : 22
  },
  hard: {
    spawnInterval: 0.55,
    targetLife   : 1.0,
    baseScore    : 25
  }
};

const GOLD_CHANCE  = 0.12;  // เป้าทอง
const DECOY_CHANCE = 0.10;  // เป้าหลอก (ไม่ควรกด)

// สีเป้า (เด็ก ป.5)
const COLORS = {
  normal: ['#38bdf8','#22c55e','#a855f7','#f97316'],
  gold  : ['#facc15','#fde047'],
  decoy : ['#94a3b8']
};

// ============================================================================
// MAIN CLASS
// ============================================================================
export class ShadowBreaker {
  constructor(opts){
    this.arena   = opts.arena;
    this.hud     = opts.hud   || {};
    this.msgBox  = opts.msgBox|| null;
    this.result  = opts.result|| {};
    this.csvBtn  = opts.csvBtn|| null;
    this.pdfBtn  = opts.pdfBtn|| null;

    if (!this.arena){
      alert('Shadow Breaker: ไม่พบพื้นที่สนามเล่น');
      return;
    }

    this.profile = ensureProfile();
    this.str     = STR.th;

    const qs   = new URLSearchParams(location.search);
    const diff = qs.get('diff') || 'normal';
    const mode = qs.get('mode') || 'timed';
    let timeQ  = parseInt(qs.get('time') || '90', 10);
    this.diff  = DIFF[diff] ? diff : 'normal';
    this.mode  = mode;
    this.timeLimit = isNaN(timeQ) ? 90 : timeQ;

    this.cfg = DIFF[this.diff];

    this.state = {
      running:false,
      paused:false,
      elapsed:0,
      lastTs:0,
      timeLeft:this.timeLimit,
      score:0,
      hits:0,
      miss:0,
      combo:0,
      bestCombo:0,
      fever:false
    };

    this.spawnTimer = 0;
    this.targets = []; // {el,x,y,life,maxLife,type:'normal'|'gold'|'decoy'}

    flushQueue();
    this._buildScene();
    this._bindInput();

    this._msg(this.str.msgReady);
    this._hud();
  }

  // -------------------------------------------------------------------------
  // BASIC UI
  // -------------------------------------------------------------------------
  _msg(t){ if (this.msgBox) this.msgBox.textContent = t; }

  _hud(){
    if (this.hud.time)  this.hud.time.textContent  = Math.max(0, Math.ceil(this.state.timeLeft));
    if (this.hud.score) this.hud.score.textContent = this.state.score;
    if (this.hud.hits)  this.hud.hits.textContent  = this.state.hits;
    if (this.hud.miss)  this.hud.miss.textContent  = this.state.miss;
    if (this.hud.combo) this.hud.combo.textContent = 'x' + this.state.combo;
  }

  _buildScene(){
    this.arena.style.position = 'relative';
    this.arena.style.overflow = 'hidden';

    // โค้ชพุ่งตัวเล็กมุมบน
    const coach = document.createElement('div');
    coach.style.position = 'absolute';
    coach.style.left = '12px';
    coach.style.top  = '10px';
    coach.style.display = 'flex';
    coach.style.alignItems = 'center';
    coach.style.gap = '6px';
    coach.style.padding = '4px 10px';
    coach.style.borderRadius = '999px';
    coach.style.background = 'rgba(15,23,42,0.85)';
    coach.style.border = '1px solid rgba(129,140,248,0.9)';
    coach.style.fontSize = '13px';
    coach.style.zIndex = '10';
    coach.innerHTML = '<span>🐰</span><span>โค้ชพุ่ง</span>';
    this.arena.appendChild(coach);
  }

  _bindInput(){
    this.arena.addEventListener('pointerdown', (ev)=>{
      if (!this.state.running || this.state.paused) return;
      const rect = this.arena.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this._handleHitAt(x,y);
    });

    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden) this.pause(true);
    });
  }

  // -------------------------------------------------------------------------
  // CONTROL
  // -------------------------------------------------------------------------
  start(){
    if (this.state.running) return;
    this.state.running = true;
    this.state.paused  = false;
    this.state.elapsed = 0;
    this.state.lastTs  = 0;
    this.state.timeLeft= this.timeLimit;
    this.state.score   = 0;
    this.state.hits    = 0;
    this.state.miss    = 0;
    this.state.combo   = 0;
    this.state.bestCombo=0;
    this.state.fever   = false;
    this.targets.length = 0;
    this.spawnTimer = 0;
    this._clearTargets();
    this._hud();
    this._msg(this.str.msgGo);

    this._loop(performance.now());
  }

  pause(v=true){
    if (!this.state.running) return;
    this.state.paused = v;
    if (v){
      this._msg(this.str.msgPaused);
    }else{
      this._msg(this.str.msgResume);
      this.state.lastTs = 0;
      this._loop(performance.now());
    }
  }

  _clearTargets(){
    this.targets.forEach(t => t.el.remove());
    this.targets.length = 0;
  }

  // -------------------------------------------------------------------------
  // TARGET SPAWN & HIT
  // -------------------------------------------------------------------------
  _spawnTarget(){
    const rect = this.arena.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // random position (หลีกเลี่ยงขอบ)
    const margin = 40;
    const x = margin + Math.random()*(rect.width  - margin*2);
    const y = margin + Math.random()*(rect.height - margin*2);

    // ประเภทเป้า
    let type = 'normal';
    const r = Math.random();
    if (r < GOLD_CHANCE) type = 'gold';
    else if (r < GOLD_CHANCE + DECOY_CHANCE) type = 'decoy';

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.style.position = 'absolute';
    el.style.left = (x - 20) + 'px';
    el.style.top  = (y - 20) + 'px';
    el.style.width = '40px';
    el.style.height= '40px';
    el.style.borderRadius = type === 'decoy' ? '4px' : '999px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.fontSize = '20px';
    el.style.fontWeight = '900';
    el.style.cursor = 'pointer';
    el.style.boxShadow = '0 0 16px rgba(15,23,42,0.9)';
    el.style.transform = 'scale(0)';
    el.style.transition = 'transform 0.12s ease-out';

    let color;
    if (type === 'gold')  color = COLORS.gold[Math.floor(Math.random()*COLORS.gold.length)];
    else if (type === 'decoy') color = COLORS.decoy[0];
    else color = COLORS.normal[Math.floor(Math.random()*COLORS.normal.length)];

    el.style.background = type === 'gold'
      ? `radial-gradient(circle at 30% 20%,#ffffff,${color})`
      : color;

    el.style.border = type === 'gold'
      ? '2px solid rgba(250,250,250,0.9)'
      : '2px solid rgba(15,23,42,0.9)';

    el.textContent = type === 'decoy' ? 'X' : '●';
    if (type === 'gold') el.textContent = '★';

    this.arena.appendChild(el);
    requestAnimationFrame(()=>{ el.style.transform = 'scale(1)'; });

    this.targets.push({
      el,
      x,
      y,
      life: this.cfg.targetLife,
      maxLife: this.cfg.targetLife,
      type,
      hit:false
    });
  }

  _handleHitAt(x,y){
    if (!this.targets.length) return;

    // หา target ที่ใกล้ที่สุดในรัศมี 28px
    let best = null;
    let bestDist = Infinity;
    for (const t of this.targets){
      if (t.hit) continue;
      const dx = x - t.x;
      const dy = y - t.y;
      const d2 = dx*dx + dy*dy;
      if (d2 < bestDist){
        bestDist = d2;
        best = t;
      }
    }
    const radius = 28;
    if (!best || bestDist > radius*radius){
      // กดพลาด ไม่มีเป้า → นับเป็น MISS เบา ๆ
      this._registerMiss(null,true);
      return;
    }

    // ถ้าเป็น decoy (X) = MISS
    if (best.type === 'decoy'){
      this._registerMiss(best,false,true);
      return;
    }

    // HIT ปกติ / gold
    this._registerHit(best);
  }

  _registerHit(target){
    target.hit = true;
    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    let gain = this.cfg.baseScore;
    let isCrit = false;

    // gold เป้า
    if (target.type === 'gold'){
      gain += 15;
      isCrit = true;
    }

    // FEVER เงื่อนไข combo ≥ 5
    let inFever = this.state.combo >= 5;
    if (inFever){
      gain = Math.round(gain * 1.4);
      if (!this.state.fever){
        this.state.fever = true;
        this._showFeverFx();
        SFX.fever();
      }
    }else{
      this.state.fever = false;
    }

    // คะแนนรวม
    this.state.score += gain;
    this._hud();

    // เอฟเฟกต์
    this._screenShake(false);
    this._burstTarget(target, false, isCrit || inFever);
    this._spawnHitFx('+'+gain, false, isCrit || inFever);
    SFX.hit(!isCrit && !inFever);

    // ลบออกจาก array
    target.el.remove();
    this.targets = this.targets.filter(t => t !== target);
  }

  _registerMiss(target,emptyTap=false,decoyHit=false){
    this.state.miss++;
    this.state.combo = 0;
    this.state.fever = false;

    // หักคะแนนเล็กน้อย
    let penalty = 8;
    if (emptyTap) penalty = 5;
    if (decoyHit) penalty = 12;
    this.state.score = Math.max(0, this.state.score - penalty);
    this._hud();

    this._screenShake(true);
    this._spawnHitFx(decoyHit ? 'WRONG' : 'MISS', true, false);
    SFX.miss();

    if (target){
      target.el.remove();
      this.targets = this.targets.filter(t => t !== target);
    }
  }

  // -------------------------------------------------------------------------
  // FX
  // -------------------------------------------------------------------------
  _screenShake(isBad){
    const el = this.arena;
    if (!el) return;
    const base = el.style.transform || 'translateZ(0)';
    const intensity = isBad ? 10 : 16; // ขยับแรงขึ้นตามที่ขอ

    let i = 0;
    const frames = 8;
    function step(){
      i++;
      if (i > frames){
        el.style.transform = base;
        el.style.transition = 'transform 0.08s ease-out';
        return;
      }
      const dx = (Math.random()*2-1) * intensity;
      const dy = (Math.random()*2-1) * intensity;
      el.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(step);
    }
    step();
  }

  _spawnHitFx(text,isBad,isCrit){
    const rect = this.arena.getBoundingClientRect();
    const x = rect.left + rect.width/2;
    const y = rect.top  + rect.height*0.35;

    const fx = document.createElement('div');
    fx.textContent = text;
    fx.style.position = 'fixed';
    fx.style.left = x + 'px';
    fx.style.top  = y + 'px';
    fx.style.transform = 'translate(-50%,-50%)';
    fx.style.zIndex = '9999';
    fx.style.fontSize = isCrit ? '26px' : '22px';
    fx.style.fontWeight = '900';
    fx.style.color = isBad ? '#fb7185' : (isCrit ? '#facc15' : '#4ade80');
    fx.style.textShadow = '0 0 12px rgba(15,23,42,0.95)';
    fx.style.pointerEvents = 'none';
    fx.style.animation = 'sbHitFloat 0.55s ease-out forwards';
    document.body.appendChild(fx);
    setTimeout(()=>fx.remove(), 600);
  }

  _showFeverFx(){
    const el = document.createElement('div');
    el.textContent = 'FEVER PUNCH!!';
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.top  = '18%';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.zIndex = '9999';
    el.style.fontSize = '32px';
    el.style.fontWeight = '900';
    el.style.letterSpacing = '0.16em';
    el.style.color = '#facc15';
    el.style.textShadow = '0 0 18px rgba(250,204,21,0.95)';
    el.style.animation = 'feverFlash 0.7s ease-out forwards';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 700);
  }

  // -------------------------------------------------------------------------
  // LOOP
  // -------------------------------------------------------------------------
  _loop(ts){
    if (!this.state.running || this.state.paused) return;
    if (!this.state.lastTs) this.state.lastTs = ts;
    const dt = (ts - this.state.lastTs)/1000;
    this.state.lastTs = ts;
    this.state.elapsed += dt;
    this.state.timeLeft = Math.max(0, this.timeLimit - this.state.elapsed);

    // spawn ใหม่
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0){
      this._spawnTarget();
      this.spawnTimer = this.cfg.spawnInterval;
    }

    // อัปเดตอายุเป้า
    for (let i=this.targets.length-1;i>=0;i--){
      const t = this.targets[i];
      t.life -= dt;
      if (t.life <= 0 && !t.hit){
        // หมดเวลา = MISS ยกเว้น decoy (หมดฟรี)
        if (t.type !== 'decoy'){
          this._registerMiss(t,false,false);
        }else{
          t.el.remove();
          this.targets.splice(i,1);
        }
      }else{
        // ลด opacity ตามเวลา
        const ratio = Math.max(0,t.life/t.maxLife);
        t.el.style.opacity = (0.4 + 0.6*ratio).toFixed(2);
      }
    }

    this._hud();

    if (this.state.timeLeft <= 0){
      this._finish();
      return;
    }

    requestAnimationFrame(this._loop.bind(this));
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  _buildSummary(){
    const total = this.state.hits + this.state.miss;
    const acc   = total>0 ? this.state.hits/total : 0;

    const duration = this.state.elapsed || this.timeLimit;
    const notesPerSec = duration>0 ? total / duration : 0;
    const notesPerMin = notesPerSec * 60;

    let rank = 'C';
    if(this.state.score>=1600 && acc>=0.95) rank='SSS';
    else if(this.state.score>=1200 && acc>=0.90) rank='S';
    else if(this.state.score>=800  && acc>=0.80) rank='A';
    else if(this.state.score>=500  && acc>=0.60) rank='B';

    return {
      profile:  this.profile,
      game:     'shadow-breaker',
      diff:     this.diff,
      duration,
      score:    this.state.score,
      hits:     this.state.hits,
      miss:     this.state.miss,
      comboMax: this.state.bestCombo,
      accuracy: acc,
      notesPerSec,
      notesPerMin,
      rank,
      device:   detectDevice(),
      timestamp:new Date().toISOString()
    };
  }

  // -------------------------------------------------------------------------
  // FINISH + RESULT
  // -------------------------------------------------------------------------
  async _finish(){
    this.state.running = false;
    this._hud();
    this._msg(this.str.msgEnd);
    SFX.end();

    const ripple = document.createElement('div');
    ripple.className = 'sb-finish-ripple';
    document.body.appendChild(ripple);
    setTimeout(()=>ripple.remove(), 600);

    const summary = this._buildSummary();
    const ok = this._showResult(summary);
    if (!ok){
      const acc = (summary.accuracy*100).toFixed(1);
      alert(
        `Shadow Breaker Result\n` +
        `Score: ${summary.score}\n` +
        `Hits: ${summary.hits}\n` +
        `Miss: ${summary.miss}\n` +
        `Accuracy: ${acc}%\n` +
        `Best Combo: x${summary.comboMax}\n` +
        `Rank: ${summary.rank}`
      );
    }

    try{
      await hybridSaveSession(summary, true);
    }catch(e){
      console.warn('shadow-breaker save error', e);
    }
  }

  _showResult(summary){
    const box   = this.result.box  || document.getElementById('sbResultCard');
    const sc    = this.result.score|| document.getElementById('sbScore');
    const h     = this.result.hits || document.getElementById('sbHits');
    const m     = this.result.miss || document.getElementById('sbMiss');
    const accEl = this.result.acc  || document.getElementById('sbAcc');
    const best  = this.result.best || document.getElementById('sbBest');
    const rank  = this.result.rank || document.getElementById('sbRank');

    if (!box) return false;
    box.style.display = 'flex';

    const acc = Math.round((summary.accuracy||0)*100);

    if (sc)    sc.textContent   = summary.score;
    if (h)     h.textContent    = summary.hits;
    if (m)     m.textContent    = summary.miss;
    if (accEl) accEl.textContent= acc + '%';
    if (best)  best.textContent = 'x' + summary.comboMax;
    if (rank)  rank.textContent = summary.rank;

    const csvBtn = this.csvBtn || document.getElementById('sbCsvBtn');
    const pdfBtn = this.pdfBtn || document.getElementById('sbPdfBtn');
    if (csvBtn) csvBtn.onclick = ()=>downloadCSVRow(summary);
    if (pdfBtn) pdfBtn.onclick = ()=>exportPDF(summary);

    return true;
  }
}