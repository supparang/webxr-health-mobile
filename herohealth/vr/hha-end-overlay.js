// === /herohealth/vr/hha-end-overlay.js ===
// HHA Universal End Summary Overlay — v1.0.0
// Listens: window 'hha:end' (detail summary object)
// Saves:
//   localStorage.HHA_LAST_SUMMARY
//   localStorage.HHA_SUMMARY_HISTORY (max 50)
// Provides buttons: Retry / Back HUB / Copy JSON / Download CSV
// NOTE: Safe to include multiple times (guarded)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if (WIN.__HHA_END_OVERLAY_LOADED__) return;
  WIN.__HHA_END_OVERLAY_LOADED__ = true;

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function pickHubUrl(){
    const h = qs('hub','') || '';
    if(h) return h;
    try{
      const u = new URL(location.href);
      u.pathname = u.pathname.replace(/\/[^\/]*$/, '/hub.html');
      u.search = '';
      u.hash = '';
      return u.href;
    }catch(_){
      return '../hub.html';
    }
  }

  function readJSON(key, fallback){
    try{
      const s = localStorage.getItem(key);
      if(!s) return fallback;
      return JSON.parse(s);
    }catch(_){
      return fallback;
    }
  }

  function writeJSON(key, obj){
    try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(_){}
  }

  function safeNum(v, d=0){
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  }

  function safeStr(v, d=''){
    if(v===null || v===undefined) return d;
    return String(v);
  }

  function fmtTs(ts){
    const t = safeNum(ts, 0);
    if(!t) return '—';
    try{
      return new Date(t).toLocaleString('th-TH', { hour12:false });
    }catch(_){
      return String(t);
    }
  }

  function gameLabel(game){
    const g = safeStr(game,'').toLowerCase();
    if(g.includes('goodjunk')) return 'GoodJunk';
    if(g.includes('groups')) return 'Food Groups';
    if(g.includes('plate')) return 'Balanced Plate';
    if(g.includes('hydration')) return 'Hydration';
    if(g.includes('hygiene')) return 'Hygiene';
    return game ? safeStr(game) : 'Game';
  }

  function deriveAccuracy(summary){
    // common keys
    if(summary.accuracyPct != null) return safeNum(summary.accuracyPct, 0);
    if(summary.accuracyGoodPct != null) return safeNum(summary.accuracyGoodPct, 0);

    // try from shots/goodShots
    const shots = safeNum(summary.shots, 0);
    const good  = safeNum(summary.goodShots, 0);
    if(shots>0) return Math.round((good/shots)*100);

    // GoodJunk alt denom
    const hitGood = safeNum(summary.hitGood, 0);
    const hitJunk = safeNum(summary.hitJunk, 0);
    const expGood = safeNum(summary.expireGood, 0);
    const miss    = safeNum(summary.miss, safeNum(summary.misses,0));
    const denom = hitGood + hitJunk + expGood + miss;
    if(denom>0) return Math.round((hitGood/denom)*100);

    return null;
  }

  function deriveScore(summary){
    return safeNum(summary.scoreFinal ?? summary.score ?? 0, 0);
  }

  function deriveMiss(summary){
    return safeNum(summary.miss ?? summary.misses ?? 0, 0);
  }

  function deriveComboMax(summary){
    return safeNum(summary.comboMax ?? summary.maxCombo ?? 0, 0);
  }

  function deriveGrade(summary){
    return safeStr(summary.grade ?? summary.rank ?? '—');
  }

  function normalizeSummary(detail){
    const s = (detail && typeof detail === 'object') ? detail : {};
    const ts = safeNum(s.ts ?? Date.now(), Date.now());

    const game = gameLabel(s.game || s.gameKey || s.title);
    const run  = safeStr(s.runMode ?? s.run ?? qs('run','play') ?? 'play');
    const diff = safeStr(s.diff ?? qs('diff','normal') ?? 'normal');
    const seed = safeStr(s.seed ?? qs('seed','') ?? '');

    const timePlanned =
      safeNum(s.timePlannedSec ?? s.durationPlannedSec ?? s.durationPlanned ?? s.timePlanSec ?? qs('time',0), 0);

    const timePlayed =
      safeNum(s.timePlayedSec ?? s.durationPlayedSec ?? s.durationPlayed ?? (timePlanned? timePlanned : 0), 0);

    const score = deriveScore(s);
    const miss  = deriveMiss(s);
    const comboMax = deriveComboMax(s);
    const accPct = deriveAccuracy(s);

    const grade = deriveGrade(s);
    const tier  = safeStr(s.tier ?? '');

    // keep raw too
    return {
      ...s,
      ts,
      _hha: {
        game, run, diff, seed,
        timePlanned, timePlayed,
        score, miss, comboMax,
        accPct, grade, tier
      }
    };
  }

  function pushHistory(norm){
    try{
      const hist = readJSON(LS_HIST, []);
      const h = Array.isArray(hist) ? hist : [];
      const x = norm._hha || {};
      h.unshift({
        ts: norm.ts,
        game: x.game,
        run: x.run,
        diff: x.diff,
        score: x.score,
        grade: x.grade
      });
      writeJSON(LS_HIST, h.slice(0, 50));
    }catch(_){}
  }

  function ensureStyle(){
    if(DOC.getElementById('hha-end-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-end-style';
    st.textContent = `
      .hhaEndBack{
        position:fixed; inset:0; z-index:99998;
        display:flex; align-items:flex-end; justify-content:center;
        padding: max(12px, env(safe-area-inset-top)) 12px max(14px, env(safe-area-inset-bottom));
        background: rgba(2,6,23,.78);
        backdrop-filter: blur(10px);
      }
      .hhaEndBack[hidden]{ display:none !important; }
      .hhaEndCard{
        width:min(560px, 96vw);
        border-radius:18px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.92);
        box-shadow: 0 24px 70px rgba(0,0,0,.35);
        overflow:hidden;
      }
      .hhaEndHead{
        display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
        padding:14px 14px 10px;
        border-bottom:1px solid rgba(148,163,184,.14);
      }
      .hhaEndTitle{ font-weight:900; font-size:16px; color:#e5e7eb; }
      .hhaEndSub{ margin-top:4px; font-size:12px; color:rgba(148,163,184,.95); }
      .hhaEndChip{
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        padding:8px 10px; border-radius:14px;
        background: rgba(34,197,94,.14);
        border:1px solid rgba(34,197,94,.22);
        min-width:62px;
        color:#e5e7eb;
      }
      .hhaEndChip b{ font-size:16px; }
      .hhaEndChip small{ margin-top:2px; font-size:11px; color:rgba(148,163,184,.95); }
      .hhaEndBody{ padding:12px 14px 14px; }
      .hhaEndGrid{
        display:grid; grid-template-columns:1fr 1fr; gap:10px;
      }
      .hhaEndRow{
        display:flex; align-items:center; justify-content:space-between; gap:10px;
        padding:9px 10px; border-radius:12px;
        background: rgba(15,23,42,.55);
        border:1px solid rgba(148,163,184,.14);
      }
      .hhaEndK{ font-size:12px; color:rgba(148,163,184,.95); }
      .hhaEndV{ font-size:13px; color:#e5e7eb; }
      .hhaEndV b{ font-size:14px; }
      .hhaEndCode{
        padding:2px 6px; border-radius:8px;
        background: rgba(148,163,184,.12);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size:12px;
        max-width: 200px;
        overflow:hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display:inline-block;
        vertical-align:bottom;
      }
      .hhaEndTips{
        margin-top:10px;
        padding:10px 10px;
        border-radius:12px;
        border:1px dashed rgba(148,163,184,.18);
        background: rgba(148,163,184,.08);
        color:#e5e7eb;
        font-size:12px;
        line-height:1.35;
        white-space:pre-line;
      }
      .hhaEndActions{
        display:flex; gap:10px; flex-wrap:wrap;
        padding:12px 14px 14px;
        border-top:1px solid rgba(148,163,184,.14);
        background: rgba(2,6,23,.86);
      }
      .hhaBtn{
        appearance:none; border:none;
        display:inline-flex; align-items:center; justify-content:center;
        padding:10px 12px; border-radius:12px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(34,197,94,.16);
        color:#e5e7eb; font-weight:900;
        cursor:pointer;
        text-decoration:none;
      }
      .hhaBtnGhost{
        background: rgba(148,163,184,.10);
      }
      .hhaBtn:active{ transform: translateY(1px); }
    `;
    DOC.head.appendChild(st);
  }

  function ensureOverlay(){
    ensureStyle();
    let back = DOC.getElementById('hhaEndBack');
    if(back) return back;

    back = DOC.createElement('div');
    back.id = 'hhaEndBack';
    back.className = 'hhaEndBack';
    back.hidden = true;

    back.innerHTML = `
      <div class="hhaEndCard" role="dialog" aria-modal="true" aria-label="สรุปผลการเล่น">
        <div class="hhaEndHead">
          <div>
            <div class="hhaEndTitle" id="hhaEndGame">Game</div>
            <div class="hhaEndSub" id="hhaEndTime">—</div>
          </div>
          <div class="hhaEndChip">
            <b id="hhaEndGrade">—</b>
            <small id="hhaEndTier"></small>
          </div>
        </div>

        <div class="hhaEndBody">
          <div class="hhaEndGrid">
            <div class="hhaEndRow"><div class="hhaEndK">Score</div><div class="hhaEndV"><b id="hhaEndScore">0</b></div></div>
            <div class="hhaEndRow"><div class="hhaEndK">Accuracy</div><div class="hhaEndV"><b id="hhaEndAcc">—</b></div></div>
            <div class="hhaEndRow"><div class="hhaEndK">Miss</div><div class="hhaEndV"><b id="hhaEndMiss">0</b></div></div>
            <div class="hhaEndRow"><div class="hhaEndK">ComboMax</div><div class="hhaEndV"><b id="hhaEndCombo">0</b></div></div>
            <div class="hhaEndRow"><div class="hhaEndK">Time</div><div class="hhaEndV"><b id="hhaEndDur">—</b></div></div>
            <div class="hhaEndRow"><div class="hhaEndK">Mode</div><div class="hhaEndV"><span id="hhaEndMode"></span></div></div>
            <div class="hhaEndRow" style="grid-column:1/3;"><div class="hhaEndK">Seed</div><div class="hhaEndV"><span class="hhaEndCode" id="hhaEndSeed">—</span></div></div>
          </div>

          <div class="hhaEndTips" id="hhaEndTips"></div>
        </div>

        <div class="hhaEndActions">
          <button class="hhaBtn" id="hhaEndRetry">Retry</button>
          <a class="hhaBtn" id="hhaEndHub" href="#">Back HUB</a>
          <button class="hhaBtn hhaBtnGhost" id="hhaEndCopy">Copy JSON</button>
          <button class="hhaBtn hhaBtnGhost" id="hhaEndCSV">Download CSV</button>
          <button class="hhaBtn hhaBtnGhost" id="hhaEndClose">Close</button>
        </div>
      </div>
    `;

    DOC.body.appendChild(back);
    return back;
  }

  function makeTips(x){
    const tips = [];
    const acc = x.accPct;
    const miss = x.miss;
    const combo = x.comboMax;

    if(acc != null && acc < 70) tips.push('• ลอง “เล็งนิ่ง” แล้วค่อยยิง อย่ารัวยาว');
    if(miss >= 6) tips.push('• ลด MISS: หยุดครึ่งจังหวะก่อนยิงเป้าถัดไป');
    if(combo < 6) tips.push('• ทำคอมโบ: ยิงเป้าที่ใกล้กึ่งกลางจอ จะติดง่ายขึ้น (มือถือ/cVR)');
    if(!tips.length) tips.push('• ฟอร์มดีมาก! ลองเพิ่มความยาก หรือเข้าโหมด research เพื่อเก็บข้อมูล');
    return tips.join('\n');
  }

  function toCSV(norm){
    const x = norm._hha || {};
    const lines = [];
    lines.push('key,value');
    lines.push(`ts,${norm.ts}`);
    lines.push(`game,${safeStr(x.game).replace(/,/g,' ')}`);
    lines.push(`run,${safeStr(x.run).replace(/,/g,' ')}`);
    lines.push(`diff,${safeStr(x.diff).replace(/,/g,' ')}`);
    lines.push(`seed,${safeStr(x.seed).replace(/,/g,' ')}`);
    lines.push(`score,${safeNum(x.score,0)}`);
    lines.push(`grade,${safeStr(x.grade).replace(/,/g,' ')}`);
    lines.push(`tier,${safeStr(x.tier).replace(/,/g,' ')}`);
    lines.push(`accuracyPct,${x.accPct==null?'':safeNum(x.accPct,0)}`);
    lines.push(`miss,${safeNum(x.miss,0)}`);
    lines.push(`comboMax,${safeNum(x.comboMax,0)}`);
    lines.push(`timePlannedSec,${safeNum(x.timePlanned,0)}`);
    lines.push(`timePlayedSec,${safeNum(x.timePlayed,0)}`);
    return lines.join('\n');
  }

  function download(filename, text, mime='text/plain'){
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

  function copyText(text){
    try{
      navigator.clipboard.writeText(String(text));
      return true;
    }catch(_){
      return false;
    }
  }

  function renderOverlay(norm){
    const back = ensureOverlay();
    const x = norm._hha || {};
    const hubUrl = pickHubUrl();

    const el = (id)=>DOC.getElementById(id);

    el('hhaEndGame').textContent = safeStr(x.game,'Game');
    el('hhaEndTime').textContent = `จบเมื่อ: ${fmtTs(norm.ts)}`;

    el('hhaEndScore').textContent = String(safeNum(x.score,0));
    el('hhaEndMiss').textContent  = String(safeNum(x.miss,0));
    el('hhaEndCombo').textContent = String(safeNum(x.comboMax,0));
    el('hhaEndAcc').textContent   = (x.accPct==null) ? '—' : `${clamp(x.accPct,0,100)}%`;

    el('hhaEndGrade').textContent = safeStr(x.grade,'—');
    el('hhaEndTier').textContent  = safeStr(x.tier,'');

    el('hhaEndDur').textContent = x.timePlanned ? `${safeNum(x.timePlayed,0)}/${safeNum(x.timePlanned,0)}s` : '—';

    el('hhaEndMode').innerHTML =
      `<span style="display:inline-flex;gap:8px;flex-wrap:wrap;">
        <span style="padding:3px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(148,163,184,.10);font-size:11px;font-weight:900;">${safeStr(x.run)}</span>
        <span style="padding:3px 8px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(148,163,184,.10);font-size:11px;font-weight:900;">${safeStr(x.diff)}</span>
      </span>`;

    el('hhaEndSeed').textContent = safeStr(x.seed,'—');

    el('hhaEndTips').textContent = makeTips(x);

    const hubA = el('hhaEndHub');
    hubA.href = hubUrl;

    el('hhaEndRetry').onclick = ()=>location.reload();
    el('hhaEndClose').onclick = ()=>{ back.hidden = true; };

    el('hhaEndCopy').onclick = ()=>{
      const json = JSON.stringify(norm, null, 2);
      if(copyText(json)) alert('คัดลอก JSON แล้ว');
      else prompt('คัดลอก JSON:', json);
    };

    el('hhaEndCSV').onclick = ()=>{
      const fn = `hha-${safeStr(x.game,'game').toLowerCase().replace(/\s+/g,'_')}-${safeStr(x.diff,'')}-${safeStr(x.run,'')}-${norm.ts}.csv`;
      download(fn, toCSV(norm), 'text/csv');
    };

    back.hidden = false;
  }

  // Main handler
  function onEnd(ev){
    const detail = ev && ev.detail;
    const norm = normalizeSummary(detail);

    // Save last + push history (if game already saved, no harm overwrite same)
    writeJSON(LS_LAST, norm);
    pushHistory(norm);

    // Show overlay
    renderOverlay(norm);
  }

  WIN.addEventListener('hha:end', onEnd, { passive:true });

  // Expose
  WIN.HHA_EndOverlay = {
    show: (summary)=>onEnd({ detail: summary }),
    hide: ()=>{ const b = DOC.getElementById('hhaEndBack'); if(b) b.hidden = true; }
  };
})();