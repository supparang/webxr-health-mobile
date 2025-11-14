// === /HeroHealth/modes/plate.safe.js (2025-11-14 QUOTA 5 หมู่ + QUEST) ===
// แนวคิด: ทำ "จานสุขภาพ" ให้ครบสัดส่วน 5 หมู่ต่อ 1 ชุด (โควตาต่อหมู่ขึ้นกับด่าน/เควสต์)
// safe.js จะ bias สปอว์นไปยังหมู่ที่ "ยังขาด" และส่งเหตุการณ์ให้ quest ประมวลผลโควตา

import { burstAt, scorePop } from '../vr/particles.js';
import { createPlateQuest } from './plate.quest.js';

// 5 หมู่ (ใช้ชุดเดียวกับ groups เพื่อความคุ้นมือ)
const GROUPS = {
  1: ['🍚','🍙','🍞','🥐','🥖','🥯'],              // ข้าว-แป้ง
  2: ['🥩','🍗','🍖','🥚','🧀','🥓'],              // เนื้อ/โปรตีน
  3: ['🥦','🥕','🍅','🥬','🌽','🥗'],              // ผัก
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],          // ผลไม้
  5: ['🥛','🧈','🧀','🍨']                         // นม/แคลเซียม
};
const ALL_EMOJI = Object.values(GROUPS).flat();

const diffCfg = {
  easy:   { spawn: 900, life: 2200 },
  normal: { spawn: 780, life: 2000 },
  hard:   { spawn: 660, life: 1800 }
};

export async function boot(opts = {}) {
  const diff = (opts.difficulty||'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML='';

  // state
  let score=0, combo=0, comboMax=0, misses=0, goodHits=0, timeLeft=dur;
  let spawnTimer=null, tickTimer=null, speedLevel=0;

  // quest: ควบคุมโควตา/เซต, คืน method optional: getFocusGroups(), onPick(group)
  const quest = createPlateQuest(diff);

  const getState = ()=>({ score, goodHits, miss:misses, comboMax, timeLeft });
  function pushQuest(){ try{ quest.update(getState()); }catch(_){ } }

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text } }));
  }

  function getXY(ev){
    if (ev?.changedTouches?.[0]) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
    if (ev?.touches?.[0])        return { x: ev.touches[0].clientX,        y: ev.touches[0].clientY };
    return { x: ev?.clientX||0, y: ev?.clientY||0 };
  }

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
    }

    // เร่งเล็กน้อยเมื่อทำได้ดี
    if (goodHits>=10 && speedLevel===0){ speedLevel=1; coach('เริ่มไวขึ้น'); }
    if (goodHits>=22 && speedLevel===1){ speedLevel=2; coach('ไวขึ้นอีก! เติมให้ครบชุด'); }

    pushQuest();
  }

  function spawnOne(){
    if (timeLeft<=0) return;

    // ขอ "กลุ่มที่ยังขาด" จาก quest ถ้ามี (เช่น [3,4]) เพื่อ bias
    let focus = [];
    try{ focus = quest.getFocusGroups ? (quest.getFocusGroups()||[]) : []; }catch(_){}
    const bias = (focus.length>0);

    let g, ch;
    if (bias && Math.random()<0.72){
      g  = focus[(Math.random()*focus.length)|0];
      ch = pick(GROUPS[g]);
    }else{
      ch = pick(ALL_EMOJI);
      g  = foodGroup(ch);
    }

    const el=document.createElement('div');
    el.textContent=ch; el.dataset.group=g;
    Object.assign(el.style,{
      position:'absolute',
      left:(10+Math.random()*80)+'%',
      top:(18+Math.random()*60)+'%',
      transform:'translate(-50%,-50%)',
      font:'900 48px system-ui',
      textShadow:'0 8px 20px rgba(0,0,0,.55)',
      pointerEvents:'auto', userSelect:'none', cursor:'pointer'
    });

    const life = Math.max(1200, cfg.life - speedLevel*160);
    const kill = ()=>{ if(el.parentNode) try{ host.removeChild(el); }catch(_){ } };

    el.addEventListener('click',(ev)=>{
      if(!el.parentNode) return; kill();
      const groupHit = Number(el.dataset.group||0);

      // แจ้ง quest ก่อนเพื่อคำนวนโควตา (optional)
      try{ quest.onPick?.(groupHit); }catch(_){}

      // ถ้ากลุ่มนี้ "ยังขาด" อยู่ → คะแนนบวก, ถ้าเกินโควตา → ลดย่อม ๆ
      let stillNeeded=false;
      try{ stillNeeded = !!quest.isNeeded?.(groupHit); }catch(_){}

      if (stillNeeded){
        emitScore(140, true, ev);
      } else {
        emitScore(-80, false, ev);
        coach('กลุ่มนี้ครบโควตาแล้ว ลองเลือกหมู่ที่ยังขาด');
      }
    });

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
        mode:'plate', difficulty:diff, score, misses, comboMax, duration:dur,
        goalCleared,
        questsCleared: sum.miniCleared || 0,
        questsTotal  : sum.miniTotal  || 0
      }
    }));
  }

  return {
    start(){
      score=0; combo=0; comboMax=0; misses=0; goodHits=0; timeLeft=dur; speedLevel=0;
      window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));

      try{ quest.start(getState()); }catch(_){}

      coach('เลือกอาหารให้ครบโควตา 5 หมู่ตามที่ยังขาด จะได้จานสุขภาพครบชุด!');
      spawnTimer = setInterval(spawnOne, Math.max(320, cfg.spawn - speedLevel*60));
      tickTimer  = setInterval(tick, 1000);
    },
    stop(){ stopAll(); }
  };
}

export default { boot };

// helpers
function foodGroup(emo){
  for(const [g,list] of Object.entries(GROUPS)){
    if(list.includes(emo)) return Number(g);
  }
  return 0;
}
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function makeHost(){
  const h=document.createElement('div'); h.id='spawnHost';
  Object.assign(h.style,{position:'absolute',inset:0,pointerEvents:'none',zIndex:650});
  document.body.appendChild(h); return h;
}