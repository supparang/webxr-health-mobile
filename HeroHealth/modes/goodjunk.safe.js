// === /HeroHealth/modes/goodjunk.safe.js (2025-11-13 LATEST) ===
// โหมด Good vs Junk + Goal 5/สุ่มจาก 10 + Mini 3/สุ่มจาก 10
// - เอฟเฟกต์คะแนนตรงตามที่ได้จริง (Particles.scorePop)
// - คอมโบส่ง event hha:combo ให้ HUD
// - โค้ชส่งข้อความผ่าน coach:line (ไปแสดงใต้ fever bar ได้)

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- พูลอีโมจิ ----------
  const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛',
                '🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑'];
  const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🥓'];

  const STAR   = '⭐';
  const DIA    = '💎';
  const SHIELD = '🛡️';
  const FIRE   = '🔥';
  const BONUS  = [STAR, DIA, SHIELD, FIRE];

  // ---------- HUD เริ่มต้น ----------
  ensureFeverBar();
  setFever(0);
  setShield(0);
  setFeverActive(false);

  // ---------- ตัวช่วยสำหรับ Goal / Mini ----------
  const G = {
    good    : s => s.goodCount | 0,
    junk    : s => s.junkMiss  | 0,
    score   : s => s.score     | 0,
    combo   : s => s.combo     | 0,
    comboMax: s => s.comboMax  | 0,
    tick    : s => s.tick      | 0
  };

  // 10 Goal ใหญ่ — เราจะสุ่มมาใช้ 5 เป้าต่อเกม
  const GOAL_POOL = [
    { id:'g_good20',    label:'เก็บของดีให้ได้ 20 ชิ้น', level:'easy',
      target:20,  check:s=>G.good(s)>=20,  prog:s=>Math.min(20,G.good(s)) },
    { id:'g_good28',    label:'เก็บของดีให้ได้ 28 ชิ้น', level:'normal',
      target:28,  check:s=>G.good(s)>=28,  prog:s=>Math.min(28,G.good(s)) },
    { id:'g_good34',    label:'เก็บของดีให้ได้ 34 ชิ้น', level:'hard',
      target:34,  check:s=>G.good(s)>=34,  prog:s=>Math.min(34,G.good(s)) },

    { id:'g_score800',  label:'ทำคะแนนรวม 800+',          level:'easy',
      target:800, check:s=>G.score(s)>=800, prog:s=>Math.min(800,G.score(s)) },
    { id:'g_score1500', label:'ทำคะแนนรวม 1500+',         level:'normal',
      target:1500,check:s=>G.score(s)>=1500,prog:s=>Math.min(1500,G.score(s)) },
    { id