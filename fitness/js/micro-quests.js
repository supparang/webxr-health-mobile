// === /fitness/js/micro-quests.js ===
// Micro-quests (mid-run) — fun + adaptive, explainable
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function makeQuest(state){
  // 6 zones (3x2) → 0..5
  const z = (Math.random()*6)|0;

  // เลือก quest ตาม phase ให้สนุกขึ้นเรื่อย ๆ
  const p = Number(state?.bossPhase)||1;

  const poolP1 = [
    { id:'perfect3',  title:'Perfect Streak', text:'ทำ PERFECT ให้ได้ 3 ครั้ง', goal:3, type:'perfect' },
    { id:'combo8',    title:'Combo',         text:'ทำคอมโบให้ถึง 8',         goal:8, type:'combo' },
    { id:'zonehit4',  title:'Zone Focus',    text:`ตีเป้าใน Zone ${z+1} ให้ได้ 4 ครั้ง`, goal:4, type:'zone', zone:z },
  ];

  const poolP2 = [
    { id:'avoidbomb', title:'No Bomb!',      text:'ห้ามโดนระเบิด 10 วิ', goal:10, type:'no_bomb_secs' },
    { id:'heal1',     title:'Recover',       text:'เก็บ Heal ให้ได้ 1 ครั้ง', goal:1, type:'heal' },
    { id:'zonehit6',  title:'Zone Focus',    text:`ตีเป้าใน Zone ${z+1} ให้ได้ 6 ครั้ง`, goal:6, type:'zone', zone:z },
  ];

  const poolP3 = [
    { id:'stormsurv', title:'Storm Survive', text:'ผ่าน Storm โดยไม่พลาด 1 ครั้ง', goal:1, type:'storm_no_miss' },
    { id:'bossface',  title:'Boss Finish',  text:'ถ้าเจอหน้า Boss ต้องตีให้โดน!', goal:1, type:'bossface' },
    { id:'perfect5',  title:'Perfect Rush', text:'ทำ PERFECT ให้ได้ 5 ครั้ง', goal:5, type:'perfect' },
  ];

  const pick = (arr)=>arr[(Math.random()*arr.length)|0];
  const q = (p===1)?pick(poolP1):(p===2)?pick(poolP2):pick(poolP3);

  return {
    ...q,
    progress: 0,
    done: false,
    startedAt: performance.now(),
    expiresAt: performance.now() + 24000, // 24s ต่อภารกิจ
    // internal helper
    _bombHitDuring: false,
    _missDuringStorm: false,
  };
}

export function questOnEvent(q, ev){
  if (!q || q.done) return q;

  const now = performance.now();
  if (now >= q.expiresAt) {
    // หมดเวลา → reset progress แต่ยังไม่ fail
    q.progress = 0;
    q.startedAt = now;
    q.expiresAt = now + 24000;
    q._bombHitDuring = false;
    q._missDuringStorm = false;
  }

  // ev: { type, grade, targetType, zoneId, comboAfter, isBossFace, inStorm, miss, bombHit }
  const type = ev?.type || '';
  const tt = ev?.targetType || '';
  const grade = ev?.grade || '';

  if (q.type === 'perfect') {
    if (type === 'hit' && grade === 'perfect') q.progress++;
  }
  else if (q.type === 'combo') {
    if (type === 'hit') q.progress = Math.max(q.progress, Number(ev.comboAfter||0));
  }
  else if (q.type === 'zone') {
    if (type === 'hit' && Number(ev.zoneId) === Number(q.zone)) q.progress++;
  }
  else if (q.type === 'heal') {
    if (type === 'hit' && tt === 'heal') q.progress++;
  }
  else if (q.type === 'bossface') {
    if (type === 'hit' && ev.isBossFace) q.progress++;
  }
  else if (q.type === 'no_bomb_secs') {
    // นับเวลาที่ “ยังไม่โดนระเบิด”
    if (type === 'hit' && (tt === 'bomb' || tt === 'decoy') && ev.bombHit) {
      q._bombHitDuring = true;
      q.progress = 0;
      q.startedAt = now;
      return q;
    }
    if (!q._bombHitDuring) {
      q.progress = Math.min(q.goal, (now - q.startedAt)/1000);
    }
  }
  else if (q.type === 'storm_no_miss') {
    // ถ้าอยู่ใน storm แล้ว miss → fail รอบนั้น
    if (ev.inStorm && type === 'timeout' && ev.miss) {
      q._missDuringStorm = true;
      q.progress = 0;
      return q;
    }
    // ถ้า storm จบและไม่มี miss ระหว่าง storm → done
    if (!ev.inStorm && ev.stormEnded && !q._missDuringStorm) {
      q.progress = 1;
    }
  }

  if (q.progress >= q.goal) q.done = true;
  return q;
}