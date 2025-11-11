// === /HeroHealth/modes/hydration.quest.js (MissionDeck-ready) ===
const THREE = window.THREE;
import { makeSpawner } from '../vr/spawn-utils.js';
import { burstAt, floatScore } from '../vr/shards.js';
import { emojiImage } from '../vr/emoji-sprite.js';
import { MissionDeck } from '../vr/mission.js';

/* ---------------- Water Gauge (DOM HUD) ---------------- */
function ensureWaterGauge() {
  // เคลียร์เก่าก่อน
  destroyWaterGauge();
  const wrap = document.createElement('div');
  wrap.id = 'waterWrap';
  wrap.setAttribute('data-hha-ui','');
  Object.assign(wrap.style, {
    position:'fixed', left:'50%', bottom:'56px', transform:'translateX(-50%)',
    width:'min(540px,86vw)', zIndex:'900', color:'#e8eefc',
    background:'#0f172a99', border:'1px solid #334155', borderRadius:'12px',
    padding:'10px 12px', backdropFilter:'blur(6px)', fontWeight:'800'
  });
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>Water</span>
      <span id="waterLbl">Balanced</span>
    </div>
    <div style="height:12px;margin-top:6px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden">
      <div id="waterFill" style="height:100%;width:55%;background:linear-gradient(90deg,#06d6a0,#37d67a)"></div>
    </div>`;
  document.body.appendChild(wrap);
  return wrap;
}
function setWaterGauge(val){ // 0..100
  const f = document.getElementById('waterFill');
  const l = document.getElementById('waterLbl');
  if(!f || !l) return;
  const pct = Math.max(0, Math.min(100, Math.round(val)));
  f.style.width = pct + '%';
  let zone = 'Low';
  if (pct >= 40 && pct <= 70) zone = 'Balanced'; else if (pct > 70) zone = 'High';
  l.textContent = zone;
  f.style.background =
    (zone === 'Balanced')
      ? 'linear-gradient(90deg,#06d6a0,#37d67a)'
      : (zone === 'High'
          ? 'linear-gradient(90deg,#22c55e,#93c5fd)'
          : 'linear-gradient(90deg,#f59e0b,#ef4444)');
}
function destroyWaterGauge(){ const el=document.getElementById('waterWrap'); if(el){ try{ el.remove(); }catch{} } }

/* ---------------- Game ---------------- */
export async function boot(cfg = {}) {
  const scene = document.querySelector('a-scene');
  const host  = cfg.host || document.getElementById('spawnHost');
  const diff  = String(cfg.difficulty || 'normal');
  const dur   = Number(cfg.duration || (diff==='easy'?90:diff==='hard'?45:60));

  ensureWaterGauge();

  const GOOD = ['💧','🚰','🥛','🍊','🍋'];
  const BAD  = ['🧋','🥤','🍹','🧃','🍺'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️';

  const tune = {
    easy:   { nextGap:[380,560], life:[1400,1700], minDist:0.34, badRate:0.28, maxConcurrent:2 },
    normal: { nextGap:[300,500], life:[1200,1500], minDist:0.32, badRate:0.35, maxConcurrent:3 },
    hard:   { nextGap:[260,460], life:[1000,1300], minDist:0.30, badRate:0.40, maxConcurrent:4 }
  };
  const C = tune[diff] || tune.normal;
  const sp = makeSpawner({ bounds:{x:[-0.75,0.75], y:[-0.05,0.45], z:-1.6}, minDist:C.minDist, decaySec:2.2 });

  // mission deck
  const md = new MissionDeck(); md.draw3();
  function updateQuestHUD(){ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:`Quest ${md.currentIndex+1}/3 — ${md.getCurrent()?.label || ''}`}})); }
  updateQuestHUD();

  // state
  let running=true, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0, shield=0;
  let remain=dur, timerId=0, loopId=0;
  let water = 55; setWaterGauge(water);

  const rand=(a,b)=>a+Math.random()*(b-a);
  const nextGap=()=>rand(C.nextGap[0], C.nextGap[1]);
  const lifeMs =()=>rand(C.life[0], C.life[1]);

  function emitScore(){ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score, combo}})); }
  function afterHitAdvance(){ md.updateScore(score); md.updateCombo(combo); if(md._autoAdvance()) updateQuestHUD(); }

  function zone(){ return (water>=40 && water<=70) ? 'GREEN' : (water>70 ? 'HIGH':'LOW'); }

  function applyHit(type, wp){
    if (type==='good'){
      const val = 20 + combo*2;
      score += val; combo++; maxCombo=Math.max(maxCombo, combo); hits++; md.onGood();
      water = Math.min(100, water + 6);
      burstAt(scene, wp, { color:'#22c55e', count:18, speed:1.0 });
      floatScore(scene, wp, '+'+val);
    } else if (type==='bad'){
      if (shield>0){ shield--; floatScore(scene, wp, 'Shield!'); burstAt(scene, wp, {color:'#60a5fa',count:14, speed:0.9}); }
      else{
        if (zone()==='HIGH'){ score += 5; floatScore(scene, wp, '+5 (High)'); }
        else { score = Math.max(0, score - 20); combo=0; floatScore(scene, wp, '-20'); }
        water = Math.max(0, water - 8);
        md.onJunk();
        burstAt(scene, wp, { color:'#ef4444', count:12, speed:0.9 });
      }
    } else if (type==='star'){
      score += 40; md.onStar(); burstAt(scene, wp, { color:'#fde047', count:20, speed:1.1 }); floatScore(scene, wp, '+40 ⭐');
    } else if (type==='diamond'){
      score += 80; md.onDiamond(); burstAt(scene, wp, { color:'#a78bfa', count:24, speed:1.2 }); floatScore(scene, wp, '+80 💎');
    } else if (type==='shield'){
      shield = Math.min(3, shield+1); burstAt(scene, wp, { color:'#60a5fa', count:18, speed:1.0 }); floatScore(scene, wp, '🛡️+1');
    }
    setWaterGauge(water);
    emitScore();
    afterHitAdvance();
  }

  function end(reason='timeout'){
    if(!running) return; running=false;
    try { clearInterval(timerId); } catch {}
    try { clearTimeout(loopId); } catch {}
    destroyWaterGauge();
    Array.from(host.querySelectorAll('a-image')).forEach(n=>{ try{ n.remove(); }catch{} });
    window.dispatchEvent(new CustomEvent('hha:end',{detail:{
      mode:'Hydration', difficulty:diff, score, comboMax:maxCombo, misses, hits, spawns,
      duration:dur, questsCleared: md.getProgress().filter(q=>q.done).length, questsTotal: md.deck.length, reason
    }}));
  }

  function spawnOne(){
    if(!running) return;
    if(host.querySelectorAll('a-image').length >= C.maxConcurrent){ loopId=setTimeout(spawnOne,120); return; }

    let ch, type;
    const r=Math.random();
    if      (r < 0.05) { ch=STAR; type='star'; }
    else if (r < 0.07) { ch=DIA;  type='diamond'; }
    else if (r < 0.10) { ch=SHIELD; type='shield'; }
    else {
      const good = Math.random() > C.badRate;
      ch = (good ? GOOD : BAD)[(Math.random()* (good?GOOD:BAD).length)|0];
      type = good ? 'good' : 'bad';
    }

    const pos = sp.sample();
    const el  = emojiImage(ch, 0.7, 128);
    el.classList.add('clickable');
    el.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    host.appendChild(el); spawns++;

    const rec = sp.markActive(pos);
    const ttl = setTimeout(()=>{
      if(!el.parentNode) return;
      if(type==='good'){ water=Math.max(0, water-4); score=Math.max(0, score-8); combo=0; window.dispatchEvent(new CustomEvent('hha:miss',{detail:{count:++misses}})); md.onJunk(); setWaterGauge(water); emitScore(); afterHitAdvance(); }
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
    }, lifeMs());

    el.addEventListener('click',(ev)=>{
      if(!running) return; ev.preventDefault(); clearTimeout(ttl);
      const wp = el.object3D.getWorldPosition(new THREE.Vector3());
      applyHit(type, wp);
      try{ host.removeChild(el);}catch{}; sp.unmark(rec);
      loopId=setTimeout(spawnOne, nextGap());
    }, {passive:false});

    loopId=setTimeout(spawnOne, nextGap());
  }

  // เวลา
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:dur}}));
  timerId = setInterval(()=>{
    if(!running) return;
    remain = Math.max(0, remain-1);
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:remain}}));
    if(remain<=0) end('timeout');
    else if (md.isCleared()) {
      const more = new MissionDeck(); more.draw3();
      more.deck.forEach(q=>{ if(!md.deck.find(x=>x.id===q.id)) md.deck.push(q); });
      updateQuestHUD();
    }
  },1000);

  spawnOne();

  return { stop(){end('quit');}, pause(){running=false;}, resume(){ if(!running){ running=true; spawnOne(); } } };
}
export default { boot };