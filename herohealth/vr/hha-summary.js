// === /herohealth/vr/hha-summary.js ===
// Hero Health Academy — End-of-Game Summary Overlay (DOM/VR)
// PATCH(B): Production-ready "จบเกม = ต้องมีหน้าสรุป"
// - ฟัง event: hha:end  (CustomEvent)
//   detail ตัวอย่าง:
//   {
//     projectTag, mode, diff, durationSec,
//     score, grade,
//     goalsCleared, goalsTotal,
//     minisCleared,
//     perfect, good, miss,
//     shield, comboMax,
//     hubUrl, restartUrl,
//     logger: { pending:boolean, ok:boolean, message:string }
//   }
// - ปุ่ม: เล่นใหม่ / กลับ Hub
// - ปลอดภัย: ถ้าไม่มีข้อมูลบางตัว ก็แสดงเท่าที่มี
// - รองรับเกมทุกตัว (GoodJunk/Hydration/Plate/Groups ฯลฯ)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const OVERLAY_ID = 'hha-summary';
  const STYLE_ID   = 'hha-summary-style-b';

  function safeText(v, fb='—') {
    if (v === null || v === undefined) return fb;
    const s = String(v).trim();
    return s ? s : fb;
  }
  function safeNum(v, fb=0) {
    v = Number(v);
    return isFinite(v) ? v : fb;
  }
  function fmtTime(sec) {
    sec = safeNum(sec, 0);
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m <= 0) return `${s}s`;
    return `${m}m ${s}s`;
  }
  function pickHubUrl(detail) {
    const d = detail || {};
    // 1) explicit
    if (d.hubUrl) return String(d.hubUrl);
    // 2) sessionStorage (ถ้ามี hub ตั้งไว้ใน hub.html)
    try {
      const ss = root.sessionStorage;
      if (ss) {
        const v = ss.getItem('HHA_HUB_URL') || ss.getItem('hhaHubUrl');
        if (v) return String(v);
      }
    } catch (_) {}
    // 3) referrer heuristic (ถ้ามาจาก hub.html)
    const ref = safeText(doc.referrer, '');
    if (ref && /hub\.html/i.test(ref)) return ref;
    // 4) fallback
    return 'hub.html';
  }
  function pickRestartUrl(detail) {
    const d = detail || {};
    if (d.restartUrl) return String(d.restartUrl);
    // reload current url without hash (คง query ไว้)
    try {
      const u = new URL(root.location.href);
      u.hash = '';
      return u.toString();
    } catch (_) {
      return root.location.href;
    }
  }

  function ensureStyle() {
    if (doc.getElementById(STYLE_ID)) return;
    const st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
/* ===== HHA Summary Patch B ===== */
#${OVERLAY_ID}{
  position:fixed; inset:0; z-index:10050;
  display:none;
  align-items:center; justify-content:center;
  padding: 18px;
}
#${OVERLAY_ID}.show{ display:flex; }
#${OVERLAY_ID} .hha-backdrop{
  position:absolute; inset:0;
  background: rgba(2,6,23,0.78);
  backdrop-filter: blur(10px);
}
#${OVERLAY_ID} .hha-card{
  position:relative;
  width:min(980px, calc(100vw - 24px));
  max-height: min(92vh, 780px);
  overflow:auto;
  border-radius: 22px;
  border:1px solid rgba(148,163,184,0.22);
  background: rgba(15,23,42,0.65);
  box-shadow: 0 20px 60px rgba(0,0,0,0.45);
  padding: 18px 18px 16px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
  color:#e5e7eb;
}
#${OVERLAY_ID} .hha-head{
  display:flex; align-items:flex-start; justify-content:space-between; gap:14px;
  margin-bottom: 10px;
}
#${OVERLAY_ID} .hha-title{
  font-weight: 1000;
  font-size: 18px;
  letter-spacing: .2px;
}
#${OVERLAY_ID} .hha-sub{
  margin-top:4px;
  color:#94a3b8;
  font-weight: 800;
  font-size: 12px;
}
#${OVERLAY_ID} .hha-gradeWrap{
  display:flex; align-items:center; gap:10px;
}
#${OVERLAY_ID} .hha-grade{
  font-weight: 1100;
  font-size: 34px;
  letter-spacing: 1px;
  padding: 10px 14px;
  border-radius: 18px;
  border:1px solid rgba(250,204,21,0.55);
  background: rgba(250,204,21,0.14);
  color:#fff7ed;
  text-shadow: 0 8px 20px rgba(0,0,0,0.35);
}
#${OVERLAY_ID} .hha-medal{
  font-size: 28px;
  filter: drop-shadow(0 10px 18px rgba(0,0,0,0.35));
}
#${OVERLAY_ID} .hha-grid{
  display:grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 12px;
  margin-top: 12px;
}
@media (max-width: 760px){
  #${OVERLAY_ID} .hha-grid{ grid-template-columns: 1fr; }
  #${OVERLAY_ID} .hha-grade{ font-size: 30px; }
}
#${OVERLAY_ID} .hha-panel{
  border-radius: 18px;
  border:1px solid rgba(148,163,184,0.18);
  background: rgba(2,6,23,0.45);
  padding: 12px 12px 10px;
}
#${OVERLAY_ID} .hha-panelTitle{
  font-weight: 1000;
  font-size: 13px;
  color:#e2e8f0;
  margin-bottom: 8px;
  display:flex; align-items:center; gap:8px;
}
#${OVERLAY_ID} .hha-rows{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
}
#${OVERLAY_ID} .hha-row{
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  padding: 8px 10px;
  border-radius: 14px;
  border:1px solid rgba(148,163,184,0.14);
  background: rgba(15,23,42,0.35);
}
#${OVERLAY_ID} .hha-k{
  color:#94a3b8;
  font-weight: 900;
  font-size: 12px;
}
#${OVERLAY_ID} .hha-v{
  color:#f8fafc;
  font-weight: 1100;
  font-size: 12px;
}
#${OVERLAY_ID} .hha-bigScore{
  font-weight: 1100;
  font-size: 42px;
  letter-spacing: .5px;
  margin: 4px 0 8px;
}
#${OVERLAY_ID} .hha-note{
  color:#a7f3d0;
  font-weight: 900;
  font-size: 12px;
  opacity: .92;
}
#${OVERLAY_ID} .hha-logger{
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  border:1px solid rgba(148,163,184,0.18);
  background: rgba(15,23,42,0.35);
  color:#cbd5e1;
  font-weight: 900;
  font-size: 12px;
}
#${OVERLAY_ID} .hha-logger.ok{ border-color: rgba(34,197,94,0.35); color:#d1fae5; background: rgba(34,197,94,0.10); }
#${OVERLAY_ID} .hha-logger.pending{ border-color: rgba(250,204,21,0.35); color:#fff7ed; background: rgba(250,204,21,0.10); }
#${OVERLAY_ID} .hha-logger.fail{ border-color: rgba(244,63,94,0.35); color:#ffe4e6; background: rgba(244,63,94,0.10); }

#${OVERLAY_ID} .hha-actions{
  margin-top: 12px;
  display:flex; flex-wrap:wrap;
  gap: 10px;
  justify-content:flex-end;
}
#${OVERLAY_ID} .hha-btn{
  pointer-events:auto;
  cursor:pointer;
  user-select:none;
  border-radius: 16px;
  padding: 12px 14px;
  font-weight: 1100;
  font-size: 14px;
  border:1px solid rgba(148,163,184,0.22);
  background: rgba(15,23,42,0.55);
  color:#e5e7eb;
  box-shadow: 0 10px 26px rgba(0,0,0,0.25);
}
#${OVERLAY_ID} .hha-btn.primary{
  border-color: rgba(34,197,94,0.55);
  background: rgba(34,197,94,0.16);
}
#${OVERLAY_ID} .hha-btn.secondary{
  border-color: rgba(59,130,246,0.55);
  background: rgba(59,130,246,0.14);
}
#${OVERLAY_ID} .hha-btn:active{
  transform: translateY(1px) scale(0.99);
}
    `.trim();
    doc.head.appendChild(st);
  }

  function ensureOverlay() {
    let el = doc.getElementById(OVERLAY_ID);
    if (el) return el;

    el = doc.createElement('div');
    el.id = OVERLAY_ID;
    el.innerHTML = `
      <div class="hha-backdrop" aria-hidden="true"></div>
      <div class="hha-card" role="dialog" aria-modal="true" aria-label="Game Summary">
        <div class="hha-head">
          <div>
            <div class="hha-title" id="hhaSumTitle">สรุปผลการเล่น</div>
            <div class="hha-sub" id="hhaSumSub">—</div>
          </div>
          <div class="hha-gradeWrap">
            <div class="hha-medal" id="hhaSumMedal">🏁</div>
            <div class="hha-grade" id="hhaSumGrade">A</div>
          </div>
        </div>

        <div class="hha-grid">
          <div class="hha-panel">
            <div class="hha-panelTitle">🏆 คะแนนรวม</div>
            <div class="hha-bigScore" id="hhaSumScore">0</div>
            <div class="hha-note" id="hhaSumNote">ทำได้ดีมาก! ลองทำให้ได้เกรดสูงขึ้นอีกนะ ✨</div>
          </div>

          <div class="hha-panel">
            <div class="hha-panelTitle">📊 สถิติ</div>
            <div class="hha-rows">
              <div class="hha-row"><div class="hha-k">เวลา</div><div class="hha-v" id="hhaSumTime">0s</div></div>
              <div class="hha-row"><div class="hha-k">โหมด</div><div class="hha-v" id="hhaSumMode">—</div></div>
              <div class="hha-row"><div class="hha-k">ระดับ</div><div class="hha-v" id="hhaSumDiff">—</div></div>
              <div class="hha-row"><div class="hha-k">Miss</div><div class="hha-v" id="hhaSumMiss">0</div></div>

              <div class="hha-row"><div class="hha-k">Perfect</div><div class="hha-v" id="hhaSumPerfect">0</div></div>
              <div class="hha-row"><div class="hha-k">Good</div><div class="hha-v" id="hhaSumGood">0</div></div>

              <div class="hha-row"><div class="hha-k">Goals</div><div class="hha-v" id="hhaSumGoals">0/0</div></div>
              <div class="hha-row"><div class="hha-k">Mini</div><div class="hha-v" id="hhaSumMinis">0</div></div>
            </div>

            <div class="hha-logger" id="hhaSumLogger" style="display:none"></div>
          </div>
        </div>

        <div class="hha-actions">
          <button class="hha-btn secondary" id="hhaSumHub">🏠 กลับ Hub</button>
          <button class="hha-btn primary" id="hhaSumRestart">🔁 เล่นใหม่</button>
        </div>
      </div>
    `;
    doc.body.appendChild(el);
    return el;
  }

  function medalFromGrade(grade) {
    grade = String(grade || '').toUpperCase();
    if (grade === 'SSS') return '👑';
    if (grade === 'SS')  return '🥇';
    if (grade === 'S')   return '🥈';
    if (grade === 'A')   return '🥉';
    if (grade === 'B')   return '⭐';
    if (grade === 'C')   return '🧱';
    return '🏁';
  }

  function noteFromGrade(grade) {
    grade = String(grade || '').toUpperCase();
    if (grade === 'SSS') return 'สุดยอดมาก! เก่งขั้นเทพเลย! 👑🔥';
    if (grade === 'SS')  return 'โหดมาก! อีกนิดเดียวถึง SSS แล้ว! 🥇';
    if (grade === 'S')   return 'เยี่ยมมาก! รักษาฟอร์มนี้ไว้! 🥈';
    if (grade === 'A')   return 'ทำได้ดี! ลองลด Miss ลงอีกหน่อยนะ ✨';
    if (grade === 'B')   return 'กำลังมา! ฝึกอีกนิดเดี๋ยวก็พุ่ง 🚀';
    if (grade === 'C')   return 'ไม่เป็นไร! ลองใหม่ได้ เก่งขึ้นแน่นอน 💪';
    return 'จบเกมแล้ว! พร้อมลุยรอบต่อไปไหม?';
  }

  function showSummary(detail) {
    ensureStyle();
    const el = ensureOverlay();

    const d = detail || {};

    // Title/sub
    doc.getElementById('hhaSumTitle').textContent = safeText(d.projectTag, 'สรุปผลการเล่น');
    const sub = [
      safeText(d.mode, 'mode'),
      '•',
      safeText(d.diff, 'diff'),
    ].join(' ');
    doc.getElementById('hhaSumSub').textContent = sub;

    // Grade/medal
    const grade = safeText(d.grade, 'A').toUpperCase();
    doc.getElementById('hhaSumGrade').textContent = grade;
    doc.getElementById('hhaSumMedal').textContent = medalFromGrade(grade);

    // Score
    doc.getElementById('hhaSumScore').textContent = String(safeNum(d.score, 0));
    doc.getElementById('hhaSumNote').textContent = noteFromGrade(grade);

    // Stats
    doc.getElementById('hhaSumTime').textContent = fmtTime(d.durationSec);
    doc.getElementById('hhaSumMode').textContent = safeText(d.mode, '—');
    doc.getElementById('hhaSumDiff').textContent = safeText(d.diff, '—');
    doc.getElementById('hhaSumMiss').textContent = String(safeNum(d.miss, 0));
    doc.getElementById('hhaSumPerfect').textContent = String(safeNum(d.perfect, 0));
    doc.getElementById('hhaSumGood').textContent = String(safeNum(d.good, 0));

    const gc = safeNum(d.goalsCleared, 0);
    const gt = safeNum(d.goalsTotal, 0);
    doc.getElementById('hhaSumGoals').textContent = `${gc}/${gt}`;
    doc.getElementById('hhaSumMinis').textContent = String(safeNum(d.minisCleared, 0));

    // Logger status (optional)
    const logEl = doc.getElementById('hhaSumLogger');
    if (d.logger && typeof d.logger === 'object') {
      const pending = !!d.logger.pending;
      const ok      = !!d.logger.ok;
      const msg     = safeText(d.logger.message, '');
      logEl.style.display = 'block';
      logEl.classList.remove('ok','pending','fail');
      if (pending) {
        logEl.classList.add('pending');
        logEl.textContent = 'กำลังส่งข้อมูลการวิจัย… ⏳';
      } else if (ok) {
        logEl.classList.add('ok');
        logEl.textContent = msg || 'ส่งข้อมูลแล้ว ✅';
      } else {
        logEl.classList.add('fail');
        logEl.textContent = msg || 'ส่งข้อมูลไม่สำเร็จ (ลองใหม่ได้) ⚠️';
      }
    } else {
      logEl.style.display = 'none';
    }

    // Buttons
    const hubUrl = pickHubUrl(d);
    const restartUrl = pickRestartUrl(d);

    const btnHub = doc.getElementById('hhaSumHub');
    const btnRestart = doc.getElementById('hhaSumRestart');

    btnHub.onclick = () => { root.location.href = hubUrl; };
    btnRestart.onclick = () => { root.location.href = restartUrl; };

    // show overlay + block gameplay clicks
    el.classList.add('show');
    // prevent scrolling background (mobile)
    doc.documentElement.style.overflow = 'hidden';
    doc.body.style.overflow = 'hidden';
  }

  function hideSummary() {
    const el = doc.getElementById(OVERLAY_ID);
    if (!el) return;
    el.classList.remove('show');
    doc.documentElement.style.overflow = '';
    doc.body.style.overflow = '';
  }

  // Expose API (optional)
  root.HHA_Summary = {
    show: showSummary,
    hide: hideSummary
  };

  // Bind once
  if (!root.__HHA_SUMMARY_BOUND_B__) {
    root.__HHA_SUMMARY_BOUND_B__ = true;

    doc.addEventListener('hha:end', (ev) => {
      const d = ev && ev.detail ? ev.detail : {};
      showSummary(d);
    }, { passive: true });

    // ESC to close (debug/dev) — ใน production จะไม่ต้องปิดก็ได้
    doc.addEventListener('keydown', (e) => {
      if (e && e.key === 'Escape') hideSummary();
    }, { passive: true });
  }

})(typeof window !== 'undefined' ? window : globalThis);
