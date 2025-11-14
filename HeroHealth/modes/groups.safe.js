// === /HeroHealth/modes/groups.safe.js (2025-11-14 QUEST-INTEG + TARGET GROUP BIAS) ===
// Gameplay: เลือกอาหาร “ตามหมู่เป้าหมาย” ที่กำหนดโดย quest
// - สุ่ม emoji ตาม 5 หมู่หลัก
// - bias ไปยัง "หมู่ที่ควรเก็บ" จาก groups.quest.js
// - คลิกถูกหมู่เป้าหมาย → ได้คะแนน + คอมโบ
// - คลิกหมู่ที่ไม่ใช่เป้าหมาย → หักคะแนน + รีเซ็ตคอมโบ
// - ส่ง event มาตรฐาน: hha:score, hha:time, hha:end, hha:coach

import { burstAt, scorePop } from '../vr/particles.js';
import { createGroupsQuest } from './groups.quest.js';

// 5 หมู่ (ใช้ชุดเดียวกับ plate)
const GROUPS = {
  1: ['🍚','🍙','🍞','🥐','🥖','🥯'],              // ข้าว-แป้ง
  2: ['🥩','🍗','🍖','🥚','🧀','🥓'],              // โปรตีน/เนื้อ
  3: ['🥦','🥕','🍅','🥬','🌽','🥗'],              // ผัก
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],          // ผลไม้
  5: ['🥛','🧈','🧀','🍨']                         // นม/แคลเซียม
};

const ALL_EMOJI = Object.values(GROUPS).flat();

const diffCfg = {
  easy:   { spawn: 900, life: 2200, hit:140, miss:110, biasTarget:0.72 },
  normal: { spawn: 800, life: 2000, hit:150, miss:120, biasTarget:0.70 },
  hard:   { spawn: 680, life: 1800, hit:160, miss:130, biasTarget:0.68 }
};

export async function boot(opts = {}) {
  const diff = (opts.difficulty||'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  const host = document.getElementById('spawnHost') || makeHost();
  host.innerHTML = '';

  // ---- state ----
  let score=0, combo=0, comboMax=0, misses=0, hits=0, goodHits=0;
  let timeLeft=dur;
  let spawnTimer=null, tickTimer=null;
  let speedLevel=0;

  // ---- quest director ----
  const quest = createGroupsQuest(diff);

  const getState = ()=>({
    score,
    goodHits,
    miss: misses,
    comboMax,
    timeLeft
  });

  function pushQuest(){
    try{ quest.update(getState()); }catch(_){}
  }

  function coach(text){
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text } }));
  }

  // ---- helpers ----
  function getXY(ev){
    if (ev?.changedTouches?.[0]) return { x: ev.changedTouches[0].clientX, y: ev.changedTouches[0].clientY };
    if (ev?.touches?.[0])        return { x: ev.touches[0].clientX,        y: ev.touches[0].clientY };
    return { x: ev?.clientX||0, y: ev?.clientY||0 };
  }

  function foodGroup(emo){
    for(const [g,list] of Object.entries(GROUPS)){
      if(list.includes(emo)) return Number(g);
    }
    return 0;
  }

  // กลุ่มที่เป็นเป้าหมายตอนนี้ (ดึงจาก quest แบบยืดหยุ่น)
  function getTargetGroups(){
    try{
      if (typeof quest.getFocusGroups === 'function'){
        const v = quest.getFocusGroups() || [];
        if (Array.isArray(v) && v.length) return v;
      }
      if (typeof quest.getTargetGroups === 'function'){
        const v = quest.getTargetGroups() || [];
        if (Array.isArray(v) && v.length) return v;
      }
      if (Array.isArray(quest.targets) && quest.targets.length){
        return quest.targets;
      }
    }catch(_){}
    return [];
  }

  function isTargetGroup(g){
    try{
      // ถ้ามีฟังก์ชันเฉพาะ ให้ใช้ก่อน
      if (typeof quest.isTargetGroup === 'function'){
        return !!quest.isTargetGroup(g);
      }
    }catch(_){}
    const targets = getTargetGroups();
    if (!targets.length) return true; // ถ้า quest ไม่ระบุอะไรเลย ให้ถือว่าถูกได้ทุกหมู่
    return targets.includes(g);
  }

  // ---- scoring ----
  function emitScore(delta, good, groupHit, ev){
    score = Math.max(0, score + (delta|0));
    if (good){
      combo++; hits++;
      goodHits++;
      comboMax = Math.max(comboMax, combo);
    }else{
      combo = 0;
      misses++;
    }

    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{ delta, total:score, combo, comboMax, good }
    }));

    if (ev){
      const {x,y} = getXY(ev);
      burstAt(x,y,{ color: good ? '#22c55e' : '#ef4444' });
      scorePop(x,y,(delta>0?'+':'')+delta,{ good });
    }

    // แจ้ง quest เพิ่มเติม (ถ้ารองรับ)
    try{ quest.onPick?.(groupHit, { correct:good }); }catch(_){}
    try{ quest.onHitGroup?.(groupHit, good); }catch(_){}

    // ปรับความโหดจากความแม่น
    if (goodHits>=10 && speedLevel===0){ speedLevel=1; coach('เพิ่มหมู่เป้าหมายและความเร็วเล็กน้อย'); }
    if (goodHits>=22 && speedLevel===1){ speedLevel=2; coach('สุดยอด! เกมจะไวขึ้นอีกหน่อย'); }

    // ป้อนข้อมูลให้ quest ใช้สรุป goal / mini quest
    pushQuest();
  }

  // ---- spawn ----
  function spawnOne(){
    if (timeLeft<=0) return;

    const targets = getTargetGroups();
    const bias = targets.length>0;

    let g, emoji;

    if (bias && Math.random()<cfg.biasTarget){
      // เน้นสปอว์นหมู่เป้าหมาย
      g     = targets[(Math.random()*targets.length)|0];
      emoji = pick(GROUPS[g]);
    }else{
      // random ทั่วไป
      emoji = pick(ALL_EMOJI);
      g     = foodGroup(emoji);
    }

    const el=document.createElement('div');
    el.textContent = emoji;
    el.dataset.group = g;
    Object.assign(el.style,{
      position:'absolute',
      left:(10+Math.random()*80)+'%',
      top:(18+Math.random()*60)+'%',
      transform:'translate(-50%,-50%)',
      font:'900 48px system-ui',
      textShadow:'0 8px 20px rgba(0,0,0,.55)',
      cursor:'pointer',
      pointerEvents:'auto',
      userSelect:'none'
    });

    const life = Math.max(1200, cfg.life - speedLevel*160);
    const kill = ()=>{ if(el.parentNode) try{ host.removeChild(el); }catch(_){ } };

    el.addEventListener('click',(ev)=>{
      if(!el.parentNode) return;
      kill();

      const groupHit = Number(el.dataset.group||0);
      const target   = isTargetGroup(groupHit);

      if (target){
        emitScore(cfg.hit, true, groupHit, ev);
      }else{
        emitScore(-cfg.miss, false, groupHit, ev);
        coach('หมู่นี้ไม่ใช่เป้าหมาย ลองเลือกตามหมู่ที่ระบบกำหนดใน GOAL / MINI');
      }
    });

    host.appendChild(el);
    setTimeout(kill, life);
  }

  // ---- time / finish ----
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
    let sum = { goalsCleared:0, goalsTotal:0, miniCleared:0, miniTotal:0 };
    try{
      const s = quest.summary?.();
      if (s) sum = { ...sum, ...s };
    }catch(_){}

    const goalCleared = sum.goalsTotal ? (sum.goalsCleared >= sum.goalsTotal) : false;

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:'groups',
        difficulty:diff,
        score,
        misses,
        comboMax,
        duration:dur,
        goalCleared,
        questsCleared: sum.miniCleared || 0,
        questsTotal  : sum.miniTotal  || 0
      }
    }));
  }

  // ---- public controller ----
  return {
    start(){
      score=0; combo=0; comboMax=0; misses=0; hits=0; goodHits=0;
      timeLeft=dur; speedLevel=0;

      window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft }}));

      // เริ่ม quest ชุดแรก (สุ่ม Goal 2 จาก 10, Mini 3 จาก 15 ตามที่กำหนดใน groups.quest.js)
      try{ quest.start(getState()); }catch(_){}

      coach('เก็บอาหารให้ตรงหมู่เป้าหมายตาม GOAL / MINI ด้านขวา หนีหมู่ล่ออื่นๆ!');
      spawnTimer = setInterval(spawnOne, Math.max(320, cfg.spawn - speedLevel*60));
      tickTimer  = setInterval(tick, 1000);
    },
    stop(){ stopAll(); }
  };
}

export default { boot };

// ---- helpers ----
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function makeHost(){
  const h=document.createElement('div');
  h.id='spawnHost';
  Object.assign(h.style,{
    position:'absolute',
    inset:0,
    pointerEvents:'none',
    zIndex:650
  });
  document.body.appendChild(h);
  return h;
}