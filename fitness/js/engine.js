// === /fitness/js/engine.js ===
// Shadow Breaker Engine (module)
// ✅ View switching (menu/play/result)
// ✅ DOM targets via DomRendererShadow + FxBurst
// ✅ FX won't disappear (assumes fx-burst.js patched/fallback)
// ✅ AI bridge via ai-features.js (no export issues)
// ✅ Target size tuned + mobile safe
// ✅ Simple boss phases + fever + shield + scoring

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { FxBurst } from './fx-burst.js';
import { AI } from './ai-features.js';

const qs = (k, d=null) => { try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };
const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
const now = ()=>performance.now();

function isMobileLike(){
  const ua = (navigator.userAgent||'').toLowerCase();
  return /android|iphone|ipad|ipod|mobile/.test(ua) || (window.innerWidth < 740);
}

function setActiveView(id){
  const views = ['sb-view-menu','sb-view-play','sb-view-result'];
  for(const vid of views){
    const el = document.getElementById(vid);
    if(!el) continue;
    el.classList.toggle('is-active', vid === id);
  }
}

function fmt1(n){ return (Math.round(n*10)/10).toFixed(1); }

function gradeFromAcc(acc){
  if (acc >= 0.92) return 'S';
  if (acc >= 0.84) return 'A';
  if (acc >= 0.72) return 'B';
  if (acc >= 0.60) return 'C';
  return 'D';
}

// ---------- Boss set ----------
const BOSSES = [
  { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', hp: 140 },
  { name:'Spark Cat', emoji:'🐱⚡', desc:'จังหวะเร็วขึ้น—อย่าหลง decoy', hp: 180 },
  { name:'Titan Core', emoji:'🧿', desc:'ยากสุด! ใช้ Shield กัน bomb', hp: 230 }
];

// ---------- Engine State ----------
const S = {
  mode: 'normal',     // normal|research
  diff: 'normal',     // easy|normal|hard
  durationSec: 70,
  running: false,

  tStart: 0,
  tLeft: 0,

  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,

  judged: 0,
  hitPerfect: 0,
  hitGood: 0,
  hitBad: 0,

  youHp: 100,
  bossIndex: 0,
  bossHp: 0,
  bossHpMax: 0,
  phase: 1,
  bossesCleared: 0,

  shield: 0,
  fever: 0,         // 0..100
  feverOnUntil: 0,  // performance time

  // targets
  nextId: 1,
  active: new Map(), // id -> {id,type,spawnAt,expireAt,sizePx,bossEmoji}

  // timers
  tickHandle: 0,
  spawnHandle: 0
};

function getBoss(){
  return BOSSES[Math.min(S.bossIndex, BOSSES.length-1)];
}

function setBoss(idx){
  S.bossIndex = idx;
  const b = getBoss();
  S.bossHpMax = b.hp;
  S.bossHp = b.hp;
  S.phase = idx + 1;
  // UI
  const tName = document.getElementById('sb-current-boss-name');
  const mEmoji = document.getElementById('sb-meta-emoji');
  const mName = document.getElementById('sb-meta-name');
  const mDesc = document.getElementById('sb-meta-desc');
  const pLabel = document.getElementById('sb-boss-phase-label');
  if (tName) tName.textContent = `${b.name} ${b.emoji}`;
  if (mEmoji) mEmoji.textContent = b.emoji;
  if (mName) mName.textContent = b.name;
  if (mDesc) mDesc.textContent = b.desc;
  if (pLabel) pLabel.textContent = String(S.phase);
}

function updateBars(){
  const you = clamp(S.youHp/100, 0, 1);
  const boss = clamp(S.bossHp / Math.max(1, S.bossHpMax), 0, 1);

  const a = document.getElementById('sb-hp-you-top');
  const b = document.getElementById('sb-hp-boss-top');
  const c = document.getElementById('sb-hp-you-bottom');
  const d = document.getElementById('sb-hp-boss-bottom');
  if(a) a.style.transform = `scaleX(${you})`;
  if(c) c.style.transform = `scaleX(${you})`;
  if(b) b.style.transform = `scaleX(${boss})`;
  if(d) d.style.transform = `scaleX(${boss})`;

  const feverBar = document.getElementById('sb-fever-bar');
  if (feverBar) feverBar.style.transform = `scaleX(${clamp(S.fever/100,0,1)})`;

  const feverLabel = document.getElementById('sb-label-fever');
  if (feverLabel){
    const on = now() < S.feverOnUntil;
    feverLabel.textContent = on ? 'ON' : (S.fever >= 100 ? 'READY' : 'BUILD');
    feverLabel.classList.toggle('on', on);
  }
}

function updateHud(){
  const t = document.getElementById('sb-text-time');
  const s = document.getElementById('sb-text-score');
  const c = document.getElementById('sb-text-combo');
  const p = document.getElementById('sb-text-phase');
  const m = document.getElementById('sb-text-miss');
  const sh = document.getElementById('sb-text-shield');

  if(t) t.textContent = `${fmt1(S.tLeft)} s`;
  if(s) s.textContent = String(S.score);
  if(c) c.textContent = String(S.combo);
  if(p) p.textContent = String(S.phase);
  if(m) m.textContent = String(S.miss);
  if(sh) sh.textContent = String(S.shield);

  const shLabel = document.getElementById('sb-boss-shield-label');
  if(shLabel) shLabel.textContent = String(S.shield);

  updateBars();
}

function setCenterMsg(text, cls=''){
  const el = document.getElementById('sb-msg-main');
  if(!el) return;
  el.classList.remove('good','bad','miss','perfect');
  if(cls) el.classList.add(cls);
  el.textContent = text;
}

// ---------- difficulty tuning ----------
function baseTargetSizePx(){
  // ✅ ทำให้ “ไม่ใหญ่เกิน” บนมือถือ + ไม่เล็กเกินบน PC
  // easy: ใหญ่ขึ้น, hard: เล็กลง
  const mobile = isMobileLike();
  let base = mobile ? 118 : 108;

  if (S.diff === 'easy') base += 22;
  else if (S.diff === 'hard') base -= 10;

  // slight scale with screen width
  const w = window.innerWidth || 360;
  base += clamp((w - 360) * 0.02, 0, 18);

  return clamp(base, 90, mobile ? 170 : 150);
}

function ttlMsByDiff(type){
  // how long target stays before expire
  let ttl = 900;
  if (S.diff === 'easy') ttl = 1150;
  if (S.diff === 'hard') ttl = 760;

  if (type === 'bossface') ttl += 220;
  if (type === 'heal' || type === 'shield') ttl += 120;
  if (type === 'bomb') ttl -= 80;

  return clamp(ttl, 520, 1600);
}

function spawnEveryMs(){
  let ms = 560;
  if (S.diff === 'easy') ms = 680;
  if (S.diff === 'hard') ms = 460;

  // AI fair pacing (only when ?ai=1 and normal mode)
  if (AI.isAssistEnabled()){
    // if struggling, slow down a bit
    const judged = Math.max(1, S.judged);
    const missRate = S.miss / judged;
    if (missRate > 0.35) ms += 90;
    if (missRate > 0.50) ms += 120;

    // if very good, slightly faster
    const acc = (S.hitPerfect + S.hitGood + S.hitBad) / judged;
    if (acc > 0.85 && missRate < 0.22) ms -= 40;
  }
  return clamp(ms, 360, 920);
}

function rollType(){
  // distribution
  const r = Math.random();
  if (r < 0.70) return 'normal';
  if (r < 0.82) return 'decoy';
  if (r < 0.90) return 'bomb';
  if (r < 0.95) return 'heal';
  return 'shield';
}

function shouldSpawnBossFace(){
  // boss face 1 ครั้งเมื่อ HP ต่ำ
  if (S.bossHp <= S.bossHpMax * 0.22){
    // check not already present
    for (const t of S.active.values()){
      if (t.type === 'bossface') return false;
    }
    // also throttle: only if at least 6 targets judged
    return S.judged >= 6;
  }
  return false;
}

// ---------- renderer ----------
let renderer = null;

function spawnOne(){
  if(!S.running || !renderer) return;

  const id = S.nextId++;
  const t = shouldSpawnBossFace() ? 'bossface' : rollType();

  // size
  let size = baseTargetSizePx();
  if (t === 'bossface') size = clamp(size + 26, 120, 210);
  if (t === 'decoy') size = clamp(size - 10, 86, 160);
  if (t === 'bomb') size = clamp(size - 6, 86, 160);

  const spawnAt = now();
  const ttl = ttlMsByDiff(t);
  const expireAt = spawnAt + ttl;

  const boss = getBoss();
  const data = { id, type: t, sizePx: size, bossEmoji: boss.emoji };

  renderer.spawnTarget(data);
  S.active.set(id, { id, type:t, sizePx:size, spawnAt, expireAt, bossEmoji: boss.emoji });

  // schedule removal on expire (checked in tick)
}

function removeAndMiss(id){
  const t = S.active.get(id);
  if(!t) return;
  renderer.removeTarget(id, 'timeout');
  S.active.delete(id);

  // miss consequences (normal/bossface/bomb count more)
  S.miss += 1;
  S.combo = 0;
  S.judged += 1;

  // small HP drain
  S.youHp = clamp(S.youHp - 2, 0, 100);

  // FX for miss
  FxBurst.popText(window.innerWidth*0.5, window.innerHeight*0.72, 'MISS', 'sb-fx-miss');
  setCenterMsg('พลาดจังหวะ! รีบคุมจังหวะ + อย่าหลงเป้าล่อ', 'miss');
}

function computeHitGrade(rtMs){
  // reaction time grading
  if (rtMs <= 220) return 'perfect';
  if (rtMs <= 430) return 'good';
  return 'bad';
}

function addFever(delta){
  if (now() < S.feverOnUntil) return; // while fever on, don't build
  S.fever = clamp(S.fever + delta, 0, 100);
  if (S.fever >= 100){
    // auto trigger fever for short burst
    S.feverOnUntil = now() + (S.diff === 'hard' ? 2200 : 2600);
    S.fever = 0;
    FxBurst.popText(window.innerWidth*0.5, window.innerHeight*0.22, 'FEVER ON!', 'sb-fx-fever');
  }
}

function bossDamage(mult=1){
  const feverOn = now() < S.feverOnUntil;
  const f = feverOn ? 1.35 : 1.0;
  return mult * f;
}

function onTargetHit(id, pt){
  const t = S.active.get(id);
  if(!t || !renderer) return;

  const rtMs = now() - t.spawnAt;
  const grade = computeHitGrade(rtMs);

  // scoring + effects
  let scoreDelta = 0;

  if (t.type === 'normal'){
    S.combo += 1;
    S.maxCombo = Math.max(S.maxCombo, S.combo);

    if (grade === 'perfect'){ scoreDelta = 40; S.hitPerfect += 1; addFever(18); }
    else if (grade === 'good'){ scoreDelta = 24; S.hitGood += 1; addFever(10); }
    else { scoreDelta = 12; S.hitBad += 1; addFever(6); }

    // boss dmg
    const dmg = (grade === 'perfect' ? 10 : grade === 'good' ? 7 : 4) * bossDamage(1);
    S.bossHp = clamp(S.bossHp - dmg, 0, S.bossHpMax);

  } else if (t.type === 'bossface'){
    // big reward
    S.combo += 1;
    S.maxCombo = Math.max(S.maxCombo, S.combo);

    if (grade === 'perfect'){ scoreDelta = 75; S.hitPerfect += 1; }
    else if (grade === 'good'){ scoreDelta = 55; S.hitGood += 1; }
    else { scoreDelta = 35; S.hitBad += 1; }

    const dmg = (grade === 'perfect' ? 26 : grade === 'good' ? 18 : 12) * bossDamage(1);
    S.bossHp = clamp(S.bossHp - dmg, 0, S.bossHpMax);

    FxBurst.popText(pt.clientX, pt.clientY, 'BOSS HIT!', 'sb-fx-fever');

  } else if (t.type === 'decoy'){
    // decoy hurts rhythm
    scoreDelta = -10;
    S.combo = 0;
    S.youHp = clamp(S.youHp - 3, 0, 100);
    FxBurst.popText(pt.clientX, pt.clientY, 'DECOY!', 'sb-fx-decoy');
    setCenterMsg('อย่าหลง Decoy 👀 — โฟกัสเป้าจริง', 'bad');

  } else if (t.type === 'bomb'){
    // bomb: if shield, block
    if (S.shield > 0){
      S.shield -= 1;
      scoreDelta = 0;
      FxBurst.popText(pt.clientX, pt.clientY, 'BLOCK!', 'sb-fx-shield');
      setCenterMsg('กันระเบิดด้วย Shield ✅', 'good');
    } else {
      scoreDelta = -40;
      S.combo = 0;
      S.miss += 1; // bomb counts as miss
      S.youHp = clamp(S.youHp - 9, 0, 100);
      FxBurst.popText(pt.clientX, pt.clientY, 'BOOM!', 'sb-fx-bomb');
      setCenterMsg('โดน Bomb 💣 — รีบตั้งจังหวะใหม่', 'bad');
    }

  } else if (t.type === 'heal'){
    scoreDelta = 10;
    S.youHp = clamp(S.youHp + 12, 0, 100);
    FxBurst.popText(pt.clientX, pt.clientY, '+HP', 'sb-fx-heal');
    setCenterMsg('ได้ Heal 🩹 — กลับมาลุยต่อ!', 'good');

  } else if (t.type === 'shield'){
    scoreDelta = 10;
    S.shield = clamp(S.shield + 1, 0, 9);
    FxBurst.popText(pt.clientX, pt.clientY, '+SHIELD', 'sb-fx-shield');
    setCenterMsg('ได้ Shield 🛡️ — กัน Bomb ได้ 1 ครั้ง', 'good');
  }

  // apply score
  S.score = Math.max(0, S.score + scoreDelta);
  S.judged += 1;

  // play hit FX (this is the “main FX” you wanted)
  renderer.playHitFx(id, { ...pt, grade, scoreDelta });

  // remove target
  renderer.removeTarget(id, 'hit');
  S.active.delete(id);

  // boss cleared?
  if (S.bossHp <= 0){
    S.bossesCleared += 1;
    FxBurst.popText(window.innerWidth*0.5, window.innerHeight*0.28, 'BOSS CLEARED!', 'sb-fx-win');

    if (S.bossIndex < BOSSES.length - 1){
      setBoss(S.bossIndex + 1);
      setCenterMsg('เข้าสู่เฟสถัดไป! 🔥', 'perfect');
    } else {
      // all bosses cleared -> finish early
      S.tLeft = Math.min(S.tLeft, 0.0);
    }
  }

  // AI micro-tip (optional)
  if (AI.isAssistEnabled()){
    const judged = Math.max(1, S.judged);
    const accPct = 100 * (S.hitPerfect + S.hitGood + S.hitBad) / judged;
    const missRate = S.miss / judged;
    const snap = {
      accPct,
      hp: S.youHp,
      hitMiss: S.miss,
      hitPerfect: S.hitPerfect,
      hitGreat: 0,
      hitGood: S.hitGood + S.hitBad,
      combo: S.combo,
      durationSec: S.durationSec
    };
    const pred = AI.predict(snap);
    if (pred && pred.tip){
      // show occasionally
      if (S.judged % 7 === 0){
        FxBurst.popText(window.innerWidth*0.5, window.innerHeight*0.86, pred.tip, 'sb-fx-tip');
      }
    }
  }

  updateHud();
}

function tick(){
  if(!S.running) return;

  // update timer
  const tNow = now();
  const elapsed = (tNow - S.tStart) / 1000;
  S.tLeft = Math.max(0, S.durationSec - elapsed);

  // expire targets
  for (const [id, t] of S.active.entries()){
    if (tNow >= t.expireAt){
      removeAndMiss(id);
    }
  }

  updateHud();

  // end?
  if (S.tLeft <= 0 || S.youHp <= 0){
    endRun();
  }
}

function clearTimers(){
  if (S.tickHandle) cancelAnimationFrame(S.tickHandle);
  S.tickHandle = 0;
  if (S.spawnHandle) clearInterval(S.spawnHandle);
  S.spawnHandle = 0;
}

function rafLoop(){
  if(!S.running) return;
  tick();
  S.tickHandle = requestAnimationFrame(rafLoop);
}

function startRun(){
  // init renderer
  const layer = document.getElementById('sb-target-layer');
  if(!layer) return;

  renderer = new DomRendererShadow(layer, {
    wrapEl: document.getElementById('sb-wrap'),
    feedbackEl: document.getElementById('sb-msg-main'),
    onTargetHit
  });

  // reset state
  S.running = true;
  S.tStart = now();
  S.tLeft = S.durationSec;

  S.score = 0;
  S.combo = 0;
  S.maxCombo = 0;
  S.miss = 0;

  S.judged = 0;
  S.hitPerfect = 0;
  S.hitGood = 0;
  S.hitBad = 0;

  S.youHp = 100;
  S.shield = 0;
  S.fever = 0;
  S.feverOnUntil = 0;

  S.active.clear();
  S.nextId = 1;

  S.bossesCleared = 0;
  setBoss(0);

  // UI
  setActiveView('sb-view-play');
  setCenterMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

  // spawn loop
  clearTimers();
  S.spawnHandle = setInterval(() => {
    // refresh interval dynamically
    try {
      const desired = spawnEveryMs();
      // soft adapt: if drift too far, recreate interval
      if (S.__spawnMs !== desired){
        S.__spawnMs = desired;
        clearInterval(S.spawnHandle);
        S.spawnHandle = setInterval(() => spawnOne(), desired);
      }
    } catch {}
    spawnOne();
  }, spawnEveryMs());
  S.__spawnMs = spawnEveryMs();

  // first wave
  spawnOne(); spawnOne();

  // run raf
  rafLoop();
}

function endRun(){
  if(!S.running) return;
  S.running = false;

  // cleanup targets
  try {
    if (renderer){
      renderer.destroy();
      renderer = null;
    }
  } catch {}
  S.active.clear();
  clearTimers();

  // result calc
  const judged = Math.max(1, S.judged);
  const hits = (S.hitPerfect + S.hitGood + S.hitBad);
  const acc = hits / judged;
  const accPct = acc * 100;

  const resTime = document.getElementById('sb-res-time');
  const resScore = document.getElementById('sb-res-score');
  const resMaxCombo = document.getElementById('sb-res-max-combo');
  const resMiss = document.getElementById('sb-res-miss');
  const resPhase = document.getElementById('sb-res-phase');
  const resBoss = document.getElementById('sb-res-boss-cleared');
  const resAcc = document.getElementById('sb-res-acc');
  const resGrade = document.getElementById('sb-res-grade');

  if(resTime) resTime.textContent = `${fmt1(S.durationSec - S.tLeft)} s`;
  if(resScore) resScore.textContent = String(S.score);
  if(resMaxCombo) resMaxCombo.textContent = String(S.maxCombo);
  if(resMiss) resMiss.textContent = String(S.miss);
  if(resPhase) resPhase.textContent = String(S.phase);
  if(resBoss) resBoss.textContent = String(S.bossesCleared);
  if(resAcc) resAcc.textContent = `${fmt1(accPct)} %`;
  if(resGrade) resGrade.textContent = gradeFromAcc(acc);

  setActiveView('sb-view-result');
}

function stopToMenu(){
  // stop if running
  if (S.running) endRun();
  setActiveView('sb-view-menu');
}

// ---------- Menu wiring ----------
function setMode(m){
  S.mode = m === 'research' ? 'research' : 'normal';

  const btnN = document.getElementById('sb-mode-normal');
  const btnR = document.getElementById('sb-mode-research');
  const desc = document.getElementById('sb-mode-desc');
  const box = document.getElementById('sb-research-box');

  if(btnN) btnN.classList.toggle('is-active', S.mode==='normal');
  if(btnR) btnR.classList.toggle('is-active', S.mode==='research');
  if(desc) desc.textContent = (S.mode==='research')
    ? 'Research: เก็บข้อมูลผู้เข้าร่วม + ล็อก AI (ความยุติธรรมในการวิจัย)'
    : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';

  if(box) box.classList.toggle('is-on', S.mode==='research');
}

function applyMenuValues(){
  const diffEl = document.getElementById('sb-diff');
  const timeEl = document.getElementById('sb-time');

  S.diff = (diffEl && diffEl.value) ? diffEl.value : 'normal';
  S.durationSec = Number(timeEl && timeEl.value) || 70;

  // reflect dataset
  const wrap = document.getElementById('sb-wrap');
  if (wrap){
    wrap.dataset.diff = S.diff;
  }
}

function bindUI(){
  // default view
  setActiveView('sb-view-menu');

  // mode toggle buttons
  const bn = document.getElementById('sb-mode-normal');
  const br = document.getElementById('sb-mode-research');
  if(bn) bn.addEventListener('click', ()=>setMode('normal'));
  if(br) br.addEventListener('click', ()=>setMode('research'));

  // howto toggle
  const howBtn = document.getElementById('sb-btn-howto');
  const howBox = document.getElementById('sb-howto');
  if(howBtn && howBox){
    howBtn.addEventListener('click', ()=>{
      howBox.classList.toggle('is-on');
    });
  }

  // apply select changes
  const diffEl = document.getElementById('sb-diff');
  const timeEl = document.getElementById('sb-time');
  if(diffEl) diffEl.addEventListener('change', applyMenuValues);
  if(timeEl) timeEl.addEventListener('change', applyMenuValues);

  // start buttons
  const bPlay = document.getElementById('sb-btn-play');
  const bRes = document.getElementById('sb-btn-research');

  if(bPlay){
    bPlay.addEventListener('click', ()=>{
      setMode('normal');
      applyMenuValues();
      startRun();
    });
  }
  if(bRes){
    bRes.addEventListener('click', ()=>{
      setMode('research');
      applyMenuValues();

      // basic validation (optional)
      const pid = (document.getElementById('sb-part-id')?.value || '').trim();
      const grp = (document.getElementById('sb-part-group')?.value || '').trim();
      if (!pid || !grp){
        FxBurst.popText(window.innerWidth*0.5, window.innerHeight*0.80, 'กรอก Participant ID และ Group ก่อน', 'sb-fx-tip');
        return;
      }
      // lock AI fairness via query mode (optional)
      startRun();
    });
  }

  // play controls
  const backMenu = document.getElementById('sb-btn-back-menu');
  if(backMenu) backMenu.addEventListener('click', stopToMenu);

  const stopToggle = document.getElementById('sb-btn-pause');
  if(stopToggle){
    stopToggle.addEventListener('change', ()=>{
      if(stopToggle.checked){
        endRun();
        stopToggle.checked = false;
        setActiveView('sb-view-menu');
      }
    });
  }

  // result actions
  const retry = document.getElementById('sb-btn-result-retry');
  const menu = document.getElementById('sb-btn-result-menu');
  if(retry) retry.addEventListener('click', ()=>{
    setActiveView('sb-view-menu');
    startRun();
  });
  if(menu) menu.addEventListener('click', ()=>setActiveView('sb-view-menu'));

  // download buttons (stub; you can hook logger later)
  const dEv = document.getElementById('sb-btn-download-events');
  const dSe = document.getElementById('sb-btn-download-session');
  if(dEv) dEv.addEventListener('click', ()=>{
    FxBurst.popText(window.innerWidth*0.5, window.innerHeight*0.78, 'Events CSV: จะใส่ logger ต่อได้เลย', 'sb-fx-tip');
  });
  if(dSe) dSe.addEventListener('click', ()=>{
    FxBurst.popText(window.innerWidth*0.5, window.innerHeight*0.78, 'Session CSV: จะใส่ logger ต่อได้เลย', 'sb-fx-tip');
  });

  // init
  setMode('normal');
  applyMenuValues();

  // optional: read query defaults
  const qd = (qs('diff','')||'').toLowerCase();
  const qt = Number(qs('time','')) || 0;
  if (diffEl && (qd==='easy'||qd==='normal'||qd==='hard')) diffEl.value = qd;
  if (timeEl && (qt===45||qt===60||qt===70||qt===90)) timeEl.value = String(qt);
  applyMenuValues();
}

// boot
window.addEventListener('DOMContentLoaded', bindUI);