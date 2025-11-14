// === /HeroHealth/modes/goodjunk.safe.js (2025-11-14 QUEST-INTEG + POP AT CLICK) ===
// คลิก "ของดี" ให้ไว เลี่ยง "ของเสีย" + เด้งคะแนนตรงจุดคลิก + โค้ช + ปรับความโหดอัตโนมัติ

import { burstAt, scorePop } from '../vr/particles.js';
import { createGoodJunkQuest } from './goodjunk.quest.js';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
const BONUS = ['⭐','💎','🛡️','🔥']; // แต้ม+ฟีเวอร์/ชิลด์

const diffCfg = {
  easy:   { spawn: 900, life: 2200, base: 16,  biasGood: 0.68 },
  normal: { spawn: 780, life: 2000, base: 18,  biasGood: 0.62 },
  hard:   { spawn: 660, life: 1800, base: 20,  biasGood: 0.58 }
};

export async function boot(opts = {}) {
  const diff = (opts.difficulty||'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML = '';

  // ---- state ----
  let score=0, combo=0, comboMax=0, misses=0, hits=0, goodHits=0, timeLeft=dur;
  let spawnTimer=null, tickTimer=null;
  let speedLevel=0; // ปรับโหดตามผลงาน

  // ---- quest director ----
  const quest = createGoodJunkQuest(diff);
  const getState = ()=>({ score, goodHits, miss:misses, comboMax, timeLeft });

  function pushQuest(){ try{ quest.update(getState()); }catch(_){ } }

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text } }));
  }

  // ---- xy helper (ให้เด้งตรงเป้า เสมอ) ----
  function getXY(ev){
    if (ev?.changedTouches?.[0]) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
    if (ev?.touches?.[0])        return { x: ev.touches[0].clientX,        y: ev.touches[0].clientY };
    return { x: ev?.clientX||0, y: ev?.clientY||0 };
  }

  // ---- scoring/effects ----
  function emitScore(delta, isGood, ev){
    score = Math.max(0, score + (delta|0));
    if (isGood){
      combo++; hits++; comboMax = Math.max(comboMax, combo); goodHits++;
    } else {
      combo = 0; misses++;
    }

    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ delta, total:score, combo, comboMax, good:isGood }
    }));

    if (ev){
      const {x,y} = getXY(ev);
      burstAt(x,y,{ color: isGood ? '#22c55e' : '#ef4444' });
      scorePop(x,y,(delta>0?'+':'')+delta,{ good:isGood });
    }

    // ปรับความโหดเมื่อทำได้ดี
    if (goodHits>=12 && speedLevel===0){ speedLevel=1; coach('เร็วขึ้นนิดหน่อย!'); }
    if (goodHits>=24 && speedLevel===1){ speedLevel=2; coach('สุดยอด! เร็วขึ้นอีกขั้น!'); }

    pushQuest();
  }

  // ---- spawn ----
  function spawnOne(){
    if (timeLeft<=0) return;

    // สุ่มชนิด: โบนัสเล็กน้อย / ของดีตาม bias / ของเสีย
    let ch, kind;
    const r = Math.random();
    if (r<0.08){ ch = pick(BONUS); kind='bonus'; }
    else if (r<0.08 + cfg.biasGood){ ch = pick(GOOD); kind='good'; }
    else { ch = pick(JUNK); kind='junk'; }

    const el=document.createElement('div');
    el.textContent = ch;
    el.dataset.kind = kind;
    Object.assign(el.style,{
      position:'absolute',
      left:(10+Math.random()*80)+'%',
      top:(18+Math.random()*60)+'%',
      transform:'translate(-50%,-50%)',
      font:'900 52px system-ui',
      textShadow:'0 8px 20px rgba(0,0,0,.55)',
      pointerEvents:'auto', userSelect:'none', cursor:'pointer'
    });

    const life = Math.max(1200, cfg.life - speedLevel*180);
    const kill = ()=>{ if(el.parentNode) try{ host.removeChild(el); }catch(_){ } };

    el.addEventListener('click',(ev)=>{
      if(!el.parentNode) return;
      kill();

      // โบนัส
      if (ch==='⭐') return emitScore(80,  true, ev);
      if (ch==='💎') return emitScore(140, true, ev);
      if (ch==='🛡️'){ emitScore(40, true, ev); coach('กันพลาดชั่วคราว! (soft)'); return; }
      if (ch==='🔥'){ emitScore(60, true, ev); coach('ไฟติด! เก็บต่อเนื่องให้ยาวๆ'); return; }

      // ปกติ
      if (GOOD.includes(ch)) {
        // คะแนนตามคอมโบ (รู้สึกได้ว่ารัวๆแล้วแรงขึ้น)
        const delta = cfg.base + combo*2;
        emitScore(delta, true, ev);
      } else {
        emitScore(-12, false, ev);
        coach('อันนี้ของเสีย หลีกเลี่ยงนะ');
      }
    });

    host.appendChild(el);
    setTimeout(kill,life);
  }

  // ---- timer ----
  function tick(){
    timeLeft--;
    window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));
    pushQuest();
    if (timeLeft<=0){
      stopAll();
      finish();
    }
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
        mode:'goodjunk', difficulty:diff, score, misses, comboMax, duration:dur,
        goalCleared,
        questsCleared: sum.miniCleared || 0,
        questsTotal  : sum.miniTotal  || 0
      }
    }));
  }

  return {
    start(){
      // reset
      score=0; combo=0; comboMax=0; misses=0; hits=0; goodHits=0; timeLeft=dur; speedLevel=0;
      window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));

      try{ quest.start(getState()); }catch(_){}

      coach('เก็บของดีต่อเนื่อง เลี่ยงของเสีย แล้วดูคอมโบพุ่ง!');
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
  const h=document.createElement('div');
  h.id='spawnHost';
  Object.assign(h.style,{position:'absolute',inset:0,pointerEvents:'none',zIndex:650});
  document.body.appendChild(h);
  return h;
}