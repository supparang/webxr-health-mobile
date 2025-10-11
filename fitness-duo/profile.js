
(function(){
  const KEY="duo_profile_v1";
  const DEF={name:"Player", coins:0, level:1, xp:0, badges:[], sessions:[], totals:{play:0, score:0, orbs:0, dodges:0, comboBest:0, accBest:0}};
  function load(){ try{return Object.assign({},DEF, JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(e){return {...DEF};} }
  function save(p){ try{ localStorage.setItem(KEY, JSON.stringify(p)); }catch(e){} }
  function needXP(lv){ return 300 + (lv-1)*120; }
  function addXP(p, n){ p.xp += n; while(p.xp >= needXP(p.level)){ p.xp -= needXP(p.level); p.level++; } }
  function grantBadge(p, id){ if(!p.badges.includes(id)) p.badges.push(id); }
  function addCoins(p, n){ p.coins = Math.max(0, (p.coins||0) + (n||0)); }
  function recordSession(s){
    const p = load();
    p.sessions.push({...s, ts: Date.now()});
    p.totals.play += 1;
    p.totals.score += (s.score||0);
    p.totals.orbs  += (s.orbs||0);
    p.totals.dodges+= (s.dodges||0);
    p.totals.comboBest = Math.max(p.totals.comboBest, s.combo||0);
    p.totals.accBest   = Math.max(p.totals.accBest, s.acc||0);
    addCoins(p, Math.round((s.score||0)/200));
    addXP(p, Math.round(40 + (s.score||0)/50));
    if((s.combo||0)>=20) grantBadge(p, "combo-20");
    if((s.acc||0)>=0.95) grantBadge(p, "acc-95");
    save(p);
    try{ window.dispatchEvent(new CustomEvent("duo:session", {detail:s})); }catch(e){}
    return p;
  }
  window.DuoProfile = { load, save, addCoins, grantBadge, recordSession, needXP };
})();
