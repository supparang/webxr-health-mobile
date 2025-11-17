// === Shadow Breaker — PRODUCTION v4.2 ================================
// Features:
// - Boss 4 ตัว: Warm-up Cone, Speed Bag, Shadow Clone, Golden Champion
// - FEVER, CRITICAL, Screen Shake, Coach lines (TH+EN)
// - Hybrid Save: API (Firebase/Sheet) + Offline Queue + CSV/PDF Export
// - Profile + Site/Room/Session metadata for research
// - Per-Boss metrics (hits/miss/duration) สำหรับงานวิจัยแพทย์
// - setLanguage(lang) สำหรับปุ่มสลับภาษา TH/EN + coach badge
// =====================================================================

// ---------- Global Config (override ได้ด้วย window.__SB_CONFIG) -------------
const DEFAULT_CONFIG = {
  firebaseApi   : '',
  sheetApi      : '',
  pdfApi        : '',
  leaderboardApi: '',
  siteId        : '',  // เช่น โรงพยาบาล/โรงเรียน
  roomId        : '',  // เช่น ห้อง ป.5/1
  sessionTag    : ''   // เช่น "pretest", "posttest"
};

function loadConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  try {
    if (window.__SB_CONFIG && typeof window.__SB_CONFIG === 'object') {
      cfg = { ...cfg, ...window.__SB_CONFIG };
    }
  } catch(e){}
  return cfg;
}

const SB_CFG = loadConfig();

// ---------- LocalStorage Keys ----------------------------------------------
const LS_PROFILE = 'fitness_profile_v1';
const LS_QUEUE   = 'fitness_offline_queue_v1';

// ---------- Localization ----------------------------------------------------
const STR = {
  th: {
    msgReady : 'โค้ชพุ่ง: เตรียมกำหมัด! เดี๋ยวเป้าจะโผล่มาทั่วจอเลย 🐰🥊',
    msgGo    : 'GO! แตะ/คลิกให้ทัน ยิ่งไว คอมโบยิ่งพุ่ง! ⚡',
    msgPaused: 'พักแขนแป๊บนึง ดื่มน้ำ หายใจลึก ๆ นะ 😄',
    msgResume: 'ลุยต่อ! ล่าคอมโบให้ถึง FEVER กันเลย! 🔥',
    msgEnd   : 'จบรอบแล้ว! มาดูพลังหมัดของเรากัน 🎉'
  },
  en: {
    msgReady : 'Coach Pung: Get your fists ready! Targets will pop up everywhere 🐰🥊',
    msgGo    : 'GO! Tap/punch in time, keep your combo up! ⚡',
    msgPaused: 'Short break! Drink some water and breathe 😄',
    msgResume: 'Back to the ring! Let’s push to FEVER! 🔥',
    msgEnd   : 'Round finished! Let’s see your punching power 🎉'
  }
};

const COACH_LINES = {
  th: {
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
  },
  en: {
    hitStreak: [
      'Coach: Combo is climbing, don’t drop it! ⚡',
      'Coach: That’s real fighter speed! 🥊',
      'Coach: Any target that appears is yours! 😎'
    ],
    fever: [
      'Coach: FEVER PUNCH!! Go full power! 🔥',
      'Coach: Fire mode ON, don’t slow down! 🔥⚡',
      'Coach: Golden fists are here, FEVER time! ✨'
    ],
    miss: [
      'Coach: Just a tiny miss, you’ll get the next one 😄',
      'Coach: The target escaped, but you’ll catch the next! 💪',
      'Coach: Deep breath, then punch on! 🐰'
    ],
    bossIntro: [
      'Coach: Watch out! Boss incoming, hit with all your power! 👀',
      'Coach: Boss fight! Punch non-stop! 💥'
    ],
    bossClearEasy: [
      'Coach: First boss down, nicely done! 🐣✨',
      'Coach: See? Boss can’t handle your punches yet 😄'
    ],
    bossClearHard: [
      'Coach: Even the big boss falls to your punches! Champion level 🏆',
      'Coach: Awesome! That’s a champion puncher! 🔥'
    ],
    finalGood: [
      'Coach: Insane power! That’s champion level! 🏆',
      'Coach: Doctors would love this score too 😄',
      'Coach: Amazing, true fire-fist fighter! 🔥'
    ],
    finalOk: [
      'Coach: Great job! With a bit more practice, combo will soar 💪',
      'Coach: Almost champion level, just a bit more! ⭐',
      'Coach: Next time, try to hold your combo longer ⚡'
    ],
    finalBad: [
      'Coach: This round was like a warm-up. Next one, we go all out! 🔁',
      'Coach: Not your full power yet, try another round! 🥊',
      'Coach: Practice more and your fists will sharpen 😄'
    ]
  }
};

// ---------- Profile ---------------------------------------------------------
function getProfile(){
  try{
    const raw = localStorage.getItem(LS_PROFILE);
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}
function saveProfile(p){
  try{ localStorage.setItem(LS_PROFILE, JSON.stringify(p)); }catch(e){}
}

function ensureProfile(){
  let p = getProfile();
  if (p) return p;

  try{
    if (window.__SB_PROFILE) {
      p = { ...window.__SB_PROFILE };
      saveProfile(p);
      return p;
    }
  }catch(e){}

  try{
    const b = document.body || null;
    if (b && b.dataset) {
      const maybe = {
        studentId: b.dataset.studentId || '',
        name     : b.dataset.playerName || b.dataset.name || '',
        school   : b.dataset.school || '',
        class    : b.dataset.class || b.dataset.className || '',
        lang     : b.dataset.lang || ''
      };
      if (maybe.studentId || maybe.name) {
        p = maybe;
        if (!p.lang) { p.lang = (navigator.language||'th').startsWith('th')?'th':'en'; }
        saveProfile(p);
        return p;
      }
    }
  }catch(e){}

  const studentId = prompt('Student ID:');
  const name      = prompt('ชื่อที่ใช้ในเกม / Player Name:');
  const school    = prompt('โรงเรียน / School:');
  const klass     = prompt('ห้องเรียน เช่น ป.5/1 (Class):');
  p = { studentId, name, school, class: klass, lang: (navigator.language||'th').startsWith('th')?'th':'en' };
  saveProfile(p);
  return p;
}

// ---------- SFX (optional) --------------------------------------------------
const SFX = (function(){
  function load(src){
    if(!src) return null;
    const a = new Audio(src);
    a.preload = 'auto';
    return a;
  }
  const hitS   = load('./sfx/ding-good.mp3');
  const missS  = load('./sfx/ding-bad.mp3');
  const feverS = load('./sfx/fever.mp3');
  const endS   = load('./sfx/end.mp3');
  return {
    hit  :()=>{ try{ if(hitS){ hitS.currentTime=0; hitS.play(); } }catch(e){} },
    miss :()=>{ try{ if(missS){ missS.currentTime=0; missS.play(); } }catch(e){} },
    fever:()=>{ try{ if(feverS){ feverS.currentTime=0; feverS.play(); } }catch(e){} },
    end  :()=>{ try{ if(endS){ endS.currentTime=0; endS.play(); } }catch(e){} }
  };
})();

// ---------- Helpers ---------------------------------------------------------
function detectDevice(){
  const ua = navigator.userAgent||'';
  if(/Quest|Oculus|Pico|Vive|VR/i.test(ua)) return 'VR';
  if(/Mobile|Android|iPhone/i.test(ua))     return 'Mobile';
  return 'PC';
}
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
function rand(a,b){ return a + Math.random()*(b-a); }

// ---------- Hybrid Save -----------------------------------------------------
const LS_QUEUE_KEY = LS_QUEUE;

function loadQueue(){
  try{
    const raw = localStorage.getItem(LS_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    return [];
  }
}
function saveQueue(q){
  try{ localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(q)); }catch(e){}
}

async function hybridSaveSession(summary, allowQueue){
  const body = JSON.stringify(summary);
  const headers = { 'Content-Type':'application/json' };
  let ok = true;
  try{
    const tasks = [];
    if (SB_CFG.firebaseApi) tasks.push(fetch(SB_CFG.firebaseApi,{method:'POST',headers,body}));
    if (SB_CFG.sheetApi)    tasks.push(fetch(SB_CFG.sheetApi   ,{method:'POST',headers,body}));
    if (tasks.length) await Promise.all(tasks);
  }catch(e){
    console.warn('ShadowBreaker save fail',e);
    ok=false;
  }
  if (!ok && allowQueue){
    const q = loadQueue();
    q.push(summary);
    saveQueue(q);
  }
}

async function flushQueue(){
  const q = loadQueue();
  if(!q.length) return;
  const remain = [];
  for (let i=0;i<q.length;i++){
    const item = q[i];
    try{
      await hybridSaveSession(item,false);
    }catch(e){
      remain.push(item);
    }
  }
  saveQueue(remain);
}

// ---------- CSV / PDF -------------------------------------------------------
async function exportPDF(summary){
  if (!SB_CFG.pdfApi){
    alert('PDF export not configured.');
    return;
  }
  try{
    const res = await fetch(SB_CFG.pdfApi,{
      method :'POST',
      headers:{'Content-Type':'application/json'},
      body   :JSON.stringify(summary)
    });
    if(!res.ok) throw new Error('PDF API error');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ShadowBreaker_'+(summary.profile.studentId||'user')+'.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }catch(e){
    console.error(e);
    alert('สร้าง PDF ไม่สำเร็จ');
  }
}
function downloadCSVRow(summary){
  const headers = [
    'timestamp','siteId','roomId','sessionTag',
    'studentId','name','school','class',
    'game','diff','duration',
    'score','hits','miss','accuracy','comboMax',
    'notesPerMin','rank','device',
    'boss1Hits','boss1Miss','boss1Dur',
    'boss2Hits','boss2Miss','boss2Dur',
    'boss3Hits','boss3Miss','boss3Dur',
    'boss4Hits','boss4Miss','boss4Dur'
  ];
  const p = summary.profile || {};
  const dur = summary.duration;
  const durStr = (dur!=null && typeof dur === 'number' && dur.toFixed)
    ? dur.toFixed(2)
    : (dur||'');

  const row = [
    summary.timestamp,
    summary.siteId||'', summary.roomId||'', summary.sessionTag||'',
    p.studentId||'', p.name||'', p.school||'', p.class||'',
    summary.game, summary.diff||'', durStr,
    summary.score==null?'':summary.score,
    summary.hits==null?'':summary.hits,
    summary.miss==null?'':summary.miss,
    (summary.accuracy*100).toFixed(1),
    summary.comboMax==null?'':summary.comboMax,
    summary.notesPerMin!=null?summary.notesPerMin.toFixed(2):'',
    summary.rank||'',
    summary.device||'',
    summary.bossStats?.[0]?.hits ?? '',
    summary.bossStats?.[0]?.miss ?? '',
    summary.bossStats?.[0]?.duration != null ? summary.bossStats[0].duration.toFixed(2) : '',
    summary.bossStats?.[1]?.hits ?? '',
    summary.bossStats?.[1]?.miss ?? '',
    summary.bossStats?.[1]?.duration != null ? summary.bossStats[1].duration.toFixed(2) : '',
    summary.bossStats?.[2]?.hits ?? '',
    summary.bossStats?.[2]?.miss ?? '',
    summary.bossStats?.[2]?.duration != null ? summary.bossStats[2].duration.toFixed(2) : '',
    summary.bossStats?.[3]?.hits ?? '',
    summary.bossStats?.[3]?.miss ?? '',
    summary.bossStats?.[3]?.duration != null ? summary.bossStats[3].duration.toFixed(2) : ''
  ];

  const csv = headers.join(',')+'\n'+row.join(',');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ShadowBreaker_'+(p.studentId||'user')+'_'+summary.timestamp+'.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- Game Config -----------------------------------------------------
const DIFF = {
  easy:   { baseScore:12, critBonus:10, missPenalty:10, ttl:1200, spawn:550, size:[64,86]  },
  normal: { baseScore:14, critBonus:12, missPenalty:12, ttl:1050, spawn:460, size:[56,80]  },
  hard:   { baseScore:16, critBonus:16, missPenalty:14, ttl: 900, spawn:380, size:[48,72]  }
};

const FEVER_COMBO = 5;
const FEVER_MULT  = 1.5;
const FEVER_SPAWN = 0.8;
const CRIT_RATIO  = 0.35;

const ICONS_NORMAL = ['🥊','✨','⭐','⚡'];
const ICONS_FEVER  = ['🔥','💥','🌟','⚡'];

const BOSS_DEFS = [
  { id:1, at:0.18, hp:5,  icon:'🧡', label:'BOSS 1 • Warm-up Cone',   bonus:120 },
  { id:2, at:0.38, hp:8,  icon:'🥊', label:'BOSS 2 • Speed Bag',      bonus:180 },
  { id:3, at:0.62, hp:12, icon:'👻', label:'BOSS 3 • Shadow Clone',   bonus:260 },
  { id:4, at:0.82, hp:16, icon:'👑', label:'BOSS 4 • Golden Champion',bonus:360 }
];

// ============================================================================
// ShadowBreaker class
// ============================================================================
export class ShadowBreaker {
  constructor(opts){
    this.opts   = opts || {};
    this.arena  = opts.arena;
    this.hud    = opts.hud||{};
    this.msgBox = opts.msgBox||null;
    this.result = opts.result||{};
    this.csvBtn = opts.csvBtn||null;
    this.pdfBtn = opts.pdfBtn||null;

    if(!this.arena){
      alert('Shadow Breaker: arena not found');
      return;
    }

    this.profile = ensureProfile();

    const qs   = new URLSearchParams(location.search);
    const langParam = qs.get('lang');
    const langFromProfile = this.profile.lang || '';
    const browserLang = (navigator.language||'th').toLowerCase();
    let lang = 'th';
    if(langParam === 'en' || langParam === 'th'){
      lang = langParam;
    }else if(langFromProfile === 'en' || langFromProfile === 'th'){
      lang = langFromProfile;
    }else if(browserLang.startsWith('en')){
      lang = 'en';
    }
    this.lang = lang;
    this.str  = STR[lang] || STR.th;
    this.coachLines = COACH_LINES[lang] || COACH_LINES.th;

    try {
      document.documentElement.setAttribute('lang', this.lang);
    } catch(e){}

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

    this.targets = [];
    this.spawnTimer     = 0;
    this.lastCoachTalk  = 0;

    this.bossDefs   = BOSS_DEFS;
    this.bossDone   = this.bossDefs.map(()=>false);
    this.bossActive = false;
    this.bossIndex  = -1;
    this.bossHp     = 0;
    this.bossHpMax  = 0;
    this.bossEl     = null;
    this.bossBar    = null;
    this.bossWrap   = null;

    this.bossHits  = this.bossDefs.map(()=>0);
    this.bossMiss  = this.bossDefs.map(()=>0);
    this.bossStart = this.bossDefs.map(()=>null);
    this.bossEnd   = this.bossDefs.map(()=>null);

    this.coachBox = document.querySelector('.coach-line') || null;

    flushQueue();
    this._buildScene();
    this._bind();
    this._msg(this.str.msgReady);
    this._hud();
  }

  // ----- public: สลับภาษาจากปุ่มด้านนอก -------------------------------
  setLanguage(lang){
    if (lang !== 'th' && lang !== 'en') return;
    this.lang = lang;
    this.str  = STR[lang] || STR.th;
    this.coachLines = COACH_LINES[lang] || COACH_LINES.th;

    if (this.profile) {
      this.profile.lang = lang;
      saveProfile(this.profile);
    }
    try {
      document.documentElement.setAttribute('lang', this.lang);
    } catch(e){}

    // อัปเดตชื่อโค้ชบน HUD
    if (this.arena) {
      const coachLabel = this.arena.querySelector('.sb-coach-name');
      if (coachLabel) {
        coachLabel.textContent = (this.lang === 'en' ? 'Coach Pung' : 'โค้ชพุ่ง');
      }
    }

    // อัปเดตข้อความหลักทันที
    this._msg(this.str.msgReady);
  }

  // ----- Messaging / Coach --------------------------------------------------
  _msg(t){
    if(this.msgBox)   this.msgBox.textContent  = t;
    if(this.coachBox) this.coachBox.textContent = t;
  }

  _coach(type){
    const linesAll = this.coachLines || {};
    const lines = linesAll[type];
    if(!lines || !lines.length) return;
    const now = this.state ? this.state.elapsed : 0;
    const MIN_INTERVAL = 3;
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

  // ----- Scene --------------------------------------------------------------
  _buildScene(){
    this.arena.style.position = 'relative';
    this.arena.style.overflow = 'hidden';

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
    coach.innerHTML='<span>🐰</span><span class="sb-coach-name">'+(this.lang==='en'?'Coach Pung':'โค้ชพุ่ง')+'</span>';
    this.arena.appendChild(coach);

    const wrap = document.createElement('div');
    wrap.style.position='absolute';
    wrap.style.right='12px';
    wrap.style.top ='10px';
    wrap.style.minWidth='140px';
    wrap.style.padding='4px 8px 6px';
    wrap.style.borderRadius='12px';
    wrap.style.background='rgba(15,23,42,0.9)';
    wrap.style.border='1px solid rgba(248,250,252,0.6)';
    wrap.style.fontSize='11px';
    wrap.style.display='none';
    wrap.style.zIndex='6';

    const title = document.createElement('div');
    title.style.display='flex';
    title.style.justifyContent='space-between';
    title.style.alignItems='center';
    title.style.fontWeight='700';
    title.style.marginBottom='2px';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = 'BOSS';
    const bossNameSpan = document.createElement('span');
    bossNameSpan.id = 'sbBossName';
    bossNameSpan.textContent = '';
    title.appendChild(labelSpan);
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

  // ----- Public Control -----------------------------------------------------
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

    this.bossDone   = this.bossDefs.map(()=>false);
    this.bossActive = false;
    this.bossIndex  = -1;
    this.bossHp     = 0;
    this.bossHpMax  = 0;
    this.bossHits   = this.bossDefs.map(()=>0);
    this.bossMiss   = this.bossDefs.map(()=>0);
    this.bossStart  = this.bossDefs.map(()=>null);
    this.bossEnd    = this.bossDefs.map(()=>null);

    if(this.bossWrap){ this.bossWrap.style.display='none'; }
    if(this.bossEl){
      this.bossEl.remove();
      this.bossEl = null;
    }

    this._hud();
    this._msg(this.str.msgGo);

    this._spawnTarget();

    this.state.lastTs = performance.now();
    requestAnimationFrame(this._loop.bind(this));
  }

  pause(v){
    if(v==null) v=true;
    if(!this.state.running) return;
    this.state.paused = v;
    this._msg(v?this.str.msgPaused:this.str.msgResume);
    if(!v){
      this.state.lastTs = performance.now();
      requestAnimationFrame(this._loop.bind(this));
    }
  }

  exitToHub(){
    if (this.opts.onExit) {
      const summary = this.state.running ? this._buildSummary() : null;
      try{ this.opts.onExit(summary); }catch(e){}
    } else {
      window.location.href = './index.html';
    }
  }

  // ----- Loop ---------------------------------------------------------------
  _loop(ts){
    if(!this.state.running || this.state.paused) return;

    const last = this.state.lastTs||ts;
    this.state.lastTs = ts;
    const dt = (ts - last)/1000;
    if (dt <= 0) {
      requestAnimationFrame(this._loop.bind(this));
      return;
    }

    this.state.elapsed  += dt;
    this.state.timeLeft  = clamp(this.timeLimit - this.state.elapsed, 0, 1e9);
    const progress = this.timeLimit>0 ? this.state.elapsed/this.timeLimit : 0;

    if (!this.bossActive){
      for (let i=0;i<this.bossDefs.length;i++){
        const def = this.bossDefs[i];
        if (!this.bossDone[i] && progress >= def.at){
          this._startBoss(i);
          break;
        }
      }
    }

    if (!this.bossActive){
      const baseSpawn = this.cfg.spawn/1000;
      const effSpawn  = this.state.fever ? baseSpawn*FEVER_SPAWN : baseSpawn;
      this.spawnTimer += dt;
      while (this.spawnTimer >= effSpawn){
        this.spawnTimer -= effSpawn;
        this._spawnTarget();
      }
    }

    const now = performance.now();
    for(let i=this.targets.length-1;i>=0;i--){
      const tg = this.targets[i];
      const age = now - tg.born;
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

  // ----- Targets ------------------------------------------------------------
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
    el.textContent = icons[Math.floor(Math.random()*icons.length)];
    el.style.fontSize = Math.round(size*0.6)+'px';
    el.style.textShadow='0 0 8px rgba(15,23,42,0.9)';

    const pad = 16;
    const rect = this.arena.getBoundingClientRect();
    const maxX = Math.max(pad, rect.width - size - pad);
    const maxY = Math.max(pad, rect.height - size - pad);
    el.style.left=rand(pad, maxX)+'px';
    el.style.top =rand(pad, maxY)+'px';

    el.animate(
      [{transform:'scale(1)'},{transform:'scale(1.06)'},{transform:'scale(1)'}],
      {duration:1000,iterations:1}
    );

    this.arena.appendChild(el);

    const tg = { el:el, born: performance.now(), ttl: this.cfg.ttl, clicked:false };
    el.addEventListener('pointerdown', (ev)=>{
      ev.stopPropagation();
      if(tg.clicked) return;
      tg.clicked=true;
      this._onHit(tg);
      el.remove();
      const idx=this.targets.indexOf(tg);
      if(idx>=0) this.targets.splice(idx,1);
    }, {once:true});

    this.targets.push(tg);
  }

  // ----- Boss ---------------------------------------------------------------
  _startBoss(idx){
    const def = this.bossDefs[idx];
    this.bossActive = true;
    this.bossIndex  = idx;
    this.bossHpMax  = def.hp;
    this.bossHp     = def.hp;

    this.bossStart[idx] = this.state.elapsed;
    this.bossHits[idx]  = 0;
    this.bossMiss[idx]  = 0;

    if(this.bossWrap){
      this.bossWrap.style.display='block';
      const nameSpan = this.bossWrap.querySelector('#sbBossName');
      if(nameSpan) nameSpan.textContent = def.label;
    }
    this._updateBossHud();

    if(this.bossEl){
      this.bossEl.remove();
      this.bossEl=null;
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

    el.addEventListener('pointerdown', (ev)=>{
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
      if (this.bossIndex < 0 || this.bossIndex >= this.bossDefs.length) {
        this.bossWrap.style.display='none';
      }
      return;
    }
    const pct = this.bossHpMax ? (this.bossHp/this.bossHpMax)*100 : 0;
    this.bossBar.style.width = clamp(pct,0,100)+'%';
  }

  _spawnFakeTargetsAroundBoss(count){
    if(!this.bossEl) return;
    const rectArena = this.arena.getBoundingClientRect();
    const pad = 24;

    for(let i=0;i<count;i++){
      const el = document.createElement('button');
      el.type='button';
      el.className='sb-fake';
      el.textContent='✖';
      el.style.position='absolute';
      el.style.width='40px';
      el.style.height='40px';
      el.style.borderRadius='50%';
      el.style.border='2px solid rgba(248,113,113,0.9)';
      el.style.background='radial-gradient(circle at 30% 30%,#fee2e2,#fb7185)';
      el.style.color='#111827';
      el.style.fontWeight='900';
      el.style.cursor='pointer';
      el.style.display='flex';
      el.style.alignItems='center';
      el.style.justifyContent='center';
      el.style.fontSize='18px';
      el.style.textShadow='0 0 6px rgba(248,250,252,0.9)';
      el.style.boxShadow='0 6px 16px rgba(0,0,0,0.35)';
      el.style.zIndex='15';

      const maxX = Math.max(pad, rectArena.width - 40 - pad);
      const maxY = Math.max(pad, rectArena.height - 40 - pad);
      el.style.left=rand(pad, maxX)+'px';
      el.style.top =rand(pad, maxY)+'px';

      el.addEventListener('pointerdown', (ev)=>{
        ev.stopPropagation();
        this._onMiss({ el });
        el.remove();
      });

      this.arena.appendChild(el);
      setTimeout(()=>{ if(el && el.parentNode){ el.remove(); } }, this.cfg.ttl);
    }
  }

  _repositionBossRandom(){
    if(!this.bossEl) return;
    const rect = this.arena.getBoundingClientRect();
    const pad = 40;
    const w = rect.width;
    const h = rect.height;
    const x = rand(pad, Math.max(pad, w-pad));
    const y = rand(pad, Math.max(pad, h-pad));

    this.bossEl.style.left = x+'px';
    this.bossEl.style.top  = y+'px';
  }

  _hitBoss(def){
    if(!this.bossActive) return;
    if(this.bossHp<=0) return;

    this.state.hits++;
    this.state.combo++;
    this.state.bestCombo = Math.max(this.state.bestCombo, this.state.combo);

    if (this.bossIndex >= 0) {
      this.bossHits[this.bossIndex]++;
    }

    let gain = this.cfg.baseScore * 2;
    if(this.state.fever) gain = Math.round(gain * FEVER_MULT);
    this.state.score += gain;

    this.bossHp = Math.max(0, this.bossHp - 1);
    const isLast = (this.bossHp === 0);

    this._hud();
    this._updateBossHud();

    this._screenShake(isLast?18:10,false);
    this._hitFloat(isLast ? ('BOSS DOWN +'+def.bonus) : ('BOSS HIT +'+gain), true);
    SFX.hit();

    if(isLast){
      this.state.score += def.bonus;
      this.bossDone[this.bossIndex] = true;
      this.bossEnd[this.bossIndex] = this.state.elapsed;

      if (def.id >= 3) this._coach('bossClearHard');
      else            this._coach('bossClearEasy');

      this.state.fever = true;
      this._showFeverFx();
      SFX.fever();

      if(this.bossEl){
        const be = this.bossEl;
        be.animate(
          [
            {transform:'translate(-50%,-50%) scale(1)', opacity:1},
            {transform:'translate(-50%,-50%) scale(1.08)', opacity:1},
            {transform:'translate(-50%,-50%) scale(0.4)', opacity:0}
          ],
          {duration:400,iterations:1,easing:'ease-in'}
        );
        setTimeout(()=>{ if(be && be.parentNode){ be.remove(); } },380);
        this.bossEl = null;
      }

      this.bossActive = false;
      setTimeout(()=>{
        if(this.bossWrap && !this.bossActive){
          this.bossWrap.style.display='none';
        }
      }, 800);
    }else{
      if(def.id === 2){
        this._repositionBossRandom();
      }else if(def.id === 3){
        const c = Math.random()<0.5 ? 1 : 2;
        this._spawnFakeTargetsAroundBoss(c);
      }
      if (this.state.combo === 3 || this.state.combo === 7) {
        this._coach('hitStreak');
      }
    }
  }

  // ----- Hit / Miss normal target ------------------------------------------
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
    this._hitFloat(crit?('CRITICAL +'+gain):('+'+gain));
    SFX.hit();
  }

  _onMiss(tg){
    this.state.miss++;
    this.state.combo = 0;
    this.state.fever = false;

    let penalty = this.cfg.missPenalty;
    if(this.bossActive && this.bossIndex === 3){
      penalty = this.cfg.missPenalty * 2;
    }
    if(this.bossActive && this.bossIndex >= 0){
      this.bossMiss[this.bossIndex]++;
    }

    this.state.score = Math.max(0, this.state.score - penalty);
    this._hud();

    this._screenShake(10,true);
    this._hitFloat('MISS');
    SFX.miss();
    this._coach('miss');
  }

  // ----- FX -----------------------------------------------------------------
  _screenShake(px,isBad){
    if(px==null) px=8;
    const a=this.arena;
    a.animate(
      [
        {transform:'translate(0,0)'},
        {transform:'translate('+px+'px,0)'},
        {transform:'translate('+(-px)+'px,0)'},
        {transform:'translate(0,0)'}
      ],
      {duration:140,iterations:1,easing:'ease-out'}
    );
    a.style.boxShadow=isBad
      ?'0 0 22px rgba(248,113,113,0.9)'
      :'0 0 22px rgba(129,140,248,0.9)';
    setTimeout(()=>{ a.style.boxShadow=''; },120);
  }

  _hitFloat(text){
    const r=this.arena.getBoundingClientRect();
    const x=r.left+r.width*0.5;
    const y=r.top +r.height*0.28;
    const fx=document.createElement('div');
    fx.textContent=text;
    fx.style.position='fixed';
    fx.style.left=x+'px';
    fx.style.top=y+'px';
    fx.style.transform='translate(-50%,-50%)';
    fx.style.zIndex='9999';
    fx.style.fontSize='22px';
    fx.style.fontWeight='900';
    fx.style.letterSpacing='0.05em';
    if(text.indexOf('MISS')===0){
      fx.style.color='#fb7185';
    }else if(text.indexOf('BOSS')===0 || text.indexOf('CRITICAL')===0){
      fx.style.color='#facc15';
    }else{
      fx.style.color='#4ade80';
    }
    fx.style.textShadow='0 0 12px rgba(15,23,42,0.95)';
    fx.style.pointerEvents='none';
    fx.style.animation='sbHitFloat 0.55s ease-out forwards';
    document.body.appendChild(fx);
    setTimeout(()=>{ fx.remove(); },600);
  }

  _showFeverFx(){
    const el=document.createElement('div');
    el.textContent='FEVER PUNCH!!';
    el.style.position='fixed';
    el.style.left='50%';
    el.style.top='18%';
    el.style.transform='translate(-50%,-50%)';
    el.style.zIndex='9999';
    el.style.fontSize='32px';
    el.style.fontWeight='900';
    el.style.letterSpacing='0.16em';
    el.style.color='#facc15';
    el.style.textShadow='0 0 18px rgba(250,204,21,0.95)';
    el.style.animation='feverFlash 0.7s ease-out forwards';
    document.body.appendChild(el);
    setTimeout(()=>{ el.remove(); },740);
  }

  // ----- Summary ------------------------------------------------------------
  _buildSummary(){
    const total   = this.state.hits+this.state.miss;
    const acc     = total>0?this.state.hits/total:0;
    const duration= this.state.elapsed||this.timeLimit;
    const notesPerSec = duration>0?total/duration:0;
    const notesPerMin = notesPerSec*60;

    let rank='C';
    if(this.state.score>=1200 && acc>=0.95) rank='SSS';
    else if(this.state.score>=900 && acc>=0.90) rank='S';
    else if(this.state.score>=650 && acc>=0.80) rank='A';
    else if(this.state.score>=420 && acc>=0.65) rank='B';

    const bossStats = this.bossDefs.map((def,idx)=>{
      const start = this.bossStart[idx];
      const end   = this.bossEnd[idx];
      return {
        id      : def.id,
        label   : def.label,
        hits    : this.bossHits[idx] || 0,
        miss    : this.bossMiss[idx] || 0,
        duration: (start!=null && end!=null) ? (end - start) : null
      };
    });

    return {
      profile   : this.profile,
      game      : 'shadow-breaker',
      diff      : this.diffName,
      duration  : duration,
      score     : this.state.score,
      hits      : this.state.hits,
      miss      : this.state.miss,
      comboMax  : this.state.bestCombo,
      accuracy  : acc,
      notesPerSec : notesPerSec,
      notesPerMin : notesPerMin,
      rank      : rank,
      device    : detectDevice(),
      timestamp : new Date().toISOString(),
      lang      : this.lang,
      siteId    : SB_CFG.siteId || '',
      roomId    : SB_CFG.roomId || '',
      sessionTag: SB_CFG.sessionTag || '',
      bossStats : bossStats
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
    setTimeout(()=>{ ripple.remove(); },600);

    const summary=this._buildSummary();

    let t='finalBad';
    if(summary.rank==='SSS' || summary.rank==='S') t='finalGood';
    else if(summary.rank==='A' || summary.rank==='B') t='finalOk';
    this._coach(t);

    const ok=this._showResult(summary);
    if(!ok){
      const acc=(summary.accuracy*100).toFixed(1);
      alert(
        'Shadow Breaker Result\n'+
        'Score: '+summary.score+'\n'+
        'Hits: '+summary.hits+'\n'+
        'Miss: '+summary.miss+'\n'+
        'Accuracy: '+acc+'%\n'+
        'Best Combo: x'+summary.comboMax+'\n'+
        'Rank: '+summary.rank
      );
    }
    try{
      await hybridSaveSession(summary,true);
    }catch(e){
      console.warn('save error',e);
    }

    if(this.bossEl){
      this.bossEl.remove();
      this.bossEl=null;
    }
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

    const npm = document.getElementById('sbNPM');
    if (npm && summary.notesPerMin != null) {
      npm.textContent = summary.notesPerMin.toFixed(1);
    }

    const csvBtn=this.csvBtn||document.getElementById('sbCsvBtn');
    const pdfBtn=this.pdfBtn||document.getElementById('sbPdfBtn');

    if(csvBtn){
      csvBtn.style.display='inline-flex';
      csvBtn.onclick=()=>{ downloadCSVRow(summary); };
    }
    if(pdfBtn){
      if(SB_CFG.pdfApi){
        pdfBtn.style.display='inline-flex';
        pdfBtn.onclick=()=>{ exportPDF(summary); };
      }else{
        pdfBtn.style.display='none';
      }
    }

    return true;
  }
}