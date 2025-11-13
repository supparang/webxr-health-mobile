// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 CENTER FX + COACH) ===
import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  ensureFeverBar();
  setFever(0);
  setShield(0);

  const G = {
    good: s=>s.goodCount|0,
    junk: s=>s.junkMiss|0,
    score: s=>s.score|0,
    comboMax: s=>s.comboMax|0,
    tick: s=>s.tick|0
  };

  const GOAL_POOL = [
    { id:'g_good20',  label:'เก็บของดีให้ได้ 20 ชิ้น',  level:'easy',   target:20,   check:s=>G.good(s)>=20,  prog:s=>Math.min(20,G.good(s)) },
    { id:'g_good28',  label:'เก็บของดีให้ได้ 28 ชิ้น',  level:'normal', target:28,   check:s=>G.good(s)>=28,  prog:s=>Math.min(28,G.good(s)) },
    { id:'g_good34',  label:'เก็บของดีให้ได้ 34 ชิ้น',  level:'hard',   target:34,   check:s=>G.good(s)>=34,  prog:s=>Math.min(34,G.good(s)) },
    { id:'g_score800', label:'ทำคะแนนรวม 800+',          level:'easy',   target:800,  check:s=>G.score(s)>=800,  prog:s=>Math.min(800,G.score(s)) },
    { id:'g_score1500',label:'ทำคะแนนรวม 1500+',         level:'normal', target:1500, check:s=>G.score(s)>=1500, prog:s=>Math.min(1500,G.score(s)) },
    { id:'g_score2200',label:'ทำคะแนนรวม 2200+',         level:'hard',   target:2200, check:s=>G.score(s)>=2200, prog:s=>Math.min(2200,G.score(s)) },
    { id:'g_combo16', label:'คอมโบสูงสุด ≥ 16',         level:'normal', target:16,   check:s=>G.comboMax(s)>=16,prog:s=>Math.min(16,G.comboMax(s)) },
    { id:'g_combo24', label:'คอมโบสูงสุด ≥ 24',         level:'hard',   target:24,   check:s=>G.comboMax(s)>=24,prog:s=>Math.min(24,G.comboMax(s)) },
    { id:'g_time30',  label:'อยู่รอดเกิน 30 วินาที',     level:'easy',   target:30,   check:s=>G.tick(s)>=30,   prog:s=>Math.min(30,G.tick(s)) },
    { id:'g_nojunk6', label:'พลาดไม่เกิน 6 ครั้ง',       level:'normal',
      target:6, check:s=>G.junk(s)<=6, prog:s=>Math.min(6,G.junk(s)) }
  ];

  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',      level:'normal', target:12,   check:s=>G.comboMax(s)>=12, prog:s=>Math.min(12,G.comboMax(s)) },
    { id:'m_combo18',  label:'คอมโบต่อเนื่อง 18',      level:'hard',   target:18,   check:s=>G.comboMax(s)>=18, prog:s=>Math.min(18,G.comboMax(s)) },
    { id:'m_score600', label:'ทำคะแนนรวม 600+',        level:'easy',   target:600,  check:s=>G.score(s)>=600,   prog:s=>Math.min(600,G.score(s)) },
    { id:'m_score1200',label:'ทำคะแนนรวม 1200+',       level:'normal', target:1200, check:s=>G.score(s)>=1200,  prog:s=>Math.min(1200,G.score(s)) },
    { id:'m_good10',   label:'เก็บของดี 10 ชิ้น',       level:'easy',   target:10,   check:s=>G.good(s)>=10,     prog:s=>Math.min(10,G.good(s)) },
    { id:'m_good18',   label:'เก็บของดี 18 ชิ้น',       level:'normal', target:18,   check:s=>G.good(s)>=18,     prog:s=>Math