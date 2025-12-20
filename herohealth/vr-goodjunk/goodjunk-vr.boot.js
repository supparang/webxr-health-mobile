// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Production boot: binds UI, logger, QuestDirector, engine, summary

import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';
import { initCloudLogger } from '../vr/hha-cloud-logger.js';

import { makeQuestDirector } from './quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

import {
  $,
  clamp, normDiff, normCh, normRun,
  makeCoach,
  runCountdown,
  waitSceneReady,
  initVRButton,
  tryEnterVR,
  makeLoggerBadge,
  celebrateQuest,
  bigCelebrateAll
} from './goodjunk-vr.ui.js';

// ---- bfcache fix ----
window.addEventListener('pageshow', (e)=>{
  if (e.persisted) window.location.reload();
});

// ---- Elements ----
const elScore = $('hud-score');
const elCombo = $('hud-combo');
const elMiss  = $('hud-miss');
const elDiff  = $('hud-diff-label');
const elChal  = $('hud-challenge-label');
const elTime  = $('hud-time-label');
const elJudge = $('hud-judge');

const elRunLabel = $('hud-run-label');
const elPill = $('hud-pill');
const startSub = $('start-sub');

const elQuestMain = $('hud-quest-main');
const elQuestMini = $('hud-quest-mini');
const elQuestMainBar = $('hud-quest-main-bar');
const elQuestMiniBar = $('hud-quest-mini-bar');
const elQuestMainCap = $('hud-quest-main-caption');
const elQuestMiniCap = $('hud-quest-mini-caption');
const elQuestHint = $('hud-quest-hint');
const elMiniCount = $('hud-mini-count');

const elCoachBubble = $('coach-bubble');
const elCoachText   = $('coach-text');
const elCoachEmoji  = $('coach-emoji');

const elTouchHint = $('touch-hint');

const btnVR      = $('btn-vr');
const elCountdown = $('start-countdown');
const elBigCelebrate = $('big-celebrate');

const startOverlay = $('start-overlay');
const btnStart2D = $('btn-start-2d');
const btnStartVR = $('btn-start-vr');
const selDiff = $('sel-diff');
const selChallenge = $('sel-challenge');

const logDot  = $('logdot');
const logText = $('logtext');

const coach = makeCoach(elCoachBubble, elCoachText, elCoachEmoji);
const loggerBadge = makeLoggerBadge(logDot, logText);

// ---- URL params from Hub ----
const pageUrl = new window.URL(window.location.href);
const URL_RUN = (pageUrl.searchParams.get('run') || 'play').toLowerCase();
const URL_DIFF = (pageUrl.searchParams.get('diff') || 'normal').toLowerCase();
const URL_CH = (pageUrl.searchParams.get('ch') || pageUrl.searchParams.get('challenge') || 'rush').toLowerCase();
const URL_TIME_RAW = parseInt(pageUrl.searchParams.get('time') || '', 10);

const DEFAULT_TIME = { easy:80, normal:60, hard:50 };
const RUN_MODE = normRun(URL_RUN);
const DIFF_INIT = normDiff(URL_DIFF);
const CH_INIT = normCh(URL_CH);
const DUR_INIT = clamp(
  (Number.isFinite(URL_TIME_RAW) ? URL_TIME_RAW : (DEFAULT_TIME[DIFF_INIT] || 60)),
  20, 180
);

// ---- Logger event ----
window.addEventListener('hha:logger', loggerBadge.onEvent);

// ---- helpers ----
function getProfile(){
  let studentProfile = null;
  let studentKey = null;
  try{
    const raw = sessionStorage.getItem('HHA_STUDENT_PROFILE');
    if (raw){
      studentProfile = JSON.parse(raw);
      studentKey = studentProfile.studentKey || null;
    }
  }catch(_){}
  return { studentProfile, studentKey };
}
function hasProfile(p){
  if (!p || typeof p !== 'object') return false;
  return !!(p.studentId || p.name || p.nickName || p.studentNo);
}

function applyRunPill(){
  if (elRunLabel) elRunLabel.textContent = RUN_MODE.toUpperCase();
  if (elPill) elPill.classList.toggle('research', RUN_MODE === 'research');
  if (startSub){
    startSub.textContent = (RUN_MODE === 'research')
      ? 'โหมดวิจัย: ต้องมี Student ID หรือชื่อเล่นจาก Hub แล้วค่อยกดเริ่ม ✅'
      : 'เลือกความยาก + โหมดความมันส์ แล้วกดเริ่ม 1 ครั้ง (เพื่อเปิดสิทธิ์เสียง/VR) ✅';
  }
}

function prefillFromHub(){
  try{ selDiff.value = DIFF_INIT; }catch(_){}
  try{ selChallenge.value = CH_INIT; }catch(_){}
  applyRunPill();

  if (elDiff) elDiff.textContent = DIFF_INIT.toUpperCase();
  if (elChal) elChal.textContent = CH_INIT.toUpperCase();
  if (elTime) elTime.textContent = DUR_INIT + 's';

  coach.setCoachFace('neutral');

  const endpoint = sessionStorage.getItem('HHA_LOG_ENDPOINT');
  if (endpoint) loggerBadge.set(null, 'logger: endpoint set ✓');
  else loggerBadge.set(null, 'logger: endpoint missing (hub?)');
}

function attachTouch(cameraEl){
  if (!cameraEl) return;
  attachTouchLook(cameraEl, {
    sensitivity: 0.26,
    areaEl: document.body,
    onActiveChange(active){
      if (active){
        elTouchHint && elTouchHint.classList.add('show');
        setTimeout(()=> elTouchHint && elTouchHint.classList.remove('show'), 2400);
      }
    }
  });
}

// ---- Quest state ----
const qState = {
  score:0, goodHits:0, miss:0, comboMax:0, timeLeft:0,
  streakGood:0,
  goldHits:0,
  goldHitsThisMini:false,
  blocks:0,
  usedMagnet:false,
  timePlus:0,

  safeNoJunkSeconds:0,
  bossCleared:false,
  challenge: CH_INIT,
  runMode: RUN_MODE
};

window.addEventListener('quest:miniStart', ()=>{
  qState.goldHitsThisMini = false;
  qState.usedMagnet = false;
  qState.timePlus = 0;
  qState.blocks = 0;
  qState.safeNoJunkSeconds = 0;
  qState.streakGood = 0;
});

let started = false;
setInterval(()=>{
  if (!started) return;
  qState.safeNoJunkSeconds = (qState.safeNoJunkSeconds|0) + 1;
}, 1000);

// ---- Quest Director ----
let Q = null;

// HUD listeners
window.addEventListener('hha:judge', (e)=>{
  const label = (e.detail||{}).label || '';
  if (elJudge) elJudge.textContent = label;
});

window.addEventListener('hha:time', (e)=>{
  const sec = (e.detail||{}).sec;
  if (typeof sec === 'number' && sec >= 0){
    if (elTime) elTime.textContent = sec + 's';
    qState.timeLeft = sec|0;
    if (Q) Q.tick(qState);
  }
});

window.addEventListener('hha:score', (e)=>{
  const d = e.detail || {};
  if (typeof d.score === 'number'){ qState.score = d.score|0; if (elScore) elScore.textContent = String(qState.score); }
  if (typeof d.goodHits === 'number'){ qState.goodHits = d.goodHits|0; }
  if (typeof d.misses === 'number'){ qState.miss = d.misses|0; if (elMiss) elMiss.textContent = String(qState.miss); }
  if (typeof d.comboMax === 'number'){ qState.comboMax = d.comboMax|0; if (elCombo) elCombo.textContent = String(qState.comboMax); }
  if (typeof d.challenge === 'string'){ qState.challenge = normCh(d.challenge); }
  if (Q) Q.tick(qState);
});

// Quest events from engine
window.addEventListener('quest:goodHit', (e)=>{
  const d = e.detail || {};
  if (d.type === 'gold'){
    qState.goldHits++;
    qState.goldHitsThisMini = true;
  }
  qState.streakGood = (qState.streakGood|0) + 1;

  if (Q){
    const isPerfect = String(d.judgment||'').toLowerCase().includes('perfect');
    Q.onEvent(isPerfect ? 'perfectHit' : 'goodHit', qState);
  }
});
window.addEventListener('quest:badHit', ()=>{
  qState.safeNoJunkSeconds = 0;
  qState.streakGood = 0;
  if (Q) Q.onEvent('junkHit', qState);
});
window.addEventListener('quest:block', ()=>{
  qState.blocks = (qState.blocks|0) + 1;
  if (Q) Q.onEvent('shieldBlock', qState);
});
window.addEventListener('quest:power', (e)=>{
  const p = (e.detail||{}).power;
  if (p === 'magnet') qState.usedMagnet = true;
  if (p === 'time')   qState.timePlus = (qState.timePlus|0) + 1;
  if (Q) Q.onEvent('power', qState);
});
window.addEventListener('quest:bossClear', ()=>{
  qState.bossCleared = true;
  if (Q) Q.onEvent('bossClear', qState);
});

// quest:update schema
window.addEventListener('quest:update', (e)=>{
  const d = e.detail || {};
  const goal = d.goal || null;
  const mini = d.mini || null;
  const meta = d.meta || {};

  if (goal){
    const cur = (goal.cur|0);
    const max = (goal.max|0);
    const pct = Math.max(0, Math.min(1, Number(goal.pct ?? (max>0?cur/max:0))));
    if (elQuestMain) elQuestMain.textContent = goal.title || 'ภารกิจหลัก';
    if (elQuestMainBar) elQuestMainBar.style.width = Math.round(pct*100) + '%';
    if (elQuestMainCap) elQuestMainCap.textContent = `${cur} / ${max}`;
  } else {
    if (elQuestMain) elQuestMain.textContent = 'ภารกิจหลัก (ครบ) ✅';
    if (elQuestMainBar) elQuestMainBar.style.width = '100%';
    if (elQuestMainCap) elQuestMainCap.textContent = '';
  }

  if (mini){
    const cur = (mini.cur|0);
    const max = (mini.max|0);
    const pct = Math.max(0, Math.min(1, Number(mini.pct ?? (max>0?cur/max:0))));
    if (elQuestMini) elQuestMini.textContent = 'Mini: ' + (mini.title || '');
    if (elQuestMiniBar) elQuestMiniBar.style.width = Math.round(pct*100) + '%';

    if (typeof mini.timeLeft === 'number' && typeof mini.timeTotal === 'number' && mini.timeTotal > 0){
      const secLeft = Math.max(0, mini.timeLeft/1000);
      if (elQuestMiniCap) elQuestMiniCap.textContent = `เหลือ ${secLeft >= 10 ? Math.round(secLeft) : (Math.round(secLeft*10)/10)}s`;
    } else {
      if (elQuestMiniCap) elQuestMiniCap.textContent = `${cur} / ${max}`;
    }
  } else {
    if (elQuestMini) elQuestMini.textContent = 'Mini quest (ครบ) ✅';
    if (elQuestMiniBar) elQuestMiniBar.style.width = '100%';
    if (elQuestMiniCap) elQuestMiniCap.textContent = '';
  }

  let hint = '';
  if (goal && String(goal.state||'').toLowerCase().includes('clear')) hint = 'GOAL CLEAR!';
  else if (mini && String(mini.state||'').toLowerCase().includes('clear')) hint = 'MINI CLEAR!';
  else if (goal && Number(goal.pct||0) >= 0.8) hint = 'ใกล้แล้ว! 🔥';
  else if (mini && Number(mini.pct||0) >= 0.8) hint = 'อีกนิดเดียว! ⚡';
  if (elQuestHint) elQuestHint.textContent = hint;

  const miniCount = (meta.miniCount|0);
  const minisCleared = (Q && Q.getState) ? (Q.getState().minisCleared|0) : 0;
  if (elMiniCount) elMiniCount.textContent = `mini ผ่าน ${minisCleared} • เล่นอยู่ ${miniCount+1}`;
});

window.addEventListener('quest:cleared', (e)=>{
  const d = e.detail || {};
  const kind = String(d.kind||'').toLowerCase();
  if (kind.includes('goal')) celebrateQuest('goal', coach);
  else celebrateQuest('mini', coach);
});

// ---- Boot ----
function bootOnce({ wantVR }){
  if (started) return;

  // research gate
  if (RUN_MODE === 'research'){
    const { studentProfile } = getProfile();
    if (!hasProfile(studentProfile)){
      alert('โหมดวิจัย: กรุณากรอก "รหัสนักเรียน" หรือ "ชื่อเล่น" ที่ Hub ก่อน แล้วกลับมาเริ่มใหม่');
      window.location.href = './hub.html';
      return;
    }
  }

  started = true;
  if (startOverlay) startOverlay.style.display = 'none';

  const diff = normDiff(selDiff?.value || DIFF_INIT);
  const chal = normCh(selChallenge?.value || CH_INIT);
  const durationSec = clamp(DUR_INIT, 20, 180);

  qState.challenge = chal;
  qState.runMode = RUN_MODE;

  if (elDiff) elDiff.textContent = diff.toUpperCase();
  if (elChal) elChal.textContent = chal.toUpperCase();
  if (elTime) elTime.textContent = durationSec + 's';

  if (elScore) elScore.textContent = '0';
  if (elCombo) elCombo.textContent = '0';
  if (elMiss)  elMiss.textContent  = '0';
  if (elJudge) elJudge.textContent = '\u00A0';

  coach.setCoach('แตะของดี! หลบ junk! ไปเลย! ⚡', 'neutral');

  const { studentProfile, studentKey } = getProfile();

  const endpoint =
    sessionStorage.getItem('HHA_LOG_ENDPOINT') ||
    'https://script.google.com/macros/s/AKfycby7IBVmpmEydNDp5BR3CMaSAjvF7ljptaDwvow_L781iDLsbtpuiFmKviGUnugFerDtQg/exec';

  loggerBadge.state.pending = true;
  loggerBadge.state.ok = false;
  loggerBadge.state.message = '';
  loggerBadge.set(null, 'logger: init…');

  initCloudLogger({
    endpoint,
    projectTag: 'HeroHealth-GoodJunkVR',
    mode: 'GoodJunkVR',
    runMode: RUN_MODE,
    diff,
    challenge: chal,
    durationPlannedSec: durationSec,
    studentKey,
    profile: studentProfile,
    debug: true
  });

  const cam = document.querySelector('#gj-camera');
  attachTouch(cam);
  initVRButton(btnVR);

  Q = makeQuestDirector({
    diff,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 2,
    maxMini: 999,
    challenge: chal
  });
  Q.start(qState);

  runCountdown(elCountdown, async ()=>{
    waitSceneReady(async ()=>{
      if (wantVR) await tryEnterVR();

      const ENGINE = goodjunkBoot(diff, {
        runMode: RUN_MODE,
        challenge: chal,
        durationSec,
        layerEl: document.getElementById('gj-layer')
      });

      window.__GJ_ENGINE__ = ENGINE;
    });
  });
}

// Summary end hook (กันซ้ำ + merge stats + big celebrate)
document.addEventListener('hha:end', (e)=>{
  try{ e.stopImmediatePropagation(); e.stopPropagation(); }catch(_){}

  const final = (e && e.detail) ? e.detail : {};
  const qs = (Q && Q.getState) ? Q.getState() : {};
  const goalsCleared = qs.goalsCleared|0;
  const minisCleared = qs.minisCleared|0;

  const goalsTotal = 2;
  const allQuest = (goalsCleared >= goalsTotal);

  const merged = {
    projectTag: 'HeroHealth-GoodJunkVR',
    mode: 'GoodJunkVR',
    diff: final.diff || DIFF_INIT,
    durationSec: final.durationSec || DUR_INIT,

    score: final.scoreFinal ?? final.score ?? qState.score ?? 0,
    grade: final.grade || 'A',

    goalsCleared,
    goalsTotal,
    minisCleared,

    perfect: final.perfect ?? 0,
    good: final.good ?? qState.goodHits ?? 0,
    miss: final.misses ?? final.miss ?? qState.miss ?? 0,

    challenge: final.challenge || qState.challenge || CH_INIT,
    runMode: final.runMode || RUN_MODE,

    hubUrl: './hub.html',
    restartUrl: window.location.href.split('#')[0],

    logger: {
      pending: !!loggerBadge.state.pending,
      ok: !!loggerBadge.state.ok,
      message: loggerBadge.state.message || ''
    }
  };

  const show = ()=>{
    if (window.HHA_Summary && typeof window.HHA_Summary.show === 'function'){
      window.HHA_Summary.show(merged);
    } else {
      document.dispatchEvent(new CustomEvent('hha:end', { detail: merged }));
    }
    coach.setCoach('จบเกมแล้ว! ดูสรุปคะแนนได้เลย 🎉', (merged.miss|0)<=3 ? 'happy' : 'neutral');
  };

  if (allQuest) bigCelebrateAll(elBigCelebrate, show);
  else show();

}, true);

// Buttons + defaults
btnStart2D?.addEventListener('click', ()=> bootOnce({ wantVR:false }));
btnStartVR?.addEventListener('click', ()=> bootOnce({ wantVR:true }));
prefillFromHub();
