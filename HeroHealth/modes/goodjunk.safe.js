// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 COACH + DYNAMIC + QUEST) ===
// โหมด Good vs Junk + Goal / Mini Quest + โค้ชใต้ Fever bar
// ใช้ร่วมกับ: vr/mode-factory.js, vr/mission.js, vr/ui-fever.js, vr/particles.js

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

// ---- โค้ชใต้ Fever Bar -----------------------------------------------------
function ensureCoachSlot() {
  const dock = document.getElementById('feverBarDock');
  if (!dock) return null;

  let wrap = document.getElementById('hhaCoachWrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'hhaCoachWrap';
    wrap.style.marginTop = '6px';
    wrap.style.font = '800 12px system-ui';
    wrap.style.color = '#e5e7eb';
    wrap.style.display = 'flex';
    wrap.style.justifyContent = 'space-between';
    wrap.style.alignItems = 'center';
    wrap.innerHTML = `
      <span id="coachText">โฟกัสของดีให้ทันนะ!</span>
      <span id="coachTier" style="font-size:11px;opacity:.8">Tier 1</span>
    `;
    dock.appendChild(wrap);
  }
  return wrap;
}

function coachSay(text, tierLabel) {
  const wrap = ensureCoachSlot();
  if (!wrap) return;
  const t = wrap.querySelector('#coachText');
  const tl = wrap.querySelector('#coachTier');
  if (t && text) t.textContent = text;
  if (tl && tierLabel) tl.textContent = tierLabel;
}

// ---- โหมดหลัก --------------------------------------------------------------
export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // พูลอีโมจิ
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
                '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
  const STAR   = '⭐';
  const DIA    = '💎';
  const SHIELD = '🛡️';
  const FIRE   = '🔥';
  const BONUS  = [STAR, DIA, SHIELD, FIRE];

  // HUD เริ่มต้น
  ensureFeverBar();
  setFever(0);
  setShield(0);
  coachSay('เริ่มจากเลือกของดีให้ติดกันหลาย ๆ ชิ้น!','Tier 1');

  // ---------- GOAL และ MINI QUEST ----------
  const G = {
    good     : s => s.goodCount | 0,
    junk     : s => s.junkMiss  | 0,
    score    : s => s.score     | 0,
    comboMax : s => s.comboMax  | 0,
    tick     : s => s.tick      | 0
  };

  // เป้าหมายหลัก 10 ข้อ (สุ่มมา 5)
  const GOAL_POOL = [
    { id:'g_good20',   label:'เก็บของดีให้ได้ 20 ชิ้น', level:'easy',
      target:20,   check:s=>G.good(s)>=20,   prog:s=>Math.min(20, G.good(s)) },
    { id:'g_good28',   label:'เก็บของดีให้ได้ 28 ชิ้น', level:'normal',
      target:28,   check:s=>G.good(s)>=28,   prog:s=>Math.min(28, G.good(s)) },
    { id:'g_good34',   label:'เก็บของดีให้ได้ 34 ชิ้น', level:'hard',
      target:34,   check:s=>G.good(s)>=34,   prog:s=>Math.min(34, G.good(s)) },
    { id:'g_score800', label:'ทำคะแนนรวม 800+',          level:'easy',
      target:800,  check:s=>G.score(s)>=800, prog:s=>Math.min(800, G.score(s)) },
    { id:'g_score1500',label:'ทำคะแนนรวม 1500+',         level:'normal',
      target:1500, check:s=>G.score(s)>=1500,prog:s=>Math.min(1500, G.score(s)) },
    { id:'g_score2200',label:'ทำคะแนนรวม 2200+',         level:'hard',
      target:2200, check:s=>G.score(s)>=2200,prog:s=>Math.min(2200, G.score(s)) },
    { id:'g_combo16',  label:'คอมโบสูงสุด ≥ 16',         level:'normal',
      target:16,   check:s=>G.comboMax(s)>=16,prog:s=>Math.min(16, G.comboMax(s)) },
    { id:'g_combo24',  label:'คอมโบสูงสุด ≥ 24',         level:'hard',
      target:24,   check:s=>G.comboMax(s)>=24,prog:s=>Math.min(24, G.comboMax(s)) },
    { id:'g_time30',   label:'อยู่รอดเกิน 30 วินาที',    level:'easy',
      target:30,   check:s=>G.tick(s)>=30,    prog:s=>Math.min(30, G.tick(s)) },
    { id:'g_nojunk6',  label:'พลาด (โดนของเสีย) ≤ 6',    level:'normal',
      target:0,    check:s=>G.junk(s)<=6,     prog:s=>Math.max(0, 6-G.junk(s)) }
  ];

  // Mini quest 10 ข้อ (สุ่มมา 3)
  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',       level:'normal',
      target:12,  check:s=>G.comboMax(s)>=12, prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',  label:'คอมโบต่อเนื่อง 18',       level:'hard',
      target:18,  check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'m_score600', label:'ทำคะแนนรวม 600+',         level:'easy',
      target:600, check:s=>G.score(s)>=600,   prog:s=>Math.min(600,G.score(s)) },
    { id:'m_score1200',label:'ทำคะแนนรวม 1200+',        level:'normal',
      target:1200,check:s=>G.score(s)>=1200,  prog:s=>Math.min(1200,G.score(s)) },
    { id:'m_good10',   label:'เก็บของดี 10 ชิ้น',        level:'easy',
      target:10,  check:s=>G.good(s)>=10,     prog:s=>Math.min(10,G.good(s)) },
    { id:'m_good18',   label:'เก็บของดี 18 ชิ้น',        level:'normal',
      target:18,  check:s=>G.good(s)>=18,     prog:s=>Math.min(18,G.good(s)) },
    { id:'m_nomiss12', label:'ไม่พลาด 12 วินาที (รักษาคอมโบไว้)', level:'normal',
      target:12,  check:s=>G.tick(s)>=12 && s.combo>0,
      prog:s=>Math.min(12, G.tick(s)) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',             level:'hard',
      target:2,   check:s=>s.star>=2,         prog:s=>Math.min(2, s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',            level:'hard',
      target:1,   check:s=>s.diamond>=1,      prog:s=>Math.min(1, s.diamond|0) },
    { id:'m_under6',   label:'พลาดไม่เกิน 6 ครั้ง',       level:'normal',
      // ผ่านได้ถ้า junkMiss ≤ 6 (ถ้าเลย 6 แล้วถือว่าไม่ผ่าน)
      target:0,   check:s=>G.junk(s)<=6,      prog:s=>Math.max(0, 6-G.junk(s)) },
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  function pushQuest(hint) {
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g => !g.done) || goals[0] || null;
    const focusMini = minis.find(m => !m.done) || minis[0] || null;

    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // ---------- สถานะภายในโหมด ----------
  let score = 0;
  let combo = 0;
  let shield = 0;
  let fever = 0;
  let feverActive = false;
  let star = 0;
  let diamond = 0;

  let tier = 1; // 1 = ง่าย, 2 = ปกติ, 3 = โหด
  let lastCoachTick = 0;

  function mult() { return feverActive ? 2 : 1; }

  function gainFever(n) {
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever >= 100) {
      feverActive = true;
      setFeverActive(true);
    }
  }

  function decayFever(base) {
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever <= 0) {
      feverActive = false;
      setFeverActive(false);
    }
  }

  function syncDeck() {
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  // ประเมิน Tier ตามฝีมือ
  function recomputeTier() {
    const s = deck.stats;
    const totalHits = s.goodCount + s.junkMiss;
    const acc = totalHits > 0 ? s.goodCount / totalHits : 0;
    let newTier = 1;

    if (acc >= 0.82 && s.comboMax >= 18) newTier = 3;
    else if (acc >= 0.65 && s.comboMax >= 8) newTier = 2;
    else newTier = 1;

    if (newTier !== tier) {
      tier = newTier;
      const label = tier === 1 ? 'Tier 1' : (tier === 2 ? 'Tier 2' : 'Tier 3');
      let msg = '';
      if (tier === 1) msg = 'อุ่นเครื่องก่อน เก็บของดีเรื่อย ๆ ให้ติดมือ';
      else if (tier === 2) msg = 'เยี่ยม! ลองเร่งคอมโบให้ไม่หลุดดูนะ';
      else msg = 'โหดมาก! รักษาคอมโบยาว ๆ แล้วลุยเป้าใหญ่ให้ครบ';

      coachSay(msg, label);

      // เผื่อมีระบบ Toast ใน HUD
      try {
        window.dispatchEvent(new CustomEvent('hha:toast', {
          detail: { text: `ระดับความท้าทาย ${label}`, level: 'info' }
        }));
      } catch(_) {}
    }
  }

  // ---------- การตัดสินเมื่อคลิก ----------
  function judge(ch, ctx) {
    const x = ctx.clientX || ctx.cx || 0;
    const y = ctx.clientY || ctx.cy || 0;

    // Power-ups -------------------------------------------------
    if (ch === STAR) {
      const d = 40 * mult();
      score += d;
      gainFever(10);
      star++;
      deck.onGood();
      syncDeck();
      if (Particles?.burstShards) Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
      if (Particles?.scorePop)   Particles.scorePop(x,y,`+${d}`,true);
      pushQuest();
      recomputeTier();
      return { good:true, scoreDelta:d, combo, comboMax: deck.stats.comboMax };
    }

    if (ch === DIA) {
      const d = 80 * mult();
      score += d;
      gainFever(30);
      diamond++;
      deck.onGood();
      syncDeck();
      if (Particles?.burstShards) Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});
      if (Particles?.scorePop)    Particles.scorePop(x,y,`+${d}`,true);
      pushQuest();
      recomputeTier();
      return { good:true, scoreDelta:d, combo, comboMax: deck.stats.comboMax };
    }

    if (ch === SHIELD) {
      shield = Math.min(3, shield+1);
      setShield(shield);
      const d = 20;
      score += d;
      deck.onGood();
      syncDeck();
      if (Particles?.burstShards) Particles.burstShards(null,null,{screen:{x,y},theme:'hydration'});
      if (Particles?.scorePop)    Particles.scorePop(x,y,`+${d}`,true);
      pushQuest();
      recomputeTier();
      return { good:true, scoreDelta:d, combo, comboMax: deck.stats.comboMax };
    }

    if (ch === FIRE) {
      feverActive = true;
      setFeverActive(true);
      fever = Math.max(fever, 60);
      setFever(fever);
      const d = 25;
      score += d;
      deck.onGood();
      syncDeck();
      if (Particles?.burstShards) Particles.burstShards(null,null,{screen:{x,y},theme:'plate'});
      if (Particles?.scorePop)    Particles.scorePop(x,y,`+${d}`,true);
      pushQuest();
      recomputeTier();
      return { good:true, scoreDelta:d, combo, comboMax: deck.stats.comboMax };
    }

    // ของดี / ของเสีย -------------------------------------------
    const isGood = GOOD.includes(ch);
    if (isGood) {
      // ปรับคะแนนตาม Tier → ยิ่ง Tier สูงเลือดก็ไหลแรง
      const tierBonus = tier === 1 ? 0 : (tier === 2 ? 4 : 8);
      const base  = 16 + combo*2 + tierBonus;
      const delta = base * mult();

      score  += delta;
      combo  += 1;
      gainFever(7 + combo*0.5);

      deck.onGood();
      syncDeck();

      if (Particles?.burstShards) Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
      if (Particles?.scorePop)    Particles.scorePop(x,y,`+${delta}`,true);

      pushQuest();
      recomputeTier();

      return { good:true, scoreDelta:delta, combo, comboMax: deck.stats.comboMax };
    } else {
      // โดนของเสีย
      if (shield > 0) {
        shield -= 1;
        setShield(shield);
        deck.onJunk(); // นับว่าโดน แต่ไม่ลดคะแนน
        syncDeck();
        if (Particles?.burstShards) Particles.burstShards(null,null,{screen:{x,y},theme:'goodjunk'});
        if (Particles?.scorePop)    Particles.scorePop(x,y,'0',false);
        pushQuest();
        recomputeTier();
        // combo ถูกรีเซ็ตใน deck.onJunk() แล้ว แต่อัปเดต local ด้วย
        combo = 0;
        return { good:false, scoreDelta:0, combo, comboMax: deck.stats.comboMax };
      }

      const delta = -12;
      score = Math.max(0, score + delta);
      combo = 0;
      decayFever(16);

      deck.onJunk();
      syncDeck();

      if (Particles?.burstShards) Particles.burstShards(null,null,{screen:{x,y},theme:'groups'});
      if (Particles?.scorePop)    Particles.scorePop(x,y,`${delta}`,false);

      pushQuest();
      recomputeTier();

      return { good:false, scoreDelta:delta, combo, comboMax: deck.stats.comboMax };
    }
  }

  // เมื่อเป้าหมายหมดอายุ (หลบของเสียทัน)
  function onExpire(ev) {
    if (!ev || ev.isGood) return;
    // เลี่ยงของเสียได้ → นับเป็น junk-avoid
    gainFever(4);
    deck.onJunk();            // นับเป็น “เหตุการณ์ของเสีย” เพื่อ Mini บางอัน
    syncDeck();
    pushQuest();
    recomputeTier();
  }

  // เดินเวลาทุกวินาที (เชื่อมกับ hha:time)
  function onSec() {
    if (combo <= 0) decayFever(6);
    else decayFever(2);

    deck.second();
    syncDeck();
    pushQuest();

    // เติม Quest ใหม่เมื่อเคลียร์ครบ
    if (deck.isCleared('mini'))  { deck.draw3();       pushQuest('Mini ใหม่'); }
    if (deck.isCleared('goals')) { deck.drawGoals(5);  pushQuest('Goal ใหม่'); }

    // อย่า spam โค้ชทุกวินาที
    lastCoachTick++;
    if (lastCoachTick >= 3) {
      lastCoachTick = 0;
      recomputeTier();
    }
  }

  // Hook global events
  window.addEventListener('hha:expired', onExpire);
  window.addEventListener('hha:time', e => {
    const sec = (e.detail?.sec|0);
    if (sec >= 0) onSec();
  });

  // ---------- เริ่มโรงงานสปอว์นเป้า ----------
  const ctrl = await factoryBoot({
    difficulty: diff,
    duration  : dur,
    pools     : { good:[...GOOD, ...BONUS], bad:[...JUNK] },
    goodRate  : 0.62,
    powerups  : BONUS,
    powerRate : 0.10,
    powerEvery: 7,
    judge     : (ch, ctx)=>judge(ch, { ...ctx, cx:(ctx.clientX||ctx.cx), cy:(ctx.clientY||ctx.cy) }),
    onExpire
  });

  // ส่งสรุปเมื่อหมดเวลา
  window.addEventListener('hha:time', (e)=>{
    const s = (e.detail?.sec|0);
    if (s > 0) return;

    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const goalCleared = goals.length>0 && goals.every(g => g.done);

    window.dispatchEvent(new CustomEvent('hha:end', { detail: {
      mode        : 'goodjunk',
      difficulty  : diff,
      score,
      comboMax    : deck.stats.comboMax,
      misses      : deck.stats.junkMiss,
      hits        : deck.stats.goodCount,
      duration    : dur,
      goalCleared,
      questsCleared: minis.filter(m=>m.done).length,
      questsTotal  : minis.length
    }}));
  });

  // Kick แรก
  pushQuest('เริ่ม');
  recomputeTier();

  return ctrl;
}

export default { boot };