// === /herohealth/vr/hha-end-summary.js ===
// HeroHealth End Summary + Back HUB + Flush-hardened (Pack 26)
// Requires: optional window.HHA_LOGGER (pack 23), optional window.HHA_SESSION (pack 25)

(function(ROOT){
  'use strict';
  const DOC = document;

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function ensureStyle(){
    if (DOC.getElementById('hha-end-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-end-style';
    st.textContent = `
      .hha-end{
        position:fixed; inset:0; z-index:9999;
        display:none; align-items:center; justify-content:center;
        background: rgba(2,6,23,.62);
        backdrop-filter: blur(12px);
      }
      .hha-end[aria-hidden="false"]{ display:flex; }
      .hha-end-card{
        width:min(720px, 92vw);
        border-radius:22px;
        background: rgba(2,6,23,.82);
        border:1px solid rgba(148,163,184,.22);
        box-shadow: 0 22px 60px rgba(0,0,0,.55);
        padding:18px;
        color:#e5e7eb;
        font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      .hha-end-top{
        display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
      }
      .hha-end-title{ font-size:26px; font-weight:1100; letter-spacing:.2px; }
      .hha-end-sub{ margin-top:6px; color:#94a3b8; font-weight:900; font-size:12px; }
      .hha-end-grade{
        min-width:110px;
        padding:10px 12px;
        border-radius:999px;
        border:1px solid rgba(34,197,94,.35);
        background: rgba(34,197,94,.14);
        text-align:center;
        font-weight:1200;
        font-size:18px;
      }
      .hha-end-grid{
        margin-top:14px;
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap:10px;
      }
      .hha-end-box{
        border:1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.55);
        border-radius:18px;
        padding:12px;
      }
      .k{ color:#94a3b8; font-weight:900; font-size:12px; }
      .v{ margin-top:2px; font-weight:1100; font-size:20px; }
      .small{ font-size:14px; font-weight:1000; }
      .hha-end-actions{
        margin-top:14px;
        display:flex;
        gap:10px;
        flex-wrap:wrap;
      }
      .hha-btn{
        height:52px;
        border-radius:16px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.60);
        color:#e5e7eb;
        font-weight:1100;
        padding:0 14px;
        cursor:pointer;
      }
      .hha-btn.primary{
        border:1px solid rgba(34,197,94,.38);
        background: rgba(34,197,94,.18);
        color:#eafff3;
      }
      .hha-btn:active{ transform: translateY(1px); }
      .hha-note{ margin-top:10px; color:#94a3b8; font-weight:900; font-size:12px; }
      @media (max-width:520px){
        .hha-end-grid{ grid-template-columns: 1fr; }
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureUI(){
    ensureStyle();
    let wrap = DOC.querySelector('.hha-end');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'hha-end';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML = `
      <div class="hha-end-card" role="dialog" aria-modal="true">
        <div class="hha-end-top">
          <div>
            <div class="hha-end-title" id="hhaEndTitle">สรุปผลการเล่น</div>
            <div class="hha-end-sub" id="hhaEndSub">—</div>
          </div>
          <div class="hha-end-grade" id="hhaEndGrade">—</div>
        </div>

        <div class="hha-end-grid">
          <div class="hha-end-box">
            <div class="k">คะแนน (Score)</div>
            <div class="v" id="hhaEndScore">0</div>
            <div class="k">คอมโบสูงสุด (Combo Max)</div>
            <div class="v small" id="hhaEndComboMax">0</div>
          </div>

          <div class="hha-end-box">
            <div class="k">Miss (นิยามมาตรฐาน)</div>
            <div class="v" id="hhaEndMiss">0</div>
            <div class="k">เวลาเล่นจริง</div>
            <div class="v small" id="hhaEndTime">0s</div>
          </div>

          <div class="hha-end-box">
            <div class="k">Goal</div>
            <div class="v small" id="hhaEndGoals">—</div>
            <div class="k">Mini Quest</div>
            <div class="v small" id="hhaEndMinis">—</div>
          </div>

          <div class="hha-end-box">
            <div class="k">ความแม่นยำ (Accuracy Good)</div>
            <div class="v small" id="hhaEndAcc">—</div>
            <div class="k">สาเหตุจบเกม</div>
            <div class="v small" id="hhaEndReason">—</div>
          </div>
        </div>

        <div class="hha-end-actions">
          <button class="hha-btn primary" id="hhaEndBackHub">กลับ HUB</button>
          <button class="hha-btn" id="hhaEndReplay">เล่นอีกครั้ง</button>
          <button class="hha-btn" id="hhaEndCopy">คัดลอกผลลัพธ์</button>
        </div>

        <div class="hha-note" id="hhaEndNote">กำลังบันทึกผล…</div>
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  async function flushNow(reason='end'){
    const L = ROOT.HHA_LOGGER;
    if (L && typeof L.flushNow === 'function'){
      try{
        await L.flushNow({ reason });
        return true;
      }catch(_){}
    }
    // fallback: short wait to allow any pending fetch to finish
    await new Promise(r=>setTimeout(r, 220));
    return false;
  }

  function setText(id, v){
    const el = DOC.getElementById(id);
    if (el) el.textContent = String(v ?? '—');
  }

  function summarizeForCopy(s){
    const lines = [];
    lines.push(`Game: ${s.projectTag || '-'}`);
    lines.push(`Mode: ${s.runMode || '-'}  Diff: ${s.diff || '-'}`);
    lines.push(`Score: ${s.scoreFinal ?? s.score ?? 0}`);
    lines.push(`ComboMax: ${s.comboMax ?? 0}`);
    lines.push(`Misses: ${s.misses ?? 0}`);
    lines.push(`Goals: ${(s.goalsCleared ?? 0)}/${(s.goalsTotal ?? 0)}`);
    lines.push(`Minis: ${(s.miniCleared ?? 0)}/${(s.miniTotal ?? 0)}`);
    if (s.accuracyGoodPct != null) lines.push(`AccuracyGood: ${Number(s.accuracyGoodPct).toFixed(1)}%`);
    lines.push(`Reason: ${s.reason || '-'}`);
    lines.push(`Session: ${s.sessionId || '-'}`);
    return lines.join('\n');
  }

  function showSummary(summary){
    const ui = ensureUI();
    ui.setAttribute('aria-hidden','false');

    const project = summary.projectTag || 'HeroHealth';
    const title = (summary.title) ? summary.title : (summary.reason==='missLimit' ? 'Game Over' : 'Completed');
    setText('hhaEndTitle', `${project} — ${title}`);

    setText('hhaEndSub',
      `sessionId: ${summary.sessionId || '-'}  •  ${summary.runMode || '-'} / ${summary.diff || '-'} / ${summary.device || summary.view || '-'}`
    );

    setText('hhaEndGrade', summary.grade || '—');

    setText('hhaEndScore', summary.scoreFinal ?? summary.score ?? 0);
    setText('hhaEndComboMax', summary.comboMax ?? 0);
    setText('hhaEndMiss', summary.misses ?? 0);

    const t = summary.durationPlayedSec ?? summary.durationSec ?? 0;
    setText('hhaEndTime', `${Math.round(Number(t)||0)}s`);

    const gC = summary.goalsCleared ?? 0, gT = summary.goalsTotal ?? 0;
    setText('hhaEndGoals', `${gC}/${gT}`);

    const mC = summary.miniCleared ?? 0, mT = summary.miniTotal ?? 0;
    setText('hhaEndMinis', `${mC}/${mT}`);

    const acc = summary.accuracyGoodPct;
    setText('hhaEndAcc', (acc==null) ? '—' : `${Number(acc).toFixed(1)}%`);

    setText('hhaEndReason', summary.reason || '-');

    // buttons
    const hubUrl = summary.hub || qs('hub', null);
    const btnHub = DOC.getElementById('hhaEndBackHub');
    const btnReplay = DOC.getElementById('hhaEndReplay');
    const btnCopy = DOC.getElementById('hhaEndCopy');
    const note = DOC.getElementById('hhaEndNote');

    if (btnHub){
      btnHub.onclick = async ()=>{
        note.textContent = 'กำลังบันทึกผล…';
        await flushNow('backHub');
        // clear active session id (pack 25)
        try{ ROOT.HHA_SESSION?.clearActiveSessionId?.(); }catch(_){}
        if (hubUrl) location.href = hubUrl;
        else location.href = '../hub.html';
      };
    }

    if (btnReplay){
      btnReplay.onclick = async ()=>{
        note.textContent = 'กำลังบันทึกผล…';
        await flushNow('replay');
        location.reload();
      };
    }

    if (btnCopy){
      btnCopy.onclick = async ()=>{
        const txt = summarizeForCopy(summary);
        try{
          await navigator.clipboard.writeText(txt);
          note.textContent = 'คัดลอกผลลัพธ์แล้ว ✅';
        }catch(_){
          note.textContent = 'คัดลอกไม่สำเร็จ (อุปกรณ์ไม่อนุญาต) ❗';
        }
      };
    }
  }

  function persistLastSummary(summary){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch(_){}
  }

  // ---- Main hook: listen hha:end ----
  let shown = false;
  ROOT.addEventListener('hha:end', async (ev)=>{
    if (shown) return;
    shown = true;

    const s = ev?.detail || {};
    // ensure sessionId stable (pack 25)
    if (!s.sessionId){
      try{ s.sessionId = ROOT.HHA_SESSION?.getOrMakeSessionId?.(); }catch(_){}
    }
    if (!s.endTimeIso) s.endTimeIso = new Date().toISOString();

    persistLastSummary(s);
    showSummary(s);

    // Flush immediately after showing (user sees overlay, log still writes)
    const note = DOC.getElementById('hhaEndNote');
    if (note) note.textContent = 'กำลังบันทึกผล…';
    await flushNow('end');
    if (note) note.textContent = 'บันทึกผลแล้ว ✅';
  }, { passive:true });

  // ---- Hardened flush on exits ----
  function scheduleFlush(reason){
    try{
      // best effort: do not block, just trigger
      flushNow(reason);
    }catch(_){}
  }
  ROOT.addEventListener('pagehide', ()=> scheduleFlush('pagehide'), { passive:true });
  DOC.addEventListener('visibilitychange', ()=>{
    if (DOC.visibilityState === 'hidden') scheduleFlush('hidden');
  }, { passive:true });

  ROOT.HHA_END_SUMMARY = { ensureUI, flushNow };
})(window);