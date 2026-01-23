'use strict';

const HHA_LAST = 'HHA_LAST_SUMMARY';
const HHA_HIST = 'HHA_SUMMARY_HISTORY';

// Default Shadow Breaker entry (ปรับชื่อไฟล์ HTML ได้ที่นี่ถ้าของคุณต่างไป)
const SHADOW_ENTRY = './games/shadow-breaker/shadow-breaker.html';

// Pass-through params (จาก hub -> game)
const PASS_KEYS = [
  'view','seed','research','studyId','log','phase','mode','diff','time','run','style','conditionGroup'
];

const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));

function qs(k, d=null){
  try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; }
}
function setQS(url, key, val){
  try{
    const u = new URL(url, location.href);
    if(val===null || val===undefined || val==='') u.searchParams.delete(key);
    else u.searchParams.set(key, String(val));
    return u.toString();
  }catch{
    return url;
  }
}

function detectView(){
  const v = (qs('view','')||'').toLowerCase();
  if(v) return v;

  const ua = navigator.userAgent || '';
  if (/Quest|Oculus|Vive|VR/i.test(ua)) return 'vr';
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'pc';
}

function makeGameUrl(base){
  let url = base;
  // force hub back to THIS hub
  url = setQS(url, 'hub', location.href.split('#')[0]);

  // auto view if not already provided
  if(!qs('view','')) url = setQS(url, 'view', detectView());

  // pass-through selected params from current hub
  const cur = new URL(location.href);
  for(const k of PASS_KEYS){
    const val = cur.searchParams.get(k);
    if(val !== null && val !== '') url = setQS(url, k, val);
  }

  // ensure run default
  url = setQS(url, 'run', qs('run','play') || 'play');
  return url;
}

// ---------- i18n ----------
const I18N = {
  th:{
    title:'VR Fitness Hub',
    sub:'เลือกเกมฝึกทักษะ + ดูผลล่าสุดจากการเล่น',
    backMain:'กลับ HeroHealth Hub',
    last:'ผลล่าสุด',
    noLast:'ยังไม่มีผลล่าสุด',
    noLast2:'กดเล่นเกมสักรอบ แล้วกลับมาดูได้เลย',
    score:'คะแนน',
    acc:'Accuracy',
    hit:'Hit',
    miss:'Miss',
    combo:'Max Combo',
    timeUsed:'เวลาเล่น',
    playShadow:'เล่น Shadow Breaker',
    replayLast:'เล่นซ้ำแบบเดิม',
    hint:'* ระบบอ่านผลล่าสุดจาก localStorage: HHA_LAST_SUMMARY และจะส่งพารามิเตอร์ (diff/time/seed/research/log) ให้เกมอัตโนมัติ',
    games:'เกมทั้งหมด',
    auto:'Auto-pass params',
    shadowDesc:'แตะ/ยิงเป้าให้ไว เก็บคอมโบ + ล้มบอส 4 ตัว',
    play:'เล่น',
    soon:'เร็ว ๆ นี้',
    history:'ประวัติ (ล่าสุด 8 รอบ)',
    clear:'ล้างประวัติ',
    noHist:'ยังไม่มีประวัติ',
    noHist2:'เล่นเกมแล้วผลจะมาอยู่ตรงนี้',
    lastBadge:(g)=>`ล่าสุด: ${g}`,
  },
  en:{
    title:'VR Fitness Hub',
    sub:'Pick a game + see your latest result',
    backMain:'Back to HeroHealth Hub',
    last:'Latest Result',
    noLast:'No latest result yet',
    noLast2:'Play once and come back here',
    score:'Score',
    acc:'Accuracy',
    hit:'Hit',
    miss:'Miss',
    combo:'Max Combo',
    timeUsed:'Time used',
    playShadow:'Play Shadow Breaker',
    replayLast:'Replay with same settings',
    hint:'* Reads from localStorage: HHA_LAST_SUMMARY and auto passes params (diff/time/seed/research/log)',
    games:'Games',
    auto:'Auto-pass params',
    shadowDesc:'Hit targets fast, keep combo, defeat 4 bosses',
    play:'Play',
    soon:'Coming soon',
    history:'History (last 8)',
    clear:'Clear history',
    noHist:'No history yet',
    noHist2:'After you play, sessions will appear here',
    lastBadge:(g)=>`Latest: ${g}`,
  }
};

let LANG = (qs('lang','')||'th').toLowerCase();
if(LANG!=='th' && LANG!=='en') LANG='th';

function applyLang(){
  const t = I18N[LANG];

  $('#tTitle').textContent = t.title;
  $('#tSub').textContent = t.sub;
  $('#tBackMain').textContent = t.backMain;

  $('#tLast').textContent = t.last;
  $('#tNoLast').textContent = t.noLast;
  $('#tNoLast2').textContent = t.noLast2;

  $('#tScore').textContent = t.score;
  $('#tAcc').textContent = t.acc;
  $('#tHit').textContent = t.hit;
  $('#tMiss').textContent = t.miss;
  $('#tCombo').textContent = t.combo;
  $('#tTimeUsed').textContent = t.timeUsed;

  $('#tPlayShadow').textContent = t.playShadow;
  $('#tReplayLast').textContent = t.replayLast;
  $('#tHint').textContent = t.hint;

  $('#tGames').textContent = t.games;
  $('#tAuto').textContent = t.auto;
  $('#tShadowDesc').textContent = t.shadowDesc;
  $('#tPlay').textContent = t.play;

  $('#tSoon1').textContent = t.soon;
  $('#tSoon2').textContent = t.soon;
  $('#tSoon3').textContent = t.soon;

  $('#tHistory').textContent = t.history;
  $('#tClear').textContent = t.clear;
  $('#tNoHist').textContent = t.noHist;
  $('#tNoHist2').textContent = t.noHist2;

  // update badge if already has data
  const badge = $('#lastBadge');
  if(badge && badge.dataset.game){
    badge.textContent = t.lastBadge(badge.dataset.game);
  }

  // keep lang buttons state
  $$('.lang-btn').forEach(b=>b.classList.toggle('active', (b.dataset.lang||'th')===LANG));
}

function readJSON(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

function prettyGameName(gameId){
  if(gameId==='shadow-breaker') return 'Shadow Breaker';
  return gameId || '—';
}

function renderLast(){
  const last = readJSON(HHA_LAST);

  const empty = $('#lastEmpty');
  const grid  = $('#lastGrid');

  if(!last || !last.gameId){
    empty.classList.remove('hidden');
    grid.classList.add('hidden');
    $('#btnReplayLast').disabled = true;
    $('#btnReplayLast').style.opacity = 0.65;
    $('#lastBadge').textContent = '—';
    return;
  }

  const gname = prettyGameName(last.gameId);
  const t = I18N[LANG];

  $('#lastBadge').dataset.game = gname;
  $('#lastBadge').textContent = t.lastBadge(gname);

  empty.classList.add('hidden');
  grid.classList.remove('hidden');

  $('#lastScore').textContent = String(last.score ?? 0);
  $('#lastAcc').textContent = String((last.accuracy ?? 0)) + '%';
  $('#lastHit').textContent = String(last.hit ?? 0);
  $('#lastMiss').textContent = String(last.miss ?? 0);
  $('#lastCombo').textContent = 'x' + String(last.maxCombo ?? 0);
  $('#lastTimeUsed').textContent = String(last.timeUsedSec ?? 0) + 's';

  // Replay enabled
  $('#btnReplayLast').disabled = false;
  $('#btnReplayLast').style.opacity = 1;
}

function renderHistory(){
  const hist = readJSON(HHA_HIST);
  const list = Array.isArray(hist) ? hist.slice(0,8) : [];

  const empty = $('#histEmpty');
  const box = $('#histList');

  if(!list.length){
    empty.classList.remove('hidden');
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  box.classList.remove('hidden');

  box.innerHTML = list.map(s=>{
    const g = prettyGameName(s.gameId);
    const dt = (s.endedAt || s.createdAt || '').slice(0,19).replace('T',' ');
    const score = s.score ?? 0;
    const acc = (s.accuracy ?? 0) + '%';
    const diff = s.diff || 'normal';
    return `
      <div class="hrow">
        <div class="left">
          <div class="t">${g} • ${diff}</div>
          <div class="s">${dt || '-' } • acc ${acc}</div>
        </div>
        <div class="right">${score}</div>
      </div>
    `;
  }).join('');
}

function wireLinks(){
  // back to main herohealth hub (allow override via ?mainHub=...)
  const mainHub = (qs('mainHub','')||'').trim();
  if(mainHub) $('#backMainHub').href = mainHub;

  // Play Shadow Breaker links
  const urlShadow = makeGameUrl(SHADOW_ENTRY);
  $('#btnPlayShadow').href = urlShadow;
  $('#linkShadow').href = urlShadow;

  // Show view chip
  const v = detectView();
  $('#chipView').textContent = 'view:' + v;

  // Replay last: use last summary params if present
  $('#btnReplayLast').addEventListener('click', ()=>{
    const last = readJSON(HHA_LAST);
    let url = makeGameUrl(SHADOW_ENTRY);

    // if last exists, prefer last settings
    if(last && last.gameId){
      if(last.diff) url = setQS(url,'diff', last.diff);
      if(last.timeSec) url = setQS(url,'time', last.timeSec);
      if(last.seed) url = setQS(url,'seed', last.seed);
      if(last.phase) url = setQS(url,'phase', last.phase);
      if(last.mode) url = setQS(url,'mode', last.mode);
      // keep research/log flags as current hub (safer), but allow last.research too
      if(last.research) url = setQS(url,'research', last.research);
    }

    location.href = url;
  });

  // Clear history
  $('#btnClearHist').addEventListener('click', ()=>{
    try{
      localStorage.removeItem(HHA_HIST);
      localStorage.removeItem(HHA_LAST);
    }catch(_){}
    renderLast();
    renderHistory();
  });
}

// ---------- init ----------
$$('.lang-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    LANG = (btn.dataset.lang||'th');
    // keep in URL
    try{
      const u = new URL(location.href);
      u.searchParams.set('lang', LANG);
      history.replaceState(null,'',u.toString());
    }catch(_){}
    applyLang();
    renderLast();
    renderHistory();
  });
});

applyLang();
renderLast();
renderHistory();
wireLinks();