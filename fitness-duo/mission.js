<!-- missions.js -->
<script>
(function(){
  const KEY="duo_missions_v1";
  const DEF={ daily:{seed:"", tasks:[]}, weekly:{week:"", tasks:[]}, chain:{active:false, index:0, tasks:[]}, claimed:{} };

  function today(){ const d=new Date(); return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`; }
  function weekNum(){
    const d=new Date(); const onejan = new Date(d.getUTCFullYear(),0,1);
    const w = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay()+1) / 7);
    return `${d.getUTCFullYear()}-W${w}`;
  }
  function rng(seed){ let h=0; for(let i=0;i<seed.length;i++) h=((h<<5)-h + seed.charCodeAt(i))|0; return ()=>{ h|=0; h=h+0x6D2B79F5|0; let t=Math.imul(h^h>>>15,1|h); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296; }; }

  function load(){ try{return Object.assign({},DEF, JSON.parse(localStorage.getItem(KEY)||"{}"));}catch(e){return {...DEF};} }
  function save(m){ try{ localStorage.setItem(KEY, JSON.stringify(m)); }catch(e){} }

  function genDaily(){
    const seed = today(); const r=rng(seed);
    return [
      {id:"D1", name:"ทำคะแนนรวม",  metric:"score", target: 2000 + Math.round(r()*3000), reward:{coins:60, xp:80}},
      {id:"D2", name:"คอมโบต่อเนื่อง", metric:"combo", target: 10 + ((r()*15)|0), reward:{coins:50, xp:60}},
      {id:"D3", name:"ความแม่นยำ",   metric:"acc",   target: 0.85 + r()*0.1, reward:{coins:70, xp:80}}
    ];
  }
  function genWeekly(){
    const w=weekNum(); const r=rng(w);
    return [
      {id:"W1", name:"เล่นครบครั้ง", metric:"play", target: 10 + ((r()*6)|0), reward:{coins:200, xp:260}},
      {id:"W2", name:"เก็บพลังงาน (Adv)", metric:"orbs", target: 80 + ((r()*80)|0), reward:{coins:160, xp:200}},
      {id:"W3", name:"Fever (Rhythm)", metric:"fever", target: 6 + ((r()*4)|0), reward:{coins:180, xp:220}}
    ];
  }
  function genChain3(){
    return [
      {id:"C1", name:"ด่าน 1: ทำคะแนน ≥ 1500", metric:"score", target:1500, reward:{coins:80,xp:100}},
      {id:"C2", name:"ด่าน 2: คอมโบ ≥ 12",     metric:"combo", target:12,   reward:{coins:100,xp:120}},
      {id:"C3", name:"ด่าน 3: ACC ≥ 88%",      metric:"acc",   target:0.88, reward:{coins:160,xp:180}},
    ];
  }

  function refresh(){
    const m = load();
    if(m.daily.seed !== today()){ m.daily = {seed: today(), tasks: genDaily()}; }
    if(m.weekly.week !== weekNum()){ m.weekly = {week: weekNum(), tasks: genWeekly()}; }
    if(!m.chain.tasks || m.chain.tasks.length!==3){ m.chain = {active:false, index:0, tasks: genChain3()}; }
    save(m);
    return m;
  }

  function isCleared(task, last){ // last: session summary
    const v = {
      score: last.score || 0,
      combo: last.combo || 0,
      acc:   last.acc   || 0,
      orbs:  last.orbs  || 0,
      dodges:last.dodges|| 0,
      fever: last.fever || 0,
      play:  1
    }[task.metric] || 0;
    return v >= task.target;
  }

  function applyReward(rew){
    const p = window.DuoProfile?.load?.(); if(!p) return;
    window.DuoProfile.addCoins(p, rew.coins||0);
    // แปลง XP ผ่าน addXP ภายใน recordSession → ขอเซฟตรง ๆ แบบง่าย
    p.xp += (rew.xp||0);
    window.DuoProfile.save(p);
  }

  function claim(id){
    const m = refresh();
    if(m.claimed[id]) return false;
    // หางานจาก 3 บอร์ด
    const all=[...(m.daily.tasks||[]), ...(m.weekly.tasks||[]), ...(m.chain.tasks||[])];
    const t = all.find(x=>x.id===id);
    if(!t || !t.cleared) return false;
    m.claimed[id]=true; save(m);
    applyReward(t.reward||{});
    return true;
  }

  // ฟังก์ชันสรุปภารกิจที่ “สำเร็จ/เคลมได้/เคลมแล้ว”
  function getProgress(){
    const m=refresh();
    const res={daily:[], weekly:[], chain:[]};
    function decorate(list){
      return list.map(x=>{
        const y={...x};
        y.claimed = !!m.claimed[y.id];
        return y;
      });
    }
    res.daily = decorate(m.daily.tasks);
    res.weekly= decorate(m.weekly.tasks);
    res.chain = decorate(m.chain.tasks.map((t,i)=>({...t, step:i+1})));
    return res;
  }

  // รับอีเวนต์ “เล่นจบ”
  window.addEventListener("duo:session", (ev)=>{
    const s=ev.detail||{};
    const m=refresh();
    // อัปเดต flag cleared
    const mark = task => { task.cleared = task.cleared || isCleared(task, s); };
    (m.daily.tasks||[]).forEach(mark);
    (m.weekly.tasks||[]).forEach(mark);

    // โหมด Chain-3: ต้องสำเร็จตามลำดับ
    if(!m.chain.active){ m.chain.active = true; m.chain.index = 0; }
    const idx = m.chain.index;
    const cur = m.chain.tasks[idx];
    if(cur && isCleared(cur, s)){ cur.cleared = true; m.chain.index = Math.min(2, idx+1); }

    save(m);
  });

  window.DuoMissions = { refresh, getProgress, claim };
})();
</script>
