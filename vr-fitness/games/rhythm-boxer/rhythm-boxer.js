// === Rhythm Boxer — v1.7 (Note-based End / Research-ready) =============
// - เกมจบเมื่อโน้ตทุกตัวถูกตัดสิน (hits+miss) ไม่ใช่ตามเวลา
// - HUD เวลาใช้ความยาวเพลงโดยประมาณ
// - Hybrid save + PDF + leaderboard (endpoint เติมทีหลังได้)

// ---------------------------------------------------------------------
// CONFIG ENDPOINT (เติมเองภายหลังได้)
// ---------------------------------------------------------------------
const FIREBASE_API = ''; // e.g. 'https://.../firebase'
const SHEET_API    = ''; // e.g. 'https://.../sheet'
const PDF_API      = ''; // e.g. 'https://.../pdf'
const LB_API       = ''; // e.g. 'https://.../leaderboard'

const LS_PROFILE = 'rb_profile_v1';
const LS_QUEUE   = 'rb_offline_queue_v1';

// ---------------------------------------------------------------------
// STRINGS
// ---------------------------------------------------------------------
const STR = {
  th: {
    msgStart : 'ฟังจังหวะแล้วต่อยให้ตรง! 🥊',
    msgPaused: 'พักแป๊บเดียวพอนะ โค้ชรอดูอยู่ 😄',
    msgResume: 'กลับมาต่อยตามจังหวะกันต่อ! 🎵',
    msgEnd   : 'โน้ตหมดแล้ว มาดูคะแนนกัน ⭐',
    lbSchool : 'อันดับในโรงเรียน',
    lbClass  : 'อันดับในห้องเรียน'
  }
};

// ---------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// OFFLINE QUEUE
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// HYBRID SAVE
// ---------------------------------------------------------------------
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
    console.warn('Rhythm Boxer save fail', e);
    ok = false;
  }
  if (!ok && allowQueue){
    const q = loadQueue();
    q.push(summary);
    saveQueue(q);
  }
}

// ---------------------------------------------------------------------
// PDF EXPORT (optional)
// ---------------------------------------------------------------------
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
    a.download = `RhythmBoxer_Report_${summary.profile.studentId || 'user'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    alert('สร้าง PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
}

// ---------------------------------------------------------------------
// LEADERBOARD (optional)
// ---------------------------------------------------------------------
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

function buildLBTable(rows){
  const table = document.createElement('table');
  table.style.width = '100%';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>#</th><th>ชื่อ</th><th>คะแนน</th><th>แม่นยำ</th></tr>';
  table.appendChild(thead);
  const tb = document.createElement('tbody');
  (rows || []).slice(0,10).forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td>${i+1}</td><td>${r.name||'-'}</td><td>${r.score||0}</td><td>${Math.round((r.accuracy||0)*100)}%</td>`;
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  return table;
}

// ---------------------------------------------------------------------
// PATTERN (demo) — สามารถเปลี่ยนภายหลังได้
// ---------------------------------------------------------------------
const SONG_PATTERN = [
  0.8, 1.5, 2.2, 3.0,
  3.8, 4.5, 5.2, 6.0,
  6.8, 7.5, 8.2, 9.0,
  9.6, 10.3, 11.0, 11.8,
  12.6, 13.4, 14.2, 15.0
].map((t,i)=>({ time:t, lane:i%4 }));

// =====================================================================
// MAIN CLASS
// =====================================================================
export class RhythmBoxer{
  constructor(opts){
    this.stage  = opts.stage;
    this.hud    = opts.hud || {};
    this.result = opts.result || {};
    this.msgBox = opts.msgBox || null;
    this.lbBox  = opts.lbBox  || null;
    this.pdfBtn = opts.pdfBtn || null;

    // ซ่อนการ์ดสรุปผลตั้งแต่ต้น
    if (this.result.box) {
      this.result.box.style.display = 'none';
    }

    if (!this.stage){
      alert('Rhythm Boxer: ไม่พบ stage container');
      return;
    }

    this.profile = ensureProfile();
    this.str     = STR.th;

    // โหลด diff / time จาก query (แต่ใช้เวลาเป็นแค่ HUD โดยประมาณ)
    const qs  = new URLSearchParams(location.search);
    let diff  = qs.get('diff') || 'normal';
    let timeQ = parseInt(qs.get('time') || '60',10);

    const DIFF = {
      easy   : { duration:60, windowPerfect:0.15, windowGood:0.30, speed:1.0 },
      normal : { duration:60, windowPerfect:0.10, windowGood:0.25, speed:1.1 },
      hard   : { duration:60, windowPerfect:0.08, windowGood:0.20, speed:1.2 }
    };
    if (!DIFF[diff]) diff='normal';

    this.diff = diff;
    this.cfg  = { ...DIFF[diff], duration: timeQ };

    this.state = {
      play:false, paused:false,
      elapsed:0, lastTs:0,
      score:0, hits:0, miss:0,
      combo:0, best:0,
      notes:[],
      raf:0
    };

    this.songEndTime = 0;     // เวลาของโน้ตตัวสุดท้าย
    this.songGuard   = 0.8;   // buffer หลัง note สุดท้ายก่อนจบเกม

    this.lanes = [];
    this._initLayout();
    this._bindInput();
    flushQueue();
    this._msg(this.str.msgStart);
  }

  // -------------------------------------------------------------------
  // BASIC UI HELPERS
  // -------------------------------------------------------------------
  _msg(t){ if (this.msgBox) this.msgBox.textContent = t; }

  _hud(){
    const s = this.state;
    const songDuration = this.songEndTime + this.songGuard;
    const showDuration = Math.max(songDuration, this.cfg.duration || 0);
    const remain = Math.max(0, Math.ceil(showDuration - s.elapsed));
    if (this.hud.time)  this.hud.time.textContent  = remain;
    if (this.hud.score) this.hud.score.textContent = s.score;
    if (this.hud.combo) this.hud.combo.textContent = 'x'+s.combo;
  }

  // -------------------------------------------------------------------
  // LAYOUT
  // -------------------------------------------------------------------
  _initLayout(){
    this.stage.innerHTML = '';
    this.stage.id = 'rbStageHost';
    this.stage.style.position = 'fixed';
    this.stage.style.inset = '0';

    const wrap = document.createElement('div');
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.gap = '8px';
    wrap.style.pointerEvents = 'none';

    this.lanes = [];

    for (let i=0;i<4;i++){
      const lane = document.createElement('div');
      lane.className = 'rb-lane';
      lane.dataset.lane = i;
      lane.style.position='relative';
      lane.style.width='80px';
      lane.style.height='60vh';
      lane.style.borderRadius='18px';
      lane.style.background='rgba(15,23,42,.85)';
      lane.style.border='1px solid rgba(148,163,184,.7)';
      lane.style.boxShadow='0 10px 30px rgba(15,23,42,.9)';
      lane.style.overflow='hidden';
      lane.style.pointerEvents='auto';
      lane.style.zIndex = '20';

      const hitLine = document.createElement('div');
      hitLine.className='rb-hitline';
      hitLine.style.position='absolute';
      hitLine.style.left='8px';
      hitLine.style.right='8px';
      hitLine.style.bottom='12px';
      hitLine.style.height='6px';
      hitLine.style.borderRadius='999px';
      hitLine.style.background='rgba(96,165,250,.9)';
      lane.appendChild(hitLine);

      wrap.appendChild(lane);
      this.lanes.push(lane);
    }

    this.stage.appendChild(wrap);

    this.state.notes = SONG_PATTERN.map(n=>({
      time:n.time,
      lane:n.lane,
      judged:false,
      hit:false,
      dom:null
    }));

    this.songEndTime = this.state.notes.reduce(
      (m,n)=>Math.max(m, n.time||0), 0
    );
  }

  _bindInput(){
    this.lanes.forEach(lane=>{
      lane.addEventListener('pointerdown', e=>{
        e.preventDefault();
        const laneIdx = parseInt(lane.dataset.lane,10);
        this._handleHit(laneIdx);
      });
    });

    window.addEventListener('keydown', e=>{
      if (e.repeat) return;
      const map = { 'a':0,'s':1,'k':2,'l':3 };
      const laneIdx = map[e.key.toLowerCase()];
      if (laneIdx!=null) this._handleHit(laneIdx);
    });

    document.addEventListener('visibilitychange',()=>{
      if (document.hidden) this.pause(true);
    });
  }

  // -------------------------------------------------------------------
  // CONTROL
  // -------------------------------------------------------------------
  start(){
    this._reset();
    this.state.play   = true;
    this.state.paused = false;
    this.state.raf    = requestAnimationFrame(this._loop.bind(this));
  }

  pause(v=true){
    if (!this.state.play) return;
    this.state.paused = v;
    if (v){
      cancelAnimationFrame(this.state.raf);
      this._msg(this.str.msgPaused);
    }else{
      this._msg(this.str.msgResume);
      this.state.lastTs = 0;
      this.state.raf = requestAnimationFrame(this._loop.bind(this));
    }
  }

  _reset(){
    this.state.elapsed = 0;
    this.state.lastTs  = 0;
    this.state.score   = 0;
    this.state.hits    = 0;
    this.state.miss    = 0;
    this.state.combo   = 0;
    this.state.best    = 0;
    this.state.notes   = SONG_PATTERN.map(n=>({
      time:n.time,
      lane:n.lane,
      judged:false,
      hit:false,
      dom:null
    }));
    this.songEndTime = this.state.notes.reduce(
      (m,n)=>Math.max(m, n.time||0), 0
    );
    this.lanes.forEach(l=>{ l.querySelectorAll('.rb-note').forEach(n=>n.remove()); });
    this._hud();
  }

  // -------------------------------------------------------------------
  // NOTES / HIT DETECTION
  // -------------------------------------------------------------------
  _spawnNote(note){
    const lane = this.lanes[note.lane];
    if (!lane) return;
    const dom  = document.createElement('div');
    dom.className = 'rb-note';
    dom.style.position='absolute';
    dom.style.left='8px';
    dom.style.right='8px';
    dom.style.height='24px';
    dom.style.borderRadius='999px';
    dom.style.background='rgba(248,250,252,.95)';
    dom.style.boxShadow='0 4px 12px rgba(15,23,42,.85)';
    dom.style.bottom='100%';
    lane.appendChild(dom);
    note.dom = dom;
  }

  _updateNotes(){
    this.state.notes.forEach(note=>{
      if (!note.dom) return;
      const tNow   = this.state.elapsed;
      const dtHead = note.time - tNow;
      const totalTravel = 2.0; // sec ก่อนถึงเส้น
      const ratio  = 1 - (dtHead / totalTravel);
      const clamp  = Math.max(0, Math.min(1.2, ratio));
      const lane   = this.lanes[note.lane];
      const h      = lane ? (lane.clientHeight||1) : 1;
      const bottomPx = 12 + clamp * (h - 40);
      note.dom.style.bottom = bottomPx + 'px';
    });
  }

  _handleHit(laneIdx){
    if (!this.state.play || this.state.paused) return;

    const tNow = this.state.elapsed;
    const cfg  = this.cfg;

    let best = null;
    let bestDt = Infinity;
    this.state.notes.forEach(note=>{
      if (note.lane!==laneIdx || note.judged) return;
      const dt = Math.abs(note.time - tNow);
      if (dt < bestDt){
        bestDt = dt;
        best   = note;
      }
    });

    if (!best){
      this._regMiss(null);
      return;
    }

    let type = 'miss';
    if (bestDt <= cfg.windowPerfect) type = 'perfect';
    else if (bestDt <= cfg.windowGood) type = 'good';

    if (type === 'miss') this._regMiss(best);
    else this._regHit(best, type);
  }

  _regHit(note, type){
    note.judged = true;
    note.hit    = true;
    this.state.hits++;

    let gain = 0;
    if (type==='perfect') gain = 30;
    else if (type==='good') gain = 15;

    this.state.combo++;
    this.state.best  = Math.max(this.state.best, this.state.combo);
    this.state.score += gain;

    if (note.dom){
      note.dom.style.background = type==='perfect' ? '#4ade80' : '#93c5fd';
      setTimeout(()=>note.dom && note.dom.remove(), 120);
    }

    this._hud();
    this._floatLane(note.lane, type==='perfect'?('+30'):('+15'), false);
  }

  _regMiss(note){
    this.state.miss++;
    this.state.combo = 0;
    this._hud();
    this._floatLane(note ? note.lane : 1, '-5', true);
  }

  _floatLane(laneIdx, txt, isBad){
    const lane = this.lanes[laneIdx] || this.lanes[1];
    if (!lane) return;
    const r  = lane.getBoundingClientRect();
    const fx = document.createElement('div');
    fx.className = 'float';
    fx.textContent = txt;
    fx.style.left  = (r.left + r.width/2) + 'px';
    fx.style.top   = (r.top + r.height*0.2) + 'px';
    fx.style.color = isBad ? '#fb7185' : '#4ade80';
    fx.style.position = 'fixed';
    fx.style.transform = 'translate(-50%,-50%)';
    document.body.appendChild(fx);
    setTimeout(()=>fx.remove(),600);
  }

  // -------------------------------------------------------------------
  // GAME LOOP (จบเมื่อโน้ตทุกตัว judged แล้ว)
  // -------------------------------------------------------------------
  _loop(ts){
    if (!this.state.play || this.state.paused) return;
    if (!this.state.lastTs) this.state.lastTs = ts;
    const dt = (ts - this.state.lastTs)/1000;
    this.state.lastTs  = ts;
    this.state.elapsed += dt;

    // spawn notes ล่วงหน้า
    const lookAhead = 2.0;
    this.state.notes.forEach(note=>{
      if (!note.dom && note.time - this.state.elapsed <= lookAhead){
        this._spawnNote(note);
      }
    });

    // auto-miss ถ้าเลยหน้าต่างดีไปแล้ว
    this.state.notes.forEach(note=>{
      if (!note.judged && this.state.elapsed - note.time > this.cfg.windowGood){
        note.judged = true;
        this.state.miss++;
        if (note.dom) note.dom.style.opacity = '0.2';
      }
    });

    // อัปเดตตำแหน่ง note
    this._updateNotes();
    this._hud();

    // เช็คว่าโน้ตทุกตัวถูกตัดสินหมดแล้วหรือยัง
    const allDone = this.state.notes.every(n => n.judged);
    if (allDone && this.state.elapsed >= this.songEndTime + this.songGuard){
      this._finish();
      return;
    }

    this.state.raf = requestAnimationFrame(this._loop.bind(this));
  }

  // -------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------
  _buildSummary(){
    const total = this.state.hits + this.state.miss;
    const acc   = total>0 ? this.state.hits/total : 0;
    let rank = 'C';
    if(this.state.score>=600 && acc>=0.95) rank='SSS';
    else if(this.state.score>=450 && acc>=0.90) rank='S';
    else if(this.state.score>=320 && acc>=0.80) rank='A';
    else if(this.state.score>=200 && acc>=0.60) rank='B';

    return {
      profile:  this.profile,
      game:     'rhythm-boxer',
      diff:     this.diff,
      duration: this.songEndTime,   // ใช้เวลาจริงของเพลง
      score:    this.state.score,
      hits:     this.state.hits,
      miss:     this.state.miss,
      comboMax: this.state.best,
      accuracy: acc,
      rank,
      device:   detectDevice(),
      timestamp:new Date().toISOString()
    };
  }

  // -------------------------------------------------------------------
  // CLEANUP / FX
  // -------------------------------------------------------------------
  _clearStage(){
    const kill = sel => document.querySelectorAll(sel).forEach(e => e.remove());
    kill('.rb-note');
    kill('.rb-lane');
    kill('.track');
    kill('.lane');
    kill('.note');

    const stage = document.getElementById('rbStageHost');
    if (stage){
      stage.innerHTML = '';
      stage.style.pointerEvents = 'none';
    }
  }

  _playFinishFx(){
    const ripple = document.createElement('div');
    ripple.className = 'rb-ripple';
    const scan = document.createElement('div');
    scan.className = 'rb-scan';
    document.body.appendChild(ripple);
    document.body.appendChild(scan);
    setTimeout(()=>{
      ripple.remove();
      scan.remove();
    },1000);
  }

  // -------------------------------------------------------------------
  // FINISH + RESULT
  // -------------------------------------------------------------------
  async _finish(){
    this.state.play = false;
    cancelAnimationFrame(this.state.raf);
    this._msg(this.str.msgEnd);

    const summary = this._buildSummary();

    if (this.stage) {
      this.stage.style.display = 'none';
    }
    this._clearStage();

    document.body.classList.add('rb-finished');
    document.body.style.overflow = 'hidden';

    this._playFinishFx();

    const ok = this._showResult(summary);
    if (!ok) {
      const acc = (summary.accuracy * 100).toFixed(1);
      alert(
        `Rhythm Boxer Result\n` +
        `Score: ${summary.score}\n` +
        `Hits: ${summary.hits}\n` +
        `Miss: ${summary.miss}\n` +
        `Accuracy: ${acc}%\n` +
        `Best Combo: x${summary.comboMax}\n` +
        `Rank: ${summary.rank}`
      );
    }

    try {
      await hybridSaveSession(summary, true);
      this._loadLeaderboards && this._loadLeaderboards(summary.profile);
    } catch(e){
      console.warn('save / leaderboard error', e);
    }
  }

  _showResult(summary){
    const box   = (this.result && this.result.box) || document.getElementById('rbResultCard');
    const score = this.result?.score || document.getElementById('rbScore');
    const hits  = this.result?.hits  || document.getElementById('rbHits');
    const miss  = this.result?.miss  || document.getElementById('rbMiss');
    const acc   = this.result?.acc   || document.getElementById('rbAcc');
    const best  = this.result?.best  || document.getElementById('rbBest');
    const rank  = this.result?.rank  || document.getElementById('rbRank');

    if (!box) {
      console.warn('Result box not found (rbResultCard)');
      return false;
    }

    const accVal = Math.round((summary.accuracy || 0) * 100);

    box.style.display = 'flex';

    if (score) score.textContent = summary.score;
    if (hits)  hits.textContent  = summary.hits;
    if (miss)  miss.textContent  = summary.miss;
    if (acc)   acc.textContent   = accVal + '%';
    if (best)  best.textContent  = 'x' + summary.comboMax;
    if (rank)  rank.textContent  = summary.rank;

    if (this.pdfBtn){
      this.pdfBtn.onclick = () => exportPDF(summary);
    }

    return true;
  }

  // -------------------------------------------------------------------
  // LEADERBOARD LOAD
  // -------------------------------------------------------------------
  async _loadLeaderboards(profile){
    if (!this.lbBox) return;
    try{
      const [schoolLB, classLB] = await Promise.all([
        loadLeaderboard('school', profile),
        loadLeaderboard('class',  profile)
      ]);
      this.lbBox.innerHTML = '';
      const t1 = document.createElement('h4');
      t1.textContent = this.str.lbSchool;
      this.lbBox.appendChild(t1);
      this.lbBox.appendChild(buildLBTable(schoolLB));

      const t2 = document.createElement('h4');
      t2.textContent = this.str.lbClass;
      this.lbBox.appendChild(t2);
      this.lbBox.appendChild(buildLBTable(classLB));
    }catch(e){
      console.warn('load leaderboard fail', e);
    }
  }
}