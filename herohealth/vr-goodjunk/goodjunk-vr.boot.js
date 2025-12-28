// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Boot: start-gated + stereo switch + context + logger hook

import { boot as goodjunkBoot } from './goodjunk.safe.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function qs(name, def=null){
  try{ return (new URL(ROOT.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b, v)); }

function isStereoWanted(){
  const vr = String(qs('vr','')||'').toLowerCase();
  const stereo = String(qs('stereo','')||'').toLowerCase();
  return (vr === 'cardboard' || stereo === '1' || stereo === 'true');
}

function buildContextFromQuery(){
  const get = (k)=> String(qs(k,'')||'');
  return {
    projectTag: get('projectTag') || 'GoodJunkVR',
    runMode: (String(get('run')||'play').toLowerCase() === 'research') ? 'research' : 'play',
    studyId: get('studyId'),
    phase: get('phase'),
    conditionGroup: get('conditionGroup'),
    sessionOrder: get('sessionOrder'),
    blockLabel: get('blockLabel'),
    siteCode: get('siteCode'),
    schoolYear: get('schoolYear'),
    semester: get('semester'),
    sessionId: get('sessionId') || get('sid'),
    gameVersion: get('gameVersion') || 'goodjunk.web.v1',

    studentKey: get('studentKey'),
    schoolCode: get('schoolCode'),
    schoolName: get('schoolName'),
    classRoom: get('classRoom'),
    studentNo: get('studentNo'),
    nickName: get('nickName'),
    gender: get('gender'),
    age: get('age'),
    gradeLevel: get('gradeLevel'),
    heightCm: get('heightCm'),
    weightKg: get('weightKg'),
    bmi: get('bmi'),
    bmiGroup: get('bmiGroup'),
    vrExperience: get('vrExperience'),
    gameFrequency: get('gameFrequency'),
    handedness: get('handedness'),
    visionIssue: get('visionIssue'),
    healthDetail: get('healthDetail'),
    consentParent: get('consentParent'),
  };
}

function setupLoggerFromQuery(){
  const log = qs('log', '');
  if (!log) return;
  try{
    if (ROOT.HHA_CLOUD_LOGGER && typeof ROOT.HHA_CLOUD_LOGGER.setEndpoint === 'function'){
      ROOT.HHA_CLOUD_LOGGER.setEndpoint(log);
      return;
    }
    if (ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.setEndpoint === 'function'){
      ROOT.HHACloudLogger.setEndpoint(log);
      return;
    }
  }catch(_){}
}

function setStartMeta(){
  const diff = String(qs('diff','normal')||'normal');
  const run  = String(qs('run','play')||'play');
  const time = clamp(Number(qs('time','80')), 30, 600)|0;
  const end  = String(qs('end','time')||'time');
  const challenge = String(qs('challenge','rush')||'rush');
  const m = DOC.getElementById('startMeta');
  if (m){
    m.textContent = `diff=${diff} • run=${run} • time=${time}s • end=${end} • challenge=${challenge}`;
  }
  const hudMeta = DOC.getElementById('hudMeta');
  if (hudMeta){
    hudMeta.textContent = `diff=${diff} • run=${run} • end=${end} • ${challenge}`;
  }
}

function hideStartOverlay(){
  const ov = DOC.getElementById('startOverlay');
  if (!ov) return;
  ov.style.display = 'none';
}

function main(){
  if (!DOC) return;

  // stereo
  if (isStereoWanted()){
    DOC.body.classList.add('gj-stereo');
    const eyeR = DOC.getElementById('gj-eyeR');
    if (eyeR) eyeR.setAttribute('aria-hidden','false');
  } else {
    DOC.body.classList.remove('gj-stereo');
  }

  setupLoggerFromQuery();

  setStartMeta();

  const ctx = buildContextFromQuery();

  const layerEl = DOC.getElementById('gj-layer');
  const layerElR = DOC.getElementById('gj-layerR');
  const crosshairEl = DOC.getElementById('gj-crosshair');
  const crosshairElR = DOC.getElementById('gj-crosshairR');
  const ringEl = DOC.getElementById('atk-ring');
  const ringElR = DOC.getElementById('atk-ringR');
  const laserEl = DOC.getElementById('atk-laser');
  const laserElR = DOC.getElementById('atk-laserR');

  const btnStart = DOC.getElementById('btnStart');

  const start = ()=>{
    hideStartOverlay();

    goodjunkBoot({
      layerEl,
      layerElR,
      crosshairEl,
      crosshairElR,
      ringEl, ringElR,
      laserEl, laserElR,
      shootEl: DOC.getElementById('btnShoot'),

      diff: String(qs('diff','normal')||'normal'),
      run:  String(qs('run','play')||'play'),
      time: clamp(Number(qs('time','80')), 30, 600)|0,
      endPolicy: String(qs('end','time')||'time'),
      challenge: String(qs('challenge','rush')||'rush'),

      seed: qs('seed', null),
      sessionId: qs('sessionId', qs('sid','')),

      context: ctx,

      // safeMargins: กัน HUD บน/ล่าง + fever/controls
      safeMargins: { top: 138, bottom: 182, left: 26, right: 26 },
    });
  };

  if (btnStart){
    btnStart.addEventListener('click', (e)=>{ e.preventDefault?.(); start(); });
  } else {
    // fallback: auto start
    start();
  }
}

main();