window.Leaderboard=(function(){
  const KEY='vfa_leaderboard';
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY) || '[]'); }catch(e){ return []; } }
  function save(data){ localStorage.setItem(KEY, JSON.stringify(data)); }
  function postResult(gameId, payload){
    const data = load();
    const entry = Object.assign({gameId, ts: Date.now()}, payload || {});
    data.push(entry);
    // keep last 200 entries
    if(data.length>200) data.splice(0, data.length-200);
    save(data);
    return entry;
  }
  function top(n=10, gameId=null){
    const data = load();
    const list = gameId ? data.filter(x=>x.gameId===gameId) : data.slice();
    list.sort((a,b)=> (b.score||0) - (a.score||0));
    return list.slice(0,n);
  }
  function recent(n=10){
    const data = load(); return data.slice(-n).reverse();
  }
  return {postResult, top, recent, load};
})();