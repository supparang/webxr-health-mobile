// === /HeroHealth/modes/groups.safe.js (2025-11-14 QUEST + FX + DYNAMIC FOCUS) ===
// เลือกอาหารให้ตรง "หมู่เป้าหมาย" ตามระดับความยาก + ผูกกับ quest-director
// ใช้ร่วมกับ: /HeroHealth/modes/groups.quest.js และ /HeroHealth/vr/particles.js

import { createGroupsQuest } from './groups.quest.js';
import { burstAt, scorePop } from '../vr/particles.js';

// ---------- กลุ่มอาหาร 5 หมู่ ----------

const GROUPS = {
  1: ['🍚','🍙','🍞','🥐','🥖','🥯'],                         // ข้าว-แป้ง
  2: ['🥩','🍗','🍖','🥚','🧀','🥓'],                         // เนื้อ-โปรตีน
  3: ['🥦','🥕','🍅','🥬','🌽','🥗'],                         // ผัก
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],                    // ผลไม้
  5: ['🥛','🧈','🧀','🍨','🍦','🥛']                          // นม/นมเปรี้ยว
};

const ALL_EMOJI = Object.values(GROUPS).flat();

function foodGroup(emo){
  for (const [g, list] of Object.entries(GROUPS)){
    if (list.includes(emo)) return Number(g);
  }
  return 0;
}

// ---------- ระดับความยาก (spawn + อายุเป้า + focusGroups สูงสุด) ----------

const diffCfg = {
  easy: {
    spawnMs: 950,
    lifeMs : 2200,
    focusGroupsMax: 1,
    baseScore: 120,
    badPenalty: -90
  },
  normal: {
    spawnMs: 800,
    lifeMs : 2000,
    focusGroupsMax: 2,
    baseScore: 130,
    badPenalty: -110
  },
  hard: {
    spawnMs: 650,
    lifeMs : 1800,
    focusGroupsMax: 3,
    baseScore: 140,
    badPenalty: -130
  }
};

// ---------- CSS ของเกมนี้ ----------

function ensureCSS(){
  const id = 'hha-groups-css';
  if (document.getElementById(id)) return;
  const css = document.createElement('style');
  css.id = id;
  css.textContent = `
    #spawnHost.groups-host{
      position:absolute;
      inset:0;
      pointer-events:none;
      z-index:650;
    }
    .grp-target{
      position:absolute;
      transform:translate(-50%,-50%);
      font:900 46px system-ui;
      text-shadow:0 6px 18px rgba(0,0,0,.55);
      cursor:pointer;
      pointer-events:auto;
      user-select:none;
      -webkit-user-select:none;
      touch-action:manipulation;
      transition:transform .08s ease, opacity .12s ease;
      will-change:transform,opacity;
    }
    .grp-target.hit{
      opacity:0;
      transform:translate(-50%,-50%) scale(.75);
    }
  `;
  document.head.appendChild(css);
}

// ----------
function randomFrom(arr){ return arr[(Math.random()*arr.length)|0]; }

function pickGroups(n){
  const all = [1,2,3,4,5];
  const out = [];
  while (out.length < n && all.length){
    const i = (Math.random()*all.length)|0;
    out.push(all.splice(i,1)[0]);
  }
  return out;
}

function makeHost(){
  const h = document.createElement('div');
  h.id = 'spawnHost';
  Object.assign(h.style,{
    position:'absolute',
    inset:0,
    pointerEvents:'none',
    zIndex:650
  });
  document.body.appendChild(h);
  return h;
}

// ======================================================================
//                           main boot()
// ======================================================================

export async function boot(opts = {}) {
  const diff = (opts.difficulty || 'normal').toLowerCase();
  const cfg  = diffCfg[diff] || diffCfg.normal;
  const dur  = (opts.duration|0) || 60;

  ensureCSS();

  const host = document.getElementById('spawnHost') || makeHost();
  host.classList.add('groups-host');
  host.innerHTML = '';

  // ---------- quest-director ----------
  // ใช้ร่วมกับ /HeroHealth/modes/groups.quest.js
  const quest = createGroupsQuest(diff);

  // ---------- state หลัก ----------
  let score    = 0;
  let combo    = 0;
  let comboMax = 0;
  let misses   = 0;
  let hits     = 0;
  let timeLeft = dur;

  let spawnTimer = null;
  let tickTimer  = null;

  // กลุ่มที่เป็น "หมู่เป้าหมาย" (เริ่มด้วย 1 หมู่ แล้วขยับขึ้น)
  let focusLevel     = 1;
  let activeGroups   = pickGroups(focusLevel);
  const hitsByGroup  = {1:0,2:0,3:0,4:0,5:0};

  // ---------- helper ส่งสถิติให้ quest-director ----------

  function questUpdate(){
    quest.update({
      score,
      combo,
      comboMax,
      misses,
      hits,
      timeLeft,
      activeGroups: activeGroups.slice(),
      hitsByGroup: {...hitsByGroup}
    });
  }

  function questStart(){
    quest.start({
      timeLeft,
      activeGroups: activeGroups.slice(),
      hitsByGroup: {...hitsByGroup}
    });
    questUpdate();
  }

  function questFinish(){
    const sum = quest.summary();
    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode       : 'groups',
        difficulty : diff,
        score,
        misses,
        comboMax,
        duration   : dur,
        goalCleared   : (sum.goalsCleared >= sum.goalsTotal),
        questsCleared : sum.miniCleared,
        questsTotal   : sum.miniTotal
      }
    }));
  }

  // ---------- COACH ----------
  function coach(text){
    if (!text) return;
    window.dispatchEvent(new CustomEvent('hha:coach',{ detail:{ text } }));
  }

  // ---------- SCORE / COMBO / MISS ----------

  function emitScore(delta, good, ev, groupHit, isTarget){
    score = Math.max(0, score + (delta|0));

    if (good){
      combo++;
      hits++;
      comboMax = Math.max(comboMax, combo);
      if (groupHit) {
        hitsByGroup[groupHit] = (hitsByGroup[groupHit]||0) + 1;
      }
    } else {
      combo = 0;
      misses++;
    }

    window.dispatchEvent(new CustomEvent('hha:score',{
      detail:{
        delta,
        total:score,
        combo,
        comboMax,
        good
      }
    }));
    window.dispatchEvent(new CustomEvent('hha:combo',{
      detail:{ combo, comboMax }
    }));

    // FX ตรงจุดคลิก
    if (ev){
      const x = ev.clientX, y = ev.clientY;
      burstAt(x,y,{ color: good ? '#22c55e' : '#f97316' });
      scorePop(x,y, (delta>0?'+':'')+delta, { good });
    }

    // ขยับระดับความโหด (เพิ่มจำนวนหมู่ที่ต้องโฟกัส)
    const totalTargetHits = activeGroups.reduce((sum,g)=>sum + (hitsByGroup[g]||0),0);

    const halfTarget = Math.round((dur * 0.4)); // heuristic: เอาเวลา/ผลงานมาเป็นตัวช่วย (ไม่สำคัญมาก)
    if (totalTargetHits >= 6 && focusLevel===1 && cfg.focusGroupsMax>=2){
      focusLevel = 2;
      activeGroups = pickGroups(2);
      coach('เก่งมาก! เพิ่มหมู่เป้าหมายเป็น 2 หมู่แล้ว');
      questUpdate();
    }else if (totalTargetHits >= 14 && focusLevel===2 && cfg.focusGroupsMax>=3){
      focusLevel = 3;
      activeGroups = pickGroups(3);
      coach('สุดยอด! ตอนนี้ต้องโฟกัสพร้อมกัน 3 หมู่!');
      questUpdate();
    }

    questUpdate();
  }

  function onExpire(isTarget){
    // หมดเวลา: นับเป็น miss เฉพาะกรณี "เป็นหมู่เป้าหมาย" → เด็กไม่เก็บเป้าหมาย
    if (isTarget){
      misses++;
      combo = 0;
      window.dispatchEvent(new CustomEvent('hha:score',{
        detail:{ delta:0, total:score, combo, comboMax, good:false }
      }));
      window.dispatchEvent(new CustomEvent('hha:combo',{
        detail:{ combo, comboMax }
      }));
      questUpdate();
    }
  }

  // ---------- SPAWN TARGET ----------

  function spawnOne(){
    if (timeLeft <= 0) return;

    const vw = window.innerWidth  || 1024;
    const vh = window.innerHeight || 768;

    const targetBias = 0.72; // 70%+ เป็นหมู่เป้าหมาย
    let emoji, g;
    if (Math.random() < targetBias){
      const tg = activeGroups[(Math.random()*activeGroups.length)|0];
      emoji = randomFrom(GROUPS[tg]);
      g = tg;
    }else{
      emoji = randomFrom(ALL_EMOJI);
      g = foodGroup(emoji);
    }

    const el = document.createElement('div');
    el.className = 'grp-target';
    el.textContent = emoji;
    el.dataset.group = String(g || 0);

    const px = 0.12 + Math.random()*0.76;
    const py = 0.20 + Math.random()*0.65;
    el.style.left = (px * vw) + 'px';
    el.style.top  = (py * vh) + 'px';

    const isTarget = activeGroups.includes(g);

    const life = cfg.lifeMs + (Math.random()*220 - 110);
    const kill = ()=>{
      if (el.parentNode){
        try{ host.removeChild(el); }catch(_){}
      }
    };

    const lifeTimer = setTimeout(()=>{
      if (!el.parentNode) return;
      kill();
      onExpire(isTarget);
    }, life);

    el.addEventListener('click',(ev)=>{
      if (!el.parentNode) return;
      clearTimeout(lifeTimer);
      el.classList.add('hit');
      setTimeout(kill, 100);

      const groupHit = Number(el.dataset.group || 0);
      const hitIsTarget = activeGroups.includes(groupHit);

      if (hitIsTarget){
        const base  = cfg.baseScore;
        const bonus = combo * 8; // ให้คอมโบมีผล
        const delta = base + bonus;
        emitScore(delta, true, ev, groupHit, true);

        if (combo === 5 || combo === 10){
          coach(`คอมโบต่อเนื่อง ${combo} ครั้ง เยี่ยมมาก!`);
        }
      }else{
        const delta = cfg.badPenalty;
        emitScore(delta, false, ev, groupHit, false);
        coach('ระวังของล่อที่ไม่ใช่หมู่เป้าหมาย!');
      }
    });

    host.appendChild(el);
  }

  // ---------- TIMER ----------

  function tick(){
    timeLeft--;
    window.dispatchEvent(new CustomEvent('hha:time',{ detail:{ sec: timeLeft } }));
    questUpdate();

    if (timeLeft <= 0){
      stopAll();
      questFinish();
    }
  }

  function stopAll(){
    if (spawnTimer){ clearInterval(spawnTimer); spawnTimer=null; }
    if (tickTimer){  clearInterval(tickTimer);  tickTimer=null;  }
  }

  // ---------- public controller ----------

  return {
    start(){
      // reset state ทุกครั้งที่เริ่ม
      score=0;combo=0;comboMax=0;misses=0;hits=0;timeLeft=dur;
      for (let g=1; g<=5; g++) hitsByGroup[g]=0;
      focusLevel = 1;
      activeGroups = pickGroups(1);

      window.dispatchEvent(new CustomEvent('hha:score',{
        detail:{ delta:0, total:0, combo:0, comboMax:0, good:true }
      }));
      window.dispatchEvent(new CustomEvent('hha:combo',{
        detail:{ combo:0, comboMax:0 }
      }));
      window.dispatchEvent(new CustomEvent('hha:time',{
        detail:{ sec: timeLeft }
      }));

      coach('เลือกเฉพาะอาหารในหมู่เป้าหมายที่กำหนดให้บน HUD นะ!');

      questStart();

      spawnTimer = setInterval(spawnOne, cfg.spawnMs);
      tickTimer  = setInterval(tick, 1000);
    },
    stop(){
      stopAll();
    }
  };
}

export default { boot };
