// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration VR — Water Zone + Goals 2 + MiniQuest 3 + Coach + FX + Fever + Shield
// 2025-12-07 Fully Integrated Version

'use strict';

// ----- Imports -----
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// GLOBAL modules (non-module <script src>)
const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// Particles FX
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){} };

// Fever UI
const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar(){},
    setFever(){},
    setFeverActive(){},
    setShield(){}
  };

const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

// Quest system
import * as HQ from './hydration.quest.js';

// Emoji pools
const GOOD = ['💧','🥛','🍉'];
const BAD  = ['🥤','🧋','🍺','☕️'];

const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const BONUS  = [STAR, DIA, SHIELD, FIRE];

// ----- safe wrappers -----
function scoreFX(x, y, label, good=true) {
  try {
    Particles.scorePop(x, y, label, { good });
    Particles.burstAt(x, y, {
      color: good ? '#22c55e' : '#f97316',
      count: good ? 14 : 10,
      radius: 60
    });
  } catch {}
}

function coach(text, gap=2200) {
  if (!text) return;
  const now = Date.now();
  if (now - coach._last < gap) return;
  coach._last = now;
  window.dispatchEvent(new CustomEvent('hha:coach', { detail:{ text }}));
}
coach._last = 0;

// ------------------------------------------
// GET QUEST FACTORY
// ------------------------------------------
function getCreateHydrationQuest(){
  if (typeof HQ.createHydrationQuest === 'function') return HQ.createHydrationQuest;
  if (HQ.default && typeof HQ.default.createHydrationQuest === 'function')
    return HQ.default.createHydrationQuest;
  throw new Error('createHydrationQuest not found');
}

// ------------------------------------------
// MAIN BOOT
// ------------------------------------------
export async function boot(cfg={}) {

  // ----- Difficulty -----
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = ['easy','normal','hard'].includes(diffRaw) ? diffRaw : 'normal';

  // ----- Duration -----
  let dur = Number(cfg.duration || 60);
  if (!isFinite(dur) || dur <= 0) dur = 60;
  dur = Math.min(180, Math.max(20, dur));

  // ----- HUD FEVER -----
  ensureFeverBar();
  setFever(0);
  setFeverActive(false);
  setShield(0);

  // ----- Water gauge -----
  ensureWaterGauge();
  let waterPct = 50;
  let { zone:waterZone } = setWaterGauge(waterPct);
  const waterStart = waterPct;

  // ----- Quest Deck -----
  const createDeck = getCreateHydrationQuest();
  const deck = createDeck(diff);

  // First draw: 2 goals + 3 mini
  deck.drawGoals(2);
  deck.draw3();

  // Track cleared
  let accGoalDone = 0;
  let accMiniDone = 0;

  // ------------------------------------------
  // PUSH QUEST TO HUD
  // ------------------------------------------
  function pushQuest(hint) {
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail:{
        goals,
        minis,
        hint: hint || `Hydration zone: ${waterZone}`
      }
    }));
  }

  // ----- SCORE + COMBO -----
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let fever = 0;
  let feverActive = false;
  let shield = 0;

  function mult(){ return feverActive ? 2 : 1; }

  function applyFever() {
    setFever(fever);
    setFeverActive(feverActive);
    setShield(shield);
  }

  function gainF(n){
    fever = Math.min(100, Math.max(0, fever + n));
    if (!feverActive && fever >= 100){
      feverActive = true;
      coach('🔥 FEVER MODE!');
    }
    applyFever();
  }

  function decayF(n){
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    if (feverActive && fever <= 0){
      feverActive = false;
    }
    applyFever();
  }

  function addWater(n){
    waterPct = Math.min(100, Math.max(0, waterPct + n));
    const r = setWaterGauge(waterPct);
    waterZone = r.zone;
    deck.stats.zone = waterZone;
  }

  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
  }

  // ------------------------------------------
  // HUD STAT UPDATE
  // ------------------------------------------
  function pushHud(extra={}){
    window.dispatchEvent(new CustomEvent('hha:score', {
      detail:{
        mode:'Hydration',
        difficulty: diff,
        score,
        combo,
        comboMax,
        misses,
        waterPct,
        waterZone,
        ...extra
      }
    }));
  }

  // ------------------------------------------
  // JUDGE
  // ------------------------------------------
  function judge(ch, ctx){
    const x = ctx?.clientX ?? ctx?.cx ?? 0;
    const y = ctx?.clientY ?? ctx?.cy ?? 0;

    // ----- Bonus -----
    if (ch === STAR){
      const d = 40*mult();
      score += d;
      gainF(10);
      combo++; comboMax = Math.max(combo, comboMax);
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x,y,'GOOD',true);
      pushHud();
      return {good:true,scoreDelta:d};
    }
    if (ch === DIA){
      const d = 80*mult();
      score += d;
      gainF(30);
      combo++; comboMax = Math.max(combo, comboMax);
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x,y,'PERFECT',true);
      pushHud();
      return {good:true,scoreDelta:d};
    }
    if (ch === SHIELD){
      shield = Math.min(3, shield+1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x,y,'GOOD',true);
      pushHud();
      return {good:true,scoreDelta:d};
    }
    if (ch === FIRE){
      feverActive = true;
      fever = Math.max(60, fever);
      applyFever();
      score += 25;
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x,y,'FEVER',true);
      pushHud();
      return {good:true,scoreDelta:25};
    }

    // ----- Normal GOOD / BAD -----
    if (GOOD.includes(ch)){
      addWater(+8);
      const d = (14 + combo*2) * mult();
      score += d;
      combo++; comboMax = Math.max(combo, comboMax);
      gainF(6 + combo*0.4);
      deck.onGood();
      syncDeck(); pushQuest();
      scoreFX(x,y, combo>=8?'PERFECT':'GOOD', true);
      pushHud();
      return {good:true,scoreDelta:d};
    } else {
      // BAD
      if (shield > 0){
        shield--;
        setShield(shield);
        decayF(6);
        deck.onGood(); // block = not MISS
        syncDeck(); pushQuest();
        scoreFX(x,y,'BLOCK',false);
        pushHud();
        return {good:false,scoreDelta:0};
      }

      // MISS
      misses++;
      combo = 0;
      addWater(-8);
      decayF(14);
      score = Math.max(0, score - 10);
      deck.onJunk();
      syncDeck(); pushQuest();
      scoreFX(x,y,'MISS',false);
      pushHud();
      return {good:false,scoreDelta:-10};
    }
  }

  // ------------------------------------------
  // EXPIRE
  // ------------------------------------------
  function onExpire(ev){
    if (!ev || ev.isGood) return;

    // expire BAD but not counted as MISS
    decayF(4);
    deck.onJunk();
    syncDeck();
    pushQuest();
    pushHud({reason:'expire'});
  }

  // ------------------------------------------
  // COUNTDOWN BEFORE GAME START
  // ------------------------------------------
  async function countdown(){
    const seq = ['3','2','1','GO!'];
    for (const s of seq){
      window.dispatchEvent(new CustomEvent('hha:countdown', {detail:{text:s}}));
      await new Promise(r => setTimeout(r, 800));
    }
  }
  await countdown();

  // ------------------------------------------
  // ON SEC
  // ------------------------------------------
  let elapsedSec = 0;

  function onSec(){
    elapsedSec++;

    const z = zoneFrom(waterPct);
    if (z==='GREEN') decayF(2);
    else decayF(6);

    if (z==='HIGH') addWater(-4);
    else if (z==='LOW') addWater(+4);
    else addWater(-1);

    deck.second();
    syncDeck();

    const g = deck.getProgress('goals');
    const m = deck.getProgress('mini');

    if (g.length && g.every(x=>x.done)){
      accGoalDone += g.length;
      deck.drawGoals(2);
      coach('🎯 Goal ใหม่!');
      pushQuest();
    }
    if (m.length && m.every(x=>x.done)){
      accMiniDone += m.length;
      deck.draw3();
      coach('✨ Mini quest ใหม่!');
      pushQuest();
    }

    pushHud();
  }

  // ------------------------------------------
  // END GAME
  // ------------------------------------------
  let ended = false;
  function finish(){
    if (ended) return;
    ended = true;

    const g = deck.getProgress('goals');
    const m = deck.getProgress('mini');

    const goalsTotal = accGoalDone + g.length;
    const goalsDone  = accGoalDone + g.filter(x=>x.done).length;

    const miniTotal  = accMiniDone + m.length;
    const miniDone   = accMiniDone + m.filter(x=>x.done).length;

    window.dispatchEvent(new CustomEvent('hha:end',{
      detail:{
        mode:'Hydration',
        difficulty:diff,
        score,
        comboMax,
        misses,
        duration: dur,
        waterStart,
        waterEnd: waterPct,
        waterZoneEnd: waterZone,
        goalsDone,
        goalsTotal,
        miniDone,
        miniTotal
      }
    }));

    pushHud({ended:true});
  }

  // ------------------------------------------
  // GLOBAL CLOCK
  // ------------------------------------------
  function onTime(e){
    const sec = e.detail?.sec ?? 0;
    if (sec > 0) onSec();
    if (sec === 0){
      finish();
      window.removeEventListener('hha:time', onTime);
    }
  }
  window.addEventListener('hha:time', onTime);

  // ------------------------------------------
  // BOOT ENGINE
  // ------------------------------------------
  const inst = await factoryBoot({
    difficulty:diff,
    duration:dur,
    pools:{ good:[...GOOD,...BONUS], bad:[...BAD] },
    goodRate:0.60,
    powerups:BONUS,
    powerRate:0.10,
    powerEvery:7,
    spawnStyle:'pop',
    judge:(ch,ctx)=>judge(ch,ctx),
    onExpire
  });

  // Start HUD+Quest
  pushHud();
  pushQuest('เริ่มภารกิจน้ำ 💧');

  return inst;
}

export default { boot };