// === /herohealth/vr/logger.safe.js ===
// HHA Logger — PRODUCTION (flush-hardened)
// ✅ In-memory events + optional ?log= endpoint later
export function createLogger(){
  const events = [];
  function ev(type, data){
    events.push({ t: Date.now(), type, ...(data||{}) });
  }
  function exportJSON(){ return JSON.stringify(events, null, 2); }
  function exportCSV(){
    const rows = [];
    rows.push('t,type,phase,kind,score,water,combo,source,msg');
    for(const e of events){
      const r = [
        e.t||'', e.type||'', e.phase||'', e.kind||'',
        e.score??'', e.water??'', e.combo??'', e.source??'', e.msg??''
      ].map(x=>String(x).replace(/\n/g,' ').replace(/,/g,' '));
      rows.push(r.join(','));
    }
    return rows.join('\n');
  }
  return { ev, events, exportJSON, exportCSV };
}