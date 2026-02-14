/* ===================================================
   HEROHEALTH EXPORT (CSV/JSON)
   - Exports planner session + last result snapshot
   - Reads:
     HHA_FIT_LAST_PLANNER_{pid}
     HHA_FIT_SESSION_* (optional)
   - Usage:
     HHExport.downloadLastPlannerCSV()
     HHExport.downloadAllPlannerCSV()
=================================================== */
(function(global){
  'use strict';

  const esc = (v)=>{
    const s = (v===null||v===undefined) ? '' : String(v);
    if(/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  };

  function toCSV(rows){
    if(!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const head = cols.map(esc).join(',');
    const body = rows.map(r => cols.map(c=>esc(r[c])).join(',')).join('\n');
    return head + '\n' + body;
  }

  function download(text, filename, mime='text/csv;charset=utf-8'){
    const blob = new Blob([text], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 200);
  }

  function safeJSON(s){
    try{ return JSON.parse(s); }catch{ return null; }
  }

  // flatten steps into columns
  function flattenSession(obj){
    // obj = {at, phase, seed, score, acc, timeMs, steps:[{game,score,acc,timeMs,streak, ai?}]}
    const base = {
      at: obj?.at ? new Date(obj.at).toISOString() : '',
      pid: obj?.pid || '',
      name: obj?.name || '',
      phase: obj?.phase || '',
      conditionGroup: obj?.conditionGroup || '',
      seed: obj?.seed ?? '',
      score: obj?.score ?? '',
      acc: obj?.acc ?? '',
      timeMs: obj?.timeMs ?? '',
      timeSec: obj?.timeMs ? Math.round(obj.timeMs/1000) : '',
      streak: obj?.streak ?? '',
    };

    const steps = Array.isArray(obj?.steps) ? obj.steps : [];
    const by = {};
    for(const s of steps){
      if(!s || !s.game) continue;
      by[s.game] = s;
    }

    const games = ['shadow','rhythm','jumpduck','balance','boss'];
    for(const g of games){
      const s = by[g] || {};
      base[`${g}_score`]  = s.score ?? '';
      base[`${g}_acc`]    = s.acc ?? '';
      base[`${g}_timeMs`] = s.timeMs ?? '';
      base[`${g}_timeSec`]= s.timeMs ? Math.round(s.timeMs/1000) : '';
      base[`${g}_streak`] = s.streak ?? '';
    }

    // AI boss flatten
    const ai = by.boss?.ai || obj?.ai?.boss || null;
    base['ai_perf'] = (ai && ai.perf!=null) ? Number(ai.perf).toFixed(3) : '';
    base['ai_spawnMin'] = ai?.spawnMin ?? '';
    base['ai_spawnMax'] = ai?.spawnMax ?? '';
    base['ai_actionChance'] = ai?.actionChance ?? '';
    base['ai_actionWindowMs'] = ai?.actionWindowMs ?? '';
    base['ai_practiceMs'] = ai?.practiceMs ?? '';
    base['ai_durationMs'] = ai?.durationMs ?? '';

    return base;
  }

  function getAllLastPlanner(){
    // keyed by pid
    const out = [];
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(!k) continue;
      if(k.startsWith('HHA_FIT_LAST_PLANNER_')){
        const obj = safeJSON(localStorage.getItem(k) || 'null');
        if(obj){
          // enrich pid from key if missing
          if(!obj.pid){
            obj.pid = k.replace('HHA_FIT_LAST_PLANNER_','');
          }
          out.push(obj);
        }
      }
    }
    // newest first
    out.sort((a,b)=>(b.at||0)-(a.at||0));
    return out;
  }

  function getLastPlannerForCurrentPID(){
    const qs = new URLSearchParams(location.search);
    const pid = qs.get('pid') || '';
    if(!pid) return null;
    const obj = safeJSON(localStorage.getItem(`HHA_FIT_LAST_PLANNER_${pid}`) || 'null');
    if(obj && !obj.pid) obj.pid = pid;
    if(obj && !obj.phase) obj.phase = qs.get('phase') || obj.phase || '';
    if(obj && !obj.seed) obj.seed = Number(qs.get('seed')||obj.seed||0)>>>0;
    if(obj && !obj.conditionGroup) obj.conditionGroup = qs.get('conditionGroup') || obj.conditionGroup || '';
    if(obj && !obj.name) obj.name = qs.get('name') || obj.name || '';
    return obj;
  }

  function downloadLastPlannerCSV(){
    const obj = getLastPlannerForCurrentPID();
    if(!obj){
      alert('ยังไม่พบผลล่าสุดของ PID นี้');
      return;
    }
    const row = flattenSession(obj);
    const csv = toCSV([row]);
    const fn = `planner_last_${row.pid||'pid'}_${row.phase||'phase'}_${(row.at||'').slice(0,10)}.csv`;
    download(csv, fn);
  }

  function downloadAllPlannerCSV(){
    const all = getAllLastPlanner();
    if(!all.length){
      alert('ยังไม่มีข้อมูลผลลัพธ์ในเครื่อง');
      return;
    }
    const rows = all.map(flattenSession);
    const csv = toCSV(rows);
    const fn = `planner_all_${new Date().toISOString().slice(0,10)}.csv`;
    download(csv, fn);
  }

  function downloadAllPlannerJSON(){
    const all = getAllLastPlanner();
    const txt = JSON.stringify(all, null, 2);
    const fn = `planner_all_${new Date().toISOString().slice(0,10)}.json`;
    download(txt, fn, 'application/json;charset=utf-8');
  }

  global.HHExport = {
    downloadLastPlannerCSV,
    downloadAllPlannerCSV,
    downloadAllPlannerJSON,
    getAllLastPlanner
  };

})(window);