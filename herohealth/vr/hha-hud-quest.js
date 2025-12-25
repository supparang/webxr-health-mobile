// === /herohealth/vr/hha-hud-quest.js ===
// HeroHealth — Quest HUD Binder (DOM) — FIX-ALL
// ✅ Always shows GOAL + MINI when quest:update arrives
// ✅ Supports questOk=false (shows QUEST OFF but keeps UI alive)
// ✅ Supports payload shapes from Groups/GoodJunk/Hydration/Plate engines
// ✅ Progress bars + percent + (optional) tLeft for rush_window
// ✅ Safe if elements missing (won't crash)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const clamp = (v, a, b) => {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  };

  function $(id){ try{ return doc.getElementById(id); } catch { return null; } }
  function q(sel){ try{ return doc.querySelector(sel); } catch { return null; } }
  function qa(sel){ try{ return Array.from(doc.querySelectorAll(sel)); } catch { return []; } }

  function setTxt(el, t){
    if (!el) return;
    el.textContent = (t == null) ? '' : String(t);
  }

  function setPctBar(el, pct){
    if (!el) return;
    const p = clamp(pct, 0, 100);
    // support: <div class="bar"><div class="fill"></div></div>
    const fill =
      el.classList && el.classList.contains('fill') ? el :
      el.querySelector ? (el.querySelector('.fill') || el.querySelector('.bar-fill') || el.querySelector('.progress-fill')) : null;

    if (fill){
      fill.style.width = p.toFixed(1) + '%';
      return;
    }
    // fallback: if el itself is the fill
    try{ el.style.width = p.toFixed(1) + '%'; }catch{}
  }

  function show(el, on){
    if (!el) return;
    el.style.display = on ? '' : 'none';
  }

  // --------- resolve UI nodes (supports multiple layouts) ----------
  const UI = {
    wrap: $('questPanel') || q('.hha-quest') || q('.quest-panel') || q('#hudQuest') || null,

    goalTitle:
      $('questGoalTitle') ||
      q('.hha-goal-title') ||
      q('#goalTitle') ||
      q('[data-quest="goal-title"]') ||
      null,

    goalProg:
      $('questGoalProg') ||
      q('.hha-goal-prog') ||
      q('#goalProg') ||
      q('[data-quest="goal-prog"]') ||
      null,

    goalBar:
      $('questGoalBar') ||
      q('.hha-goal-bar') ||
      q('#goalBar') ||
      q('[data-quest="goal-bar"]') ||
      null,

    miniTitle:
      $('questMiniTitle') ||
      q('.hha-mini-title') ||
      q('#miniTitle') ||
      q('[data-quest="mini-title"]') ||
      null,

    miniProg:
      $('questMiniProg') ||
      q('.hha-mini-prog') ||
      q('#miniProg') ||
      q('[data-quest="mini-prog"]') ||
      null,

    miniBar:
      $('questMiniBar') ||
      q('.hha-mini-bar') ||
      q('#miniBar') ||
      q('[data-quest="mini-bar"]') ||
      null,

    // optional labels
    groupLabel:
      $('questGroupLabel') ||
      q('.hha-quest-group') ||
      q('[data-quest="group-label"]') ||
      null,

    hint:
      $('questHint') ||
      q('.hha-quest-hint') ||
      q('[data-quest="hint"]') ||
      null
  };

  // If wrapper not found, still bind (some UIs place goal/mini directly)
  const hasAny =
    UI.goalTitle || UI.goalProg || UI.goalBar ||
    UI.miniTitle || UI.miniProg || UI.miniBar;

  if (!hasAny) {
    // Not fatal: allow engines to run without quest HUD
    // (but user expects it, so we try to auto-create if possible)
    // Try to attach a minimal quest box if body exists
    try{
      const box = doc.createElement('div');
      box.className = 'hha-quest hha-quest-autogen';
      Object.assign(box.style, {
        position:'fixed',
        left:'12px',
        bottom:'12px',
        width:'min(560px, calc(100vw - 24px))',
        zIndex:'65',
        pointerEvents:'none',
        background:'rgba(2,6,23,.55)',
        border:'1px solid rgba(148,163,184,.16)',
        borderRadius:'18px',
        padding:'10px 12px',
        backdropFilter:'blur(10px)',
        WebkitBackdropFilter:'blur(10px)',
        boxShadow:'0 16px 46px rgba(0,0,0,.38)',
        color:'#e5e7eb',
        fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      });
      box.innerHTML = `
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <div style="flex:1 1 240px; min-width:220px;">
            <div style="font-weight:900; font-size:12px; opacity:.85;">GOAL</div>
            <div class="hha-goal-title" style="font-weight:900; font-size:14px; margin-top:3px;">—</div>
            <div style="display:flex; justify-content:space-between; font-size:12px; opacity:.9; margin-top:6px;">
              <div class="hha-goal-prog">0/0</div><div class="hha-goal-pct">0%</div>
            </div>
            <div class="hha-goal-bar" style="height:10px; border-radius:999px; background:rgba(148,163,184,.12); margin-top:6px; overflow:hidden;">
              <div class="fill" style="height:100%; width:0%; background:rgba(34,197,94,.9);"></div>
            </div>
          </div>
          <div style="flex:1 1 240px; min-width:220px;">
            <div style="font-weight:900; font-size:12px; opacity:.85;">🧩 MINI</div>
            <div class="hha-mini-title" style="font-weight:900; font-size:14px; margin-top:3px;">—</div>
            <div style="display:flex; justify-content:space-between; font-size:12px; opacity:.9; margin-top:6px;">
              <div class="hha-mini-prog">0/0</div><div class="hha-mini-pct">0%</div>
            </div>
            <div class="hha-mini-bar" style="height:10px; border-radius:999px; background:rgba(148,163,184,.12); margin-top:6px; overflow:hidden;">
              <div class="fill" style="height:100%; width:0%; background:rgba(59,130,246,.92);"></div>
            </div>
          </div>
        </div>
        <div class="hha-quest-hint" style="margin-top:8px; font-size:12px; opacity:.85;">—</div>
      `;
      doc.body.appendChild(box);

      // Re-resolve
      UI.wrap = box;
      UI.goalTitle = q('.hha-goal-title');
      UI.goalProg  = q('.hha-goal-prog');
      UI.goalBar   = q('.hha-goal-bar');
      UI.miniTitle = q('.hha-mini-title');
      UI.miniProg  = q('.hha-mini-prog');
      UI.miniBar   = q('.hha-mini-bar');
      UI.hint      = q('.hha-quest-hint');
    }catch{}
  }

  // extra percent labels if exist
  function resolvePctLabel(forMini){
    if (forMini) return $('questMiniPct') || q('.hha-mini-pct') || q('[data-quest="mini-pct"]') || null;
    return $('questGoalPct') || q('.hha-goal-pct') || q('[data-quest="goal-pct"]') || null;
  }
  const goalPctEl = resolvePctLabel(false);
  const miniPctEl = resolvePctLabel(true);

  // ---------- rendering ----------
  function formatProg(prog, target){
    const p = Math.max(0, (prog|0));
    const t = Math.max(0, (target|0));
    return `${p}/${t}`;
  }

  function pct(prog, target){
    const t = Math.max(0, Number(target) || 0);
    const p = Math.max(0, Number(prog) || 0);
    if (t <= 0) return 0;
    return clamp((p / t) * 100, 0, 100);
  }

  function showQuestOff(detail){
    const msg = '⚠️ QUEST ไม่พร้อม (เช็ค groups-quests.js / hha-hud-quest.js)';
    setTxt(UI.goalTitle, '—');
    setTxt(UI.goalProg, '0/0');
    setPctBar(UI.goalBar, 0);
    if (goalPctEl) setTxt(goalPctEl, '0%');

    setTxt(UI.miniTitle, '—');
    setTxt(UI.miniProg, '0/0');
    setPctBar(UI.miniBar, 0);
    if (miniPctEl) setTxt(miniPctEl, '0%');

    if (UI.groupLabel) setTxt(UI.groupLabel, (detail && detail.groupLabel) ? detail.groupLabel : '—');
    if (UI.hint) setTxt(UI.hint, msg);
  }

  function renderGoal(goal){
    if (!goal){
      setTxt(UI.goalTitle, '—');
      setTxt(UI.goalProg, '0/0');
      setPctBar(UI.goalBar, 0);
      if (goalPctEl) setTxt(goalPctEl, '0%');
      return;
    }
    const label = goal.label ? String(goal.label) : 'GOAL';
    const p = (goal.prog == null) ? 0 : (goal.prog|0);
    const t = (goal.target == null) ? 0 : (goal.target|0);

    setTxt(UI.goalTitle, label);
    setTxt(UI.goalProg, formatProg(p, t));
    const pr = pct(p, t);
    setPctBar(UI.goalBar, pr);
    if (goalPctEl) setTxt(goalPctEl, Math.round(pr) + '%');
  }

  function renderMini(mini){
    if (!mini){
      setTxt(UI.miniTitle, '—');
      setTxt(UI.miniProg, '0/0');
      setPctBar(UI.miniBar, 0);
      if (miniPctEl) setTxt(miniPctEl, '0%');
      return;
    }
    let label = mini.label ? String(mini.label) : 'MINI';
    const p = (mini.prog == null) ? 0 : (mini.prog|0);
    const t = (mini.target == null) ? 0 : (mini.target|0);

    // show timer if provided (rush_window)
    const hasTL = (mini.tLeft != null) && (mini.windowSec != null);
    if (hasTL){
      const tl = Math.max(0, mini.tLeft|0);
      const ws = Math.max(1, mini.windowSec|0);
      label = `${label} (${tl}s)`;
      // If this mini is time-windowed, also reflect remaining time in hint
      if (UI.hint) setTxt(UI.hint, `⏱️ เหลือเวลา ${tl}/${ws} วินาที`);
    }

    setTxt(UI.miniTitle, label);
    setTxt(UI.miniProg, formatProg(p, t));
    const pr = pct(p, t);
    setPctBar(UI.miniBar, pr);
    if (miniPctEl) setTxt(miniPctEl, Math.round(pr) + '%');
  }

  function inferActive(detail){
    // Engine already sends goal/mini as active not-done, but accept alt shape too
    const goal = detail.goal || detail.activeGoal || null;
    const mini = detail.mini || detail.activeMini || null;
    return { goal, mini };
  }

  function update(detail){
    detail = detail || {};

    // if wrapper exists but hidden, show it
    if (UI.wrap) show(UI.wrap, true);

    const questOk = (detail.questOk !== undefined) ? !!detail.questOk : true;
    if (!questOk){
      showQuestOff(detail);
      return;
    }

    if (UI.groupLabel) setTxt(UI.groupLabel, detail.groupLabel ? String(detail.groupLabel) : '—');

    const { goal, mini } = inferActive(detail);

    // if hint exists and quest ok, clear hint unless engine sends something
    if (UI.hint){
      if (detail.hint) setTxt(UI.hint, String(detail.hint));
      else setTxt(UI.hint, 'ทำให้ครบ!');
    }

    renderGoal(goal);
    renderMini(mini);
  }

  // ---------- event binding ----------
  let lastUpdateAt = 0;

  root.addEventListener('quest:update', (ev) => {
    try{
      const d = ev && ev.detail ? ev.detail : {};
      lastUpdateAt = Date.now();
      update(d);
    }catch{}
  });

  // If engine never emits quest:update, show a gentle placeholder (but don't spam)
  setTimeout(() => {
    try{
      if (!lastUpdateAt){
        // keep panels alive but neutral
        update({ questOk:false, groupLabel:'', hint:'รอ quest:update… (เช็คว่า Engine.start ถูกเรียก และ script โหลดครบ)' });
      }
    }catch{}
  }, 1800);

  // Expose debug helper
  root.HHA_QUEST_HUD = root.HHA_QUEST_HUD || {};
  root.HHA_QUEST_HUD.force = function(payload){ update(payload || {}); };

})(window);