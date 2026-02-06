// === /herohealth/vr/hha-summary-ui.js ===
// HHA Universal End Summary UI — v1.0.0
// Listens: hha:end (required), optional hha:start
// Features:
// - Overlay summary (score/grade/accuracy/miss/combo/etc. auto-detect keys)
// - Buttons: Retry, Close, Copy JSON, Download CSV, Back to HUB
// - Stores: HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY (top 50)
// - Harden: overlay hidden on boot, [hidden]{display:none}
// Config:
//   window.HHA_SUMMARY_CONFIG = { hubDefault:'../hub.html', title:'HeroHealth — Summary' }

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__HHA_SUMMARY_UI_LOADED__) return;
  WIN.__HHA_SUMMARY_UI_LOADED__ = true;

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const CFG = Object.assign({
    hubDefault: '../hub.html',
    title: 'HeroHealth — Summary'
  }, WIN.HHA_SUMMARY_CONFIG || {});

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function safeCopy(text){
    try{ navigator.clipboard?.writeText(String(text)); }catch(_){}
  }
  function safeDownload(filename, text, mime='text/plain'){
    try{
      const blob = new Blob([text], { type:mime });
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

      .hhaSumBack{
        position:fixed; inset:0; z-index:99998;
        background: rgba(2,6,23,.66);
        backdrop-filter: blur(8px);
        display:flex; align-items:center; justify-content:center;
        padding: 16px;
      }

      .hhaSumCard{
        width: min(920px, 96vw);
        max-height: min(92vh, 900px);
        overflow:auto;
        border-radius: 22px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.86);
        box-shadow: 0 20px 80px rgba(0,0,0,.42);
        padding: 16px 16px 14px;
      }

      .hhaSumHead{
        display:flex; align-items:flex-start; justify-content:space-between;
        gap: 12px;
        margin-bottom: 10px;
      }

      .hhaSumTitle{
        font-weight: 1000;
        font-size: 16px;
        color: rgba(226,232,240,.98);
        letter-spacing: .2px;
      }

      .hhaSumSub{
        margin-top: 2px;
        font-weight: 950;
        font-size: 12px;
        color: rgba(148,163,184,.94);
      }

      .hhaSumPills{
        display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;
      }
      .hhaPill{
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.55);
        color: rgba(226,232,240,.95);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 950;
        white-space: nowrap;
      }
      .hhaPill b{ font-weight: 1000; }

      .hhaSumGrid{
        display:grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 10px;
        margin-top: 10px;
      }

      .hhaBox{
        grid-column: span 6;
        border-radius: 18px;
        border: 1px solid rgba(148,163,184,.16);
        background: rgba(15,23,42,.42);
        padding: 12px 12px 10px;
      }
      .hhaBox.big{ grid-column: span 12; }

      .hhaBoxTitle{
        font-weight: 1000;
        font-size: 12px;
        color: rgba(148,163,184,.92);
        margin-bottom: 8px;
      }
      .hhaBoxValue{
        font-weight: 1000;
        font-size: 30px;
        color: rgba(226,232,240,.98);
        line-height: 1.1;
      }
      .hhaBoxValue small{
        font-weight: 950;
        font-size: 12px;
        color: rgba(148,163,184,.94);
      }

      .hhaSumTips{
        white-space: pre-line;
        color: rgba(226,232,240,.92);
        font-weight: 800;
        font-size: 13px;
        line-height: 1.45;
      }

      .hhaSumBtns{
        margin-top: 12px;
        display:flex;
        flex-wrap:wrap;
        gap: 10px;
        justify-content: space-between;
        align-items:center;
      }

      .hhaBtnRow{
        display:flex; flex-wrap:wrap; gap:10px;
      }

      .hhaBtn{
        pointer-events:auto;
        border-radius: 14px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(30,41,59,.72);
        color: rgba(226,232,240,.96);
        font-weight: 950;
        padding: 10px 12px;
        font-size: 13px;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(0,0,0,.22);
      }
      .hhaBtn.primary{
        background: rgba(34,197,94,.22);
        border-color: rgba(34,197,94,.28);
      }
      .hhaBtn.danger{
        background: rgba(239,68,68,.16);
        border-color: rgba(239,68,68,.22);
      }

      @media (max-width: 640px){
        .hhaBox{ grid-column: span 12; }
        .hhaSumCard{ padding: 14px 12px 12px; }
        .hhaBoxValue{ font-size: 28px; }
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureDom(){
    ensureStyle();
    let back = DOC.getElementById('hhaSummaryBackdrop');
    if(!back){
      back = DOC.createElement('div');
      back.id = 'hhaSummaryBackdrop';
      back.className = 'hhaSumBack';
      back.hidden = true;
      back.innerHTML = `
        <div class="hhaSumCard" role="dialog" aria-modal="true" aria-label="${CFG.title}">
          <div class="hhaSumHead">
            <div>
              <div class="hhaSumTitle" id="hhaSumTitle">${CFG.title}</div>
              <div class="hhaSumSub" id="hhaSumSub">—</div>
            </div>
            <div class="hhaSumPills" id="hhaSumPills"></div>
          </div>

          <div class="hhaSumGrid">
            <div class="hhaBox">
              <div class="hhaBoxTitle">SCORE</div>
              <div class="hhaBoxValue" id="hhaSumScore">—</div>
            </div>
            <div class="hhaBox">
              <div class="hhaBoxTitle">GRADE</div>
              <div class="hhaBoxValue" id="hhaSumGrade">—</div>
            </div>

            <div class="hhaBox">
              <div class="hhaBoxTitle">ACCURACY</div>
              <div class="hhaBoxValue" id="hhaSumAcc">—</div>
            </div>
            <div class="hhaBox">
              <div class="hhaBoxTitle">MISS</div>
              <div class="hhaBoxValue" id="hhaSumMiss">—</div>
            </div>

            <div class="hhaBox">
              <div class="hhaBoxTitle">MAX COMBO</div>
              <div class="hhaBoxValue" id="hhaSumCombo">—</div>
            </div>
            <div class="hhaBox">
              <div class="hhaBoxTitle">MODE</div>
              <div class="hhaBoxValue" id="hhaSumMode">—</div>
            </div>

            <div class="hhaBox big">
              <div class="hhaBoxTitle">TIPS</div>
              <div class="hhaSumTips" id="hhaSumTips">—</div>
            </div>
          </div>

          <div class="hhaSumBtns">
            <div class="hhaBtnRow">
              <button class="hhaBtn primary" id="hhaBtnRetry">เล่นอีกครั้ง</button>
              <button class="hhaBtn" id="hhaBtnClose">ปิด</button>
            </div>
            <div class="hhaBtnRow">
              <button class="hhaBtn" id="hhaBtnCopy">Copy JSON</button>
              <button class="hhaBtn" id="hhaBtnCSV">Download CSV</button>
              <button class="hhaBtn danger" id="hhaBtnHub">กลับ HUB</button>
            </div>
          </div>
        </div>
      `;
      DOC.body.appendChild(back);
    }
    return back;
  }

  function getAny(summary, keys, def=null){
    for(const k of keys){
      if(summary && summary[k] !== undefined && summary[k] !== null) return summary[k];
    }
    return def;
  }

  function computeAccuracy(summary){
    // Try explicit accuracy first
    let acc = getAny(summary, ['accuracyPct','accuracyGoodPct','accuracy','accPct'], null);
    if (acc !== null){
      // if 0..1 convert to %
      const n = Number(acc);
      if (!Number.isFinite(n)) return null;
      if (n <= 1.001) return Math.round(n * 100);
      return Math.round(n);
    }

    // infer from hits/shots
    const shots = Number(getAny(summary, ['shots','totalShots','shotsTotal'], NaN));
    const good  = Number(getAny(summary, ['goodShots','hitGood','hitsGood'], NaN));
    if (Number.isFinite(shots) && shots > 0 && Number.isFinite(good)){
      return Math.round((good/shots)*100);
    }

    // infer from good/junk/expire
    const hitGood = Number(getAny(summary, ['hitGood'], NaN));
    const hitJunk = Number(getAny(summary, ['hitJunk'], NaN));
    const expGood = Number(getAny(summary, ['expireGood'], NaN));
    if (Number.isFinite(hitGood)){
      const denom = Math.max(1,
        (Number.isFinite(hitGood)?hitGood:0) +
        (Number.isFinite(hitJunk)?hitJunk:0) +
        (Number.isFinite(expGood)?expGood:0)
      );
      return Math.round((hitGood/denom)*100);
    }

    return null;
  }

  function buildTips(summary){
    const tips = [];

    const acc = computeAccuracy(summary);
    const miss = Number(getAny(summary, ['miss','misses'], 0))||0;
    const combo = Number(getAny(summary, ['comboMax','maxCombo'], 0))||0;

    if (acc !== null && acc < 70) tips.push('• เล็งนิ่ง ๆ ก่อนยิง 1 จังหวะ แล้วค่อยแตะ จะเพิ่มความแม่นได้มาก');
    if (miss >= 6) tips.push('• MISS เยอะ: ลดการยิงรัวตอนเป้าแน่น แล้วเลือกเป้าที่ใกล้ศูนย์กลางก่อน');
    if (combo < 6) tips.push('• ทำคอมโบ: โฟกัส “เป้าถูกชนิด/ถูกหมู่” ต่อเนื่อง 3–5 ครั้ง จะเริ่มติดมือ');

    // game-specific hints
    const game = String(getAny(summary, ['game'], '')||'').toLowerCase();
    if (game.includes('hydration')) tips.push('• Hydration: พอหลุด GREEN ให้รีบยิง GOOD 1–2 ครั้งเพื่อดึงกลับ');
    if (game.includes('plate')) tips.push('• Plate: ช่วงต้นให้เก็บ “หมู่ที่ยังไม่มี” ก่อน จะผ่าน Goal ไว');
    if (game.includes('groups')) tips.push('• Groups: อ่าน “ชื่อหมู่” บน HUD ก่อนยิง จะกัน hit_bad ได้ดีที่สุด');
    if (game.includes('goodjunk')) tips.push('• GoodJunk: ช่วงบอสอย่าเสี่ยงยิง JUNK — เน้น GOOD ให้ต่อเนื่อง');

    if (!tips.length) tips.push('• ฟอร์มดีมาก! ลองเพิ่มความยาก หรือเล่นโหมด research เพื่อเก็บข้อมูลแบบ deterministic');

    return tips.join('\n');
  }

  function save(summary){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify(summary));
      const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      hist.unshift({
        ts: summary.ts || Date.now(),
        game: summary.game || summary.gameKey || '',
        score: summary.score || summary.scoreFinal || 0,
        grade: summary.grade || '',
        diff: summary.diff || '',
        run: summary.run || summary.runMode || ''
      });
      localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0,50)));
    }catch(_){}
  }

  function summaryToCSV(summary){
    const flat = [];

    // header-ish fields
    const pairs = [
      ['ts', summary.ts || Date.now()],
      ['game', summary.game || summary.gameKey || ''],
      ['reason', summary.reason || 'end'],
      ['run', summary.run || summary.runMode || ''],
      ['diff', summary.diff || ''],
      ['view', summary.view || ''],
      ['seed', summary.seed || ''],
      ['score', summary.score || summary.scoreFinal || 0],
      ['grade', summary.grade || ''],
      ['accuracyPct', computeAccuracy(summary)],
      ['miss', summary.miss ?? summary.misses ?? 0],
      ['comboMax', summary.comboMax ?? summary.maxCombo ?? 0],
    ];
    for(const [k,v] of pairs) flat.push([k, (v===null||v===undefined)?'':String(v).replace(/,/g,' ')]);

    const lines = [];
    lines.push('key,value');
    for(const [k,v] of flat) lines.push(`${k},${v}`);

    // include logs/events if present
    const logs = summary.logs || summary.events || null;
    if (Array.isArray(logs) && logs.length){
      lines.push('');
      lines.push('event_t,event_type,event_phase,event_kind,event_score,event_extra');
      for(const ev of logs.slice(0, 5000)){
        const row = [
          ev.t ?? ev.ts ?? '',
          ev.type ?? '',
          ev.phase ?? '',
          ev.kind ?? '',
          ev.score ?? '',
          JSON.stringify(ev).replace(/\n/g,' ').replace(/,/g,' ')
        ];
        lines.push(row.join(','));
      }
    }

    return lines.join('\n');
  }

  function show(summary){
    const back = ensureDom();

    // normalize + enrich
    const s = Object.assign({}, summary || {});
    if (!s.ts) s.ts = Date.now();

    // store
    save(s);

    // detect fields
    const game = String(getAny(s, ['game','gameKey'], 'HHA Game'));
    const run  = String(getAny(s, ['run','runMode'], 'play'));
    const diff = String(getAny(s, ['diff'], 'normal'));
    const view = String(getAny(s, ['view'], ''));
    const seed = String(getAny(s, ['seed'], ''));

    const score = Number(getAny(s, ['score','scoreFinal'], 0))||0;
    const grade = String(getAny(s, ['grade'], getAny(s, ['rank'], '—')));
    const miss  = Number(getAny(s, ['miss','misses'], 0))||0;
    const combo = Number(getAny(s, ['comboMax','maxCombo'], 0))||0;
    const acc   = computeAccuracy(s);

    // fill DOM
    DOC.getElementById('hhaSumTitle').textContent = `${game} — สรุปผล`;
    DOC.getElementById('hhaSumSub').textContent =
      `run=${run} | diff=${diff}` + (view?` | view=${view}`:'') + (seed?` | seed=${seed}`:'');

    const pills = [];
    if (s.bossCleared !== undefined) pills.push(`Boss <b>${s.bossCleared? 'CLEAR':'—'}</b>`);
    if (s.miniCleared !== undefined) pills.push(`Mini <b>${s.miniCleared? 'OK':'—'}</b>`);
    if (s.goalsCleared !== undefined) pills.push(`Goals <b>${s.goalsCleared}/${s.goalsTotal||1}</b>`);
    if (s.stormCycles !== undefined) pills.push(`Storm <b>${s.stormOk||0}/${s.stormCycles||0}</b>`);
    if (s.greenHoldSec !== undefined) pills.push(`GREEN <b>${Math.round(Number(s.greenHoldSec)||0)}s</b>`);

    const pillEl = DOC.getElementById('hhaSumPills');
    pillEl.innerHTML = pills.map(x=>`<span class="hhaPill">${x}</span>`).join('');

    DOC.getElementById('hhaSumScore').textContent = String(score);
    DOC.getElementById('hhaSumGrade').textContent = String(grade);
    DOC.getElementById('hhaSumAcc').textContent = (acc===null) ? '—' : `${acc}%`;
    DOC.getElementById('hhaSumMiss').textContent = String(miss);
    DOC.getElementById('hhaSumCombo').textContent = String(combo);
    DOC.getElementById('hhaSumMode').textContent = `${run} / ${diff}`;

    DOC.getElementById('hhaSumTips').textContent = buildTips(s);

    // buttons
    const hub = String(qs('hub', CFG.hubDefault) || CFG.hubDefault);

    DOC.getElementById('hhaBtnRetry').onclick = ()=>location.reload();
    DOC.getElementById('hhaBtnClose').onclick = ()=>{ back.hidden = true; };
    DOC.getElementById('hhaBtnHub').onclick = ()=>{ location.href = hub; };

    DOC.getElementById('hhaBtnCopy').onclick = ()=>safeCopy(JSON.stringify(s, null, 2));
    DOC.getElementById('hhaBtnCSV').onclick = ()=>{
      const fn = `${String(game).toLowerCase().replace(/\s+/g,'-')}-${diff}-${run}-${s.ts}.csv`;
      safeDownload(fn, summaryToCSV(s), 'text/csv');
    };

    back.hidden = false;
  }

  // Harden: never show at boot
  try{
    const back = ensureDom();
    back.hidden = true;
  }catch(_){}

  // Listen to end
  WIN.addEventListener('hha:end', (ev)=>{
    try{
      const s = (ev && ev.detail) ? ev.detail : {};
      show(s);
    }catch(_){}
  }, { passive:true });

  // public helper
  WIN.HHA_SummaryUI = { show };
})();