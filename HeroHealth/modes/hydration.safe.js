// === /HeroHealth/modes/hydration.safe.js (2025-11-14 WATER GAUGE + QUEST) ===
// เป้าคลิกเกี่ยวกับน้ำ: เพิ่ม/ลดระดับน้ำในร่างกาย ให้คงอยู่ "โซนสมดุล (40-70%)"
// เด้งคะแนนตรงคลิก + เกจน้ำ + โค้ช + ปรับความโหด

import { burstAt, scorePop } from '../vr/particles.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom, burstAtScreen, floatScoreScreen } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const HYDRA = ['💧','🥤','🧃','🫗'];        // เติมน้ำ
const DRAIN = ['🔥','🏃','☀️','🧂','💨'];   // ลดน้ำ/คายน้ำ

const diffCfg = {
  easy:   { spawn: 900, life: 2200, stepGood:+10, stepDrain:-12 },
  normal: { spawn: 780, life: 2000, stepGood:+9,  stepDrain:-13 },
  hard:   { spawn: 660, life: 1800, stepGood:+8,  stepDrain:-14 }
};

export async function boot(opts = {}) {
  const diff = (opts.difficulty||'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML='';

  ensureWaterGauge();

  // state
  let water=50; // 0..100
  setWaterGauge(water);

  let score=0, combo=0, comboMax=0, misses=0, goodHits=0, timeLeft=dur;
  let spawnTimer=null, tickTimer=null, speedLevel=0;

  // quest
  const quest = createHydrationQuest(diff);
  const getState = ()=>({ score, goodHits, miss:misses, comboMax, timeLeft, water, zone: zoneFrom(water) });

  function pushQuest(){ try{ quest.update(getState()); }catch(_){ } }

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text } }));
  }

  function getXY(ev){
    if (ev?.changedTouches?.[0]) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
    if (ev?.touches?.[0])        return { x: ev.touches[0].clientX,        y: ev.touches[0].clientY };
    return { x: ev?.clientX||0, y: ev?.clientY||0 };
  }

  function zoneScore(z){ return z==='GREEN' ? 120 : (z==='HIGH' ? 40 : 30); }

  function emitScore(delta, isGood, ev){
    score = Math.max(0, score + (delta|0));
    if (isGood){ combo++; goodHits++; comboMax = Math.max(comboMax, combo); }
    else { combo=0; misses++; }

    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ delta, total:score, combo, comboMax, good:isGood }
    }));

    if (ev){
      const {x,y} = getXY(ev);
      burstAt(x,y,{ color: isGood ? '#22c55e' : '#ef4444' });
      scorePop(x,y,(delta>0?'+':'')+delta,{ good:isGood });
      // เสริมเอฟเฟกต์เกจ
      if (isGood) { burstAtScreen(x,y,{ color:'#22c55e', count:18 }); }
      else        { burstAtScreen(x,y,{ color:'#ef4444', count:14 }); }
    }

    // เร่งความโหด
    if (goodHits>=10 && speedLevel===0){ speedLevel=1; coach('จังหวะไวขึ้นเล็กน้อย'); }
    if (goodHits>=22 && speedLevel===1){ speedLevel=2; coach('ไวขึ้นอีกนิด! รักษาโซน Green ให้ได้'); }

    pushQuest();
  }

  function applyDelta(d, ev){
    // ปรับน้ำ + แปลผลโซน
    water = Math.max(0, Math.min(100, water + d));
    setWaterGauge(water);
    const z = zoneFrom(water);
    const good = (z==='GREEN');
    const base = zoneScore(z);
    emitScore(good ? base : -Math.round(base*0.35), good, ev);

    // โค้ชเล็กน้อย
    if (z==='LOW')  coach('น้ำต่ำไป เพิ่ม 💧/🥤 ให้มากขึ้น');
    if (z==='HIGH') coach('น้ำเกิน ลองหลีกเลี่ยงสิ่งที่ทำให้เพิ่มน้ำ');
  }

  function spawnOne(){
    if (timeLeft<=0) return;

    let ch, delta;
    const r = Math.random();
    if (r<0.6){ ch = pick(HYDRA); delta = cfg.stepGood; }    // โอกาสเติมน้ำมากกว่า
    else      { ch = pick(DRAIN); delta = cfg.stepDrain; }

    const el=document.createElement('div');
    el.textContent = ch;
    Object.assign(el.style,{
      position:'absolute',
      left:(10+Math.random()*80)+'%',
      top:(18+Math.random()*60)+'%',
      transform:'translate(-50%,-50%)',
      font:'900 50px system-ui',
      textShadow:'0 8px 20px rgba(0,0,0,.55)',
      pointerEvents:'auto', cursor:'pointer', userSelect:'none'
    });

    const life = Math.max(1200, cfg.life - speedLevel*160);
    const kill = ()=>{ if(el.parentNode) try{ host.removeChild(el); }catch(_){ } };

    el.addEventListener('click',(ev)=>{ if(!el.parentNode) return; kill(); applyDelta(delta, ev); });
    host.appendChild(el);
    setTimeout(kill, life);
  }

  function tick(){
    timeLeft--;
    window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));
    pushQuest();
    if (timeLeft<=0){ stopAll(); finish(); }
  }

  function stopAll(){
    if (spawnTimer){ clearInterval(spawnTimer); spawnTimer=null; }
    if (tickTimer){  clearInterval(tickTimer);  tickTimer=null; }
  }

  function finish(){
    const sum = quest.summary ? quest.summary() : { goalsCleared:0, goalsTotal:0, miniCleared:0, miniTotal:0 };
    const goalCleared = sum.goalsTotal ? (sum.goalsCleared >= sum.goalsTotal) : false;

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:'hydration', difficulty:diff, score, misses, comboMax, duration:dur,
        goalCleared,
        questsCleared: sum.miniCleared || 0,
        questsTotal  : sum.miniTotal  || 0
      }
    }));
  }

  return {
    start(){
      score=0; combo=0; comboMax=0; misses=0; goodHits=0; timeLeft=dur; water=50; speedLevel=0;
      setWaterGauge(water);
      window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));

      try{ quest.start(getState()); }catch(_){}

      coach('รักษาน้ำให้อยู่โซนสมดุล (40–70%) คลิก 💧 เติม แต่ระวัง DRAIN!');
      spawnTimer = setInterval(spawnOne, Math.max(320, cfg.spawn - speedLevel*60));
      tickTimer  = setInterval(tick, 1000);
    },
    stop(){ stopAll(); }
  };
}

export default { boot };

// helpers
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function makeHost(){
  const h=document.createElement('div'); h.id='spawnHost';
  Object.assign(h.style,{position:'absolute',inset:0,pointerEvents:'none',zIndex:650});
  document.body.appendChild(h); return h;
}