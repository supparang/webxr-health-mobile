// === Shadow Breaker — v2.0 (Gold/Bomb/Fever + Research-ready) =================
// - ต่อยเป้า Shadow 2D บนจอ (PC/Mobile/VR WebView)
// - gold target, bomb target, fever mode (combo ≥ 5)
// - Timed mode จาก query (?mode=timed&time=90&diff=normal)
// - Research Summary schema แบบเดียวกับ Rhythm Boxer
// ==============================================================================

// ---------------------------------------------------------------------------
// CONFIG ENDPOINT (เติมเองภายหลังได้)
// ---------------------------------------------------------------------------
const FIREBASE_API = ''; // e.g. 'https://.../firebase'
const SHEET_API    = ''; // e.g. 'https://.../sheet'
const PDF_API      = ''; // e.g. 'https://.../pdf'
const LB_API       = ''; // e.g. 'https://.../leaderboard'

const LS_PROFILE = 'fitness_profile_v1';
const LS_QUEUE   = 'fitness_offline_queue_v1';

// ---------------------------------------------------------------------------
// STRINGS
// ---------------------------------------------------------------------------
const STR = {
  th: {
    msgReady : 'เตรียมหมัดให้พร้อม… เป้าจะมาแบบสุ่มทั่วจอ! 🥊',
    msgGo    : 'GO! ต่อยให้ทัน อย่าพลาดเยอะล่ะ 💥',
    msgPaused: 'พักหมัดแป๊บเดียวก็พอ โค้ชยังรอดูอยู่ 😄',
    msgResume: 'กลับมาต่อยกันต่อ! 🚀',
    msgEnd   : 'หมดเวลาแล้ว มาดูว่าต่อยได้แค่ไหน ✨',
    lbSchool : 'อันดับในโรงเรียน',
    lbClass  : 'อันดับในห้อง'
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
    a.download = `ShadowBreaker_Report_${summary.profile.studentId || 'user'}.pdf`;
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
  a.download = `ShadowBreaker_${p.studentId||'user'}_${summary.timestamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// LEADERBOARD + DEVICE
// ---------------------------------------------------------------------------
async function loadLeaderboard(scope, profile){
  if (!LB_API) return [];
  const url = new URL(LB_API);
  url.searchParams.set('scope', scope);
  url.searchParams.set('school', profile.school||'');
  url.searchParams.set('class',  profile.class||'');
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return res.json();
}
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
  easy   : { spawnInterval: 1.2, lifeTime: 1.4, baseScore: 20 },
  normal : { spawnInterval: 0.9, lifeTime: 1.1, baseScore: 25 },
  hard   : { spawnInterval: 0.7, lifeTime: 0.9, baseScore: 30 }
};

// สัดส่วน gold/bomb
const GOLD_CHANCE = 0.12;  // 12%
const BOMB_CHANCE = 0.08;  // 8%

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
    this.lbBox   = opts.lbBox || null;

    if (!this.arena){
      alert('Shadow Breaker: ไม่พบ #sbArena');
      return;
    }

    this.profile = ensureProfile();
    this.str     = STR.th;

    const qs   = new URLSearchParams(location.search);
    const diff = qs.get('diff') || 'normal';
    const mode = qs.get('mode') || 'timed';
    let timeQ  = parseInt(qs.get('time') || '60',10);
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
      totalTargets:0,
      fever:false
    };

    /** @type {Map<string, any>} */
    this.targets = new Map();
    this.spawnTimer = null;

    flushQueue();
    this._prepareArena();
    this._msg(this.str.msgReady);
    this._hud();
  }

  // -----------------------------------------------------------------------
  // BASIC UI
  // -----------------------------------------------------------------------
  _msg(t){ if (this.msgBox) this.msgBox.textContent = t; }

  _hud(){
    if (this.hud.time)  this.hud.time.textContent  = Math.max(0, Math.ceil(this.state.timeLeft));
    if (this.hud.score) this.hud.score.textContent = this.state.score;
    if (this.hud.hits)  this.hud.hits.textContent  = this.state.hits;
    if (this.hud.miss)  this.hud.miss.textContent  = this.state.miss;
    if (this.hud.combo) this.hud.combo.textContent = 'x' + this.state.combo;
  }

  _prepareArena(){
    this.arena.style.position = 'relative';
    this.arena.style.overflow = 'hidden';
    this.arena.style.touchAction = 'manipulation';

    this.arena.addEventListener('pointerdown', (e)=>{
      const t = e.target.closest('.sb-target');
      if (!t) return;
      const id = t.dataset.id;
      if (!id) return;
      this._hitTarget(id, e);
    });

    document.addEventListener('visibilitychange', ()=>{
      if (document.hidden) this.pause(true);
    });
  }

  // -----------------------------------------------------------------------
  // CONTROL
  // -----------------------------------------------------------------------
  start(){
    if (this.state.running) return;
    this.state.running = true;
    this.state.paused  = false;
    this.state.elapsed = 0;
    this.state.timeLeft= this.timeLimit;
    this.state.lastTs  = 0;
    this.state.score   = 0;
    this.state.hits    = 0;
    this.state.miss    = 0;
    this.state.combo   = 0;
    this.state.bestCombo=0;
    this.state.fever   = false;
    this._clearTargets();
    this._hud();
    this._msg(this.str.msgGo);

    this._startSpawnLoop();
    this._loop(performance.now());
  }

  pause(v=true){
    if (!this.state.running) return;
    this.state.paused = v;
    if (v){
      if (this.spawnTimer) clearInterval(this.spawnTimer);
      this.spawnTimer = null;
      this._msg(this.str.msgPaused);
    }else{
      this._msg(this.str.msgResume);
      this.state.lastTs = 0;
      this._startSpawnLoop();
      this._loop(performance.now());
    }
  }

  _startSpawnLoop(){
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    const iv = this.cfg.spawnInterval * 1000;
    this.spawnTimer = setInterval(()=>{
      if (!this.state.running || this.state.paused) return;
      this._spawnTarget();
    }, iv);
  }

  _clearTargets(){
    this.targets.forEach(t=>{
      if (t.el && t.el.remove) t.el.remove();
    });
    this.targets.clear();
  }

  // -----------------------------------------------------------------------
  // TARGETS
  // -----------------------------------------------------------------------
  _spawnTarget(){
    const rect = this.arena.getBoundingClientRect();
    const size = Math.max(60, Math.min(rect.width, rect.height) * 0.18);

    const id  = 't-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    const el  = document.createElement('div');
    el.className = 'sb-target';
    el.dataset.id = id;

    // type: normal / gold / bomb
    let type = 'normal';
    const r = Math.random();
    if (r < BOMB_CHANCE) type = 'bomb';
    else if (r < BOMB_CHANCE + GOLD_CHANCE) type = 'gold';

    el.dataset.type = type;

    // random position (safe margin 10%)
    const marginX = rect.width * 0.10;
    const marginY = rect.height * 0.15;
    const maxX = rect.width  - marginX - size;
    const maxY = rect.height - marginY - size;
    const x = marginX + Math.random()*maxX;
    const y = marginY + Math.random()*maxY;

    Object.assign(el.style, {
      position:'absolute',
      width: size + 'px',
      height:size + 'px',
      left:  x + 'px',
      top:   y + 'px',
      borderRadius:'50%',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      fontSize:(size*0.5)+'px',
      fontWeight:'900',
      cursor:'pointer',
      transform:'scale(0.2)',
      opacity:'0',
      transition:'transform 0.08s ease-out, opacity 0.08s ease-out'
    });

    if (type === 'gold'){
      el.textContent = '★';
      el.style.background = 'radial-gradient(circle at 30% 20%,#facc15,#f97316)';
      el.style.boxShadow  = '0 0 18px rgba(250,204,21,0.9)';
      el.style.color      = '#111827';
    }else if (type === 'bomb'){
      el.textContent = 'X';
      el.style.background = 'radial-gradient(circle at 30% 20%,#f97316,#b91c1c)';
      el.style.boxShadow  = '0 0 18px rgba(248,113,113,0.9)';
      el.style.color      = '#fee2e2';
    }else{
      el.textContent = '';
      el.style.background = 'radial-gradient(circle,#0ea5e9,#1d4ed8)';
      el.style.boxShadow  = '0 0 18px rgba(59,130,246,0.9)';
      el.style.color      = '#e5e7eb';
    }

    this.arena.appendChild(el);

    // animate in
    requestAnimationFrame(()=>{
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
    });

    const now     = performance.now();
    const lifeMs  = this.cfg.lifeTime * 1000;
    const expire  = now + lifeMs;

    this.targets.set(id, {
      id, el, type,
      createdAt: now,
      expireAt: expire,
      clicked: false
    });

    this.state.totalTargets++;
  }

  _hitTarget(id, evt){
    if (!this.state.running || this.state.paused) return;
    const t = this.targets.get(id);
    if (!t || t.clicked) return;

    t.clicked = true;
    this.targets.delete(id);

    // basic scoring
    let gain = this.cfg.baseScore;
    let missPenalty = 10;

    // gold / bomb
    if (t.type === 'gold') {
      gain *= 2; // gold x2
    } else if (t.type === 'bomb') {
      // bomb → นับ miss หนัก + รีเซ็ตคอมโบ
      this.state.miss++;
      this.state.combo = 0;
      this._screenShake(true);
      this._spawnHitFx(evt.clientX, evt.clientY, '-MISS-', true);
      this._hud();
      t.el && t.el.remove();
      return;
    }

    // combo & fever
    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    let inFever = this.state.combo >= 5;
    if (inFever){
      gain = Math.round(gain * 1.5);
      if (!this.state.fever) {
        this.state.fever = true;
        this._showFeverFx();
      }
    }else{
      this.state.fever = false;
    }

    this.state.score += gain;
    this._hud();

    // fx
    this._screenShake(false);
    this._spawnHitFx(evt.clientX, evt.clientY, '+'+gain, false);

    // remove with small pop
    if (t.el){
      t.el.style.transform = 'scale(0.2)';
      t.el.style.opacity = '0';
      setTimeout(()=>t.el && t.el.remove(), 80);
    }
  }

  // -----------------------------------------------------------------------
  // FX
  // -----------------------------------------------------------------------
  _screenShake(isBad){
    const target = this.arena;
    if (!target) return;
    target.style.transition = 'transform 0.08s';
    const mag = isBad ? 12 : 6;
    target.style.transform = `translate(${(Math.random()-0.5)*mag}px, ${(Math.random()-0.5)*mag}px)`;
    setTimeout(()=>{
      target.style.transform = 'translate(0,0)';
    }, 90);
  }

  _spawnHitFx(x,y,text,isBad){
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

  // -----------------------------------------------------------------------
  // GAME LOOP (timed mode)
  // -----------------------------------------------------------------------
  _loop(ts){
    if (!this.state.running || this.state.paused) return;
    if (!this.state.lastTs) this.state.lastTs = ts;
    const dt = (ts - this.state.lastTs)/1000;
    this.state.lastTs = ts;
    this.state.elapsed += dt;
    this.state.timeLeft = Math.max(0, this.timeLimit - this.state.elapsed);

    // auto miss expired targets
    const now = performance.now();
    const expired = [];
    this.targets.forEach((t,id)=>{
      if (!t.clicked && now > t.expireAt){
        expired.push(id);
      }
    });
    expired.forEach(id=>{
      const t = this.targets.get(id);
      if (!t) return;
      this.targets.delete(id);
      if (t.el) t.el.remove();
      this.state.miss++;
      this.state.combo = 0;
    });

    this._hud();

    if (this.state.timeLeft <= 0){
      this._finish();
      return;
    }

    requestAnimationFrame(this._loop.bind(this));
  }

  // -----------------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------------
  _buildSummary(){
    const total = this.state.hits + this.state.miss;
    const acc   = total>0 ? this.state.hits/total : 0;

    const duration = this.state.elapsed || this.timeLimit;
    const notesPerSec = duration>0 ? total / duration : 0;
    const notesPerMin = notesPerSec * 60;

    let rank = 'C';
    if(this.state.score>=800 && acc>=0.95) rank='SSS';
    else if(this.state.score>=600 && acc>=0.90) rank='S';
    else if(this.state.score>=400 && acc>=0.80) rank='A';
    else if(this.state.score>=250 && acc>=0.60) rank='B';

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

  // -----------------------------------------------------------------------
  // FINISH + RESULT
  // -----------------------------------------------------------------------
  async _finish(){
    this.state.running = false;
    if (this.spawnTimer) clearInterval(this.spawnTimer);
    this.spawnTimer = null;

    this._clearTargets();
    this._hud();
    this._msg(this.str.msgEnd);

    // เล่น ripple fx เบา ๆ ถ้ามี CSS
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
      // leaderboard (optional)
      if (this.lbBox){
        const [schoolLB, classLB] = await Promise.all([
          loadLeaderboard('school', summary.profile),
          loadLeaderboard('class',  summary.profile)
        ]);
        this.lbBox.innerHTML = '';
        const wrap = document.createElement('div');

        const mkTable = (title, data)=>{
          const h = document.createElement('h4');
          h.textContent = title;
          wrap.appendChild(h);
          const table = document.createElement('table');
          table.style.width = '100%';
          const thead = document.createElement('thead');
          thead.innerHTML = '<tr><th>#</th><th>ชื่อ</th><th>คะแนน</th><th>แม่นยำ</th></tr>';
          table.appendChild(thead);
          const tb = document.createElement('tbody');
          (data||[]).slice(0,10).forEach((r,i)=>{
            const tr = document.createElement('tr');
            tr.innerHTML =
              `<td>${i+1}</td><td>${r.name||'-'}</td><td>${r.score||0}</td><td>${Math.round((r.accuracy||0)*100)}%</td>`;
            tb.appendChild(tr);
          });
          table.appendChild(tb);
          wrap.appendChild(table);
        };

        mkTable('อันดับในโรงเรียน', schoolLB);
        mkTable('อันดับในห้อง',    classLB);
        this.lbBox.appendChild(wrap);
      }
    }catch(e){
      console.warn('shadow-breaker save/leaderboard error', e);
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