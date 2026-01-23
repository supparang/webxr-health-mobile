// === /herohealth/hygiene-vr/hygiene.teacher-export.js ===
// Export last 200 summaries (HHA_SUMMARY_HISTORY) filtered to hygiene -> CSV
// Exposes: window.HHA_TEXPORT.exportHygieneCSV()

'use strict';

(function(){
  const WIN = window;

  const KEY = 'HHA_SUMMARY_HISTORY';

  function load(key, fb){
    try{ const s = localStorage.getItem(key); return s? JSON.parse(s): fb; }catch{ return fb; }
  }

  function esc(v){
    const s = String(v ?? '');
    if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  function toRow(obj, keys){
    return keys.map(k=>esc(obj[k])).join(',');
  }

  function exportHygieneCSV(){
    const hist = load(KEY, []);
    const arr = Array.isArray(hist) ? hist : [];
    const rows = arr.filter(x=>x && x.game==='hygiene').slice(0, 200);

    const keys = [
      'timestampIso','sessionId','runMode','diff','view','dateKey',
      'playerName','playerId',
      'reason','durationPlayedSec','durationPlannedSec',
      'stepAcc','comboMax','loopsDone',
      'bossClears','miniBossClears',
      'hazHits','misses','missForgiven',
      'missionId','missionName','missionDone','missionPct'
    ];

    // Attach playerName/playerId from scoreboard last player if missing
    const p = WIN.HHA_HW_SB?.getPlayer?.();
    for(const r of rows){
      if(!r.playerName) r.playerName = p?.name || '';
      if(!r.playerId) r.playerId = p?.id || '';
    }

    const header = keys.join(',');
    const body = rows.map(r=>toRow(r, keys)).join('\n');
    const csv = header + '\n' + body;

    // download
    try{
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.download = `hygiene_export_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
      return true;
    }catch{
      // fallback copy to clipboard
      return navigator.clipboard?.writeText(csv).then(()=>true).catch(()=>false);
    }
  }

  WIN.HHA_TEXPORT = { exportHygieneCSV };
})();