// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (HARDENED + Evaluate/Create + Silent Badge)
// ✅ Auto view detect (no UI override)
// ✅ Boots engine from ./plate.safe.js
// ✅ Wires HUD (hha:score, hha:time, quest:update, hha:coach, hha:end)
// ✅ End overlay: aria-hidden only
// ✅ Back HUB + Restart
// ✅ Pass-through research context params
// ✅ HARDEN: guard against mount missing + visible error
// ✅ PATCH: Miss breakdown (junk vs timeout) from hha:judge stream
// ✅ NEW: Post-game (PLAY only)
//    - Evaluate: เลือกเหตุผล (มากไป/น้อยไป/ควรเพิ่มอะไร)
//    - Create (ป.5): ปรับ 1 อย่างแล้วเห็นผลทันที + badge (silent)

'use strict';

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || navigator.maxTouchPoints > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto(){
  const forced = (qs('view','')||'').toLowerCase();
  if(forced) return forced;
  return isMobile() ? 'mobile' : 'pc';
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}

function clamp(v, a, b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}
function pct(n){
  n = Number(n)||0;
  return `${Math.round(n)}%`;
}

function setOverlayOpen(open){
  const ov = DOC.getElementById('endOverlay');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function showCoach(msg, meta='Coach'){
  const card = DOC.getElementById('coachCard');
  const mEl = DOC.getElementById('coachMsg');
  const metaEl = DOC.getElementById('coachMeta');
  if(!card || !mEl) return;

  mEl.textContent = String(msg || '');
  if(metaEl) metaEl.textContent = meta;
  card.classList.add('show');
  card.setAttribute('aria-hidden','false');

  clearTimeout(WIN.__HHA_COACH_TO__);
  WIN.__HHA_COACH_TO__ = setTimeout(()=>{
    card.classList.remove('show');
    card.setAttribute('aria-hidden','true');
  }, 2400);
}

/* ------------------------------------------------
 * Miss breakdown (reset per run)
 * ------------------------------------------------ */
const MISS = { junk:0, timeout:0, shot:0 };

function resetMissBreakdown(){
  MISS.junk = 0;
  MISS.timeout = 0;
  MISS.shot = 0;
}

function wireMissStream(){
  WIN.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    const kind = String(d.kind || '').toLowerCase();
    if(kind === 'junk') MISS.junk++;
    else if(kind === 'expire_good') MISS.timeout++;
    else if(kind === 'shot_miss') MISS.shot++;
  });
}

/* ------------------------------------------------
 * Silent Badge (localStorage)
 * ------------------------------------------------ */
const BADGE_KEY = 'HHA_BADGES_V1';

function readBadges(){
  try{
    const raw = localStorage.getItem(BADGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }catch{ return []; }
}
function hasBadge(id){
  return readBadges().includes(id);
}
function awardBadgeSilent(id, meta=null){
  if(!id) return false;
  if(hasBadge(id)) return false;
  const arr = readBadges();
  arr.push(id);
  try{ localStorage.setItem(BADGE_KEY, JSON.stringify(arr)); }catch{}
  // silent emit (UI may ignore)
  try{ WIN.dispatchEvent(new CustomEvent('hha:badge', { detail:{ id, meta, silent:true } })); }catch{}
  return true;
}

/* ------------------------------------------------
 * Post-game Evaluate/Create (PLAY only)
 * ------------------------------------------------ */
function ensurePostGameArea(){
  const panel = DOC.querySelector('#endOverlay .endPanel');
  if(!panel) return null;

  let area = DOC.getElementById('postGameArea');
  if(area) return area;

  area = DOC.createElement('div');
  area.id = 'postGameArea';
  area.style.margin = '6px 6px 0';
  area.style.padding = '10px';
  area.style.borderRadius = '18px';
  area.style.border = '1px solid rgba(148,163,184,.14)';
  area.style.background = 'rgba(10,16,40,.28)';
  area.style.color = 'var(--text)';
  area.style.display = 'none';

  // insert before buttons
  const btns = panel.querySelector('.endBtns');
  if(btns) panel.insertBefore(area, btns);
  else panel.appendChild(area);

  return area;
}

function renderEvaluateCreate({ runMode, summary }){
  const area = ensurePostGameArea();
  if(!area) return;

  if(String(runMode||'play').toLowerCase() !== 'play'){
    area.style.display = 'none';
    area.innerHTML = '';
    return;
  }

  area.style.display = 'block';

  // read group counts if present
  const g = [
    Number(summary.g1||0), Number(summary.g2||0), Number(summary.g3||0),
    Number(summary.g4||0), Number(summary.g5||0)
  ];

  // simple helper score preview for Create step
  function computePlateQuality(){
    const distinct = g.filter(x=>x>0).length;       // 0..5
    const balance = distinct / 5;                   // 0..1
    const junkPenalty = clamp((summary.missJunk ?? 0) / 10, 0, 1); // rough
    const quality = clamp(balance * 0.85 + (1 - junkPenalty) * 0.15, 0, 1);
    return Math.round(quality * 100);
  }

  const baseQ = computePlateQuality();

  area.innerHTML = `
    <div style="font-weight:950;font-size:14px;margin-bottom:6px;">ภารกิจหลังจบเกม (PLAY)</div>
    <div style="color:var(--muted);font-size:12px;margin-bottom:10px;">
      1) Evaluate: เลือกเหตุผล  2) Create: ปรับ 1 อย่าง แล้วดูผลทันที (ได้ Badge แบบเงียบ)
    </div>

    <!-- Step 1: Evaluate -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start;">
      <div style="flex:1;min-width:240px;">
        <div style="font-weight:900;margin-bottom:6px;">1) Evaluate</div>
        <div style="display:grid;gap:8px;">
          ${radioRow('ev', 'too_much', 'มากไป (บางหมู่เยอะเกิน)')}
          ${radioRow('ev', 'too_little', 'น้อยไป (บางหมู่ขาด)')}
          ${radioRow('ev', 'add_what', 'ควรเพิ่มอะไร (เลือกแล้วบอกเหตุผล)')}
        </div>
        <div id="evHint" style="margin-top:8px;color:var(--muted);font-size:12px;">เลือก 1 ข้อ เพื่อปลดล็อกขั้น Create</div>
      </div>

      <!-- Step 2: Create -->
      <div style="flex:1;min-width:240px;">
        <div style="font-weight:900;margin-bottom:6px;">2) Create (ป.5)</div>
        <div style="display:grid;gap:8px;">
          ${btnRow('cr_add_veg', 'เพิ่มผัก 1 ส่วน')}
          ${btnRow('cr_reduce_rice', 'ลดข้าว/แป้ง 1 ส่วน')}
          ${btnRow('cr_swap_snack', 'เปลี่ยนขนมเป็นผลไม้')}
        </div>

        <div style="margin-top:10px;padding:10px;border-radius:14px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.35);">
          <div style="font-size:12px;color:var(--muted);">ผลทันที (จำลอง)</div>
          <div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;">
            <div style="font-size:22px;font-weight:950;">คุณภาพจาน: <span id="qNow">${baseQ}</span></div>
            <div style="font-size:12px;color:var(--muted);">/100</div>
          </div>
          <div id="crMsg" style="margin-top:6px;font-size:12px;color:var(--muted);">ต้องทำ Evaluate ก่อน</div>
        </div>
      </div>
    </div>

    <div id="badgeLine" style="margin-top:10px;font-size:12px;color:var(--muted);">
      Badge: <span id="badgeState">ยังไม่ได้รับ</span>
    </div>
  `;

  function radioRow(name, value, label){
    return `
      <label style="display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:14px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.28);cursor:pointer;">
        <input type="radio" name="${name}" value="${value}" style="margin-top:2px;"/>
        <span style="font-size:13px;font-weight:800;">${label}</span>
      </label>
    `;
  }
  function btnRow(id, label){
    return `
      <button type="button" class="btn" id="${id}" style="justify-content:flex-start;gap:10px;">
        ${label}
      </button>
    `;
  }

  // gate Create step until Evaluate chosen
  let evChosen = '';
  const evHint = area.querySelector('#evHint');
  const crMsg = area.querySelector('#crMsg');
  const qNow = area.querySelector('#qNow');
  const badgeState = area.querySelector('#badgeState');

  const badgeId = 'plate-create-1';
  badgeState.textContent = hasBadge(badgeId) ? 'ได้รับแล้ว ✅' : 'ยังไม่ได้รับ';

  area.querySelectorAll('input[name="ev"]').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      evChosen = String(inp.value||'');
      if(evHint) evHint.textContent = 'โอเค! ไปขั้น Create ได้เลย';
      if(crMsg) crMsg.textContent = 'เลือก “ปรับ 1 อย่าง” แล้วดูผล';
    });
  });

  // Create actions
  function applyCreate(kind){
    if(!evChosen){
      if(crMsg) crMsg.textContent = 'ต้องเลือก Evaluate ก่อนนะ 🙂';
      return;
    }

    // quick “instant effect” simulation (not affecting engine score; only learning feedback)
    let delta = 0;
    let msg = '';

    if(kind === 'cr_add_veg'){
      delta = +8;
      msg = 'เพิ่มผักแล้ว! สีจานดีขึ้น 👍';
    }else if(kind === 'cr_reduce_rice'){
      delta = +6;
      msg = 'ลดแป้งลงนิดนึง—สมดุลขึ้น 👍';
    }else if(kind === 'cr_swap_snack'){
      delta = +10;
      msg = 'เปลี่ยนเป็นผลไม้! ดีมาก 🍎';
    }

    const newQ = clamp(baseQ + delta, 0, 100);
    if(qNow) qNow.textContent = String(newQ);
    if(crMsg) crMsg.textContent = msg;

    // silent badge (only once)
    const got = awardBadgeSilent(badgeId, { ev: evChosen, create: kind, qBefore: baseQ, qAfter: newQ });
    if(got){
      badgeState.textContent = 'ได้รับแล้ว ✅ (Silent)';
      // coach whisper (still subtle)
      showCoach('ได้ Badge: นักปรับจานมือโปร 🏅', 'Badge');
    }else{
      badgeState.textContent = 'ได้รับแล้ว ✅';
    }
  }

  const b1 = area.querySelector('#cr_add_veg');
  const b2 = area.querySelector('#cr_reduce_rice');
  const b3 = area.querySelector('#cr_swap_snack');

  if(b1) b1.addEventListener('click', ()=>applyCreate('cr_add_veg'));
  if(b2) b2.addEventListener('click', ()=>applyCreate('cr_reduce_rice'));
  if(b3) b3.addEventListener('click', ()=>applyCreate('cr_swap_snack'));
}

function wireHUD(){
  const hudScore = DOC.getElementById('hudScore');
  const hudTime  = DOC.getElementById('hudTime');
  const hudCombo = DOC.getElementById('hudCombo');

  const goalName = DOC.getElementById('goalName');
  const goalSub  = DOC.getElementById('goalSub');
  const goalNums = DOC.getElementById('goalNums');
  const goalBar  = DOC.getElementById('goalBar');

  const miniName = DOC.getElementById('miniName');
  const miniSub  = DOC.getElementById('miniSub');
  const miniNums = DOC.getElementById('miniNums');
  const miniBar  = DOC.getElementById('miniBar');

  WIN.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if(hudScore) hudScore.textContent = String(d.score ?? d.value ?? 0);
    if(hudCombo) hudCombo.textContent = String(d.combo ?? d.comboNow ?? 0);
  });

  WIN.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    if(hudTime) hudTime.textContent = String(Math.max(0, Math.ceil(Number(t)||0)));
  });

  WIN.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    if(d.goal){
      const g = d.goal;
      if(goalName) goalName.textContent = g.name || 'Goal';
      if(goalSub)  goalSub.textContent  = g.sub  || '';
      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      if(goalNums) goalNums.textContent = `${cur}/${tar}`;
      if(goalBar)  goalBar.style.width  = `${Math.round((cur/tar)*100)}%`;
    }
    if(d.mini){
      const m = d.mini;
      if(miniName) miniName.textContent = m.name || 'Mini Quest';
      if(miniSub)  miniSub.textContent  = m.sub  || '';
      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      if(miniNums) miniNums.textContent = `${cur}/${tar}`;
      if(miniBar)  miniBar.style.width  = `${Math.round((cur/tar)*100)}%`;
    }
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if(d && (d.msg || d.text)) showCoach(d.msg || d.text, d.tag || 'Coach');
  });
}

function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = qs('hub','') || '';

  if(btnRestart){
    btnRestart.addEventListener('click', ()=>location.reload());
  }
  if(btnBackHub){
    btnBackHub.addEventListener('click', ()=>{
      if(hub) location.href = hub;
      else history.back();
    });
  }
}

function wireEndSummary(){
  const kScore = DOC.getElementById('kScore');
  const kAcc   = DOC.getElementById('kAcc');
  const kCombo = DOC.getElementById('kCombo');
  const kGoals = DOC.getElementById('kGoals');
  const kMini  = DOC.getElementById('kMini');
  const kMiss  = DOC.getElementById('kMiss');

  const kMissJunk    = DOC.getElementById('kMissJunk');
  const kMissTimeout = DOC.getElementById('kMissTimeout');
  const kGrade       = DOC.getElementById('kGrade');

  WIN.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};

    if(kScore) kScore.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if(kCombo) kCombo.textContent = String(d.comboMax ?? d.combo ?? 0);

    const missTotal = (d.miss ?? d.misses ?? d.missTotal ?? 0);
    if(kMiss)  kMiss.textContent  = String(missTotal);

    const acc = (d.accuracyPct ?? d.accuracyGoodPct ?? null);
    if(kAcc) kAcc.textContent = (acc==null) ? '—' : pct(acc);

    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // breakdown: prefer engine keys if present, else stream
    const mj = (d.missJunk ?? null);
    const me = (d.missExpire ?? null);

    if(kMissJunk)    kMissJunk.textContent    = String((mj==null ? (MISS.junk|0) : (mj|0)));
    if(kMissTimeout) kMissTimeout.textContent = String((me==null ? (MISS.timeout|0) : (me|0)));

    if(kGrade) kGrade.textContent = String(d.grade || '—');

    // NEW: Evaluate/Create only when runMode=play
    renderEvaluateCreate({ runMode: (d.runMode ?? qs('run','play')), summary: d });

    setOverlayOpen(true);
  });
}

function buildEngineConfig(){
  const view = getViewAuto();
  const run  = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();

  // Important: if you test with time=15, it WILL end very fast.
  const time = clamp(qs('time','90'), 10, 999);

  const seed = Number(qs('seed', Date.now())) || Date.now();

  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    // passthrough
    hub: qs('hub','') || '',
    logEndpoint: qs('log','') || '',

    studyId: qs('studyId','') || '',
    phase: qs('phase','') || '',
    conditionGroup: qs('conditionGroup','') || '',
    sessionOrder: qs('sessionOrder','') || '',
    blockLabel: qs('blockLabel','') || '',
    siteCode: qs('siteCode','') || '',
    schoolCode: qs('schoolCode','') || '',
    schoolName: qs('schoolName','') || '',
    gradeLevel: qs('gradeLevel','') || '',
    studentKey: qs('studentKey','') || '',
  };
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(()=>{
  resetMissBreakdown();

  const cfg = buildEngineConfig();
  setBodyView(cfg.view);

  wireHUD();
  wireMissStream();
  wireEndControls();
  wireEndSummary();

  setOverlayOpen(false);

  const mount = DOC.getElementById('plate-layer');
  if(!mount){
    console.error('[PlateVR] mount #plate-layer missing');
    showCoach('หา playfield ไม่เจอ (#plate-layer)', 'System');
    return;
  }

  try{
    Promise.resolve().then(()=>engineBoot({ mount, cfg }));
  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม (ดู Console)', 'System');
  }
});