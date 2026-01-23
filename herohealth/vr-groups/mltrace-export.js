// === /herohealth/vr-groups/mltrace-export.js ===
// MLTrace Export helpers (JSON / CSV) for GroupsVR

(function(){
  'use strict';
  const WIN = window;

  function safe(v){
    if (v == null) return '';
    const s = String(v);
    // CSV-safe: wrap when contains special chars
    if (/[,"\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
    return s;
  }

  function toCSV(rows){
    if (!rows || !rows.length) return '';
    const cols = Object.keys(rows[0]);
    let out = cols.map(safe).join(',') + '\n';
    for (const r of rows){
      out += cols.map(k=>safe(r[k])).join(',') + '\n';
    }
    return out;
  }

  function downloadText(filename, text){
    try{
      const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
      return true;
    }catch(_){
      return false;
    }
  }

  function exportTraceCSV(summary){
    const samples = summary?.mlTrace?.samples || [];
    const events  = summary?.mlTrace?.events  || [];

    const csv1 = toCSV(samples);
    const csv2 = toCSV(events);

    const ok1 = downloadText('GroupsVR-mltrace-samples.csv', csv1 || ''); 
    const ok2 = downloadText('GroupsVR-mltrace-events.csv',  csv2 || '');

    return (ok1 && ok2);
  }

  function exportTraceJSON(summary){
    const json = JSON.stringify(summary?.mlTrace || {samples:[],events:[]}, null, 2);
    return downloadText('GroupsVR-mltrace.json', json);
  }

  WIN.GroupsVR = WIN.GroupsVR || {};
  WIN.GroupsVR.MLExport = {
    toCSV,
    exportTraceCSV,
    exportTraceJSON,
    downloadText
  };
})();