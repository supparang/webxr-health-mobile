// === /herohealth/vr/hha-summary.js ===
// HHA Universal End Summary Overlay — v1.0.0
// ✅ Listens: window 'hha:end' {detail: summary}
// ✅ Stores: HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY (top 50)
// ✅ Buttons: Retry, BackHub (.btnBackHub), Copy JSON, Download CSV, Close
// ✅ CSV: generic (session rows + event rows if summary.logs exists)
// ✅ Harden: hide on boot; [hidden]{display:none !important;}

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function safeText(id, txt){
    const el = DOC.getElementById(id);
    if (el) el.textContent = String(txt ?? '');
  }

  function safeCopy(text){
    try{ navigator.clipboard?.writeText(String(text)); }catch(_){}
  }

  function safeDownload(filename, text, mime='text/plain'){
    try{
      const blob = new Blob([text], {type:mime});
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url;
      a.download = filename;
      DOC.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1200);
    }catch(_){}
  }

  function ensureStyle(){
    if (DOC.getElementById('hha-summary-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-summary-style';
    st.textContent = `
      [hidden]{ display:none !important; }
      .hha-summary-backdrop{
        position:fixed; inset:0; z-index:99999;
        background:rgba(2,6,23,.72);
        display:grid; place-items:center;
        padding: max(10px, env(safe-area-inset-top)) 12px max(14px, env(safe-area-inset-bottom)) 12px;
      }
      .hha-summary-card{
        width:min(780px, 94vw);
        max-height:min(86vh, 820px);
        overflow:auto;
        border-radius:18px;
        border:1px solid rgba(148,163,184,.20);
        background:rgba(2,6,23,.92);
        color:#e5e7eb;
        box-shadow:0 18px 60px rgba(0,0,0,.35);
        padding:14px;
        font-family:system-ui,-apple-system,Segoe UI,Roboto;
      }
      .hha-s-row{ display:flex; gap:10px; flex-wrap:wrap; }
      .hha-pill{
        padding:6px 10px; border-radius:999px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.55);
        font-size:13px;
      }
      .hha-s-title{ font-weight:900; font-size:18px; margin:2px 0 8px; }
      .hha-s-grid{
        display:grid; grid-template-columns:repeat(2, minmax(0,1fr));
        gap:10px; margin-top:10px;
      }
      @media (max-width:560px){ .hha-s-grid{ grid-template-columns:1fr; } }
      .hha-box{
        border:1px solid rgba(148,163,184,.18);
        border-radius:14px;
        background:rgba(15,23,42,.45);
        padding:10px;
      }
      .hha-k{ color:#94a3b8; font-size:12px; }
      .hha-v{ font-weight:800; font-size:18px; }
      .hha-tips{ white-space:pre-wrap; font-size:13px; color:#e2e8f0; line-height:1.35; }
      .hha-btns{ display:flex; flex-wrap:wrap; gap:10px; margin-top:12px; }
      .hha-btn{
        appearance:none; border:1px solid rgba(148,163,184,.22);
        background:rgba(15,23,42,.65); color:#e5e7eb;
        border-radius:12px; padding:10px 12px;
        font-weight:800; font-size:14px;
        cursor:pointer;
      }
      .hha-btn:active{ transform: translateY(1px); }
      .hha-btn.primary{ border-color:rgba(34,197,94,.35); background:rgba(34,197,94,.14); }
      .hha-btn.danger{ border-color:rgba(239,68,68,.35); background:rgba(239,68,68,.10); }
    `;
    DOC.head.appendChild(st);
  }

  function ensureOverlay(){
    ensureStyle();
    let back = DOC.getElementById('hhaResultBackdrop');
    if (back) return back;

    back = DOC.createElement('div');
    back.id = 'hhaResultBackdrop';
    back.className = 'hha-summary-backdrop';
    back.hidden = true;

    back.innerHTML = `
      <div class="hha-summary-card" role="dialog" aria-modal="true" aria-label="ผลการเล่น">
        <div class="hha-s-row" style="justify-content:space-between; align-items:center;">
          <div>
            <div class="hha-s-title">สรุปผลการเล่น</div>
            <div class="hha-s-row">
              <div class="hha-pill" id="hhaPGame">game</div>
              <div class="hha-pill" id="hhaPRun">run</div>
              <div class="hha-pill" id="hhaPDiff">diff</div>
              <div class="hha-pill" id="hhaPSeed">seed</div>
            </div>
          </div>
          <button class="hha-btn danger" id="hhaBtnClose">ปิด</button>
        </div>

        <div class="hha-s-grid">
          <div class="hha-box">
            <div class="hha-k">คะแนน</div>
            <div class="hha-v" id="hhaScore">0</div>
          </div>
          <div class="hha-box">
            <div class="hha-k">เกรด / ระดับ</div>
            <div class="hha-v"><span id="hhaGrade">—</span> <span style="font-size:14px; font-weight:700; color:#cbd5e1" id="hhaTier"></span></div>
          </div>
          <div class="hha-box">
            <div class="hha-k">ความแม่น</div>
            <div class="hha-v" id="hhaAcc">0%</div>
          </div>
          <div class="hha-box">
            <div class="hha-k">คอมโบสูงสุด / พลาด</div>
            <div class="hha-v"><span id="hhaComboMax">0</span> / <span id="hhaMiss">0</span></div>
          </div>
        </div>

        <div class="hha-box" style="margin-top:10px;">
          <div class="hha-k">Goals / Minis</div>
          <div class="hha-tips" id="hhaGoals">—</div>
        </div>

        <div class="hha-box" style="margin-top:10px;">
          <div class="hha-k">คำแนะนำ</div>
          <div class="hha-tips" id="hhaTips">—</div>
        </div>

        <div class="hha-btns">
          <button class="hha-btn primary" id="hhaBtnRetry">เล่นอีกครั้ง</button>
          <button class="hha-btn btnBackHub">กลับ HUB</button>
          <button class="hha-btn" id="hhaBtnCopyJSON">Copy JSON</button>
          <button class="hha-btn" id="hhaBtnCSV">Download CSV</button>
        </div>
      </div>
    `;
    DOC.body.appendChild(back);
    return back;
  }

  function computeAccuracy(summary){
    // Prefer explicit fields if present
    const acc1 = summary.accuracyPct;
    if (Number.isFinite(acc1)) return Math.max(0, Math.min(100, Math.round(acc1)));

    const acc2 = summary.accuracyGoodPct;
    if (Number.isFinite(acc2)) return Math.max(0, Math.min(100, Math.round(acc2)));

    // fallback from hits/shots
    const shots = Number(summary.shots ?? 0) || 0;
    const good = Number(summary.goodShots ?? summary.hitGood ?? 0) || 0;
    if (shots > 0) return Math.max(0, Math.min(100, Math.round((good/shots)*100)));
    return 0;
  }

  function computeScore(summary){
    return Number(summary.scoreFinal ?? summary.score ?? 0) || 0;
  }

  function computeMiss(summary){
    return Number(summary.miss ?? summary.misses ?? 0) || 0;
  }

  function computeComboMax(summary){
    return Number(summary.comboMax ?? summary.maxCombo ?? 0) || 0;
  }

  function computeGrade(summary, acc, score){
    if (summary.grade) return String(summary.grade);
    // simple fallback
    if (acc>=92 && score>=220) return 'S';
    if (acc>=86 && score>=170) return 'A';
    if (acc>=76 && score>=120) return 'B';
    if (acc>=62) return 'C';
    return 'D';
  }

  function computeTier(summary, grade){
    if (summary.tier) return String(summary.tier);
    if (grade==='S' || grade==='A') return '🔥 Elite';
    if (grade==='B') return '⚡ Skilled';
    if (grade==='C') return '✅ Ok';
    return '🧊 Warm-up';
  }

  function buildGoalsText(summary){
    const parts = [];
    // Generic keys across your games:
    // Plate: goalsCleared/goalsTotal, miniCleared/miniTotal, g1..g5
    // Hydration: greenHoldSec, stormOk/stormCycles, bossHit/bossNeed
    // Groups: miniCleared, bossCleared, accuracyGoodPct
    if (Number.isFinite(summary.greenHoldSec)) parts.push(`GREEN: ${Math.round(summary.greenHoldSec)}s`);
    if (summary.stormCycles != null) parts.push(`Storm: ${summary.stormOk ?? 0}/${summary.stormCycles ?? 0}`);
    if (summary.bossNeed != null) parts.push(`Boss: ${summary.bossHit ?? 0}/${summary.bossNeed ?? 0}`);
    if (summary.goalsTotal != null) parts.push(`Goals: ${summary.goalsCleared ?? 0}/${summary.goalsTotal ?? 0}`);
    if (summary.miniTotal != null) parts.push(`Mini: ${summary.miniCleared ?? 0}/${summary.miniTotal ?? 0}`);

    // Plate group counts if present
    if (summary.g1!=null || summary.g2!=null){
      parts.push(`Plate 5 หมู่: [1:${summary.g1??0}] [2:${summary.g2??0}] [3:${summary.g3??0}] [4:${summary.g4??0}] [5:${summary.g5??0}]`);
    }

    if (!parts.length) return '—';
    return parts.map(x=>'• '+x).join('\n');
  }

  function buildTips(summary, acc, miss, comboMax){
    const tips = [];
    const run = String(summary.runMode ?? summary.run ?? '').toLowerCase();

    if (acc < 70) tips.push('• เคล็ดลับ: หยุดครึ่งจังหวะก่อนยิง แล้วเล็งกลางเป้า จะเพิ่มความแม่นได้เร็ว');
    if (miss >= 6) tips.push('• ลดพลาด: อย่ายิงรัวตอนเป้าแน่น เลือกยิงเป้าที่โล่งก่อน');
    if (comboMax < 6) tips.push('• ทำคอมโบ: โฟกัสเป้าที่ใกล้ศูนย์กลาง/ใกล้ crosshair จะติดคอมโบง่ายขึ้น');
    if (!tips.length) tips.push('• ฟอร์มดีมาก! ลองเพิ่มความยาก หรือโหมด research เพื่อเก็บข้อมูลแบบ deterministic');

    if (run === 'research' || run === 'study') tips.push('• Research: seed คงที่ ทำซ้ำได้ เหมาะเก็บข้อมูลเปรียบเทียบ');
    return tips.join('\n');
  }

  function storeSummary(summary){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify(summary));
      const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      const row = {
        ts: summary.ts || Date.now(),
        game: summary.game || summary.gameKey || summary.pack || '',
        score: computeScore(summary),
        grade: summary.grade || '',
        diff: summary.diff || '',
        run: summary.run || summary.runMode || '',
        seed: summary.seed || ''
      };
      hist.unshift(row);
      localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0,50)));
    }catch(_){}
  }

  function summaryToCSV(summary){
    const s = summary || {};
    const acc = computeAccuracy(s);
    const score = computeScore(s);
    const miss = computeMiss(s);
    const comboMax = computeComboMax(s);
    const grade = computeGrade(s, acc, score);

    const sessionRows = [
      ['ts', (s.ts ?? Date.now())],
      ['game', (s.game ?? s.gameKey ?? '')],
      ['run', (s.run ?? s.runMode ?? '')],
      ['diff', (s.diff ?? '')],
      ['timeSec', (s.timeSec ?? s.durationPlannedSec ?? s.timePlannedSec ?? '')],
      ['seed', (s.seed ?? '')],
      ['score', score],
      ['grade', grade],
      ['tier', (s.tier ?? '')],
      ['accuracyPct', acc],
      ['comboMax', comboMax],
      ['miss', miss],
      ['reason', (s.reason ?? '')]
    ];

    const lines = [];
    lines.push('session_key,session_value');
    for(const [k,v] of sessionRows){
      lines.push(`${k},${String(v).replace(/,/g,' ')}`);
    }

    // events (optional) if summary.logs exists
    const logs = Array.isArray(s.logs) ? s.logs : [];
    if (logs.length){
      lines.push('');
      lines.push('event_t,event_type,event_phase,event_kind,event_score,event_water,event_combo,event_source,event_msg');
      for(const ev of logs.slice(0, 4000)){
        const row = [
          ev.t ?? '',
          ev.type ?? '',
          ev.phase ?? '',
          ev.kind ?? '',
          ev.score ?? '',
          ev.water ?? '',
          ev.combo ?? '',
          ev.source ?? '',
          ev.msg ?? ''
        ].map(x=>String(x).replace(/\n/g,' ').replace(/,/g,' '));
        lines.push(row.join(','));
      }
    }
    return lines.join('\n');
  }

  function bindButtons(summary){
    const hub = String(qs('hub','../hub.html'));
    DOC.getElementById('hhaBtnRetry')?.addEventListener('click', ()=>location.reload());
    DOC.getElementById('hhaBtnClose')?.addEventListener('click', ()=>{
      const back = DOC.getElementById('hhaResultBackdrop');
      if(back) back.hidden = true;
    });
    DOC.getElementById('hhaBtnCopyJSON')?.addEventListener('click', ()=>safeCopy(JSON.stringify(summary,null,2)));
    DOC.getElementById('hhaBtnCSV')?.addEventListener('click', ()=>{
      const name = `${(summary.game||'hha')}-${(summary.diff||'')}-${(summary.run||summary.runMode||'')}-${(summary.ts||Date.now())}.csv`;
      safeDownload(name, summaryToCSV(summary), 'text/csv');
    });
    DOC.querySelectorAll('.btnBackHub')?.forEach(b=> b.addEventListener('click', ()=>{ location.href = hub; }));
  }

  function showSummary(summary){
    const back = ensureOverlay();
    if (!summary || typeof summary !== 'object') summary = { game:'unknown', ts:Date.now() };

    // normalize basics
    summary.ts = summary.ts || Date.now();

    const acc = computeAccuracy(summary);
    const score = computeScore(summary);
    const miss = computeMiss(summary);
    const comboMax = computeComboMax(summary);
    const grade = computeGrade(summary, acc, score);
    const tier = computeTier(summary, grade);

    // render
    safeText('hhaPGame', summary.game || summary.gameKey || 'HHA');
    safeText('hhaPRun',  String(summary.run || summary.runMode || 'play'));
    safeText('hhaPDiff', String(summary.diff || 'normal'));
    safeText('hhaPSeed', `seed=${summary.seed ?? ''}`);

    safeText('hhaScore', score);
    safeText('hhaAcc', `${acc}%`);
    safeText('hhaComboMax', comboMax);
    safeText('hhaMiss', miss);
    safeText('hhaGrade', grade);
    safeText('hhaTier', tier);

    safeText('hhaGoals', buildGoalsText(summary));
    safeText('hhaTips', buildTips(summary, acc, miss, comboMax));

    bindButtons(summary);

    back.hidden = false;
  }

  function hideOnBoot(){
    try{
      const back = DOC.getElementById('hhaResultBackdrop');
      if(back) back.hidden = true;
    }catch(_){}
  }

  // boot
  ensureStyle();
  hideOnBoot();

  // listen end
  WIN.addEventListener('hha:end', (e)=>{
    const s = e && e.detail ? e.detail : null;
    if (!s) return;
    try{ storeSummary(s); }catch(_){}
    showSummary(s);
  }, { passive:true });

  // expose
  WIN.HHA_Summary = { show: showSummary, csv: summaryToCSV };
})();