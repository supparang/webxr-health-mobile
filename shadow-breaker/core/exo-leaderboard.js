// EXO Leaderboard — local fallback + optional remote REST
window.EXO_LB = (function(){
  const KEY='EXO_LEADERBOARD_LOCAL';
  function local(){ return EXO.store.get(KEY, []); }
  function saveLocal(arr){ EXO.store.set(KEY, arr); }

  async function submit(entry){
    // entry: {name, module, score, accuracy, diff, t}
    entry.t = entry.t || Date.now();
    const cfg = EXO_SETTINGS.get();
    const url = cfg.api.leaderboardUrl?.trim();
    const apiKey = cfg.api.apiKey?.trim();
    if (url){
      try{
        await fetch(url, {method:'POST', headers:{'Content-Type':'application/json','Authorization':apiKey?`Bearer ${apiKey}`:''}, body:JSON.stringify(entry)});
        return true;
      }catch(e){ console.warn('Remote LB failed, fall back to local'); }
    }
    const arr = local(); arr.push(entry); arr.sort((a,b)=> b.score-a.score); saveLocal(arr.slice(0,100));
    return true;
  }

  async function top(limit=20){
    const cfg = EXO_SETTINGS.get();
    const url = cfg.api.leaderboardUrl?.trim();
    if (url){
      try{
        const res = await fetch(url+'?limit='+limit, {headers:{'Authorization':cfg.api.apiKey?`Bearer ${cfg.api.apiKey}`:''}});
        const rows = await res.json(); return rows;
      }catch(e){ console.warn('Remote LB read failed, use local'); }
    }
    return local().slice(0,limit);
  }
  return { submit, top };
})();
