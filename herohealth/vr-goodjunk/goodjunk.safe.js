// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (DOM dual-eye + HUD fallback + VR/cVR safe spawn)
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ HUD fallback: update DOM directly if binder not working
// ✅ Dual-eye: spawn mirrored targets for VR/cVR (Cardboard ready)
// ✅ Safe spawn: avoid HUD / fever / shoot button; clamp to mid-field (no targets too low)
// ✅ End summary + back HUB + localStorage last summary

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function rnd01(){ return Math.random(); }
function now(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }

function qs(name, def=null){
  try{
    const u = new URL(ROOT.location.href);
    const v = u.searchParams.get(name);
    return (v===null || v==='') ? def : v;
  }catch(_){ return def; }
}

function toInt(v, d){ v = Number(v); return Number.isFinite(v) ? (v|0) : d; }
function toNum(v, d){ v = Number(v); return Number.isFinite(v) ? v : d; }

function emit(type, detail){
  try{
    ROOT.dispatchEvent(new CustomEvent(type, { detail }));
  }catch(_){}
}

/* ---------------- HUD fallback ---------------- */
function hudSet(id, val){
  try{ const el = DOC && DOC.getElementById(id); if (el) el.textContent = String(val ?? ''); }catch(_){}
}
function hudCoachSet(mood, text, sub){
  hudSet('hudCoachLine', text || '');
  if (sub !== undefined) hudSet('hudCoachSub', sub || '');
  try{
    const img = DOC && DOC.getElementById('hudCoachImg');
    if (!img) return;
    const m = String(mood || 'neutral').toLowerCase();
    let file = 'coach-neutral.png';
    if (m === 'happy') file = 'coach-happy.png';
    if (m === 'sad') file = 'coach-sad.png';
    if (m === 'fever') file = 'coach-fever.png';
    img.src = `./img/${file}`;
  }catch(_){}
}
function hudQuestSet(goalTitle, goalNow, goalTotal, miniTitle, miniNow, miniTotal, miniLeftMs){
  if (goalTitle) hudSet('hudGoalTitle', goalTitle);
  if (goalNow !== undefined && goalTotal !== undefined) hudSet('hudGoalCount', `${goalNow}/${goalTotal}`);
  if (miniTitle) hudSet('hudMiniTitle', miniTitle);
  if (miniNow !== undefined && miniTotal !== undefined) hudSet('hudMiniCount', `${miniNow}/${miniTotal}`);

  if (miniLeftMs !== undefined){
    const ms = Math.max(0, Number(miniLeftMs)||0);
    hudSet('hudMiniTimer', ms > 0 ? `${Math.ceil(ms/1000)}s` : '');
  }else{
    hudSet('hudMiniTimer', '');
  }

  if (goalNow !== undefined && goalTotal !== undefined && miniNow !== undefined && miniTotal !== undefined){
    hudSet('hudQProgress', `Goals ${goalNow}/${goalTotal} • Minis ${miniNow}/${miniTotal}`);
  }
}

/* ---------------- Grade helpers ---------------- */
function rankFromAcc(acc){
  const a = clamp(acc,0,100);
  if (a >= 97) return 'SSS';
  if (a >= 93) return 'SS';
  if (a >= 88) return 'S';
  if (a >= 80) return 'A';
  if (a >= 70) return 'B';
  return 'C';
}

/* ---------------- UI helpers ---------------- */
function setBodyView(view){
  const v = String(view || 'pc').toLowerCase();
  DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if (v === 'mobile') DOC.body.classList.add('view-mobile');
  else if (v === 'vr') DOC.body.classList.add('view-vr');
  else if (v === 'cvr') DOC.body.classList.add('view-cvr');
  else DOC.body.classList.add('view-pc');

  // toggle eyeR aria
  const eyeR = DOC.getElementById('eyeR');
  if (eyeR) eyeR.setAttribute('aria-hidden', (v==='vr'||v==='cvr') ? 'false' : 'true');

  // active pills
  const m = { pc:'btnViewPC', mobile:'btnViewMobile', vr:'btnViewVR', cvr:'btnViewCVR' };
  Object.values(m).forEach(id=>{
    const b = DOC.getElementById(id);
    if (b) b.classList.remove('active');
  });
  const act = DOC.getElementById(m[v] || m.pc);
  if (act) act.classList.add('active');
}

async function enterFullscreen(){
  try{
    const el = DOC.documentElement;
    if (!DOC.fullscreenElement && el.requestFullscreen){
      await el.requestFullscreen();
    }
  }catch(_){}
}

function showVrHintIfNeeded(){
  const view = getView();
  const hint = DOC.getElementById('vrHint');
  if (!hint) return;
  if (view==='vr' || view==='cvr'){
    hint.hidden = false;
  }else{
    hint.hidden = true;
  }
}

function getView(){
  const v = qs('view', null);
  if (v) return String(v).toLowerCase();
  if (DOC.body.classList.contains('view-vr')) return 'vr';
  if (DOC.body.classList.contains('view-cvr')) return 'cvr';
  if (DOC.body.classList.contains('view-mobile')) return 'mobile';
  return 'pc';
}

/* ---------------- Target spawning ---------------- */
function makeSafeRect(){
  // stage is full screen; we avoid HUD top + fever + shoot
  const stage = DOC.getElementById('gj-stage');
  const hud   = DOC.querySelector('.hha-hud');
  const fever = DOC.getElementById('hhaFever');
  const ctrls = DOC.querySelector('.hha-controls');

  const r = stage ? stage.getBoundingClientRect() : { left:0, top:0, right:innerWidth, bottom:innerHeight, width:innerWidth, height:innerHeight };

  let topReserve = 0;
  let botReserve = 0;

  // prefer actual heights
  if (hud){
    const hr = hud.getBoundingClientRect();
    topReserve = Math.max(topReserve, hr.bottom - r.top + 10);
  }else{
    topReserve = 160;
  }

  if (fever){
    const fr = fever.getBoundingClientRect();
    botReserve = Math.max(botReserve, r.bottom - fr.top + 8);
  }else{
    botReserve = 170;
  }

  if (ctrls){
    const cr = ctrls.getBoundingClientRect();
    botReserve = Math.max(botReserve, r.bottom - cr.top + 8);
  }

  // clamp to avoid tiny area
  const padX = 18;
  const padY = 18;

  let x1 = r.left + padX;
  let x2 = r.right - padX;
  let y1 = r.top + topReserve + padY;
  let y2 = r.bottom - botReserve - padY;

  const w = Math.max(1, x2-x1);
  const h = Math.max(1, y2-y1);

  // make targets more "mid-field" (แก้ปัญหาเป้าต่ำ)
  const midTop = y1 + h*0.10;       // allow a bit
  const midBot = y1 + h*0.85;       // cut very bottom
  y1 = midTop;
  y2 = midBot;

  // final clamp
  if (y2 - y1 < 160){
    // relax if too small
    y1 = r.top + 120;
    y2 = r.bottom - 220;
  }

  return { x1, y1, x2, y2 };
}

function pickPoint(rect){
  const x = rect.x1 + (rect.x2-rect.x1) * rnd01();
  const y = rect.y1 + (rect.y2-rect.y1) * rnd01();
  return { x, y };
}

function setTargetPos(el, x, y, s=1){
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.setProperty('--s', String(s));
}

/* ---------------- FX helpers ---------------- */
const Particles = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles || {
  scorePop(){},
  burstAt(){},
  celebrate(){}
};

function ringPulse(eye){
  try{
    const wrap = (eye === 'r') ? DOC.getElementById('eyeR') : DOC.getElementById('eyeL');
    if (!wrap) return;
    wrap.classList.add('atk-on');
    setTimeout(()=>wrap.classList.remove('atk-on'), 220);
  }catch(_){}
}

/* ---------------- End summary ---------------- */
function buildSummaryHTML(S){
  const acc = S.hitAll > 0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
  const grade = rankFromAcc(acc);
  const hub = S.hub || '../herohealth/hub.html';

  return `
    <div class="start-card" style="width:min(760px,calc(100% - 24px)); margin:0 auto; pointer-events:auto;">
      <div class="start-title">สรุปผล GoodJunkVR</div>
      <div class="start-desc">
        Score <b>${S.score|0}</b> • Miss <b>${S.misses|0}</b> • ComboMax <b>${S.comboMax|0}</b><br/>
        Accuracy <b>${acc}%</b> • Grade <b style="color:var(--accent)">${grade}</b>
      </div>
      <div class="start-meta">
        diff=${S.diff} • view=${S.view} • duration=${S.durationPlannedSec}s
      </div>
      <button id="btnBackHub" class="btn-start" type="button">กลับหน้า HUB</button>
    </div>
  `;
}

/* ---------------- Core game ---------------- */
export function boot(){
  if (!DOC) return;

  const diff = String(qs('diff','normal')).toLowerCase();
  const run  = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
  const view = String(qs('view','mobile')).toLowerCase();
  const durationPlannedSec = toInt(qs('time', qs('duration', '70')), 70);
  const hub = qs('hub', '../herohealth/hub.html');

  // bind DOM
  const hudMeta   = DOC.getElementById('hudMeta');
  const startMeta = DOC.getElementById('startMeta');
  const startOverlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const btnShoot = DOC.getElementById('btnShoot');

  const layerL = DOC.getElementById('gj-layer-l');
  const layerR = DOC.getElementById('gj-layer-r');

  if (!layerL || !layerR || !btnShoot || !btnStart || !startOverlay) return;

  // view setup
  setBodyView(view);
  showVrHintIfNeeded();

  // view buttons
  const btnViewPC = DOC.getElementById('btnViewPC');
  const btnViewMobile = DOC.getElementById('btnViewMobile');
  const btnViewVR = DOC.getElementById('btnViewVR');
  const btnViewCVR = DOC.getElementById('btnViewCVR');
  const btnEnterFS = DOC.getElementById('btnEnterFS');
  const btnEnterVR = DOC.getElementById('btnEnterVR');
  const vrHint = DOC.getElementById('vrHint');
  const btnVrOk = DOC.getElementById('btnVrOk');

  function gotoView(v){
    const u = new URL(ROOT.location.href);
    u.searchParams.set('view', v);
    u.searchParams.set('v', String(Date.now()));
    ROOT.location.href = u.toString();
  }
  if (btnViewPC) btnViewPC.onclick = ()=>gotoView('pc');
  if (btnViewMobile) btnViewMobile.onclick = ()=>gotoView('mobile');
  if (btnViewVR) btnViewVR.onclick = ()=>gotoView('vr');
  if (btnViewCVR) btnViewCVR.onclick = ()=>gotoView('cvr');

  if (btnEnterFS) btnEnterFS.onclick = ()=>enterFullscreen();
  if (btnEnterVR) btnEnterVR.onclick = async ()=>{
    // สำหรับ DOM VR: ใช้ fullscreen + split-eye (VR/cVR) แทน WebXR session
    await enterFullscreen();
    const cur = getView();
    if (cur !== 'vr' && cur !== 'cvr') gotoView('vr');
  };
  if (btnVrOk) btnVrOk.onclick = ()=>{ if (vrHint) vrHint.hidden = true; };

  const metaLine = `diff=${diff} • run=${run} • end=time • rush • view=${getView()}`;
  if (hudMeta) hudMeta.textContent = metaLine;
  if (startMeta) startMeta.textContent = metaLine;

  // state
  const cfg = (()=>{
    if (diff === 'easy') return { spawnMs: 740, size: 1.05, junkP: 0.30, scoreGood: 60, scoreJunk: -40, missLimit: 18 };
    if (diff === 'hard') return { spawnMs: 520, size: 0.92, junkP: 0.42, scoreGood: 80, scoreJunk: -60, missLimit: 12 };
    return { spawnMs: 620, size: 0.98, junkP: 0.36, scoreGood: 70, scoreJunk: -50, missLimit: 14 };
  })();

  const S = {
    diff,
    view:getView(),
    run,
    hub,
    durationPlannedSec,
    left: durationPlannedSec,
    started:false,
    ended:false,

    score:0,
    combo:0,
    comboMax:0,
    misses:0,

    hitGood:0,
    hitJunk:0,
    hitAll:0,

    goalsTotal:2,
    goalsCleared:0,
    miniTotal:7,
    miniCleared:0
  };

  function coach(mood, text, sub){
    emit('hha:coach', { mood, text, sub });
    hudCoachSet(mood, text, sub);
  }

  function updateScore(){
    const acc = S.hitAll > 0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);
    emit('hha:score', {
      score:S.score|0,
      combo:S.combo|0,
      misses:S.misses|0,
      grade,
      accuracyGoodPct: acc
    });

    hudSet('hhaScore', S.score|0);
    hudSet('hhaCombo', S.combo|0);
    hudSet('hhaMiss',  S.misses|0);
    hudSet('hhaGrade', grade);
  }

  function updateTime(){
    emit('hha:time', { left:S.left|0 });
    hudSet('hhaTime', Math.max(0, S.left|0));
  }

  function updateQuest(){
    // minimal quest model (ให้ HUD มีข้อมูล “ตลอด”)
    const goalTitle = `Goal: เก็บของดี`;
    const miniTitle = `Mini: หลีกขยะให้ได้`;

    emit('quest:update', {
      goalTitle,
      goalNow:S.goalsCleared,
      goalTotal:S.goalsTotal,
      miniTitle,
      miniNow:S.miniCleared,
      miniTotal:S.miniTotal
    });

    hudQuestSet(goalTitle, S.goalsCleared, S.goalsTotal, miniTitle, S.miniCleared, S.miniTotal, 0);
  }

  function setStartOverlay(show){
    startOverlay.hidden = !show;
  }

  // targets registry (sync between eyes)
  const targets = new Map(); // id -> { kind, x, y, elL, elR, bornMs }
  let seq = 1;

  const EMOJI_GOOD = ['🥦','🍎','🍉','🍌','🥬','🍍','🥕','🍇'];
  const EMOJI_JUNK = ['🍟','🍔','🥤','🍩','🍕','🍿','🍫'];

  function makeEl(kind, emoji, id){
    const el = DOC.createElement('div');
    el.className = `gj-target ${kind}`;
    el.textContent = emoji;
    el.dataset.tid = String(id);
    return el;
  }

  function spawnOne(){
    if (!S.started || S.ended) return;

    const rect = makeSafeRect();
    const p = pickPoint(rect);

    const isJunk = rnd01() < cfg.junkP;
    const kind = isJunk ? 'junk' : 'good';
    const emoji = isJunk
      ? EMOJI_JUNK[(Math.random()*EMOJI_JUNK.length)|0]
      : EMOJI_GOOD[(Math.random()*EMOJI_GOOD.length)|0];

    const id = seq++;
    const elL = makeEl(kind, emoji, id);
    const elR = makeEl(kind, emoji, id);

    // size: VR slightly bigger
    const v = getView();
    const s = (v==='vr'||v==='cvr') ? (cfg.size*1.05) : cfg.size;

    setTargetPos(elL, p.x, p.y, s);
    setTargetPos(elR, p.x, p.y, s);

    layerL.appendChild(elL);
    layerR.appendChild(elR);

    targets.set(id, { kind, x:p.x, y:p.y, elL, elR, bornMs: now() });

    // click = hit
    elL.addEventListener('click', ()=>hit(id,'click'));
    elR.addEventListener('click', ()=>hit(id,'click'));
  }

  function removeTarget(id){
    const t = targets.get(id);
    if (!t) return;
    targets.delete(id);
    try{ t.elL && t.elL.remove(); }catch(_){}
    try{ t.elR && t.elR.remove(); }catch(_){}
  }

  function hit(id, via){
    const t = targets.get(id);
    if (!t || S.ended) return;

    // FX + ring
    ringPulse('l');
    if (S.view==='vr' || S.view==='cvr') ringPulse('r');

    const x = t.x, y = t.y;

    // pop
    try{ t.elL.classList.add('hit'); }catch(_){}
    try{ t.elR.classList.add('hit'); }catch(_){}

    // scoring
    if (t.kind === 'good'){
      S.hitGood++;
      S.hitAll++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);
      S.score += cfg.scoreGood + Math.min(40, S.combo*2);
      Particles.scorePop(x,y,`+${cfg.scoreGood}`, 'good');
      Particles.burstAt(x,y,'good');
      emit('hha:judge', { text:'GOOD!', kind:'good', via });
      coach('happy', 'ดีมาก! เก็บของดีต่อ 🥦✨', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้');
    }else{
      S.hitJunk++;
      S.hitAll++;
      S.combo = 0;
      S.misses++; // junk hit counts as miss
      S.score += cfg.scoreJunk;
      Particles.scorePop(x,y,`${cfg.scoreJunk}`, 'bad');
      Particles.burstAt(x,y,'bad');
      emit('hha:judge', { text:'JUNK!', kind:'bad', via });
      coach('sad', 'โดนขยะ! ระวัง 🍟🚫', 'พยายามเล็งของดี');
    }

    updateScore();

    // quick quest progress (simple)
    // goal: clear 2 “milestones” = hitGood >= 10, hitGood >= 25
    const g1 = (S.hitGood >= 10);
    const g2 = (S.hitGood >= 25);
    S.goalsCleared = (g1?1:0) + (g2?1:0);

    // mini: every 5 good hits increases
    S.miniCleared = clamp(Math.floor(S.hitGood/5), 0, S.miniTotal);

    updateQuest();

    setTimeout(()=>removeTarget(id), 140);
  }

  function shoot(){
    if (!S.started || S.ended) return;

    // choose nearest target to crosshair center in LEFT eye
    const eye = DOC.getElementById('eyeL');
    const cr = eye.getBoundingClientRect();
    const cx = cr.left + cr.width/2;
    const cy = cr.top  + cr.height/2;

    let bestId = null;
    let bestD = 1e18;

    targets.forEach((t,id)=>{
      const dx = (t.x - cx);
      const dy = (t.y - cy);
      const d2 = dx*dx + dy*dy;
      if (d2 < bestD){
        bestD = d2;
        bestId = id;
      }
    });

    // require within radius
    const radius = (getView()==='vr' || getView()==='cvr') ? 170 : 140;
    if (bestId !== null && bestD <= radius*radius){
      hit(bestId,'shoot');
    }else{
      // miss shot (no target)
      S.combo = 0;
      S.misses++;
      emit('hha:judge', { text:'MISS', kind:'bad', via:'shoot' });
      coach('neutral', 'พลาด! เล็งกลางแล้วกดยิงนะ 🎯', 'ใกล้เป้าอีกนิด');
      updateScore();
    }

    // end by miss limit
    if (S.misses >= cfg.missLimit){
      endGame('miss-limit');
    }
  }

  btnShoot.addEventListener('click', shoot);

  // start
  btnStart.addEventListener('click', ()=>{
    setStartOverlay(false);
    startGame();
  });

  function startGame(){
    if (S.started) return;
    S.started = true;
    S.ended = false;
    S.left = durationPlannedSec;

    coach('neutral', 'เริ่มแล้ว! เก็บของดี หลีกขยะ 🥦🚫', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้');
    updateScore();
    updateTime();
    updateQuest();

    // kickoff spawns
    for (let i=0;i<3;i++) setTimeout(spawnOne, 120*i);

    // timers
    let lastTick = now();
    let accSpawn = 0;

    function loop(){
      if (S.ended) return;
      const t = now();
      const dt = Math.min(80, t-lastTick);
      lastTick = t;

      // countdown
      accSpawn += dt;
      if (accSpawn >= cfg.spawnMs){
        accSpawn -= cfg.spawnMs;
        spawnOne();
      }

      // time update (every 1000ms)
      // use real-time drift-safe
      if (!loop._acc) loop._acc = 0;
      loop._acc += dt;
      if (loop._acc >= 1000){
        loop._acc -= 1000;
        S.left = Math.max(0, (S.left|0) - 1);
        updateTime();
        if (S.left <= 0){
          endGame('time');
          return;
        }
      }

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  function endGame(reason){
    if (S.ended) return;
    S.ended = true;

    // clear targets
    targets.forEach((_,id)=>removeTarget(id));
    targets.clear();

    const acc = S.hitAll > 0 ? Math.round((S.hitGood/S.hitAll)*100) : 0;
    const grade = rankFromAcc(acc);

    emit('hha:end', {
      reason,
      scoreFinal:S.score|0,
      comboMax:S.comboMax|0,
      misses:S.misses|0,
      accuracyGoodPct: acc,
      grade
    });

    // localStorage last summary
    try{
      const last = {
        ts: Date.now(),
        game: 'GoodJunkVR',
        diff: S.diff,
        view: S.view,
        durationPlannedSec: S.durationPlannedSec,
        scoreFinal: S.score|0,
        comboMax: S.comboMax|0,
        misses: S.misses|0,
        accuracyGoodPct: acc,
        grade,
        reason
      };
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(last));
    }catch(_){}

    // show summary
    const host = DOC.getElementById('end-summary');
    if (host){
      host.innerHTML = buildSummaryHTML(S);
      const btn = DOC.getElementById('btnBackHub');
      if (btn){
        btn.onclick = ()=>{
          try{
            // flush logger if exists
            if (ROOT.HHA_Cloud_Logger && typeof ROOT.HHA_Cloud_Logger.flush === 'function'){
              ROOT.HHA_Cloud_Logger.flush();
            }
          }catch(_){}
          ROOT.location.href = S.hub || '../herohealth/hub.html';
        };
      }
    }

    coach('happy', `จบแล้ว! เก่งมาก 💚 (Grade ${grade})`, 'กดกลับ HUB เพื่อไปเกมถัดไป');
    Particles.celebrate();
  }

  // show start overlay by default
  setStartOverlay(true);

  // VR hint initial
  showVrHintIfNeeded();

  // initial UI
  updateScore();
  updateTime();
  updateQuest();
}