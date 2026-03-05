// === /herohealth/vr/hero-title.js ===
// Hero Title + Level + Badge (localStorage)
// FULL v20260306-HERO-TITLE-LV
'use strict';

function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,String(v)); }catch(_){ } }
function safeJsonParse(s, fb){ try{ return JSON.parse(String(s||'')); }catch(_){ return fb; } }

export function heroKeys(pid){
  pid = String(pid||'anon').trim() || 'anon';
  return {
    xp: `HHA_HERO_XP:${pid}`,
    book: `HHA_CARD_BOOK:${pid}`,
    last: `HHA_LAST_REWARD:${pid}`,
    profile: `HHA_HERO_PROFILE:${pid}`
  };
}

export function readHero(pid){
  const K = heroKeys(pid);
  const xp = Number(lsGet(K.xp)||'0') || 0;
  const book = safeJsonParse(lsGet(K.book), null) || { cards:{S:0,A:0,B:0,C:0}, history:[] };
  if(!book.cards) book.cards = {S:0,A:0,B:0,C:0};
  const last = safeJsonParse(lsGet(K.last), null);

  const meta = computeHeroMeta(xp, book.cards);
  const hero = {
    pid: String(pid||'anon').trim() || 'anon',
    xp,
    cards: {
      S: Number(book.cards.S||0)||0,
      A: Number(book.cards.A||0)||0,
      B: Number(book.cards.B||0)||0,
      C: Number(book.cards.C||0)||0,
    },
    last,
    ...meta
  };

  // cache profile (nice for Hub)
  try{ lsSet(K.profile, JSON.stringify(hero)); }catch(_){}
  return hero;
}

export function computeHeroMeta(xp, cards){
  xp = Number(xp||0)||0;
  cards = cards || {};
  const s = Number(cards.S||0)||0;
  const a = Number(cards.A||0)||0;
  const b = Number(cards.B||0)||0;
  const c = Number(cards.C||0)||0;

  // ---- Level from XP (simple, classroom-friendly) ----
  // Lv1 0-39, Lv2 40-89, Lv3 90-159, Lv4 160-249, Lv5 250-359, Lv6 360+
  const LV = (function(){
    if(xp >= 360) return 6;
    if(xp >= 250) return 5;
    if(xp >= 160) return 4;
    if(xp >=  90) return 3;
    if(xp >=  40) return 2;
    return 1;
  })();

  // ---- Badge tier (from cards) ----
  // If S>=3 => ⭐Elite, else A>=5 => 🥇Gold, else B>=6 => 🥈Silver, else C>=8 => 🥉Bronze, else 🧪Rookie
  const badge = (function(){
    if(s >= 3) return { tier:'elite', icon:'⭐', name:'Elite' };
    if(a >= 5) return { tier:'gold',  icon:'🥇', name:'Gold' };
    if(b >= 6) return { tier:'silver',icon:'🥈', name:'Silver' };
    if(c >= 8) return { tier:'bronze',icon:'🥉', name:'Bronze' };
    return { tier:'rookie', icon:'🧪', name:'Rookie' };
  })();

  // ---- Title (C) : depends on LV + badge + skill focus ----
  // We bias “Healthy Food Hero” vibe for GoodJunk
  const title = (function(){
    if(LV >= 6 && badge.tier==='elite') return 'Legendary Veggie Guardian';
    if(LV >= 5 && (badge.tier==='elite' || badge.tier==='gold')) return 'Veggie Champion';
    if(LV >= 4 && (badge.tier==='gold' || badge.tier==='silver')) return 'Nutrition Knight';
    if(LV >= 3) return 'Healthy Hunter';
    if(LV >= 2) return 'Snack Scout';
    return 'Rookie Recruit';
  })();

  // ---- Progress to next level (for UI bars) ----
  const nextXp = (function(){
    if(LV===1) return 40;
    if(LV===2) return 90;
    if(LV===3) return 160;
    if(LV===4) return 250;
    if(LV===5) return 360;
    return null; // max
  })();
  const prevXp = (function(){
    if(LV===1) return 0;
    if(LV===2) return 40;
    if(LV===3) return 90;
    if(LV===4) return 160;
    if(LV===5) return 250;
    if(LV===6) return 360;
    return 0;
  })();

  const p = (nextXp==null) ? 100 : Math.max(0, Math.min(100, ((xp - prevXp) / Math.max(1,(nextXp - prevXp))) * 100));

  return {
    level: LV,
    title,
    badge,         // {tier, icon, name}
    nextXp,
    levelProgressPct: Math.round(p)
  };
}

export function attachHeroAutoRefresh(pid, onUpdate){
  // listen reward/end -> refresh hero widget
  const fn = ()=>{ try{ onUpdate && onUpdate(readHero(pid)); }catch(_){} };
  window.addEventListener('hha:reward', fn);
  window.addEventListener('hha:end', fn);
  return ()=> {
    window.removeEventListener('hha:reward', fn);
    window.removeEventListener('hha:end', fn);
  };
}