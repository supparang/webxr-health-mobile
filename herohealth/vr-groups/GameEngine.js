// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji target + Fever + Quest)
// ใช้คู่กับ difficulty.foodgroups.js + quest-manager.js + ui-fever.js

'use strict';

import { emojiImage } from './emoji-image.js';

// A-Frame global
const A = window.AFRAME;
if (!A) {
  console.error('[GroupsVR] AFRAME not found');
}

// Fever UI (จาก /vr/ui-fever.js IIFE)
const FeverUI =
  (window.GAME_MODULES && window.GAME_MODULES.FeverUI) ||
  window.FeverUI ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  };

const { ensureFeverBar, setFever, setFeverActive } = FeverUI;

// Quest Manager (จาก quest-manager.js)
const GroupsQuestManager =
  (window.GAME_MODULES && window.GAME_MODULES.GroupsQuestManager) || null;

// Difficulty table (จาก difficulty.foodgroups.js)
function pickDifficulty (diffKey) {
  const ns = window.HeroHealth || {};
  if (ns.foodGroupsDifficulty && ns.foodGroupsDifficulty.get) {
    return ns.foodGroupsDifficulty.get(diffKey);
  }
  return {
    spawnInterval: 1100,
    lifetime: 2200,
    maxActive: 4,
    scale: 1.0,
    feverGainHit: 7,
    feverLossMiss: 16,
    questTarget: 5
  };
}

// ===== Food groups / emoji pool =====
const GROUPS = {
  1: ['🍚', '🍙', '🍞', '🥯', '🥐'],                    // ข้าว-แป้ง
  2: ['🥩', '🍗', '🍖', '🥚', '🧀'],                    // โปรตีน
  3: ['🥦', '🥕', '🥬', '🌽', '🥗', '🍅'],               // ผัก
  4: ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓', '🍍'],         // ผลไม้
  5: ['🥛', '🧈', '🧀', '🍨']                            // นม/ผลิตภัณฑ์นม
};

const GOOD = Object.values(GROUPS).flat();
const BAD  = ['🍔', '🍟', '🍕', '🍩', '🍪', '🧋', '🥤', '🍫', '🍬', '🥓'];

function randomOf (arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function foodGroup (emoji) {
  for (const [g, list] of Object.entries(GROUPS)) {
    if (list.includes(emoji)) return +g;
  }
  return 0;
}

// ===== Coach helper =====
let lastCoachAt = 0;
function coach (text, minGap = 2200) {
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try {
    window.dispatchEvent(new CustomEvent('hha:coach', {
      detail: { text }
    }));
  } catch {}
}

// ===== Stat helper (ยิง event ให้ HUD / Cloud logger) =====
function emitStat (state, extra = {}) {
  const q = state.questSummary || {};
  try {
    window.dispatchEvent(new CustomEvent('hha:stat', {
      detail: {
        mode: 'Food Groups',
        difficulty: state.diff,
        score: state.score,
        combo: state.combo,
        comboMax: state.comboMax,
        misses: state.misses,
        fever: state.fever,
        feverActive: state.feverActive,
        // Quest
        goalsCleared: q.clearedGoals || 0,
        goalsTotal:   q.totalGoals   || 0,
        questsCleared: q.clearedMinis || 0,
        questsTotal:   q.totalMinis   || 0,
        ...extra
      }
    }));
  } catch {}
}

// ===== Target creation (จุดสำคัญ: ไม่ใช้ shader แปลก ๆ แล้ว) =====
function createTargetEntity (scene, spawn, onHit, onExpire) {
  if (!scene || !spawn) return null;

  const size = spawn.size || 0.7;

  // 1) สร้าง texture จาก emoji เป็น data URL
  const texUrl = emojiImage(spawn.emoji, { size: 256 });

  // 2) ใช้ <a-image> ธรรมดา ไม่ระบุ shader → A-Frame จะใช้ 'flat' ให้อัตโนมัติ
  const el = document.createElement('a-image');
  el.classList.add('groups-target');

  const x = spawn.pos.x;
  const y = spawn.pos.y;
  const z = spawn.pos.z;

  el.setAttribute('position', `${x} ${y} ${z}`);
  el.setAttribute('width',  size);
  el.setAttribute('height', size);
  el.setAttribute('src', texUrl);
  el.setAttribute('transparent', 'true');
  el.setAttribute('side', 'double');

  // ให้ cursor / raycaster ยิงโดนเฉพาะ class นี้
  // (ใน groups-vr.html ควรมี raycaster="objects: .groups-target")
  el.dataset.emoji  = spawn.emoji;
  el.dataset.isGood = spawn.isGood ? '1' : '0';
  el.dataset.groupId = String(spawn.gId || 0);

  // เอฟเฟกต์ลอยเบา ๆ
  el.setAttribute(
    'animation__float',
    `property=position; dir=alternate; dur=700; easing=easeInOutSine; loop=true; to=${x} ${y + 0.12} ${z}`
  );

  // คลิก = ยิงเป้า
  el.addEventListener('click', () => {
    onHit && onHit(spawn, el);
  });

  // ตั้งเวลาให้หมดอายุเอง ถ้าไม่ได้ยิง
  const life = spawn.lifetime || 2200;
  const timeout = setTimeout(() => {
    if (!el.parentNode) return;
    onExpire && onExpire(spawn, el);
    try {
      el.parentNode.removeChild(el);
    } catch {}
  }, life);

  // cleanup helper
  el.__groupsTimeout = timeout;

  scene.appendChild(el);
  return el;
}

// ===== main engine =====
export async function startEngine (opts = {}) {
  const scene = document.querySelector('a-scene');
  if (!scene) {
    console.error('[GroupsVR] <a-scene> not found');
    return null;
  }

  const diffKey = String(opts.diff || opts.difficulty || 'normal').toLowerCase();
  const diffCfg = pickDifficulty(diffKey);

  let duration = Number(opts.duration || opts.time || 60);
  if (!Number.isFinite(duration) || duration <= 0) duration = 60;
  if (duration < 20) duration = 20;
  if (duration > 180) duration = 180;

  // Fever UI เริ่มต้น
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);

  // Quest manager
  let quest = null;
  if (GroupsQuestManager) {
    quest = new GroupsQuestManager();
    quest.start(diffKey, { quest: { goalsPick: 2, minisPick: 3 } });
  }

  const state = {
    diff: diffKey,
    score: 0,
    combo: 0,
    comboMax: 0,
    misses: 0,
    fever: 0,
    feverActive: false,
    questSummary: quest ? quest.getSummary() : null
  };

  function refreshQuestSummary () {
    if (!quest) {
      state.questSummary = null;
      return;
    }
    state.questSummary = quest.getSummary();
  }

  function setFeverValue (v) {
    state.fever = Math.max(0, Math.min(100, v));
    setFever(state.fever);
    const active = state.fever >= 100;
    if (active !== state.feverActive) {
      state.feverActive = active;
      setFeverActive(active);
      if (active) {
        coach('โหมดพลังงานพิเศษ! เก็บอาหารดีให้ครบทุกหมู่เลย ✨', 2500);
      }
    }
  }

  function addFever (delta) {
    setFeverValue(state.fever + delta);
  }

  function loseFever (delta) {
    // เวลาพลาด / ปล่อยเป้าหลุด
    const d = state.feverActive ? delta * 1.5 : delta;
    setFeverValue(state.fever - d);
  }

  function scoreHit (spawn, isPerfect) {
    const base = spawn.isGood ? 15 : -12;
    const comboBonus = spawn.isGood ? state.combo * 2 : 0;
    const multi = state.feverActive ? 2 : 1;
    const delta = (base + comboBonus) * multi;

    if (delta > 0) {
      state.score += delta;
      state.combo += 1;
      state.comboMax = Math.max(state.comboMax, state.combo);
      addFever(diffCfg.feverGainHit || 7);
    } else {
      state.score = Math.max(0, state.score + delta);
      state.combo = 0;
      state.misses += 1;
      loseFever(diffCfg.feverLossMiss || 16);
    }

    if (quest) {
      quest.onHit({
        groupId: spawn.gId || 0,
        isGood: !!spawn.isGood
      });
      refreshQuestSummary();
    }

    // HUD / logger
    emitStat(state);
  }

  function handleHit (spawn, el) {
    // ลบ object ออกจากฉาก
    if (el && el.parentNode) {
      if (el.__groupsTimeout) clearTimeout(el.__groupsTimeout);
      try { el.parentNode.removeChild(el); } catch {}
    }

    const grp = spawn.gId || 0;
    const perfect = state.feverActive || state.combo >= 8;

    if (spawn.isGood) {
      scoreHit(spawn, perfect);
      if (perfect) coach('สุดยอด! เก็บอาหารดีแบบต่อเนื่องเลย 🎯', 2500);
    } else {
      scoreHit(spawn, false);
      coach('ลองเลี่ยงของทอดและของหวาน ดูที่อาหารหลัก 5 หมู่แทน 🍚🥦🍎🥛', 3500);
    }
  }

  function handleExpire (spawn, el) {
    if (el && el.parentNode) {
      try { el.parentNode.removeChild(el); } catch {}
    }
    // ปล่อยหลุด: ไม่ถือว่าพลาด แต่ลด fever เล็กน้อย
    loseFever(6);
    emitStat(state);
  }

  // lane ตำแหน่ง x ให้เป้าเกิด
  const LANES = [-1.2, -0.4, 0.4, 1.2];

  function makeSpawn () {
    const isGood = Math.random() < 0.7; // 70% เป็นอาหารดี
    const emoji = isGood ? randomOf(GOOD) : randomOf(BAD);
    const gId   = isGood ? foodGroup(emoji) : 0;

    const laneX = randomOf(LANES);
    const pos = { x: laneX, y: 1.5, z: -3.4 };

    return {
      emoji,
      isGood,
      gId,
      pos,
      size: diffCfg.scale || 1.0,
      lifetime: diffCfg.lifetime || 2200
    };
  }

  let ended = false;
  const active = new Set();

  function spawnLoop () {
    if (ended) return;
    // จำกัดจำนวนเป้าในฉาก ไม่ให้เยอะเกิน
    if (active.size >= (diffCfg.maxActive || 4)) return;

    const spawn = makeSpawn();
    console.log('[GroupsVR] spawn target', {
      emoji: spawn.emoji,
      isGood: spawn.isGood,
      gId: spawn.gId,
      pos: spawn.pos
    });

    const el = createTargetEntity(
      scene,
      spawn,
      (sp, entity) => {
        active.delete(entity);
        handleHit(sp, entity);
      },
      (sp, entity) => {
        active.delete(entity);
        handleExpire(sp, entity);
      }
    );

    if (el) active.add(el);
  }

  const interval = diffCfg.spawnInterval || 1100;
  const spawnTimer = setInterval(spawnLoop, interval);

  // countdown ภายใน engine เผื่อกรณีไม่มี hha:time กลาง
  const finishTimer = setTimeout(() => {
    finish();
  }, duration * 1000);

  function finish () {
    if (ended) return;
    ended = true;

    clearInterval(spawnTimer);
    clearTimeout(finishTimer);

    active.forEach((el) => {
      if (el && el.parentNode) {
        if (el.__groupsTimeout) clearTimeout(el.__groupsTimeout);
        try { el.parentNode.removeChild(el); } catch {}
      }
    });
    active.clear();

    refreshQuestSummary();
    emitStat(state, { ended: true });

    try {
      window.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          mode: 'Food Groups',
          difficulty: state.diff,
          score: state.score,
          misses: state.misses,
          comboMax: state.comboMax,
          duration,
          ...(state.questSummary || {})
        }
      }));
    } catch {}
  }

  // ถ้ามี clock กลาง hha:time (จาก groups-vr.html) ก็ใช้ร่วมด้วย
  const onTime = (e) => {
    const sec = e.detail && (e.detail.sec | 0);
    if (sec === 0) {
      finish();
      window.removeEventListener('hha:time', onTime);
    }
  };
  window.addEventListener('hha:time', onTime);

  // ยิง stat เริ่มต้นให้ HUD
  refreshQuestSummary();
  emitStat(state);

  coach('ภารกิจวันนี้: ยิงอาหารดีให้ครบ แล้วเลี่ยงอาหารควรลดนะ 💪', 0);

  // controller object สำหรับภายนอก
  return {
    stop () {
      finish();
    }
  };
}

export default { startEngine };
