// === /HeroHealth/modes/hydration.quest.js (2025-11-13) ===
// โหมด Hydration: เก็บ "เครื่องดื่มดี" (น้ำ 💧 / นม 🥛 / ชาไม่หวาน 🍵) หลีกเลี่ยง "หวาน" (โซดา 🥤 / บาวบาว 🧋 / น้ำอัดลม 🍹)
// - มี Power-ups: ⭐, 💎, 🛡️, 🔥 (เหมือนโหมดอื่น เพื่อความคุ้นมือ)
// - Fever bar ใช้แทน "ระดับความชุ่มชื้น" ได้โดยนัย (ยิ่งดี ยิ่ง active)
// - ส่งสถานะ Goal/Mini ไป quest-hud ด้วย 'quest:update'

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { MissionDeck } from '../vr/mission.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { Particles } from '../vr/particles.js';

export async function boot(cfg = {}) {
  const diff = String(cfg.difficulty || 'normal');
  const dur  = Number(cfg.duration || 60);

  // ---------- Pools ----------
  const GOOD = ['💧','💦','🚰','🥛','🍵','🧊'];                 // น้ำ, นม, ชาไม่หวาน, น้ำแข็ง
  const BAD  = ['🥤','🧋','🍹','🧃','🍷','🍺'];                // น้ำหวาน/บาวบาว/เครื่องดื่มหวาน (และแอลกอฮอล์นับเป็นไม่ดี)
  const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
  const BONUS=[STAR,DIA,SHIELD,FIRE];

  // Fever (Hydration meter)
  ensureFeverBar(); setFever(0); setFeverActive(false); setShield(0);

  // ---------- Goals / Mini Quests ----------
  // อ่านจาก deck.stats
  const G = {
    good   : s=>s.goodCount|0,
    bad    : s=>s.junkMiss|0,
    score  : s=>s.score|0,
    combo  : s=>s.combo|0,
    cmax   : s=>s.comboMax|0,
    tick   : s=>s.tick|0
  };

  const GOAL_POOL = [
    { id:'g_drink18',   label:'เก็บเครื่องดื่มดี 18 ชิ้น', level:'easy',   target:18,  check:s=>G.good(s)>=18, prog:s=>Math.min(18, G.good(s)) },
    { id:'g_drink26',   label:'เก็บเครื่องดื่มดี 26 ชิ้น', level:'normal', target:26,  check:s=>G.good(s)>=26, prog:s=>Math.min(26, G.good(s)) },
    { id:'g_drink34',   label:'เก็บเครื่องดื่มดี 34 ชิ้น', level:'hard',   target:34,  check:s=>G.good(s)>=34, prog:s=>Math.min(34, G.good(s)) },
    { id:'g_score1000', label:'ทำคะแนนรวม 1000+',       level:'easy',   target:1000, check:s=>G.score(s)>=1000, prog:s=>Math.min(1000, G.score(s)) },
    { id:'g_score1800', label:'ทำคะแนนรวม 1800+',       level:'normal', target:1800, check:s=>G.score(s)>=1800, prog:s=>Math.min(1800, G.score(s)) },
    { id:'g_combo16',   label:'คอมโบสูงสุด ≥ 16',       level:'normal', target:16,   check:s=>G.cmax(s)>=16,    prog:s=>Math.min(16, G.cmax(s)) },
    { id:'g_combo22',   label:'คอมโบสูงสุด ≥ 22',       level:'hard',   target:22,   check:s=>G.cmax(s)>=22,    prog:s=>Math.min(22, G.cmax(s)) },
    { id:'g_stay30',    label:'อยู่รอดเกิน 30 วินาที',  level:'easy',   target:30,   check:s=>G.tick(s)>=30,    prog:s=>Math.min(30, G.tick(s)) },
    { id:'g_under6',    label:'พลาดไม่เกิน 6 ครั้ง',     level:'normal', target:0,    check:s=>G.bad(s)<=6,      prog:s=>Math.max(0, 6-G.bad(s)) },
    { id:'g_under3',    label:'พลาดไม่เกิน 3 ครั้ง',     level:'hard',   target:0,    check:s=>G.bad(s)<=3,      prog:s=>Math.max(0, 3-G.bad(s)) },
  ];

  const MINI_POOL = [
    { id:'m_combo12',  label:'คอมโบต่อเนื่อง 12',       level:'normal', target:12,  check:s=>G.cmax(s)>=12,     prog:s=>Math.min(12, G.cmax(s)) },
    { id:'m_combo18',  label:'คอมโบต่อเนื่อง 18',       level:'hard',   target:18,  check:s=>G.cmax(s)>=18,     prog:s=>Math.min(18, G.cmax(s)) },
    { id:'m_score800', label:'ทำคะแนนรวม 800+',         level:'easy',   target:800, check:s=>G.score(s)>=800,   prog:s=>Math.min(800, G.score(s)) },
    { id:'m_score1300',label:'ทำคะแนนรวม 1300+',        level:'normal', target:1300,check:s=>G.score(s)>=1300,  prog:s=>Math.min(1300,G.score(s)) },
    { id:'m_good12',   label:'เก็บเครื่องดื่มดี 12 ชิ้น', level:'easy',   target:12,  check:s=>G.good(s)>=12,    prog:s=>Math.min(12, G.good(s)) },
    { id:'m_good20',   label:'เก็บเครื่องดื่มดี 20 ชิ้น', level:'normal', target:20,  check:s=>G.good(s)>=20,    prog:s=>Math.min(20, G.good(s)) },
    { id:'m_nomiss12', label:'ไม่พลาด 12 วินาที',         level:'normal', target:12,  check:s=>G.tick(s)>=12 && s.combo>0, prog:s=>Math.min(12, G.tick(s)) },
    { id:'m_star2',    label:'เก็บ ⭐ 2 ดวง',             level:'hard',   target:2,   check:s=>s.star>=2,         prog:s=>Math.min(2, s.star|0) },
    { id:'m_dia1',     label:'เก็บ 💎 1 เม็ด',            level:'hard',   target:1,   check:s=>s.diamond>=1,      prog:s=>Math.min(1, s.diamond|0) },
    { id:'m_under6',   label:'พลาดไม่เกิน 6 ครั้ง',       level:'normal', target:0,   check:s=>G.bad(s)<=6,       prog:s=>Math.max(0, 6-G.bad(s)) },
  ];

  const deck = new MissionDeck({ goalPool: GOAL_POOL, miniPool: MINI_POOL });
  deck.drawGoals(5);
  deck.draw3();

  function pushQuest(hint){
    const goals = deck.getProgress('goals');
    const minis = deck.getProgress('mini');
    const focusGoal = goals.find(g=>!g.done) || goals[0] || null;
    const focusMini = minis.find(m=>!m.done) || minis[0] || null;
    window.dispatchEvent(new CustomEvent('quest:update', {
      detail: { goal: focusGoal, mini: focusMini, goalsAll: goals, minisAll: minis, hint }
    }));
  }

  // ---------- Runtime ----------
  let score=0, combo=0, shield=0, fever=0, feverActive=false;
  let star=0, diamond=0;

  function mult(){ return feverActive ? 2 : 1; }
  function gainFever(n){
    fever = Math.max(0, Math.min(100, fever + n));
    setFever(fever);
    if (!feverActive && fever>=100){ feverActive=true; setFeverActive(true); }
  }
  function decayFever(base){
    const d = feverActive ? 10 : base;
    fever = Math.max(0, fever - d);
    setFever(fever);
    if (feverActive && fever<=0){ feverActive=false; setFeverActive(false); }
  }
  function syncDeck(){
    deck.updateScore(score);
    deck.updateCombo(combo);
    deck.stats.star    = star;
    deck.stats.diamond = diamond;
  }

  // คะแนน + เอฟเฟกต์
  function scoreAt(x,y,delta,good,theme='hydration'){
    Particles.burstShards(null,null,{screen:{x,y},theme});
    try{ Particles.scorePop({x,y,delta,good}); }catch(_){}
  }

  function judge(ch, ctx){
    const x = ctx.clientX||ctx.cx, y = ctx.clientY||ctx.cy;

    // Powerups
    if (ch===STAR){ const d=40*mult(); score+=d; gainFever(12); star++; deck.onGood(); syncDeck(); scoreAt(x,y,d,true,'hydration'); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===DIA){  const d=80*mult(); score+=d; gainFever(28); diamond++; deck.onGood(); syncDeck(); scoreAt(x,y,d,true,'hydration'); pushQuest(); return {good:true,scoreDelta:d}; }
    if (ch===SHIELD){ shield=Math.min(3, shield+1); setShield(shield); score+=20; deck.onGood(); syncDeck(); scoreAt(x,y,20,true,'hydration'); pushQuest(); return {good:true,scoreDelta:20}; }
    if (ch===FIRE){ feverActive=true; setFeverActive(true); fever=Math.max(fever,60); setFever(fever); score+=25; deck.onGood(); syncDeck(); scoreAt(x,y,25,true,'hydration'); pushQuest(); return {good:true,scoreDelta:25}; }

    const isGood = GOOD.includes(ch);
    if (isGood){
      // ให้คะแนนสูงขึ้นเล็กน้อยตามคอมโบ
      const base = 14 + combo*2;
      const delta = base * mult();
      score += delta; combo += 1;
      gainFever(7 + combo*0.4);
      deck.onGood(); syncDeck();
      scoreAt(x,y,delta,true,'hydration');
      pushQuest();
      return { good:true, scoreDelta: delta };
    } else {
      if (shield>0){ shield-=1; setShield(shield); scoreAt(x,y,0,false,'groups'); syncDeck(); push
