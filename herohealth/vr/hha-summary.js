// === /herohealth/vr/hha-summary.js ===
// HHA Summary Pack — v1.0.0
// ✅ store: HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ show/hide overlay
// ✅ bind buttons: Retry / Close / BackHub / CopyJSON / DownloadCSV
// ✅ CSV builder (generic)
// ✅ hardened: [hidden] style lock (optional)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function safeText(id, txt){
    const el = DOC.getElementById(id);
    if(el) el.textContent = String(txt);
  }

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

  function saveSummary(summary){
    try{
      localStorage.setItem(LS_LAST, JSON.stringify(summary));
      const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
      hist.unshift({
        ts: summary.ts || Date.now(),
        game: summary.game || '',
        score: summary.scoreFinal ?? summary.score ?? 0,
        grade: summary.grade || '',
        diff: summary.diff || summary.runMode || '',
        run: summary.run || summary.runMode || ''
      });
      localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 50)));
    }catch(_){}
  }

  // Generic CSV: session rows + events array
  function summaryToCSV(summary){
    const s = summary || {};
    const lines = [];

    lines.push('session_key,session_value');
    const sessionPairs = [
      ['ts', s.ts ?? ''],
      ['game', s.game ?? ''],
      ['run', s.run ?? s.runMode ?? ''],
      ['diff', s.diff ?? ''],
      ['timePlannedSec', s.durationPlannedSec ?? s.timeSec ?? s.timePlannedSec ?? ''],
      ['seed', s.seed ?? ''],
      ['scoreFinal', s.scoreFinal ?? s.score ?? ''],
      ['grade', s.grade ?? ''],
      ['miss', s.miss ?? s.misses ?? ''],
      ['comboMax', s.comboMax ?? s.maxCombo ?? ''],
      ['accuracyGoodPct', s.accuracyGoodPct ?? s.accuracyPct ?? ''],
      ['bossCleared', s.bossCleared ?? s.bossCleared === false ? false : ''],
      ['miniCleared', s.miniCleared ?? s.miniCleared === false ? false : ''],
    ];

    for(const [k,v] of sessionPairs){
      lines.push(`${k},${String(v).replace(/,/g,' ')}`);
    }

    const evs = Array.isArray(s.logs) ? s.logs : (Array.isArray(s.events) ? s.events : null);
    if(evs){
      lines.push('');
      lines.push('event_t,event_type,event_kind,event_phase,event_score,event_msg');
      for(const e of evs){
        const row = [
          e.t ?? e.ts ?? '',
          e.type ?? e.kind ?? '',
          e.kind ?? e.event ?? '',
          e.phase ?? '',
          e.score ?? '',
          e.msg ?? e.text ?? ''
        ].map(x=>String(x).replace(/\n/g,' ').replace(/,/g,' '));
        lines.push(row.join(','));
      }
    }
    return lines.join('\n');
  }

  function hideOverlay(backdropId){
    const back = DOC.getElementById(backdropId || 'resultBackdrop');
    if(back) back.hidden = true;
  }
  function showOverlay(backdropId){
    const back = DOC.getElementById(backdropId || 'resultBackdrop');
    if(back) back.hidden = false;
  }

  function bindButtons(opts){
    const o = opts || {};
    const hub = String(qs('hub', o.hubFallback || '../hub.html'));

    // retry
    const retryId = o.btnRetryId || 'btnRetry';
    DOC.getElementById(retryId)?.addEventListener('click', ()=>location.reload());

    // close
    const closeId = o.btnCloseId || 'btnCloseSummary';
    DOC.getElementById(closeId)?.addEventListener('click', ()=>hideOverlay(o.backdropId));

    // back hub
    const backSel = o.btnBackSel || '.btnBackHub';
    DOC.querySelectorAll(backSel)?.forEach(b=>{
      b.addEventListener('click', ()=>{
        location.href = hub;
      });
    });

    // copy json
    const copyId = o.btnCopyId || 'btnCopyJSON';
    DOC.getElementById(copyId)?.addEventListener('click', ()=>{
      if(o.lastSummary) safeCopy(JSON.stringify(o.lastSummary, null, 2));
    });

    // download csv
    const csvId = o.btnCSVId || 'btnDownloadCSV';
    DOC.getElementById(csvId)?.addEventListener('click', ()=>{
      if(!o.lastSummary) return;
      const s = o.lastSummary;
      const name = `${String(s.game||'hha')}-${String(s.diff||'')}-${String(s.run||s.runMode||'')}-${String(s.ts||Date.now())}.csv`;
      safeDownload(name, summaryToCSV(s), 'text/csv');
    });
  }

  // Harden: lock [hidden]
  function ensureHiddenLockStyle(){
    try{
      if(DOC.getElementById('hha-summary-style')) return;
      const st = DOC.createElement('style');
      st.id = 'hha-summary-style';
      st.textContent = `[hidden]{ display:none !important; }`;
      DOC.head.appendChild(st);
    }catch(_){}
  }

  // Public API
  WIN.HHA_Summary = {
    LS_LAST, LS_HIST,
    ensureHiddenLockStyle,
    saveSummary,
    summaryToCSV,
    hideOverlay,
    showOverlay,

    /**
     * render(summary, map)
     * map = { scoreId, gradeId, accId, comboId, missId, goalsId, minisId, tierId, tipsId, nextId }
     */
    render: function(summary, map){
      const s = summary || {};
      const m = map || {};

      // store
      saveSummary(s);

      // render common
      if(m.scoreId) safeText(m.scoreId, s.scoreFinal ?? s.score ?? 0);
      if(m.gradeId) safeText(m.gradeId, s.grade ?? '—');
      if(m.accId)   safeText(m.accId, (s.accuracyGoodPct!=null) ? `${s.accuracyGoodPct}%` : ((s.accuracyPct!=null)?`${s.accuracyPct}%`:'—'));
      if(m.comboId) safeText(m.comboId, s.comboMax ?? s.maxCombo ?? 0);
      if(m.missId)  safeText(m.missId, s.miss ?? s.misses ?? 0);

      if(m.goalsId && (s.goalsCleared!=null || s.goalText)) safeText(m.goalsId, s.goalText ?? `${s.goalsCleared}/${s.goalsTotal}`);
      if(m.minisId && (s.miniCleared!=null || s.miniText)) safeText(m.minisId, s.miniText ?? `${s.miniCleared}/${s.miniTotal}`);
      if(m.tierId && s.tier) safeText(m.tierId, s.tier);

      if(m.tipsId && Array.isArray(s.tips)) safeText(m.tipsId, s.tips.join('\n'));
      if(m.nextId){
        safeText(m.nextId, `Next: diff=${s.diff||''} | run=${s.run||s.runMode||''} | seed=${s.seed||''}`);
      }

      // show
      showOverlay(m.backdropId || 'resultBackdrop');

      // bind
      bindButtons({
        backdropId: m.backdropId || 'resultBackdrop',
        hubFallback: m.hubFallback || '../hub.html',
        btnRetryId: m.btnRetryId || 'btnRetry',
        btnCloseId: m.btnCloseId || 'btnCloseSummary',
        btnBackSel: m.btnBackSel || '.btnBackHub',
        btnCopyId: m.btnCopyId || 'btnCopyJSON',
        btnCSVId: m.btnCSVId || 'btnDownloadCSV',
        lastSummary: s
      });
    }
  };

})();