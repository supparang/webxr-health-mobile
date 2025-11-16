// === Shadow Breaker — DEV v3.6 (Hybrid + Blackbelt + Report + Leaderboard-ready) ===
// - DEV version with comments for teaching & research
// - You can minify later for production

// ---- CONFIG ENDPOINT (TODO: ใส่ URL จริง) ----
const FIREBASE_API = '';  // optional cloud function URL
const SHEET_API    = '';  // Google Apps Script (API บันทึกลง ShadowBreakerResearch)
const PDF_API      = '';  // Google Apps Script (API สร้าง PDF)
const LB_API       = '';  // optional leaderboard API (ถ้ายังไม่ใช้ ปล่อยว่างได้)

// LocalStorage keys
const LS_PROFILE = 'sb_profile_v1';
const LS_QUEUE   = 'sb_offline_queue_v1';

// ===== STRINGS (TH + EN เผื่ออนาคต) =====
const STR = {
  th:{
    msgStart :'กด ▶ แล้วต่อยเป้าให้ทัน! พยายามไม่พลาดนะ 💥',
    msgPaused:'⏸ พักได้ แต่อย่าหนีโค้ชนานเกินไปนะ 😆',
    msgResume:'กลับมาต่อยต่อเลย! 🔥',
    msgEnd   :'จบด่านแล้ว มาดูคะแนนกัน ⭐',
    lbSchool :'อันดับในโรงเรียน',
    lbClass  :'อันดับในห้องเรียน'
  },
  en:{
    msgStart :'Press ▶ and punch the targets in time! 💥',
    msgPaused:'⏸ Break time, but don’t disappear 😆',
    msgResume:'Back to punching! 🔥',
    msgEnd   :'Stage complete, let’s see your score ⭐',
    lbSchool :'School Leaderboard',
    lbClass  :'Class Leaderboard'
  }
};

// ===== Profile handling =====
function getProfile(){
  try{
    const raw = localStorage.getItem(LS_PROFILE);
    return raw ? JSON.parse(raw) : null;
  }catch{
    return null;
  }
}

function saveProfile(p){
  try{
    localStorage.setItem(LS_PROFILE, JSON.stringify(p));
  }catch{}
}

// ถ้าไม่มี profile → ถามแบบง่าย ๆ ผ่าน prompt (สามารถเปลี่ยนเป็นฟอร์มสวย ๆ ทีหลังได้)
function ensureProfile(lang='th'){
  let p = getProfile();
  if (p) return p;

  const studentId = prompt('Student ID:');
  const name      = prompt('ชื่อที่ใช้ในเกม:');
  const school    = prompt('โรงเรียน / หน่วยงาน:');
  const klass     = prompt('ห้องเรียน เช่น ป.5/1:');

  p = { studentId, name, school, class: klass, lang };
  saveProfile(p);
  return p;
}

// ===== Offline queue สำหรับ session ที่ส่งไม่สำเร็จ =====
function loadQueue(){
  try{
    const raw = localStorage.getItem(LS_QUEUE);
    return raw ? JSON.parse(raw) : [];
  }catch{
    return [];
  }
}
function saveQueue(q){
  try{
    localStorage.setItem(LS_QUEUE, JSON.stringify(q));
  }catch{}
}

// พยายามส่ง queue ที่ค้างอยู่ทุกครั้งที่เปิดเกม
async function flushQueue(){
  const q = loadQueue();
  if (!q.length) return;
  const remain = [];
  for (const item of q){
    try{
      await hybridSaveSession(item, false); // ไม่ต้องเก็บเข้าคิวซ้ำ
    }catch{
      remain.push(item);
    }
  }
  saveQueue(remain);
}

// ===== Hybrid Save (ส่งไปทั้ง Firebase + Google Sheet) =====
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
    console.warn('Hybrid save fail', e);
    ok = false;
  }

  if (!ok && allowQueue){
    const q = loadQueue();
    q.push(summary);
    saveQueue(q);
  }
}

// ===== PDF Export (เรียก Apps Script ที่สร้าง PDF) =====
async function exportPDF(summary){
  if (!PDF_API) {
    alert('ยังไม่ได้ตั้งค่า PDF_API');
    return;
  }
  try{
    const res = await fetch(PDF_API,{
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(summary)
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

// ===== Leaderboard Fetch (ถ้ามี API พร้อม) =====
async function loadLeaderboard(scope, profile){
  if (!LB_API) return [];
  const url = new URL(LB_API);
  url.searchParams.set('scope', scope);             // 'school' | 'class'
  url.searchParams.set('school', profile.school||'');
  url.searchParams.set('class',  profile.class||'');
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return res.json();  // expected: [{name, score, accuracy}, ...]
}

// ===== Blackbelt Patterns (แพทเทิร์นโหด) =====
const BLACKBELT_PATTERNS = [
  ['L','R','C','U'],
  ['U','D','L','R','U'],
  ['L','L','R','R','C'],
  ['U','C','D','L','R'],
  ['fake','L','R','fake','C'],
];

// แปลงโค้ดตำแหน่ง → x,y บนจอ
function mapPatternToPos(code, rect){
  const w = rect.width, h = rect.height;
  const midY = h * 0.45;
  switch(code){
    case 'L':   return { x: w*0.20, y: midY,       fake:false };
    case 'R':   return { x: w*0.80, y: midY,       fake:false };
    case 'C':   return { x: w*0.50, y: midY,       fake:false };
    case 'U':   return { x: w*0.50, y: h*0.30,     fake:false };
    case 'D':   return { x: w*0.50, y: h*0.65,     fake:false };
    case 'fake':
      return { x: w*(0.25+Math.random()*0.5), y:h*(0.25+Math.random()*0.5), fake:true };
    default:
      return { x:w*0.5, y:midY, fake:false };
  }
}

// ===== Helpers =====
function detectDevice(){
  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Pico|Vive|VR/i.test(ua)) return 'VR';
  if (/Mobile|Android|iPhone/i.test(ua))     return 'Mobile';
  return 'PC';
}

function buildLBTable(rows){
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>#</th><th>ชื่อ</th><th>คะแนน</th><th>แม่นยำ</th></tr>';
  table.appendChild(thead);
  const tb = document.createElement('tbody');
  (rows || []).slice(0,10).forEach((r,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${r.name||'-'}</td><td>${r.score||0}</td><td>${Math.round((r.accuracy||0)*100)}%</td>`;
    tb.appendChild(tr);
  });
  table.appendChild(tb);
  return table;
}

// ===== MAIN CLASS =====
export class ShadowBreaker{
  constructor(opts){
    // Elements
    this.stage  = opts.stage;
    this.hud    = opts.hud || {};
    this.result = opts.result || {};
    this.msgBox = opts.msgBox || null;
    this.lbBox  = opts.lbBox  || null;
    this.pdfBtn = opts.pdfBtn || null;

    if (!this.stage){
      alert('Shadow Breaker: ไม่พบ stage container');
      return;
    }

    // Profile & language
    this.profile = ensureProfile('th');      // เปลี่ยนเป็น 'en' ถ้าอยากเริ่ม EN
    this.lang    = this.profile.lang || 'th';
    this.str     = STR[this.lang] || STR.th;

    // Difficulty from URL
    const qs = new URLSearchParams(location.search);
    let diff = qs.get('diff') || 'normal';
    let time = parseInt(qs.get('time') || '90', 10);

    const DIFF = {
      easy     : { duration:60,  spawn:1.35, lifetime:1.65, mode:'random'  },
      normal   : { duration:90,  spawn:1.05, lifetime:1.35, mode:'random'  },
      hard     : { duration:120, spawn:0.85, lifetime:1.10, mode:'random'  },
      blackbelt: { duration:120, spawn:0.62, lifetime:0.90, mode:'pattern' }
    };
    if (!DIFF[diff]) diff = 'normal';
    if (!Number.isFinite(time) || time<30 || time>300) time = DIFF[diff].duration;

    this.diff = diff;
    this.cfg  = { ...DIFF[diff], duration: time };

    // Game state
    this.state = {
      play:false, paused:false,
      elapsed:0, lastTs:0, spawnT:0,
      score:0, hits:0, miss:0, combo:0, best:0,
      fever:0, onfire:false, raf:0
    };

    // Target pool
    this.targets = new Set();
    this.MAX_TARGETS = 12;
    this.EMOJI = ['🥊','💥','⭐','🔥','⚡','💫'];

    // Blackbelt pattern state
    this.patternIdx = 0;
    this.patternStep= 0;

    this._bindEvents();
    flushQueue();
    this._msg(this.str.msgStart);
  }

  _msg(text){
    if (this.msgBox) this.msgBox.textContent = text;
  }

  _hud(){
    const s = this.state, c = this.cfg;
    if (this.hud.time)  this.hud.time.textContent  = Math.max(0,Math.ceil(c.duration - s.elapsed));
    if (this.hud.score) this.hud.score.textContent = s.score;
    if (this.hud.combo) this.hud.combo.textContent = 'x'+s.combo;
  }

  start(){
    this._reset();
    this.state.play = true;
    this.state.paused = false;
    this.state.raf = requestAnimationFrame(this._loop.bind(this));
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
    this.state = {
      play:true, paused:false,
      elapsed:0, lastTs:0, spawnT:0,
      score:0, hits:0, miss:0, combo:0, best:0,
      fever:0, onfire:false, raf:0
    };
    this.patternIdx = 0;
    this.patternStep= 0;
    this.stage.classList.remove('shake');
    this.targets.forEach(t=>t.remove());
    this.targets.clear();
    this._hud();
  }

  // ===== Spawn logic =====
  _spawnRandom(){
    if (this.targets.size >= this.MAX_TARGETS) return;
    const el = document.createElement('div');
    el.className = 'sb-target';
    el.textContent = this._pick(this.EMOJI);
    const r = this.stage.getBoundingClientRect();
    el.style.left = (Math.random()*(r.width-100)+50) + 'px';
    el.style.top  = (Math.random()*(r.height-160)+80)+ 'px';
    el.dataset.created = performance.now();
    el.dataset.fake    = '0';
    el.addEventListener('pointerdown',()=>this._hit(el));
    this.stage.appendChild(el);
    this.targets.add(el);
  }

  _spawnPattern(){
    if (this.targets.size >= this.MAX_TARGETS) return;
    const patterns = BLACKBELT_PATTERNS;

    // เริ่มชุดใหม่ถ้าอยู่ต้น sequence
    if (this.patternStep === 0){
      this.patternIdx = Math.floor(Math.random()*patterns.length);
    }
    const seq  = patterns[this.patternIdx];
    const code = seq[this.patternStep % seq.length];

    const r   = this.stage.getBoundingClientRect();
    const pos = mapPatternToPos(code, r);

    const el = document.createElement('div');
    el.className = 'sb-target';
    el.textContent = pos.fake ? '✖️' : this._pick(this.EMOJI);
    el.style.left  = pos.x + 'px';
    el.style.top   = pos.y + 'px';
    el.dataset.created = performance.now();
    el.dataset.fake    = pos.fake ? '1' : '0';
    el.addEventListener('pointerdown',()=>this._hit(el));
    this.stage.appendChild(el);
    this.targets.add(el);

    this.patternStep++;
  }

  _spawn(){
    if (this.cfg.mode === 'pattern') this._spawnPattern();
    else this._spawnRandom();
  }

  // ===== Hit / Miss =====
  _hit(el){
    if (!this.targets.has(el)) return;
    const isFake = el.dataset.fake === '1';
    if (isFake){
      this._miss(el, true);
      return;
    }

    const nextCombo = this.state.combo + 1;
    const isCrit    = nextCombo >= 5; // FEVER
    const isOnfire  = nextCombo >= 8; // ON FIRE

    let gain = 10 + (isCrit ? 20 : 0);
    if (isOnfire){
      this.state.onfire = true;
      gain *= 2;
    }

    this.state.hits++;
    this.state.combo++;
    this.state.best = Math.max(this.state.best, this.state.combo);
    this.state.fever = Math.min(100, this.state.combo * 10);
    this.state.score += gain;

    this._pfx(el);
    this._float(el, '+'+gain, false);
    this.targets.delete(el);
    el.remove();
    this._hud();
  }

  _miss(el, fromFake=false){
    this.state.miss++;
    this.state.combo  = 0;
    this.state.fever  = 0;
    this.state.onfire = false;
    this._float(el, fromFake?'-15':'-5', true);
    this._shake();
    this.targets.delete(el);
    el.remove();
    this._hud();
  }

  _shake(){
    this.stage.classList.add('shake');
    setTimeout(()=>this.stage.classList.remove('shake'),180);
  }

  _float(el, txt, isBad){
    const r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float';
    f.textContent = txt;
    f.style.left = (r.left+r.width/2) + 'px';
    f.style.top  = (r.top +r.height/2) + 'px';
    f.style.color = isBad ? '#f97373' : '#4ade80';
    document.body.appendChild(f);
    setTimeout(()=>f.remove(),650);
  }

  _pfx(el){
    const r = el.getBoundingClientRect();
    for(let i=0;i<7;i++){
      const p = document.createElement('div');
      p.className = 'pfx';
      p.style.left = (r.left+r.width/2) + 'px';
      p.style.top  = (r.top +r.height/2) + 'px';
      p.style.background = 'var(--c-neon,#4df8ff)';
      p.style.setProperty('--dx', (Math.random()*120-60)+'px');
      p.style.setProperty('--dy', (Math.random()*120-60)+'px');
      document.body.appendChild(p);
      setTimeout(()=>p.remove(),450);
    }
  }

  _pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  // ===== Main Loop =====
  _loop(ts){
    if (!this.state.play || this.state.paused) return;

    if (!this.state.lastTs) this.state.lastTs = ts;
    const dt = (ts - this.state.lastTs)/1000;
    this.state.lastTs  = ts;
    this.state.elapsed += dt;

    if (this.state.elapsed >= this.cfg.duration){
      this._finish();
      return;
    }

    // dynamic spawn
    this.state.spawnT += dt;
    const t   = this.state.elapsed / this.cfg.duration;
    const dyn = Math.max(this.cfg.spawn * (1 - 0.45*t), 0.35);
    if (this.state.spawnT >= dyn){
      this.state.spawnT = 0;
      this._spawn();
    }

    // lifetime check
    const now = performance.now();
    this.targets.forEach(el=>{
      const age = (now - Number(el.dataset.created))/1000;
      if (age >= this.cfg.lifetime){
        this._miss(el, false);
      }
    });

    this._hud();
    this.state.raf = requestAnimationFrame(this._loop.bind(this));
  }

  // ===== Summary & Finish =====
  _buildSummary(){
    const total = this.state.hits + this.state.miss;
    const acc   = total>0? this.state.hits/total : 0;
    let rank    = 'C';
    if(this.state.score>=1600 && acc>=0.95) rank='SSS';
    else if(this.state.score>=1100 && acc>=0.90) rank='S';
    else if(this.state.score>=800  && acc>=0.80) rank='A';
    else if(this.state.score>=500  && acc>=0.60) rank='B';

    return {
      profile: this.profile,
      game: 'shadow-breaker',
      diff: this.diff,
      duration: this.cfg.duration,
      score: this.state.score,
      hits: this.state.hits,
      miss: this.state.miss,
      comboMax: this.state.best,
      accuracy: acc,
      rank,
      device: detectDevice(),
      timestamp: new Date().toISOString()
    };
  }

  async _finish(){
    this.state.play = false;
    cancelAnimationFrame(this.state.raf);
    this.targets.forEach(t=>t.remove());
    this.targets.clear();
    this._msg(this.str.msgEnd);

    const summary = this._buildSummary();
    this._showResult(summary);
    hybridSaveSession(summary,true);
    this._loadLeaderboards(summary.profile);
  }

  _showResult(summary){
    const { box, score, hits, miss, acc, best, rank } = this.result;
    if (!box) return;
    const accVal = Math.round((summary.accuracy||0)*100);

    box.style.display = 'flex';
    if (score) score.textContent = summary.score;
    if (hits)  hits.textContent  = summary.hits;
    if (miss)  miss.textContent  = summary.miss;
    if (acc)   acc.textContent   = accVal + '%';
    if (best)  best.textContent  = 'x' + summary.comboMax;
    if (rank)  rank.textContent  = summary.rank;

    if (this.pdfBtn){
      this.pdfBtn.onclick = ()=>exportPDF(summary);
    }
  }

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

  _bindEvents(){
    document.addEventListener('visibilitychange',()=>{
      if (document.hidden) this.pause(true);
    });
  }
}