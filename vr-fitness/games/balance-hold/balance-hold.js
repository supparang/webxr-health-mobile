// === Balance Hold — v2.0 (Research-ready) ===================================
// Mechanics:
// - เกมแบบ "ถือท่า" (Balance Pose) ทีละรอบ
// - ทั่วไป: แตะ/กดค้างหน้าจอ หรือกด Space ค้าง = ถือท่า
// - Normal / Gold pose → ต้องถือให้ครบเวลา
// - Bomb pose → ห้ามถือ (ถ้าถือ = MISS)
// - FEVER: combo ≥ 5 → คะแนนเพิ่ม, ขึ้นคำว่า "FEVER!!"
// - สรุปผลแบบเดียวกับ Shadow Breaker / Jump Duck / Rhythm Boxer
// ============================================================================

// ---------------------------------------------------------------------------
// CONFIG ENDPOINT (เติมภายหลัง)
// ---------------------------------------------------------------------------
const FIREBASE_API = ''; // 'https://.../firebase'
const SHEET_API    = ''; // 'https://.../sheet'
const PDF_API      = ''; // 'https://.../pdf'
const LB_API       = ''; // 'https://.../leaderboard'

const LS_PROFILE = 'fitness_profile_v1';
const LS_QUEUE   = 'fitness_offline_queue_v1';

// ---------------------------------------------------------------------------
// STRINGS
// ---------------------------------------------------------------------------
const STR = {
  th: {
    msgReady : 'เตรียมตัวทรงตัว… ถือท่าให้นิ่งที่สุดเท่าที่ทำได้ 🧘‍♂️',
    msgGo    : 'GO! แตะ/กดค้างบนจอ หรือกด Space เพื่อถือท่าตามที่โค้ชบอก ✨',
    msgPaused: 'พักขา/แขนสักครู่ เดี๋ยวค่อยกลับมาทรงตัวต่อ 😄',
    msgResume: 'กลับมาทรงตัวต่อกันเลย ระวังท่าหลอก (BOMB)! 🚨',
    msgEnd   : 'หมดเวลาแล้ว มาดูว่าถือท่าได้ดีแค่ไหน ✨'
  }
};

// ---------------------------------------------------------------------------
// PROFILE
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
  const name      = prompt('ชื่อที่ใช้ในเกม:');
  const school    = prompt('โรงเรียน / หน่วยงาน:');
  const klass     = prompt('ห้องเรียน เช่น ป.5/1:');
  p = { studentId, name, school, class: klass, lang:'th' };
  saveProfile(p);
  return p;
}

// ---------------------------------------------------------------------------
// QUEUE + HYBRID SAVE
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
    console.warn('BalanceHold save fail', e);
    ok = false;
  }
  if (!ok && allowQueue){
    const q = loadQueue();
    q.push(summary);
    saveQueue(q);
  }
}

// ---------------------------------------------------------------------------
// PDF + CSV
// ---------------------------------------------------------------------------
async function exportPDF(summary){
  if (!PDF_API){
    alert('ยังไม่ได้ตั้งค่า PDF_API');
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
    a.download = `BalanceHold_Report_${summary.profile.studentId || 'user'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
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
  a.download = `BalanceHold_${p.studentId||'user'}_${summary.timestamp}.csv`;
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
  easy   : { poseHold: 3.5, maxPoseTime: 5.0, baseScore: 20 },
  normal : { poseHold: 4.5, maxPoseTime: 6.0, baseScore: 25 },
  hard   : { poseHold: 5.5, maxPoseTime: 7.0, baseScore: 30 }
};

const GOLD_CHANCE = 0.12;  // 12% gold pose (ถือแล้วโบนัส)
const BOMB_CHANCE = 0.08;  // 8% bomb pose (ห้ามถือ)

// Pose list (ตัวอย่าง 4 ท่า)
const POSES = [
  { key:'left',  label:'เอียงตัวซ้าย',  icon:'↙️' },
  { key:'right', label:'เอียงตัวขวา',   icon:'↘️' },
  { key:'front', label:'กึ่งย่อตรงกลาง', icon:'⬇️' },
  { key:'oneleg',label:'ยืนขาเดียว',   icon:'🦵' }
];

// ============================================================================
// MAIN CLASS
// ============================================================================
export class BalanceHold {
  constructor(opts){
    this.arena   = opts.arena;
    this.hud     = opts.hud   || {};
    this.msgBox  = opts.msgBox|| null;
    this.result  = opts.result|| {};
    this.csvBtn  = opts.csvBtn|| null;
    this.pdfBtn  = opts.pdfBtn|| null;

    if (!this.arena){
      alert('Balance Hold: ไม่พบ arena container');
      return;
    }

    this.profile = ensureProfile();
    this.str     = STR.th;

    const qs   = new URLSearchParams(location.search);
    const diff = qs.get('diff') || 'normal';
    const mode = qs.get('mode') || 'timed';
    let timeQ  = parseInt(qs.get('time') || '60', 10);
    this.diff  = DIFF[diff] ? diff : 'normal';
    this.mode  = mode;
    this.timeLimit = isNaN(timeQ) ? 60 : timeQ;

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
      totalPoses:0,
      fever:false
    };

    this.activePose = null;
    this.poseGapTimer = 0;
    this.isHolding = false;

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

    const center = document.createElement('div');
    center.id = 'bhCenter';
    center.style.position = 'absolute';
    center.style.left = '50%';
    center.style.top  = '50%';
    center.style.transform = 'translate(-50%,-50%)';
    center.style.display = 'flex';
    center.style.flexDirection = 'column';
    center.style.alignItems = 'center';
    center.style.gap = '8px';

    const poseBadge = document.createElement('div');
    poseBadge.id = 'bhPoseBadge';
    poseBadge.style.minWidth = '120px';
    poseBadge.style.padding = '8px 14px';
    poseBadge.style.borderRadius = '999px';
    poseBadge.style.background = 'rgba(15,23,42,0.9)';
    poseBadge.style.border = '1px solid rgba(129,140,248,0.85)';
    poseBadge.style.display = 'flex';
    poseBadge.style.alignItems = 'center';
    poseBadge.style.justifyContent = 'center';
    poseBadge.style.gap = '8px';
    poseBadge.style.fontSize = '16px';
    poseBadge.innerHTML = '<span>🧘‍♂️</span><span>รอท่าแรก…</span>';

    const poseBarWrap = document.createElement('div');
    poseBarWrap.style.width = '220px';
    poseBarWrap.style.height = '10px';
    poseBarWrap.style.borderRadius = '999px';
    poseBarWrap.style.background = 'rgba(15,23,42,0.9)';
    poseBarWrap.style.border = '1px solid rgba(129,140,248,0.7)';
    poseBarWrap.style.overflow = 'hidden';

    const poseBar = document.createElement('div');
    poseBar.id = 'bhPoseBar';
    poseBar.style.width = '0%';
    poseBar.style.height = '100%';
    poseBar.style.borderRadius = 'inherit';
    poseBar.style.background = 'linear-gradient(90deg,#a855f7,#6366f1)';
    poseBarWrap.appendChild(poseBar);

    const hint = document.createElement('div');
    hint.id = 'bhHint';
    hint.style.fontSize = '13px';
    hint.style.opacity = '0.85';
    hint.textContent = 'แตะ/กดค้างหน้าจอ หรือกด Space ค้างเพื่อถือท่า';

    center.appendChild(poseBadge);
    center.appendChild(poseBarWrap);
    center.appendChild(hint);
    this.arena.appendChild(center);

    this.poseBadgeEl = poseBadge;
    this.poseBarEl   = poseBar;
    this.hintEl      = hint;
  }

  _bindInput(){
    const onDown = ()=>{
      if (!this.state.running || this.state.paused) return;
      this.isHolding = true;
      this._updateHoldHint();
    };
    const onUp = ()=>{
      this.isHolding = false;
      this._updateHoldHint();
    };

    this.arena.addEventListener('pointerdown', onDown);
    this.arena.addEventListener('pointerup',   onUp);
    this.arena.addEventListener('pointerleave',onUp);

    window.addEventListener('keydown', e=>{
      if (!this.state.running || this.state.paused) return;
      if (e.code === 'Space'){
        this.isHolding = true;
        this._updateHoldHint();
      }
    });
    window.addEventListener('keyup', e=>{
      if (e.code === 'Space'){
        this.isHolding = false;
        this._updateHoldHint();
      }
    });

    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden) this.pause(true);
    });
  }

  _updateHoldHint(){
    if (!this.hintEl) return;
    if (this.activePose && this.activePose.special === 'bomb'){
      this.hintEl.textContent = this.isHolding
        ? '❌ ท่านี้เป็น BOMB! ปล่อยมือทันที!'
        : 'ท่านี้เป็น BOMB ห้ามถือ ให้ปล่อยไว้เฉย ๆ';
    }else{
      this.hintEl.textContent = this.isHolding
        ? 'ดีมาก! รักษาท่าให้นิ่งจนแถบเต็ม ✨'
        : 'แตะ/กดค้างหน้าจอ หรือกด Space เพื่อถือท่า';
    }
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
    this.activePose    = null;
    this.poseGapTimer  = 0;
    this.isHolding     = false;
    this._hud();
    this._msg(this.str.msgGo);
    this._updateHoldHint();

    this._startNextPose();
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

  // -------------------------------------------------------------------------
  // POSES
  // -------------------------------------------------------------------------
  _startNextPose(){
    const pose = POSES[Math.floor(Math.random()*POSES.length)];
    let special = 'normal';
    const r = Math.random();
    if (r < BOMB_CHANCE) special = 'bomb';
    else if (r < BOMB_CHANCE + GOLD_CHANCE) special = 'gold';

    const hold = this.cfg.poseHold;
    const maxT = this.cfg.maxPoseTime;

    this.activePose = {
      id: 'p-'+Date.now(),
      pose,
      special,
      holdRequired: hold,
      timeMax: maxT,
      elapsed: 0,
      holdTime: 0,
      done: false,
      result: null // 'hit' | 'miss'
    };
    this.state.totalPoses++;

    // UI อัปเดต
    if (this.poseBadgeEl){
      const icon = pose.icon || '🧘‍♂️';
      let txt = pose.label;
      if (special === 'gold') txt += ' (GOLD)';
      else if (special === 'bomb') txt += ' (BOMB)';
      this.poseBadgeEl.innerHTML = `<span>${icon}</span><span>${txt}</span>`;
      this.poseBadgeEl.style.borderColor =
        special === 'gold' ? 'rgba(250,204,21,0.9)' :
        special === 'bomb' ? 'rgba(248,113,113,0.9)' :
        'rgba(129,140,248,0.85)';
    }
    if (this.poseBarEl){
      this.poseBarEl.style.width = '0%';
      this.poseBarEl.style.background =
        special === 'gold'
          ? 'linear-gradient(90deg,#facc15,#f97316)'
          : 'linear-gradient(90deg,#a855f7,#6366f1)';
    }
    this._updateHoldHint();
  }

  _updatePose(dt){
    if (!this.activePose) return;

    const p = this.activePose;
    p.elapsed += dt;

    if (p.special === 'bomb'){
      // ห้ามถือ → ถ้าถือ = MISS
      if (this.isHolding && !p.done){
        this._onPoseMiss(p, true);
        return;
      }
      if (p.elapsed >= p.timeMax && !p.done){
        // ปล่อยนิ่ง ๆ ครบเวลา = hit
        this._onPoseHit(p, true);
        return;
      }
    }else{
      // normal / gold: ต้องถือให้ครบ holdRequired
      if (this.isHolding && !p.done){
        p.holdTime += dt;
      }
      const ratio = Math.min(1, p.holdTime / p.holdRequired);
      if (this.poseBarEl){
        this.poseBarEl.style.width = (ratio*100).toFixed(1) + '%';
      }
      if (p.holdTime >= p.holdRequired && !p.done){
        this._onPoseHit(p, false);
        return;
      }
      if (p.elapsed >= p.timeMax && !p.done){
        this._onPoseMiss(p, false);
        return;
      }
    }
  }

  _onPoseHit(p, isBombPose){
    p.done = true;
    p.result = 'hit';

    let gain = this.cfg.baseScore;
    if (p.special === 'gold') gain = Math.round(gain*2);
    if (isBombPose) gain = Math.round(gain*1.5); // gold bomb-clear

    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    let inFever = this.state.combo >= 5;
    if (inFever){
      gain = Math.round(gain*1.4);
      if (!this.state.fever){
        this.state.fever = true;
        this._showFeverFx();
      }
    }else{
      this.state.fever = false;
    }

    this.state.score += gain;
    this._hud();
    this._screenPulse(false);
    this._spawnHitFx('+'+gain, false);

    // pose จบ → gap เล็กน้อยค่อยเริ่มท่าถัดไป
    this.activePose = null;
    this.poseGapTimer = 0.6;
  }

  _onPoseMiss(p, isBombPose){
    p.done = true;
    p.result = 'miss';

    this.state.miss++;
    this.state.combo = 0;
    this.state.fever = false;

    // ลงโทษเพิ่มถ้าเป็น bomb pose แล้วถือผิด
    if (p.special === 'bomb'){
      this.state.score = Math.max(0, this.state.score - 40);
    }else{
      this.state.score = Math.max(0, this.state.score - 15);
    }

    this._hud();
    this._screenPulse(true);
    this._spawnHitFx('MISS', true);

    this.activePose = null;
    this.poseGapTimer = 0.6;
  }

  // -------------------------------------------------------------------------
  // FX
  // -------------------------------------------------------------------------
  _screenPulse(isBad){
    const target = this.arena;
    if (!target) return;
    const orig = target.style.boxShadow || '';
    target.style.transition = 'box-shadow 0.1s';
    target.style.boxShadow = isBad
      ? '0 0 24px rgba(248,113,113,0.9)'
      : '0 0 24px rgba(129,140,248,0.9)';
    setTimeout(()=>{
      target.style.boxShadow = orig;
    }, 120);
  }

  _spawnHitFx(text,isBad){
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
    fx.style.fontSize = '22px';
    fx.style.fontWeight = '900';
    fx.style.color = isBad ? '#fb7185' : '#4ade80';
    fx.style.textShadow = '0 0 10px rgba(15,23,42,0.9)';
    fx.style.pointerEvents = 'none';
    fx.style.animation = 'sbHitFloat 0.55s ease-out forwards';
    document.body.appendChild(fx);
    setTimeout(()=>fx.remove(), 600);
  }

  _showFeverFx(){
    const el = document.createElement('div');
    el.textContent = 'FEVER!!';
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.top  = '18%';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.zIndex = '9999';
    el.style.fontSize = '32px';
    el.style.fontWeight = '900';
    el.style.letterSpacing = '0.18em';
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

    // update pose
    if (this.activePose){
      this._updatePose(dt);
    }else{
      this.poseGapTimer -= dt;
      if (this.poseGapTimer <= 0 && this.state.timeLeft > 2){
        this._startNextPose();
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
    if(this.state.score>=800 && acc>=0.95) rank='SSS';
    else if(this.state.score>=600 && acc>=0.90) rank='S';
    else if(this.state.score>=420 && acc>=0.80) rank='A';
    else if(this.state.score>=260 && acc>=0.60) rank='B';

    return {
      profile:  this.profile,
      game:     'balance-hold',
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

    const ripple = document.createElement('div');
    ripple.className = 'sb-finish-ripple';
    document.body.appendChild(ripple);
    setTimeout(()=>ripple.remove(), 600);

    const summary = this._buildSummary();
    const ok = this._showResult(summary);
    if (!ok){
      const acc = (summary.accuracy*100).toFixed(1);
      alert(
        `Balance Hold Result\n` +
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
      console.warn('balance-hold save error', e);
    }
  }

  _showResult(summary){
    const box   = this.result.box  || document.getElementById('bhResultCard');
    const sc    = this.result.score|| document.getElementById('bhScore');
    const h     = this.result.hits || document.getElementById('bhHits');
    const m     = this.result.miss || document.getElementById('bhMiss');
    const accEl = this.result.acc  || document.getElementById('bhAcc');
    const best  = this.result.best || document.getElementById('bhBest');
    const rank  = this.result.rank || document.getElementById('bhRank');

    if (!box) return false;
    box.style.display = 'flex';

    const acc = Math.round((summary.accuracy||0)*100);

    if (sc)    sc.textContent   = summary.score;
    if (h)     h.textContent    = summary.hits;
    if (m)     m.textContent    = summary.miss;
    if (accEl) accEl.textContent= acc + '%';
    if (best)  best.textContent = 'x' + summary.comboMax;
    if (rank)  rank.textContent = summary.rank;

    const csvBtn = this.csvBtn || document.getElementById('bhCsvBtn');
    const pdfBtn = this.pdfBtn || document.getElementById('bhPdfBtn');
    if (csvBtn) csvBtn.onclick = ()=>downloadCSVRow(summary);
    if (pdfBtn) pdfBtn.onclick = ()=>exportPDF(summary);

    return true;
  }
}