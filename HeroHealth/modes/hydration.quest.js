import { boot as run } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';

function ensureWater(){
  const id='waterUI';
  let w=document.getElementById(id);
  if(!w){
    w=document.createElement('div'); w.id=id;
    w.style.cssText='position:fixed;left:16px;right:16px;bottom:66px;padding:12px;border:1px solid #334155;border-radius:12px;background:#0f172aCC;color:#e8eefc;z-index:905';
    w.innerHTML='<div style="display:flex;justify-content:space-between;font-weight:800"><span>Water</span><span id="waterLbl">Balanced</span></div><div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden"><div id="waterFill" style="height:100%;width:55%;"></div></div>';
    document.body.appendChild(w);
  }
  return {
    set(v){
      const f=document.getElementById('waterFill'), l=document.getElementById('waterLbl');
      const pct=Math.max(0,Math.min(100,Math.round(v))); f.style.width=pct+'%';
      let zone='Low'; if(pct>=40&&pct<=70) zone='Balanced'; else if(pct>70) zone='High';
      l.textContent=zone;
      f.style.background= zone==='Balanced'?'linear-gradient(90deg,#06d6a0,#37d67a)':(zone==='High'?'linear-gradient(90deg,#22c55e,#93c5fd)':'linear-gradient(90deg,#f59e0b,#ef4444)');
    }
  };
}

export async function boot(cfg = {}) {
  const deck = new MissionDeck().draw3();
  const HUD = ensureWater(); let water=55; HUD.set(water);
  const GOOD=['💧','🚰','🥛','🍊','🍋']; const BAD=['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';
  let balancedSec=0; showGoal(`รักษา Balanced 25 วิ — คืบหน้า ${balancedSec}/25`);

  function zone(){ return (water>=40&&water<=70)?'Balanced':(water>70?'High':'Low'); }

  function judge(ch, s){
    if (ch===STAR){ deck.onStar(); return {good:true,scoreDelta:40}; }
    if (ch===DIA ){ deck.onDiamond(); return {good:true,scoreDelta:80}; }
    if (ch===SHIELD){ return {good:true,scoreDelta:0}; }

    if (GOOD.includes(ch)){
      water = Math.min(100, water+6); HUD.set(water); deck.onGood();
      return {good:true, scoreDelta: 20 + s.combo*2};
    } else if (BAD.includes(ch)){
      if (zone()==='High') { water=Math.max(0, water-8); HUD.set(water); deck.onJunk(); return {good:true,scoreDelta:5}; }
      water=Math.max(0, water-8); HUD.set(water); deck.onJunk(); return {good:false, scoreDelta:-20};
    }
    return {good:false,scoreDelta:0};
  }

  // นับ Balanced สะสม + อัปเดต goal
  const off = listen('hha:time', ()=> {
    if (zone()==='Balanced'){ balancedSec = Math.min(25, balancedSec+1); showGoal(`รักษา Balanced 25 วิ — คืบหน้า ${balancedSec}/25`); }
  });

  const off2 = listen('hha:score', e=>{
    deck.updateScore(e.detail?.score||0);
    deck.updateCombo(e.detail?.combo||0);
    if (deck._autoAdvance()) showQuest(deck.getCurrent()?.label || 'ครบแล้ว!');
  });

  const g = await run({
    host: cfg.host, difficulty: cfg.difficulty || 'normal', duration: cfg.duration,
    pools:{ good:[...GOOD, STAR, DIA, SHIELD], bad: BAD }, goodRate:0.65, judge
  });

  return { stop(){off();off2();g.stop();}, pause(){g.pause();deck.pause();}, resume(){deck.resume();g.resume();} };
}
function showGoal(t){ upsert('gl',t); } function showQuest(t){ upsert('ql',`Quest ${t}`); }
function upsert(id,text){ let p=document.getElementById('goalQuestPanel'); if(!p){p=document.createElement('div');p.id='goalQuestPanel';p.style.cssText='position:fixed;left:0;right:0;bottom:8px;padding:8px 14px;z-index:910;color:#e8eefc;font:600 14px system-ui';p.innerHTML='<div id="gl" style="margin-bottom:6px"></div><div id="ql"></div>';document.body.appendChild(p);} const el=document.getElementById(id); if(el) el.textContent=text; }
function listen(n,f){window.addEventListener(n,f);return()=>window.removeEventListener(n,f);}
export default { boot };