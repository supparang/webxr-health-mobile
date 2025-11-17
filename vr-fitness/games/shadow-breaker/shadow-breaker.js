// === Shadow Breaker — v3.0 (Boss 4 ตัว + Coach พุ่งพูดเก่ง + Emoji Targets) ======
// - เป้าเป็น emoji (🥊⚡⭐🔥) + เอฟเฟ็กต์ CRITICAL / FEVER
// - โค้ชพุ่งพูดระหว่างเล่น (คอมโบ, FEVER, MISS, จบเกม)
// - เพิ่ม BOSS 4 ตัว ต่อ 1 รอบ จากง่ายไปยาก
//   • Boss 1  : ง่ายสุด
//   • Boss 2–3: กลาง ๆ
//   • Boss 4  : แข็งสุด ต้องแตะหลายที
// ============================================================================

const FIREBASE_API = '';
const SHEET_API    = '';
const PDF_API      = '';
const LB_API       = '';

const LS_PROFILE = 'fitness_profile_v1';
const LS_QUEUE   = 'fitness_offline_queue_v1';

// ข้อความหลัก
const STR = {
  th: {
    msgReady : 'โค้ชพุ่ง: เตรียมกำหมัด! เดี๋ยวเป้าจะโผล่มาทั่วจอเลย 🐰🥊',
    msgGo    : 'GO! แตะ/คลิกให้ทัน ยิ่งไว คอมโบยิ่งพุ่ง! ⚡',
    msgPaused: 'พักแขนแป๊บนึง ดื่มน้ำ หายใจลึก ๆ นะ 😄',
    msgResume: 'ลุยต่อ! ล่าคอมโบให้ถึง FEVER กันเลย! 🔥',
    msgEnd   : 'จบรอบแล้ว! มาดูพลังหมัดของเรากัน 🎉'
  }
};

// ประโยคโค้ชพุ่ง
const COACH_LINES = {
  hitStreak: [
    'โค้ชพุ่ง: คอมโบกำลังมา อย่าพลาดละ! ⚡',
    'โค้ชพุ่ง: หมัดรัวแบบนี้แหละ ของจริง! 🥊',
    'โค้ชพุ่ง: เป้าไหนโผล่มา ก็โดนหมดเลยนะ! 😎'
  ],
  fever: [
    'โค้ชพุ่ง: FEVER PUNCH!! ต่อยให้สุดพลังไปเลย! 🔥',
    'โค้ชพุ่ง: โหมดไฟลุกแล้ว ห้ามช้าซักเป้า! 🔥⚡',
    'โค้ชพุ่ง: หมัดทองของแท้ FEVER มาแล้ว! ✨'
  ],
  miss: [
    'โค้ชพุ่ง: พลาดนิดเดียวเอง ลองใหม่เดี๋ยวก็ได้คอมโบต่อ 😄',
    'โค้ชพุ่ง: เป้าหนีทัน ไม่เป็นไร เดี๋ยวเราตามทัน! 💪',
    'โค้ชพุ่ง: หายใจลึก ๆ แล้วลุยต่อได้เลย! 🐰'
  ],
  // บอส
  bossIntro: [
    'โค้ชพุ่ง: ระวัง! บอสกำลังโผล่มา ลองตีให้สุดแรงดู! 👀',
    'โค้ชพุ่ง: บอสมาแล้ว! ต่อยรัว ๆ เลย! 💥'
  ],
  bossClearEasy: [
    'โค้ชพุ่ง: บอสตัวแรก ร่วงสวยงามมาก! 🐣✨',
    'โค้ชพุ่ง: โอเคเลย! บอสยังสู้หมัดเราไม่ได้! 😄'
  ],
  bossClearHard: [
    'โค้ชพุ่ง: บอสใหญ่ยังโดนหมัดเราแตก! แชมป์ชัด ๆ 🏆',
    'โค้ชพุ่ง: สุดยอด! หมัดระดับแชมเปียนต่อยบอสไม่เหลือ! 🔥'
  ],
  // สรุปท้ายเกม
  finalGood: [
    'โค้ชพุ่ง: โหดมาก! หมัดระดับแชมป์เลยแบบนี้ 🏆',
    'โค้ชพุ่ง: คะแนนนี้คุณหมอก็ต้องกดไลก์ให้แล้วละ! 😄',
    'โค้ชพุ่ง: สุดยอดดดด ป.5 สายหมัดไฟต้องคนนี้เลย! 🔥'
  ],
  finalOk: [
    'โค้ชพุ่ง: ดีมาก! ถ้าซ้อมอีกนิด คอมโบจะพุ่งกว่านี้แน่นอน 💪',
    'โค้ชพุ่ง: ใกล้ถึงระดับแชมป์แล้ว อีกนิดเดียวเอง! ⭐',
    'โค้ชพุ่ง: รอบหน้าลองรักษาคอมโบให้นานขึ้นนะ! ⚡'
  ],
  finalBad: [
    'โค้ชพุ่ง: รอบนี้เหมือนวอร์มร่างกาย รอบหน้าลุยจริง! 🔁',
    'โค้ชพุ่ง: หมัดยังไม่สุด ลองใหม่อีกรอบได้เลย! 🥊',
    'โค้ชพุ่ง: ไม่เป็นไร ซ้อมเยอะ ๆ เดี๋ยวหมัดจะคมเอง 😄'
  ]
};

// ---------- Profile ---------------------------------------------------------
function getProfile(){
  try{ const raw = localStorage.getItem(LS_PROFILE); return raw ? JSON.parse(raw) : null; }
  catch{ return null; }
}
function saveProfile(p){ try{ localStorage.setItem(LS_PROFILE, JSON.stringify(p)); }catch{} }
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

// ---------- SFX (optional) --------------------------------------------------
const SFX = (() => {
  function load(src){ if(!src) return null; const a=new Audio(src); a.preload='auto'; return a; }
  const hitS   = load('./sfx/ding-good.mp3');
  const missS  = load('./sfx/ding-bad.mp3');
  const feverS = load('./sfx/fever.mp3');
  const endS   = load('./sfx/end.mp3');
  return {
    hit(){ try{ if(hitS){ hitS.currentTime=0; hitS.play(); } }catch{} },
    miss(){ try{ if(missS){ missS.currentTime=0; missS.play(); } }catch{} },
    fever(){ try{ if(feverS){ feverS.currentTime=0; feverS.play(); } }catch{} },
    end(){ try{ if(endS){ endS.currentTime=0; endS.play(); } }catch{} }
  };
})();

// ---------- Hybrid Save -----------------------------------------------------
function loadQueue(){ try{ const raw=localStorage.getItem(LS_QUEUE); return raw?JSON.parse(raw):[];}catch{return[];} }
function saveQueue(q){ try{ localStorage.setItem(LS_QUEUE, JSON.stringify(q)); }catch{} }

async function flushQueue(){
  const q = loadQueue(); if(!q.length) return;
  const remain = [];
  for (const item of q){
    try{ await hybridSaveSession(item,false); }catch{ remain.push(item); }
  }
  saveQueue(remain);
}
async function hybridSaveSession(summary, allowQueue=true){
  const body = JSON.stringify(summary);
  const headers = { 'Content-Type':'application/json' };
  let ok = true;
  try{
    const tasks = [];
    if (FIREBASE_API) tasks.push(fetch(FIREBASE_API,{method:'POST',headers,body}));
    if (SHEET_API)    tasks.push(fetch(SHEET_API   ,{method:'POST',headers,body}));
    if (tasks.length) await Promise.all(tasks);
  }catch(e){ console.warn('ShadowBreaker save fail',e); ok=false; }
  if (!ok && allowQueue){ const q=loadQueue(); q.push(summary); saveQueue(q); }
}

// ---------- CSV / PDF -------------------------------------------------------
async function exportPDF(summary){
  if (!PDF_API){ alert('ยังไม่ได้ตั้งค่า PDF_API'); return; }
  try{
    const res = await fetch(PDF_API,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(summary)
    });
    if(!res.ok) throw new Error('PDF API error');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`ShadowBreaker_${summary.profile.studentId||'user'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){ console.error(e); alert('สร้าง PDF ไม่สำเร็จ'); }
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
    p.studentId||'', p.name||'', p.school||'', p.class||'',
    summary.game, summary.diff||'', summary.score??'',
    summary.hits??'', summary.miss??'',
    (summary.accuracy*100).toFixed(1),
    summary.comboMax??'',
    summary.notesPerMin!=null?summary.notesPerMin.toFixed(2):'',
    summary.rank||'', summary.device||''
  ];
  const csv = headers.join(',')+'\n'+row.join(',');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`ShadowBreaker_${p.studentId||'user'}_${summary.timestamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Helpers ---------------------------------------------------------
function detectDevice(){
  const ua = navigator.userAgent||'';
  if(/Quest|Oculus|Pico|Vive|VR/i.test(ua)) return 'VR';
  if(/Mobile|Android|iPhone/i.test(ua))     return 'Mobile';
  return 'PC';
}
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function rand(a,b){ return a + Math.random()*(b-a); }

// ---------- Config ----------------------------------------------------------
const DIFF = {
  easy:   { baseScore:12, critBonus:10, missPenalty:10, ttl:1200, spawn:550, size:[64,86]  },
  normal: { baseScore:14, critBonus:12, missPenalty:12, ttl:1050, spawn:460, size:[56,80]  },
  hard:   { baseScore:16, critBonus:16, missPenalty:14, ttl: 900, spawn:380, size:[48,72]  }
};

const FEVER_COMBO = 5;
const FEVER_MULT  = 1.5;
const FEVER_SPAWN = 0.8;
const CRIT_RATIO  = 0.35;

// เป้าเป็น emoji
const ICONS_NORMAL = ['🥊','✨','⭐','⚡'];
const ICONS_FEVER  = ['🔥','💥','🌟','⚡'];

// Boss 4 ตัว (เวลาที่จะออกคิดเป็นสัดส่วนของรอบ)
const BOSS_DEFS = [
  { id:1, at:0.18, hp:5, icon:'🐣', label:'BOSS 1', bonus:120 },
  { id:2, at:0.38, hp:8, icon:'🐯', label:'BOSS 2', bonus:180 },
  { id:3, at:0.62, hp:12, icon:'🐲', label:'BOSS 3', bonus:260 },
  { id:4, at:0.82, hp:16, icon:'👑', label:'BOSS 4', bonus:360 }
];

// ===========================================================================
//  ShadowBreaker class
// ===========================================================================
export class ShadowBreaker {
  constructor(opts){
    this.arena   = opts.arena;
    this.hud     = opts.hud||{};
    this.msgBox  = opts.msgBox||null;
    this.result  = opts.result||{};
    this.csvBtn  = opts.csvBtn||null;
    this.pdfBtn  = opts.pdfBtn||null;

    if(!this.arena){ alert('Shadow Breaker: ไม่พบพื้นที่ arena'); return; }

    this.profile = ensureProfile();
    this.str = STR.th;

    const qs = new URLSearchParams(location.search);
    const diff = qs.get('diff') || 'normal';
    const mode = qs.get('mode') || 'timed';
    const t    = parseInt(qs.get('time')||'90',10);

    this.diffName  = DIFF[diff]?diff:'normal';
    this.mode      = mode;
    this.timeLimit = isNaN(t)?90:t;
    this.cfg       = DIFF[this.diffName];

    this.state = {
      running:false, paused:false,
      elapsed:0, lastTs:0, timeLeft:this.timeLimit,
      score:0, hits:0, miss:0, combo:0, bestCombo:0, fever:false
    };

    // เป้าเล็ก ๆ
    this.targets = [];
    this.spawnTimer = 0;          // วินาที
    this.lastCoachTalk = 0;       // วินาที

    // BOSS
    this.bossDefs  = BOSS_DEFS;
    this.bossDone  = this.bossDefs.map(()=>false);
    this.bossActive= false;
    this.bossIndex = -1;
    this.bossHp    = 0;
    this.bossHpMax = 0;
    this.bossEl    = null;
    this.bossBar   = null;
    this.bossWrap  = null;

    this.coachBox = document.querySelector('.coach-line') || null;

    flushQueue();
    this._buildScene();
    this._bind();
    this._msg(this.str.msgReady);
    this._hud();
  }

  // ----- UI / Coach ---------------------------------------------------------
  _msg(t){
    if(this.msgBox)  this.msgBox.textContent  = t;
    if(this.coachBox) this.coachBox.textContent = t;
  }

  _coach(type){
    const lines = COACH_LINES[type];
    if(!lines || !lines.length) return;
    const now = this.state ? this.state.elapsed : 0;
    const MIN_INTERVAL = 3; // โค้ชจะไม่พูดถี่เกินไป
    if(now - this.lastCoachTalk < MIN_INTERVAL) return;
    this.lastCoachTalk = now;
    const msg = lines[Math.floor(Math.random()*lines.length)];
    this._msg(msg);
  }

  _hud(){
    if(this.hud.time)  this.hud.time.textContent  = Math.max(0, Math.ceil(this.state.timeLeft));
    if(this.hud.score) this.hud.score.textContent = this.state.score;
    if(this.hud.hits)  this.hud.hits.textContent  = this.state.hits;
    if(this.hud.miss)  this.hud.miss.textContent  = this.state.miss;
    if(this.hud.combo) this.hud.combo.textContent = 'x'+this.state.combo;
  }

  _buildScene(){
    this.arena.style.position = 'relative';
    this.arena.style.overflow = 'hidden';

    // โค้ชพุ่งมุมซ้ายบน
    const coach = document.createElement('div');
    coach.style.position='absolute';
    coach.style.left='12px';
    coach.style.top ='10px';
    coach.style.display='flex';
    coach.style.alignItems='center';
    coach.style.gap='6px';
    coach.style.padding='4px 10px';
    coach.style.borderRadius='999px';
    coach.style.background='rgba(15,23,42,0.85)';
    coach.style.border='1px solid rgba(129,140,248,0.9)';
    coach.style.fontSize='13px';
    coach.style.zIndex='5';
    coach.innerHTML='<span>🐰</span><span>โค้ชพุ่ง</span>';
    this.arena.appendChild(coach);

    // HUD ของ BOSS มุมขวาบน
    const wrap = document.createElement('div');
    wrap.style.position='absolute';
    wrap.style.right='12px';
    wrap.style.top ='10px';
    wrap.style.minWidth='120px';
    wrap.style.padding='4px 8px 6px';
    wrap.style.borderRadius='12px';
    wrap.style.background='rgba(15,23,42,0.9)';
    wrap.style.border='1px solid rgba(248,250,252,0.6)';
    wrap.style.fontSize='11px';
    wrap.style.display='none';
    wrap.style.zIndex='6';

    const title = document.createElement('div');
    title.textContent = 'BOSS';
    title.style.fontWeight='700';
    title.style.marginBottom='2px';
    title.style.display='flex';
    title.style.justifyContent='space-between';
    title.style.alignItems='center';
    const bossNameSpan = document.createElement('span');
    bossNameSpan.id = 'sbBossName';
    bossNameSpan.textContent = '';
    title.appendChild(bossNameSpan);

    const barOuter = document.createElement('div');
    barOuter.style.width='100%';
    barOuter.style.height='8px';
    barOuter.style.borderRadius='999px';
    barOuter.style.background='rgba(15,23,42,0.9)';
    barOuter.style.border='1px solid rgba(248,113,113,0.8)';
    barOuter.style.overflow='hidden';

    const barInner = document.createElement('div');
    barInner.style.height='100%';
    barInner.style.width='100%';
    barInner.style.borderRadius='999px';
    barInner.style.background='linear-gradient(90deg,#f97316,#ef4444)';
    barOuter.appendChild(barInner);

    wrap.appendChild(title);
    wrap.appendChild(barOuter);
    this.arena.appendChild(wrap);

    this.bossWrap = wrap;
    this.bossBar  = barInner;
  }

  _bind(){
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden) this.pause(true);
    });
  }

  // ----- Control ------------------------------------------------------------
  start(){
    if(this.state.running) return;
    this.state.running = true;
    this.state.paused  = false;
    this.state.elapsed = 0;
    this.state.timeLeft= this.timeLimit;
    this.state.score   = 0;
    this.state.hits    = 0;
    this.state.miss    = 0;
    this.state.combo   = 0;
    this.state.bestCombo=0;
    this.state.fever   = false;
    this.targets.length = 0;
    this.spawnTimer = 0;
    this.lastCoachTalk = 0;
    this.bossDone  = this.bossDefs.map(()=>false);
    this.bossActive= false;
    this.bossIndex = -1;
    this.bossHp    = 0;
    this.bossHpMax = 0;
    if(this.bossWrap){
      this.bossWrap.style.display='none';
    }
    if(this.bossEl){
      this.bossEl.remove();
      this.bossEl=null;
    }

    this._hud();
    this._msg(this.str.msgGo);

    // เป้าแรกโผล่ทันที
    this._spawnTarget();

    this.state.lastTs = performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  pause(v=true){
    if(!this.state.running) return;
    this.state.paused = v;
    this._msg(v?this.str.msgPaused:this.str.msgResume);
    if(!v){
      this.state.lastTs = performance.now();
      requestAnimationFrame(this._loop.bind(this));
    }
  }

  // ----- Loop ---------------------------------------------------------------
  _loop(ts){
    if(!this.state.running || this.state.paused) return;

    const last = this.state.lastTs||ts;
    this.state.lastTs = ts;
    const dt = (ts - last)/1000;       // วินาที
    if (dt <= 0) { requestAnimationFrame(this._loop.bind(this)); return; }

    this.state.elapsed  += dt;
    this.state.timeLeft  = clamp(this.timeLimit - this.state.elapsed, 0, 1e9);

    const progress = this.timeLimit > 0 ? this.state.elapsed / this.timeLimit : 0;

    // Trigger Boss ตาม progress
    if (!this.bossActive) {
      for (let i=0;i<this.bossDefs.length;i++){
        const def = this.bossDefs[i];
        if (!this.bossDone[i] && progress >= def.at){
          this._startBoss(i);
          break;
        }
      }
    }

    // spawn ปกติ ถ้าไม่ได้สู้บอส
    if (!this.bossActive){
      const baseSpawn = this.cfg.spawn/1000;
      const effSpawn  = this.state.fever ? baseSpawn*FEVER_SPAWN : baseSpawn;
      this.spawnTimer += dt;
      while (this.spawnTimer >= effSpawn){
        this.spawnTimer -= effSpawn;
        this._spawnTarget();
      }
    }

    // update targets (หมดเวลา = MISS)
    const now = performance.now();
    for(let i=this.targets.length-1;i>=0;i--){
      const tg = this.targets[i];
      const age = (now - tg.born);
      if (age >= tg.ttl){
        if (!tg.clicked) this._onMiss(tg);
        tg.el.remove();
        this.targets.splice(i,1);
      }
    }

    this._hud();
    this._updateBossHud();

    if (this.state.timeLeft <= 0){
      this._finish();
      return;
    }

    requestAnimationFrame(this._loop.bind(this));
  }

  // ----- Spawn เป้าเล็ก (emoji) -------------------------------------------
  _spawnTarget(){
    const el = document.createElement('button');
    el.type='button';
    el.className='sb-target';

    const size = Math.round(rand(this.cfg.size[0], this.cfg.size[1]));
    el.style.position='absolute';
    el.style.width=size+'px';
    el.style.height=size+'px';
    el.style.borderRadius='50%';
    el.style.cursor='pointer';
    el.style.userSelect='none';
    el.style.display='flex';
    el.style.alignItems='center';
    el.style.justifyContent='center';
    el.style.lineHeight='1';

    const isFever = this.state && this.state.fever;
    if(isFever){
      el.style.background='radial-gradient(circle at 30% 30%,#fed7aa,#f97316)';
      el.style.border='2px solid rgba(254,240,138,0.95)';
      el.style.boxShadow='0 0 24px rgba(251,191,36,0.95)';
    }else{
      el.style.background=Math.random()<0.5
        ?'radial-gradient(circle at 30% 30%,#e0f2fe,#3b82f6)'
        :'radial-gradient(circle at 70% 30%,#fee2e2,#fb7185)';
      el.style.border='2px solid rgba(248,250,252,0.9)';
      el.style.boxShadow='0 6px 20px rgba(0,0,0,0.35)';
    }

    const icons = isFever ? ICONS_FEVER : ICONS_NORMAL;
    const icon  = icons[Math.floor(Math.random()*icons.length)];
    el.textContent = icon;
    el.style.fontSize = Math.round(size*0.6)+'px';
    el.style.textShadow='0 0 8px rgba(15,23,42,0.9)';

    const pad = 16;
    const rect = this.arena.getBoundingClientRect();
    const maxX = Math.max(pad, rect.width - size - pad);
    const maxY = Math.max(pad, rect.height - size - pad);
    const x = rand(pad, maxX);
    const y = rand(pad, maxY);
    el.style.left=x+'px';
    el.style.top =y+'px';

    el.animate(
      [{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],
      {duration:1000,iterations:1}
    );

    this.arena.appendChild(el);

    const tg = { el, born: performance.now(), ttl: this.cfg.ttl, clicked:false };
    const onClick = (ev)=>{
      ev.stopPropagation();
      if(tg.clicked) return;
      tg.clicked=true;
      this._onHit(tg);
      el.remove();
      const idx=this.targets.indexOf(tg);
      if(idx>=0) this.targets.splice(idx,1);
    };
    el.addEventListener('pointerdown', onClick, {once:true});

    this.targets.push(tg);
  }

  // ----- Boss ---------------------------------------------------------------
  _startBoss(idx){
    const def = this.bossDefs[idx];
    this.bossActive = true;
    this.bossIndex  = idx;
    this.bossHpMax  = def.hp;
    this.bossHp     = def.hp;

    // แสดงแถบ BOSS
    if(this.bossWrap){
      this.bossWrap.style.display='block';
      const nameSpan = this.bossWrap.querySelector('#sbBossName');
      if(nameSpan) nameSpan.textContent = def.label;
    }
    this._updateBossHud();

    // สร้างตัวบอสกลางจอ
    if(this.bossEl){
      this.bossEl.remove();
    }
    const el = document.createElement('button');
    el.type='button';
    el.className='sb-boss';
    el.style.position='absolute';
    el.style.left='50%';
    el.style.top ='52%';
    el.style.transform='translate(-50%,-50%)';
    el.style.width='min(220px,60vw)';
    el.style.height='min(220px,60vw)';
    el.style.borderRadius='50%';
    el.style.border='3px solid rgba(248,250,252,0.98)';
    el.style.background='radial-gradient(circle at 30% 30%,#fed7aa,#f97316)';
    el.style.boxShadow='0 0 36px rgba(248,250,252,0.9), 0 0 80px rgba(250,204,21,0.7)';
    el.style.display='flex';
    el.style.alignItems='center';
    el.style.justifyContent='center';
    el.style.fontSize='64px';
    el.style.textShadow='0 0 16px rgba(15,23,42,0.9)';
    el.style.cursor='pointer';
    el.style.zIndex='20';

    el.textContent = def.icon;

    el.animate(
      [
        {transform:'translate(-50%,-50%) scale(0.4)', opacity:0},
        {transform:'translate(-50%,-50%) scale(1.05)', opacity:1},
        {transform:'translate(-50%,-50%) scale(1)', opacity:1}
      ],
      {duration:450,iterations:1,easing:'ease-out'}
    );

    el.addEventListener('pointerdown',(ev)=>{
      ev.stopPropagation();
      this._hitBoss(def);
    });

    this.arena.appendChild(el);
    this.bossEl = el;

    this._coach('bossIntro');
    this._screenShake(6,false);
  }

  _updateBossHud(){
    if(!this.bossWrap || !this.bossBar) return;
    if(!this.bossActive){
      // ถ้าไม่มีบอสแต่ยังไม่เคลียร์ครบทั้ง 4 ตัว ให้ซ่อน
      if (this.bossIndex < 0 || this.bossIndex >= this.bossDefs.length) {
        this.bossWrap.style.display='none';
      }
      return;
    }
    const pct = this.bossHpMax ? (this.bossHp/this.bossHpMax)*100 : 0;
    this.bossBar.style.width = clamp(pct,0,100)+'%';
  }

  _hitBoss(def){
    if(!this.bossActive) return;
    if(this.bossHp<=0) return;

    // ทุกตาที่ตีบอส นับเป็น hit + combo เช่นเดียวกับเป้าเล็ก
    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    // ดาเมจ 1 ต่อครั้ง
    this.bossHp = Math.max(0, this.bossHp - 1);
    const isLast = (this.bossHp === 0);

    // คะแนน: ตีแต่ละครั้งได้ baseScore + เน้นเพิ่มโบนัสตอนฆ่า
    let gain = this.cfg.baseScore * 2;  // Base ต่อหมัดที่โดนบอส
    if(this.state.fever) gain = Math.round(gain * FEVER_MULT);
    this.state.score += gain;

    this._hud();
    this._updateBossHud();

    // เอฟเฟ็กต์
    this._screenShake(isLast?18:10,false);
    this._hitFloat(isLast ? `BOSS DOWN +${def.bonus}` : `BOSS HIT +${gain}`, true);
    SFX.hit();

    if(isLast){
      // โบนัสเพิ่มเมื่อจัดการบอสสำเร็จ
      this.state.score += def.bonus;
      this.bossDone[this.bossIndex] = true;

      // FEVER หลังชนะบอส (รับประกัน)
      this.state.fever = true;
      this._showFeverFx();
      if (def.id >= 3) this._coach('bossClearHard');
      else            this._coach('bossClearEasy');
      SFX.fever();

      // ลบตัวบอส
      if(this.bossEl){
        this.bossEl.animate(
          [
            {transform:'translate(-50%,-50%) scale(1)', opacity:1},
            {transform:'translate(-50%,-50%) scale(1.08)', opacity:1},
            {transform:'translate(-50%,-50%) scale(0.4)', opacity:0}
          ],
          {duration:400,iterations:1,easing:'ease-in'}
        );
        setTimeout(()=>{
          if(this.bossEl){ this.bossEl.remove(); this.bossEl=null; }
        },380);
      }

      // จบบอสแล้วกลับไป spawn เป้าปกติ
      this.bossActive = false;
      // ทิ้งแถบไว้สักครู่แล้วค่อยซ่อน
      setTimeout(()=>{
        if(this.bossWrap && !this.bossActive){
          this.bossWrap.style.display='none';
        }
      }, 800);
    }else{
      // ระหว่างสู้บอส ถ้าคอมโบสูง ๆ ให้พูดหน่อย
      if (this.state.combo === 3 || this.state.combo === 7) {
        this._coach('hitStreak');
      }
    }
  }

  // ----- Hit / Miss เป้าเล็ก ----------------------------------------------
  _onHit(tg){
    const now = performance.now();
    const age = now - tg.born;
    const crit = (age/tg.ttl) <= CRIT_RATIO;

    let gain = this.cfg.baseScore + (crit ? this.cfg.critBonus : 0);
    if(this.state.fever) gain = Math.round(gain*FEVER_MULT);

    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    if (!this.state.fever && this.state.combo >= FEVER_COMBO){
      this.state.fever = true;
      this._showFeverFx();
      SFX.fever();
      this._coach('fever');
    } else if (this.state.combo === 3 || this.state.combo === 7) {
      this._coach('hitStreak');
    }

    this.state.score += gain;
    this._hud();

    this._screenShake(crit?12:7);
    this._hitFloat(crit?`CRITICAL +${gain}`:`+${gain}`, crit);
    SFX.hit();
  }

  _onMiss(tg){
    this.state.miss++;
    this.state.combo = 0;
    this.state.fever = false;
    this.state.score = Math.max(0, this.state.score - this.cfg.missPenalty);
    this._hud();

    this._screenShake(10,true);
    this._hitFloat('MISS',true);
    SFX.miss();
    this._coach('miss');
  }

  // ----- FX -----------------------------------------------------------------
  _screenShake(px=8,isBad=false){
    const a=this.arena;
    a.animate(
      [
        {transform:'translate(0,0)'},
        {transform:`translate(${px}px,0)`},
        {transform:`translate(${-px}px,0)`},
        {transform:'translate(0,0)'}
      ],
      {duration:140,iterations:1,easing:'ease-out'}
    );
    a.style.boxShadow=isBad
      ?'0 0 22px rgba(248,113,113,0.9)'
      :'0 0 22px rgba(129,140,248,0.9)';
    setTimeout(()=>{a.style.boxShadow='';},120);
  }

  _hitFloat(text,isGoldOrBad){
    const r=this.arena.getBoundingClientRect();
    const x=r.left+r.width*0.5;
    const y=r.top +r.height*0.28;
    const fx=document.createElement('div');
    fx.textContent=text;
    fx.style.position='fixed';
    fx.style.left=x+'px'; fx.style.top=y+'px';
    fx.style.transform='translate(-50%,-50%)';
    fx.style.zIndex='9999';
    fx.style.fontSize='22px';
    fx.style.fontWeight='900';
    fx.style.letterSpacing='0.05em';
    fx.style.color=text.startsWith('MISS')
      ?'#fb7185'
      :(text.startsWith('BOSS') || text.startsWith('CRITICAL') ? '#facc15' : '#4ade80');
    fx.style.textShadow='0 0 12px rgba(15,23,42,0.95)';
    fx.style.pointerEvents='none';
    fx.style.animation='sbHitFloat 0.55s ease-out forwards';
    document.body.appendChild(fx);
    setTimeout(()=>fx.remove(),600);
  }

  _showFeverFx(){
    const el=document.createElement('div');
    el.textContent='FEVER PUNCH!!';
    el.style.position='fixed';
    el.style.left='50%'; el.style.top='18%';
    el.style.transform='translate(-50%,-50%)';
    el.style.zIndex='9999';
    el.style.fontSize='32px';
    el.style.fontWeight='900';
    el.style.letterSpacing='0.16em';
    el.style.color='#facc15';
    el.style.textShadow='0 0 18px rgba(250,204,21,0.95)';
    el.style.animation='feverFlash 0.7s ease-out forwards';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),740);
  }

  // ----- Summary / Finish ---------------------------------------------------
  _buildSummary(){
    const total=this.state.hits+this.state.miss;
    const acc  = total>0?this.state.hits/total:0;
    const duration=this.state.elapsed||this.timeLimit;
    const notesPerSec = duration>0?total/duration:0;
    const notesPerMin = notesPerSec*60;

    let rank='C';
    if(this.state.score>=1200 && acc>=0.95) rank='SSS';
    else if(this.state.score>=900 && acc>=0.90) rank='S';
    else if(this.state.score>=650 && acc>=0.80) rank='A';
    else if(this.state.score>=420 && acc>=0.65) rank='B';

    return {
      profile:this.profile,
      game:'shadow-breaker',
      diff:this.diffName,
      duration,
      score:this.state.score,
      hits:this.state.hits,
      miss:this.state.miss,
      comboMax:this.state.bestCombo,
      accuracy:acc,
      notesPerSec,
      notesPerMin,
      rank,
      device:detectDevice(),
      timestamp:new Date().toISOString()
    };
  }

  async _finish(){
    this.state.running=false;
    this._hud();
    this._msg(this.str.msgEnd);
    SFX.end();

    const ripple=document.createElement('div');
    ripple.className='sb-finish-ripple';
    document.body.appendChild(ripple);
    setTimeout(()=>ripple.remove(),600);

    const summary=this._buildSummary();

    // ให้โค้ชพุ่งคอมเมนต์ตามระดับ Rank
    let t='finalBad';
    if(summary.rank==='SSS' || summary.rank==='S') t='finalGood';
    else if(summary.rank==='A' || summary.rank==='B') t='finalOk';
    this._coach(t);

    const ok=this._showResult(summary);
    if(!ok){
      const acc=(summary.accuracy*100).toFixed(1);
      alert(`Shadow Breaker Result
Score: ${summary.score}
Hits: ${summary.hits}
Miss: ${summary.miss}
Accuracy: ${acc}%
Best Combo: x${summary.comboMax}
Rank: ${summary.rank}`);
    }
    try{ await hybridSaveSession(summary,true); }catch(e){ console.warn('save error',e); }

    // เคลียร์บอสเผื่อจอค้าง
    if(this.bossEl){ this.bossEl.remove(); this.bossEl=null; }
  }

  _showResult(summary){
    const box=this.result.box || document.getElementById('sbResultCard');
    const sc =this.result.score|| document.getElementById('sbScore');
    const h  =this.result.hits || document.getElementById('sbHits');
    const m  =this.result.miss || document.getElementById('sbMiss');
    const ac =this.result.acc  || document.getElementById('sbAcc');
    const bc =this.result.best || document.getElementById('sbBest');
    const rk =this.result.rank || document.getElementById('sbRank');
    if(!box) return false;
    box.style.display='flex';

    const acc = Math.round((summary.accuracy||0)*100);
    if(sc) sc.textContent = summary.score;
    if(h)  h.textContent  = summary.hits;
    if(m)  m.textContent  = summary.miss;
    if(ac) ac.textContent = acc+'%';
    if(bc) bc.textContent = 'x'+summary.comboMax;
    if(rk) rk.textContent = summary.rank;

    const csvBtn=this.csvBtn||document.getElementById('sbCsvBtn');
    const pdfBtn=this.pdfBtn||document.getElementById('sbPdfBtn');
    if(csvBtn) csvBtn.onclick=()=>downloadCSVRow(summary);
    if(pdfBtn) pdfBtn.onclick=()=>exportPDF(summary);

    return true;
  }
}