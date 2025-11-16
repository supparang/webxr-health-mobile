// === Jump Duck — Research Edition v1.0 ===
// - คำสั่ง: 🆙 Jump / ⬇ Duck / ⏹ Stay
// - ใช้ตรวจการตอบสนอง + การตัดสินใจรวดเร็ว (Reaction & Decision making)
// - Summary format compatible with ShadowBreakerResearch

// ---- CONFIG (เหมือน 2 เกมก่อน) ----
const FIREBASE_API = '';
const SHEET_API    = ''; // ใส่ URL Apps Script
const PDF_API      = ''; // ใส่ URL Apps Script
const LB_API       = '';

const LS_PROFILE = 'jd_profile_v1';
const LS_QUEUE   = 'jd_queue_v1';

// ===== STRINGS =====
const STR = {
  th:{
    msgStart :'พร้อมหรือยัง? เมื่อขึ้นสัญลักษณ์ให้ตอบให้ถูก! 🆙⬇',
    msgPaused:'หยุดพักได้ แต่ผลยังรออยู่ 😄',
    msgResume:'กลับมาลุยกันต่อ! 🔥',
    msgEnd   :'จบการทดสอบแล้ว ⭐',
    cmdUp    :'🆙 กระโดด!',
    cmdDown  :'⬇ ก้ม!',
    cmdStay  :'⏹ ยืนนิ่ง!'
  }
};

// ===== Profile =====
function getProfile(){
  try{ return JSON.parse(localStorage.getItem(LS_PROFILE)); }catch{ return null; }
}
function saveProfile(p){ try{ localStorage.setItem(LS_PROFILE, JSON.stringify(p)); }catch{} }
function ensureProfile(){
  let p = getProfile();
  if (p) return p;
  p = {
    studentId: prompt("Student ID:"),
    name     : prompt("ชื่อที่ใช้ในเกม:"),
    school   : prompt("โรงเรียน / หน่วยงาน:"),
    class    : prompt("ห้องเรียน เช่น ป.5/1:"),
    lang     : "th"
  };
  saveProfile(p);
  return p;
}

// ===== Offline queue =====
function loadQueue(){ try{ return JSON.parse(localStorage.getItem(LS_QUEUE)) || []; }catch{ return []; } }
function saveQueue(q){ try{ localStorage.setItem(LS_QUEUE, JSON.stringify(q)); }catch{} }

async function hybridSaveSession(data, allowQueue=true){
  const body = JSON.stringify(data);
  const headers = { 'Content-Type':'application/json' };

  try{
    const tasks=[];
    if (FIREBASE_API) tasks.push(fetch(FIREBASE_API, {method:'POST', headers, body}));
    if (SHEET_API)    tasks.push(fetch(SHEET_API,    {method:'POST', headers, body}));
    if (tasks.length) await Promise.all(tasks);
  }catch(e){
    if (allowQueue){
      const q = loadQueue(); q.push(data); saveQueue(q);
    }
  }
}

async function exportPDF(data){
  if (!PDF_API){ alert("PDF_API ยังว่าง"); return; }
  const r = await fetch(PDF_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const b = await r.blob();
  const url = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href=url; a.download=`JumpDuck_Report_${data.profile.studentId}.pdf`; a.click();
  URL.revokeObjectURL(url);
}

// ===== Leaderboard =====
async function loadLeaderboard(scope, profile){
  if (!LB_API) return [];
  const url = new URL(LB_API);
  url.searchParams.set('scope', scope);
  url.searchParams.set('school', profile.school);
  url.searchParams.set('class', profile.class);
  const r = await fetch(url.toString());
  return r.json();
}

function device(){
  const ua = navigator.userAgent;
  if (/Quest|Oculus|Pico|Vive|VR/i.test(ua)) return 'VR';
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
  return 'PC';
}

// ===== Command Pattern =====
const COMMANDS = ['jump','duck','stay'];
const ICON = { jump:'🆙', duck:'⬇', stay:'⏹' };

const PATTERN = Array.from({length:25}, ()=> COMMANDS[Math.floor(Math.random()*3)]);

// ===== MAIN CLASS =====
export class JumpDuck{
  constructor(opts){
    this.stage  = opts.stage;
    this.hud    = opts.hud;
    this.result = opts.result;
    this.msgBox = opts.msgBox;
    this.lbBox  = opts.lbBox;
    this.pdfBtn = opts.pdfBtn;

    this.profile = ensureProfile();
    this.str = STR.th;

    const qs = new URLSearchParams(location.search);
    const diff = qs.get('diff') || 'normal';
    const t    = Number(qs.get('time') || 60);

    const DIFF={
      easy   :{duration:t, interval:2.0, good:0.65 },
      normal :{duration:t, interval:1.6, good:0.60 },
      hard   :{duration:t, interval:1.25,good:0.55 }
    };
    this.cfg = DIFF[diff]||DIFF.normal;

    this.state={ play:false, paused:false, elapsed:0, lastTs:0,
      score:0, hits:0, miss:0, combo:0, best:0, idx:0, cmd:''
    };

    this._bindInput();
    this._msg(this.str.msgStart);
  }

  _msg(t){ if(this.msgBox) this.msgBox.textContent=t; }
  _hud(){
    if(this.hud.time)  this.hud.time.textContent = Math.max(0,Math.ceil(this.cfg.duration-this.state.elapsed));
    if(this.hud.score) this.hud.score.textContent = this.state.score;
    if(this.hud.combo) this.hud.combo.textContent = 'x'+this.state.combo;
  }

  start(){
    this.state.play=true;
    this.state.lastTs=0;
    this._nextCommand();
    this.raf=requestAnimationFrame(this._loop.bind(this));
  }

  pause(v=true){
    this.state.paused=v;
    if(v){
      cancelAnimationFrame(this.raf);
      this._msg(this.str.msgPaused);
    }else{
      this._msg(this.str.msgResume);
      this.state.lastTs=0;
      this.raf=requestAnimationFrame(this._loop.bind(this));
    }
  }

  _nextCommand(){
    this.state.cmd = PATTERN[this.state.idx % PATTERN.length];
    this.stage.textContent = ICON[this.state.cmd];
  }

  _handle(action){
    if(!this.state.play || this.state.paused) return;
    const cmd = this.state.cmd;
    if(cmd === action){
      this.state.hits++;
      this.state.combo++;
      this.state.best = Math.max(this.state.best, this.state.combo);
      this.state.score += 20 + (this.state.combo>=5?10:0);
      this._msg(`${ICON[cmd]} ✓`);
    }else{
      this.state.miss++;
      this.state.combo = 0;
      this._msg(`${ICON[cmd]} ✗`);
    }
    this.state.idx++;
    this._hud();
    this._nextCommand();
  }

  _bindInput(){
    // Mobile/PC buttons
    document.addEventListener('keydown', e=>{
      if(e.key==='ArrowUp')   this._handle('jump');
      if(e.key==='ArrowDown') this._handle('duck');
      if(e.key===' ')         this._handle('stay');
    });

    // Touch zones (mobile / VR gaze)
    this.stage.addEventListener('pointerdown', ()=>{
      // tap = stay (design choice)
      this._handle('stay');
    });
  }

  _loop(ts){
    if(!this.state.play || this.state.paused) return;
    if(!this.state.lastTs) this.state.lastTs=ts;
    const dt=(ts-this.state.lastTs)/1000;
    this.state.lastTs=ts;
    this.state.elapsed+=dt;

    if(this.state.elapsed>=this.cfg.duration){
      this._finish();
      return;
    }

    // Auto-advance command every interval
    if(this.state.elapsed >= this.state.idx*this.cfg.interval){
      // ถือว่าพลาดหากยังไม่ตอบ
      this.state.miss++;
      this.state.combo=0;
      this._msg(`${ICON[this.state.cmd]} (Timeout) ✗`);
      this.state.idx++;
      this._hud();
      this._nextCommand();
    }

    this.raf=requestAnimationFrame(this._loop.bind(this));
  }

  _summary(){
    const total=this.state.hits+this.state.miss;
    const acc=total>0 ? this.state.hits/total:0;
    let rank='C';
    if(this.state.score>=550&&acc>=0.95)rank='SSS';
    else if(this.state.score>=420&&acc>=0.90)rank='S';
    else if(this.state.score>=300&&acc>=0.80)rank='A';
    else if(this.state.score>=200&&acc>=0.60)rank='B';

    return {
      profile:this.profile,
      game:'jump-duck',
      duration:this.cfg.duration,
      score:this.state.score,
      hits:this.state.hits,
      miss:this.state.miss,
      comboMax:this.state.best,
      accuracy:acc,
      rank,
      device:device(),
      timestamp:new Date().toISOString()
    };
  }

  async _finish(){
    this.state.play=false;
    cancelAnimationFrame(this.raf);
    this._msg(this.str.msgEnd);

    const data=this._summary();
    this._showResult(data);
    hybridSaveSession(data,true);
    this._loadLeaderboards();
  }

  _showResult(data){
    const r=this.result;
    r.box.style.display='flex';
    r.score.textContent=data.score;
    r.hits.textContent=data.hits;
    r.miss.textContent=data.miss;
    r.acc.textContent=Math.round(data.accuracy*100)+'%';
    r.best.textContent='x'+data.comboMax;
    r.rank.textContent=data.rank;
    this.pdfBtn.onclick=()=>exportPDF(data);
  }

  async _loadLeaderboards(){
    if(!this.lbBox)return;
    try{
      const [a,b]=await Promise.all([
        loadLeaderboard('school',this.profile),
        loadLeaderboard('class', this.profile)
      ]);
      this.lbBox.innerHTML = '<h4>อันดับในโรงเรียน</h4>';
      this.lbBox.appendChild(this._lb(a));
      this.lbBox.innerHTML += '<h4>อันดับในห้องเรียน</h4>';
      this.lbBox.appendChild(this._lb(b));
    }catch(e){}
  }

  _lb(rows){
    const t=document.createElement('table');
    t.style.width='100%';
    t.innerHTML='<tr><th>#</th><th>ชื่อ</th><th>คะแนน</th><th>แม่น</th></tr>';
    (rows||[]).slice(0,10).forEach((r,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${i+1}</td><td>${r.name}</td><td>${r.score}</td><td>${Math.round((r.accuracy||0)*100)}%</td>`;
      t.appendChild(tr);
    });
    return t;
  }
}