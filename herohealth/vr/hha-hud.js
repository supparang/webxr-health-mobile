// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR)
// - listens: hha:score, quest:update, hha:coach, hha:fever, hha:judge, hha:time, hha:end
// - safe: if element missing -> skip
// ✅ PATCH: End Screen renderer (#hvr-end) to prevent "black screen" after game end

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_HUD_BINDER__) return;
  root.__HHA_HUD_BINDER__ = true;

  const $id = (id) => doc.getElementById(id);
  const clamp = (v, a, b) => {
    v = Number(v) || 0;
    if (v < a) return a;
    if (v > b) return b;
    return v;
  };

  // --------------------------------------------------------
  //  End screen
  // --------------------------------------------------------
  function ensureEndHost() {
    let el = $id('hvr-end');
    if (el) return el;

    el = doc.createElement('div');
    el.id = 'hvr-end';
    Object.assign(el.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '120',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '18px',
      background: 'rgba(2,6,23,.55)',
      backdropFilter: 'blur(10px)'
    });
    doc.body.appendChild(el);
    return el;
  }

  function showEnd(detail = {}) {
    const endEl = ensureEndHost();
    if (!endEl) return;

    const score = detail.score ?? 0;
    const miss  = detail.miss ?? 0;
    const combo = detail.comboBest ?? 0;
    const water = detail.water ?? 0;
    const zone  = detail.zone ?? '-';
    const green = detail.greenTick ?? 0;

    const goalsDone = detail.goalsDone ?? null;
    const minisDone = detail.minisDone ?? null;

    endEl.innerHTML = `
      <div style="width:min(560px,92vw);background:rgba(2,6,23,.82);border:1px solid rgba(148,163,184,.22);
                  border-radius:22px;box-shadow:0 30px 90px rgba(0,0,0,.65);padding:16px 16px 14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="font-weight:1000;font-size:20px;">🏁 จบเกม</div>
          <div style="font-weight:900;font-size:12px;opacity:.85;border:1px solid rgba(148,163,184,.25);
                      padding:6px 10px;border-radius:999px;background:rgba(2,6,23,.55);">
            ZONE ${zone}
          </div>
        </div>

        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;">
            <div style="opacity:.72;font-size:12px;">Score</div>
            <div style="font-weight:1000;font-size:28px;">${score}</div>
          </div>
          <div style="background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;">
            <div style="opacity:.72;font-size:12px;">Combo Best</div>
            <div style="font-weight:1000;font-size:28px;">${combo}</div>
          </div>
          <div style="background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;">
            <div style="opacity:.72;font-size:12px;">Miss</div>
            <div style="font-weight:1000;font-size:28px;">${miss}</div>
          </div>
          <div style="background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:12px;">
            <div style="opacity:.72;font-size:12px;">Water</div>
            <div style="font-weight:1000;font-size:28px;">${water}%</div>
          </div>
        </div>

        <div style="margin-top:10px;opacity:.80;font-size:12px;line-height:1.35;">
          อยู่ในโซน GREEN รวม ~ <b>${green}</b> วินาที
          ${goalsDone != null || minisDone != null ? `<br/>Quest: Goal <b>${goalsDone ?? '-'}</b> • Mini <b>${minisDone ?? '-'}</b>` : ``}
        </div>

        <div style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          <button id="hha-end-close"
            style="border:1px solid rgba(148,163,184,.25);background:rgba(2,6,23,.55);color:#e5e7eb;
                   padding:10px 12px;border-radius:14px;font-weight:900;cursor:pointer;">
            ✅ ปิดหน้าสรุป
          </button>
          <button id="hha-end-restart"
            style="border:1px solid rgba(148,163,184,.25);background:rgba(34,197,94,.18);color:#e5e7eb;
                   padding:10px 12px;border-radius:14px;font-weight:1000;cursor:pointer;">
            🔁 เล่นอีกครั้ง
          </button>
        </div>
      </div>
    `;

    endEl.style.display = 'flex';
    endEl.classList.add('on');

    endEl.querySelector('#hha-end-close')?.addEventListener('click', () => {
      endEl.classList.remove('on');
      endEl.style.display = 'none';
    });

    endEl.querySelector('#hha-end-restart')?.addEventListener('click', () => {
      root.location.reload();
    });
  }

  // --------------------------------------------------------
  //  HUD updates (safe)
  // --------------------------------------------------------
  function onScore(e) {
    const d = e?.detail || {};
    const score = $id('hha-score-main'); if (score) score.textContent = String(d.score ?? 0);
    const combo = $id('hha-combo-max');  if (combo) combo.textContent = String(d.comboBest ?? d.combo ?? 0);
    const miss  = $id('hha-miss');       if (miss)  miss.textContent  = String(d.miss ?? 0);

    const z = $id('hha-water-zone-text'); if (z && d.zone) z.textContent = String(d.zone);

    const gfill = $id('hha-grade-progress-fill');
    const gtxt  = $id('hha-grade-progress-text');
    if (gfill && typeof d.progressPct === 'number') gfill.style.width = clamp(d.progressPct,0,100) + '%';
    if (gtxt && d.progressText) gtxt.textContent = String(d.progressText);

    const gb = $id('hha-grade-badge'); if (gb && d.grade) gb.textContent = String(d.grade);

    // optional goal/mini counters
    const gC = $id('hha-goal-count'); if (gC && typeof d.goalsDone === 'number') gC.textContent = String(d.goalsDone);
    const mC = $id('hha-mini-count'); if (mC && typeof d.minisDone === 'number') mC.textContent = String(d.minisDone);
  }

  function onQuest(e) {
    const d = e?.detail || {};
    const goalEl = $id('hha-quest-goal'); if (goalEl && d.goalText) goalEl.textContent = String(d.goalText).replace(/^Goal:\s*/,'Goal: ');
    const miniEl = $id('hha-quest-mini'); if (miniEl && d.miniText) miniEl.textContent = String(d.miniText).replace(/^Mini:\s*/,'Mini: ');

    const gC = $id('hha-goal-count'); if (gC && typeof d.goalDone === 'number') gC.textContent = String(d.goalDone);
    const mC = $id('hha-mini-count'); if (mC && typeof d.miniDone === 'number') mC.textContent = String(d.miniDone);
  }

  function onTime(e) {
    const sec = Number(e?.detail?.sec);
    const t = $id('hha-time-left');
    if (t && Number.isFinite(sec)) t.textContent = String(sec);
  }

  function onEnd(e) {
    const d = e?.detail || {};
    showEnd(d);
  }

  // Bind events (safe)
  root.addEventListener('hha:score', onScore, { passive:true });
  root.addEventListener('quest:update', onQuest, { passive:true });
  root.addEventListener('hha:time', onTime, { passive:true });
  root.addEventListener('hha:end',  onEnd,  { passive:true });

})(typeof window !== 'undefined' ? window : globalThis);