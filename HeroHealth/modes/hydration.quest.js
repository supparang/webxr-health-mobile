// === /HeroHealth/modes/hydration.quest.js (final) ===
const THREE=window.THREE;
import{makeSpawner}from'../vr/spawn-utils.js';
import{burstAt,floatScore,setShardMode}from'../vr/shards.js';
import{emojiImage}from'../vr/emoji-sprite.js';
import{drawThree}from'../vr/quests-powerups.js';

function destroyWaterGauge(){const el=document.getElementById('waterWrap');if(el)el.remove();}
function ensureWaterGauge(){destroyWaterGauge();const wrap=document.createElement('div');
wrap.id='waterWrap';Object.assign(wrap.style,{position:'fixed',left:'50%',bottom:'56px',transform:'translateX(-50%)',
width:'min(540px,86vw)',zIndex:'900',background:'#0f172a99',border:'1px solid #334155',borderRadius:'12px',padding:'10px 12px',
backdropFilter:'blur(6px)',color:'#e8eefc',fontWeight:'800'});
wrap.innerHTML=`<div style="display:flex;justify-content:space-between"><span>Water</span><span id="waterLbl">Balanced</span></div>
<div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
<div id="waterFill" style="height:100%;width:50%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div></div>`;
document.body.appendChild(wrap);}
function setWaterGauge(val){const f=document.getElementById('waterFill');const l=document.getElementById('waterLbl');
if(!f||!l)return;const pct=Math.max(0,Math.min(100,Math.round(val)));f.style.width=pct+'%';
let zone='Low';if(pct>=40&&pct<=70)zone='Balanced';else if(pct>70)zone='High';
l.textContent=zone;f.style.background=(zone==='Balanced')?'linear-gradient(90deg,#06d6a0,#37d67a)':
(zone==='High'?'linear-gradient(90deg,#22c55e,#93c5fd)':'linear-gradient(90deg,#f59e0b,#ef4444)');}

export async function boot(cfg={}) {
  setShardMode('hydration');
  const scene=document.querySelector('a-scene');const host=cfg.host||document.getElementById('spawnHost');
  const diff=String(cfg.difficulty||'normal');const dur=Number(cfg.duration||(diff==='easy'?90:diff==='hard'?45:60));
  ensureWaterGauge();
  const GOOD=['💧','🚰','🥛','🍊','🍋'],BAD=['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐',DIA='💎',SHIELD='🛡️';
  const tune={easy:{nextGap:[380,560],life:[1400,1700],badRate:0.25,maxConcurrent:2},
    normal:{nextGap:[300,500],life:[1200,1500],badRate:0.35,maxConcurrent:3},
    hard:{nextGap:[260,460],life:[1000,1300],badRate:0.40,maxConcurrent:4}};
  const C=tune[diff]||tune.normal;const sp=makeSpawner({bounds:{x:[-0.75,0.75],y:[-0.05,0.45],z:-1.6},minDist:0.3});
  let running=true,score=0,combo=0,maxCombo=0,hits=0,misses=0,water=55,shield=0,spawns=0,remain=dur,questIdx=0;
  const QUESTS=drawThree('hydration',diff);
  window.addEventListener('hha:dispose-ui',destroyWaterGauge);window.dispatchEvent(new CustomEvent('hha:quest',{detail:{label:QUESTS[0].label,currentIndex:0,total:3}}));

  function emitGoal(){window.dispatchEvent(new CustomEvent('hha:goal',{detail:{label:`รักษาน้ำระดับ ${Math.round(water)}