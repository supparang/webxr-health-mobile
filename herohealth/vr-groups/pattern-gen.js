// === /herohealth/vr/pattern-gen.js ===
// Pattern Generator — SEEDED (HHA)
// ✅ Deterministic with provided rng()
// ✅ Provides: getConfig(playedSec, bossActive) + nextPos(safe)
// ✅ Patterns: calm, lanes, zigzag, rain, ring, bossStorm
// ✅ Emits: hha:pattern {name, untilSec}

'use strict';

export function createPatternGen({ rng, emit } = {}){
  const R = (typeof rng === 'function') ? rng : Math.random;
  const E = (typeof emit === 'function') ? emit : ()=>{};

  const S = {
    cur: 'calm',
    until: 0,
    // local phase for patterns
    laneIndex: 0,
    zigDir: 1,
    rainCol: 0,
    ringT: 0,
    lastName: ''
  };

  function pick(arr){
    const a = Array.isArray(arr) ? arr : [];
    if(!a.length) return 'calm';
    const i = Math.floor(R() * a.length);
    return a[Math.max(0, Math.min(a.length-1, i))];
  }

  function setPattern(name, playedSec, durSec){
    S.cur = name;
    S.until = playedSec + durSec;
    S.laneIndex = 0;
    S.zigDir = 1;
    S.rainCol = 0;
    S.ringT = 0;

    if(S.lastName !== name){
      S.lastName = name;
      E('hha:pattern', { name, untilSec: S.until });
    }
  }

  function rollNextPattern(playedSec, bossActive){
    if(bossActive){
      // boss => force storm most of the time
      setPattern('bossStorm', playedSec, 10);
      return;
    }

    // early calm, then rotate patterns
    if(playedSec < 10){
      setPattern('calm', playedSec, 6);
      return;
    }

    const name = pick(['lanes','zigzag','rain','ring','calm']);
    const dur = (name === 'calm') ? 5 : 7;
    setPattern(name, playedSec, dur);
  }

  function getConfig(playedSec, bossActive){
    if(playedSec >= S.until){
      rollNextPattern(playedSec, bossActive);
    }

    // default
    let cfg = {
      name: S.cur,
      spawnMs: 900,
      // weights for kind (caller may override)
      pGood: 0.70,
      pJunk: 0.26,
      pStar: 0.02,
      pShield: 0.02,
      // hint for UI/coach
      hint: ''
    };

    if(S.cur === 'calm'){
      cfg.spawnMs = 920;
      cfg.hint = 'โหมดปกติ: เก็บของดีให้แม่น';
    }
    else if(S.cur === 'lanes'){
      cfg.spawnMs = 760;
      cfg.pJunk += 0.04; cfg.pGood -= 0.04;
      cfg.hint = 'WAVE: เป้ามาเป็นเลน (ซ้าย→ขวา)';
    }
    else if(S.cur === 'zigzag'){
      cfg.spawnMs = 720;
      cfg.pJunk += 0.06; cfg.pGood -= 0.06;
      cfg.hint = 'WAVE: เป้ามาแบบซิกแซก';
    }
    else if(S.cur === 'rain'){
      cfg.spawnMs = 680;
      cfg.pJunk += 0.08; cfg.pGood -= 0.08;
      cfg.hint = 'STORM: ฝนเป้าตกเป็นคอลัมน์';
    }
    else if(S.cur === 'ring'){
      cfg.spawnMs = 740;
      cfg.pStar += 0.01; // ให้มีลุ้น power มากขึ้นนิด
      cfg.hint = 'WAVE: วงแหวนรอบจอ (ระวังของเสีย)';
    }
    else if(S.cur === 'bossStorm'){
      cfg.spawnMs = 560;
      cfg.pJunk = Math.min(0.52, cfg.pJunk + 0.18);
      cfg.pGood = Math.max(0.40, cfg.pGood - 0.16);
      cfg.pStar += 0.01;
      cfg.pShield += 0.02;
      cfg.hint = 'BOSS STORM: ของเสียถี่ขึ้น! เก็บของดีเพื่อลดพลังบอส';
    }

    // normalize weights
    let sum = cfg.pGood + cfg.pJunk + cfg.pStar + cfg.pShield;
    if(sum <= 0) sum = 1;
    cfg.pGood/=sum; cfg.pJunk/=sum; cfg.pStar/=sum; cfg.pShield/=sum;

    return cfg;
  }

  function nextPos(safe){
    // safe: {x,y,w,h}
    if(!safe) return { x: 100, y: 200 };

    const x0 = safe.x, y0 = safe.y, w = safe.w, h = safe.h;

    // helper clamp inside safe
    const cx = (v)=> Math.max(x0, Math.min(x0+w, v));
    const cy = (v)=> Math.max(y0, Math.min(y0+h, v));

    if(S.cur === 'calm'){
      return { x: x0 + R()*w, y: y0 + R()*h };
    }

    if(S.cur === 'lanes'){
      // 5 vertical lanes, iterate
      const lanes = 5;
      const i = (S.laneIndex++ % lanes);
      const lx = x0 + (i + 0.5) * (w / lanes);
      const ly = y0 + R()*h;
      return { x: cx(lx), y: cy(ly) };
    }

    if(S.cur === 'zigzag'){
      // bounce left-right while moving downward
      const step = 0.18; // portion
      let t = (S.ringT += step);
      if(t > 1){ S.ringT = 0; t = 0; S.zigDir *= -1; }
      const px = (S.zigDir > 0) ? t : (1 - t);
      const x = x0 + px * w;
      const y = y0 + (0.15 + 0.7 * R()) * h;
      return { x: cx(x), y: cy(y) };
    }

    if(S.cur === 'rain' || S.cur === 'bossStorm'){
      // column rain (8 columns)
      const cols = 8;
      const c = (S.rainCol++ % cols);
      const x = x0 + (c + 0.5) * (w / cols);
      const y = y0 + (0.12 + 0.86 * R()) * h;
      return { x: cx(x), y: cy(y) };
    }

    if(S.cur === 'ring'){
      // ring points around center
      const cx0 = x0 + w/2;
      const cy0 = y0 + h/2;
      const rad = Math.min(w,h) * 0.38;
      const a = (S.ringT += 0.55); // radians-ish step
      const x = cx0 + Math.cos(a) * rad * (0.85 + 0.25*R());
      const y = cy0 + Math.sin(a) * rad * (0.85 + 0.25*R());
      return { x: cx(x), y: cy(y) };
    }

    // fallback
    return { x: x0 + R()*w, y: y0 + R()*h };
  }

  return { getConfig, nextPos };
}