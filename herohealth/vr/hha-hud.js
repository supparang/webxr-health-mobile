// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR)
// PATCH(A): เพิ่ม Progress Visibility แบบ “เห็นชัดมาก”
// - Goal progress bar + x/y + pct
// - Mini quest progress bar + x/y หรือ timer + timeLeft
// - Status tag: ACTIVE / CLEARED (โชว์ชั่วคราวตอนผ่าน)
// - รองรับ payload มาตรฐานจาก quest:update:
//   detail: { goal:{title,cur,max,pct,state}, mini:{title,cur,max,pct,timeLeft,timeTotal,state}, meta?:{...} }
// - ฟัง quest:cleared เพื่อแฟลชสถานะ + ปล่อยให้ particles/celebrate ทำงานร่วมกันได้

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // -------------------------
  // Utils
  // -------------------------
  function clamp01(x) {
    x = Number(x);
    if (!isFinite(x)) x = 0;
    if (x < 0) return 0;
    if (x > 1) return 1;
    return x;
  }
  function pctToText(pct) {
    pct = clamp01(pct);
    return Math.round(pct * 100) + '%';
  }
  function safeText(v, fallback = '') {
    if (v === null || v === undefined) return fallback;
    const s = String(v);
    return s.trim() ? s : fallback;
  }
  function msToSec(v) {
    v = Number(v);
    if (!isFinite(v)) return null;
    return Math.max(0, v) / 1000;
  }
  function formatSec(sec) {
    sec = Number(sec);
    if (!isFinite(sec)) return '';
    sec = Math.max(0, sec);
    // แสดงแบบ 8.0s ชัด ๆ
    return (sec >= 10 ? Math.round(sec) : (Math.round(sec * 10) / 10)) + 's';
  }

  // -------------------------
  // HUD creation (safe)
  // -------------------------
  const HUD_ID = 'hha-hud';
  const STYLE_ID = 'hha-hud-style-a';

  function ensureStyle() {
    if (doc.getElementById(STYLE_ID)) return;

    const st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
/* ===== HHA HUD Patch A: Progress Visibility ===== */
#${HUD_ID}{
  position:fixed; inset:0; pointer-events:none; z-index:9999;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
}
#${HUD_ID} .hha-top{
  position:fixed; top:10px; left:50%; transform:translateX(-50%);
  display:flex; gap:10px; align-items:flex-start; justify-content:center;
  width:min(980px, calc(100vw - 24px));
  pointer-events:none;
}
#${HUD_ID} .hha-card{
  pointer-events:none;
  background:rgba(2,6,23,0.72);
  border:1px solid rgba(148,163,184,0.22);
  box-shadow:0 10px 30px rgba(0,0,0,0.35);
  border-radius:16px;
  padding:10px 12px;
  backdrop-filter: blur(8px);
  min-width: 320px;
  max-width: 520px;
}
#${HUD_ID} .hha-titleRow{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  margin-bottom:8px;
}
#${HUD_ID} .hha-title{
  font-weight:800;
  font-size:13px;
  color:#e5e7eb;
  letter-spacing:.2px;
  line-height:1.1;
  display:flex; align-items:center; gap:8px;
}
#${HUD_ID} .hha-sub{
  font-weight:700;
  font-size:12px;
  color:#a7f3d0;
  opacity:.95;
}
#${HUD_ID} .hha-badge{
  font-weight:900;
  font-size:11px;
  padding:4px 10px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,0.28);
  color:#e5e7eb;
  background:rgba(15,23,42,0.55);
  text-transform:uppercase;
  letter-spacing:.6px;
}
#${HUD_ID} .hha-badge.active{
  border-color:rgba(34,197,94,0.5);
  background:rgba(34,197,94,0.16);
}
#${HUD_ID} .hha-badge.cleared{
  border-color:rgba(250,204,21,0.6);
  background:rgba(250,204,21,0.18);
  color:#fff7ed;
}
#${HUD_ID} .hha-badge.hidden{ display:none; }

#${HUD_ID} .hha-progressRow{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  margin-bottom:6px;
}
#${HUD_ID} .hha-desc{
  color:#cbd5e1;
  font-weight:700;
  font-size:12px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  max-width: 78%;
}
#${HUD_ID} .hha-count{
  color:#f8fafc;
  font-weight:900;
  font-size:12px;
}
#${HUD_ID} .hha-bar{
  width:100%;
  height:10px;
  border-radius:999px;
  background:rgba(148,163,184,0.16);
  border:1px solid rgba(148,163,184,0.18);
  overflow:hidden;
}
#${HUD_ID} .hha-fill{
  width:0%;
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg, rgba(34,197,94,0.95), rgba(59,130,246,0.9));
  transition:width 160ms ease;
  box-shadow: 0 0 14px rgba(34,197,94,0.22);
}
#${HUD_ID} .hha-fill.warn{
  background:linear-gradient(90deg, rgba(250,204,21,0.95), rgba(244,63,94,0.9));
  box-shadow: 0 0 16px rgba(244,63,94,0.22);
}
#${HUD_ID} .hha-pct{
  margin-top:6px;
  display:flex; align-items:center; justify-content:space-between;
  color:#94a3b8;
  font-weight:800;
  font-size:11px;
}
#${HUD_ID} .hha-flash{
  animation:hhaFlash 420ms ease both;
}
@keyframes hhaFlash{
  0%{ transform:translateY(-2px) scale(1.01); filter:brightness(1.12); }
  100%{ transform:translateY(0) scale(1); filter:brightness(1); }
}

/* mobile tighten */
@media (max-width:520px){
  #${HUD_ID} .hha-card{ min-width: 220px; padding:9px 10px; }
  #${HUD_ID} .hha-title{ font-size:12px; }
  #${HUD_ID} .hha-desc{ max-width:74%; }
}
    `.trim();
    doc.head.appendChild(st);
  }

  function ensureHUD() {
    let hud = doc.getElementById(HUD_ID);
    if (hud) return hud;

    hud = doc.createElement('div');
    hud.id = HUD_ID;

    // Top center group: Goal + Mini
    const top = doc.createElement('div');
    top.className = 'hha-top';

    // Goal card
    const goal = doc.createElement('div');
    goal.className = 'hha-card';
    goal.innerHTML = `
      <div class="hha-titleRow">
        <div class="hha-title"><span>🎯</span><span id="hhaGoalTitle">GOAL</span></div>
        <div class="hha-badge active hidden" id="hhaGoalBadge">ACTIVE</div>
      </div>
      <div class="hha-progressRow">
        <div class="hha-desc" id="hhaGoalDesc">—</div>
        <div class="hha-count" id="hhaGoalCount">0/0</div>
      </div>
      <div class="hha-bar"><div class="hha-fill" id="hhaGoalFill"></div></div>
      <div class="hha-pct">
        <span id="hhaGoalPct">0%</span>
        <span id="hhaGoalHint">ทำให้ครบ!</span>
      </div>
    `;

    // Mini card
    const mini = doc.createElement('div');
    mini.className = 'hha-card';
    mini.innerHTML = `
      <div class="hha-titleRow">
        <div class="hha-title"><span>🧩</span><span id="hhaMiniTitle">MINI QUEST</span></div>
        <div class="hha-badge active hidden" id="hhaMiniBadge">ACTIVE</div>
      </div>
      <div class="hha-progressRow">
        <div class="hha-desc" id="hhaMiniDesc">—</div>
        <div class="hha-count" id="hhaMiniCount">0/0</div>
      </div>
      <div class="hha-bar"><div class="hha-fill" id="hhaMiniFill"></div></div>
      <div class="hha-pct">
        <span id="hhaMiniPct">0%</span>
        <span id="hhaMiniHint">—</span>
      </div>
    `;

    top.appendChild(goal);
    top.appendChild(mini);
    hud.appendChild(top);
    doc.body.appendChild(hud);

    return hud;
  }

  function $(id) { return doc.getElementById(id); }

  function setBadge(el, state) {
    if (!el) return;
    el.classList.remove('active', 'cleared', 'hidden');
    if (!state) { el.classList.add('hidden'); return; }
    const s = String(state).toLowerCase();
    if (s === 'active') {
      el.textContent = 'ACTIVE';
      el.classList.add('active');
    } else if (s === 'cleared' || s === 'complete' || s === 'completed') {
      el.textContent = 'CLEARED';
      el.classList.add('cleared');
    } else {
      el.textContent = String(state).toUpperCase();
      el.classList.add('active');
    }
  }

  function flashCard(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove('hha-flash');
    // force reflow
    void cardEl.offsetWidth;
    cardEl.classList.add('hha-flash');
  }

  function setProgress(fillEl, pct01, warn = false) {
    if (!fillEl) return;
    pct01 = clamp01(pct01);
    fillEl.style.width = Math.round(pct01 * 1000) / 10 + '%';
    if (warn) fillEl.classList.add('warn');
    else fillEl.classList.remove('warn');
  }

  // -------------------------
  // State + update functions
  // -------------------------
  let lastGoalKey = '';
  let lastMiniKey = '';
  let lastGoalCur = null;
  let lastMiniCur = null;

  function updateGoal(g) {
    const goalCard = $('hhaGoalTitle')?.closest('.hha-card');
    const badge = $('hhaGoalBadge');
    const titleEl = $('hhaGoalTitle');
    const descEl = $('hhaGoalDesc');
    const countEl = $('hhaGoalCount');
    const pctEl = $('hhaGoalPct');
    const hintEl = $('hhaGoalHint');
    const fillEl = $('hhaGoalFill');

    if (!g) {
      if (descEl) descEl.textContent = '—';
      if (countEl) countEl.textContent = '0/0';
      if (pctEl) pctEl.textContent = '0%';
      if (hintEl) hintEl.textContent = '—';
      setProgress(fillEl, 0);
      setBadge(badge, null);
      return;
    }

    const title = safeText(g.title, 'GOAL');
    const cur = Number(g.cur ?? 0);
    const max = Math.max(0, Number(g.max ?? 0));
    const pct = (g.pct !== undefined && g.pct !== null)
      ? clamp01(g.pct)
      : (max > 0 ? clamp01(cur / max) : 0);

    const state = safeText(g.state, 'active');
    const key = title + '|' + max;

    if (titleEl) titleEl.textContent = 'GOAL';
    if (descEl) descEl.textContent = title;
    if (countEl) countEl.textContent = `${Math.max(0, cur)}/${Math.max(0, max)}`;
    if (pctEl) pctEl.textContent = pctToText(pct);

    // hint
    if (hintEl) {
      if (String(state).toLowerCase().includes('clear')) hintEl.textContent = 'ผ่านแล้ว! 🎉';
      else if (pct >= 0.8) hintEl.textContent = 'ใกล้แล้ว! 🔥';
      else hintEl.textContent = 'ทำให้ครบ!';
    }

    setBadge(badge, state);
    setProgress(fillEl, pct, false);

    // flash when progress increments OR goal changes
    if (key !== lastGoalKey || (lastGoalCur !== null && cur !== lastGoalCur)) {
      // flash only on positive progress or change
      if (key !== lastGoalKey || (cur > (lastGoalCur ?? -Infinity))) {
        flashCard(goalCard);
      }
    }
    lastGoalKey = key;
    lastGoalCur = cur;
  }

  function updateMini(m) {
    const miniCard = $('hhaMiniTitle')?.closest('.hha-card');
    const badge = $('hhaMiniBadge');
    const titleEl = $('hhaMiniTitle');
    const descEl = $('hhaMiniDesc');
    const countEl = $('hhaMiniCount');
    const pctEl = $('hhaMiniPct');
    const hintEl = $('hhaMiniHint');
    const fillEl = $('hhaMiniFill');

    if (!m) {
      if (descEl) descEl.textContent = '—';
      if (countEl) countEl.textContent = '0/0';
      if (pctEl) pctEl.textContent = '0%';
      if (hintEl) hintEl.textContent = '—';
      setProgress(fillEl, 0);
      setBadge(badge, null);
      return;
    }

    const title = safeText(m.title, 'MINI QUEST');
    const cur = Number(m.cur ?? 0);
    const max = Math.max(0, Number(m.max ?? 0));
    const pct = (m.pct !== undefined && m.pct !== null)
      ? clamp01(m.pct)
      : (max > 0 ? clamp01(cur / max) : 0);

    const state = safeText(m.state, 'active');
    const key = title + '|' + max;

    if (titleEl) titleEl.textContent = 'MINI QUEST';
    if (descEl) descEl.textContent = title;

    // timer vs counter hint
    const tl = msToSec(m.timeLeft);
    const tt = msToSec(m.timeTotal);
    const hasTimer = (tl !== null && tt !== null && tt > 0);

    if (countEl) {
      if (hasTimer) countEl.textContent = `${formatSec(tl)}`;
      else countEl.textContent = `${Math.max(0, cur)}/${Math.max(0, max)}`;
    }
    if (pctEl) pctEl.textContent = pctToText(pct);

    // warning when time left low
    let warn = false;
    if (hasTimer) {
      // warn when <= 3s
      warn = (tl <= 3.0);
    }

    if (hintEl) {
      if (String(state).toLowerCase().includes('clear')) hintEl.textContent = 'ผ่านแล้ว! 🌟';
      else if (hasTimer) hintEl.textContent = `เหลือ ${formatSec(tl)} ⏳`;
      else if (pct >= 0.8) hintEl.textContent = 'อีกนิดเดียว! ⚡';
      else hintEl.textContent = 'ทำภารกิจย่อย!';
    }

    setBadge(badge, state);
    setProgress(fillEl, pct, warn);

    // flash when progress increments OR mini changes
    if (key !== lastMiniKey || (lastMiniCur !== null && cur !== lastMiniCur)) {
      if (key !== lastMiniKey || (cur > (lastMiniCur ?? -Infinity))) {
        flashCard(miniCard);
      }
    }
    lastMiniKey = key;
    lastMiniCur = cur;
  }

  // -------------------------
  // Bind listeners (safe)
  // -------------------------
  ensureStyle();
  ensureHUD();

  // Existing HHA events (keep)
  function onScore() { /* เกมอื่นใช้ต่อได้ ไม่แตะ */ }
  function onCoach() { /* เกมอื่นใช้ต่อได้ ไม่แตะ */ }
  function onEnd() { /* เกมอื่นใช้ต่อได้ ไม่แตะ */ }

  // Patch A: quest:update
  function onQuestUpdate(ev) {
    const d = ev && ev.detail ? ev.detail : null;
    if (!d) return;
    updateGoal(d.goal || null);
    updateMini(d.mini || null);
  }

  // Patch A: quest:cleared -> flash badge CLEARED ชั่วครู่ (HUD)
  function onQuestCleared(ev) {
    const d = ev && ev.detail ? ev.detail : null;
    if (!d) return;
    const kind = String(d.kind || d.type || '').toLowerCase();
    const state = 'cleared';

    if (kind.includes('goal')) {
      const badge = $('hhaGoalBadge');
      setBadge(badge, state);
      flashCard($('hhaGoalTitle')?.closest('.hha-card'));
      // กลับเป็น ACTIVE ต่อ ถ้ายังมี goal ใหม่
      setTimeout(() => {
        // ไม่ override ถ้า goal อัปเดตมาใหม่แล้ว
        // (ปล่อยให้ quest:update จัดการ)
      }, 350);
    } else if (kind.includes('mini')) {
      const badge = $('hhaMiniBadge');
      setBadge(badge, state);
      flashCard($('hhaMiniTitle')?.closest('.hha-card'));
    }
  }

  // Register only once
  if (!root.__HHA_HUD_BOUND_A__) {
    root.__HHA_HUD_BOUND_A__ = true;

    doc.addEventListener('quest:update', onQuestUpdate, { passive: true });
    doc.addEventListener('quest:cleared', onQuestCleared, { passive: true });

    // keep compatibility with existing HUD signals (no-op if not used)
    doc.addEventListener('hha:score', onScore, { passive: true });
    doc.addEventListener('hha:coach', onCoach, { passive: true });
    doc.addEventListener('hha:end', onEnd, { passive: true });
  }

})(typeof window !== 'undefined' ? window : globalThis);
