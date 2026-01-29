// === /fitness/js/daily-missions.js ===
// Daily Missions (A-22) — fun goals for kids + research-friendly
'use strict';

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

function pick(rng, arr){ return arr[Math.floor(rng.rand()*arr.length)]; }

export function createDailyMissions(rng, diffKey){
  // 3 missions per run
  const pool = [
    { id:'perfect',  title:'PERFECT x{n}', desc:'ทำ PERFECT ให้ได้ {n} ครั้ง', targetByDiff:{easy:8, normal:12, hard:16} },
    { id:'combo',    title:'COMBO ≥ {n}',  desc:'ทำคอมโบให้ถึง {n} (อย่างน้อย 1 ครั้ง)', targetByDiff:{easy:8, normal:12, hard:16} },
    { id:'boss',     title:'BOSS x{n}',    desc:'เคลียร์บอสให้ได้ {n} ตัว', targetByDiff:{easy:1, normal:1, hard:2} },
    { id:'noBomb',   title:'NO BOMB',      desc:'จบรอบโดยไม่โดนระเบิดเลย', targetByDiff:{easy:1, normal:1, hard:1} },
    { id:'fever',    title:'FEVER {n}s',   desc:'อยู่ใน FEVER รวม {n} วินาที', targetByDiff:{easy:3, normal:5, hard:7} },
    { id:'accuracy', title:'ACCURACY ≥ {n}%', desc:'Accuracy ให้ได้อย่างน้อย {n}%', targetByDiff:{easy:80, normal:86, hard:90} }
  ];

  // choose 3 unique missions
  const chosen = [];
  const used = new Set();
  while (chosen.length < 3 && used.size < pool.length){
    const m = pick(rng, pool);
    if (used.has(m.id)) continue;
    used.add(m.id);

    const n = (m.targetByDiff && m.targetByDiff[diffKey]) ?? 10;
    chosen.push({
      id: m.id,
      title: m.title.replace('{n}', String(n)),
      desc:  m.desc.replace('{n}', String(n)),
      target: n,
      done: false,
      value: 0
    });
  }

  function updateFromEvent(e){
    // e: { type, grade, rtMs, combo, bossCleared, feverActiveS, accuracy, hitType }
    for (const m of chosen){
      if (m.done) continue;

      if (m.id === 'perfect'){
        if (e.type==='hit' && e.grade==='perfect'){ m.value++; }
        if (m.value >= m.target) m.done = true;
      }
      else if (m.id === 'combo'){
        if (typeof e.combo === 'number') m.value = Math.max(m.value, e.combo);
        if (m.value >= m.target) m.done = true;
      }
      else if (m.id === 'boss'){
        if (typeof e.bossCleared === 'number') m.value = e.bossCleared;
        if (m.value >= m.target) m.done = true;
      }
      else if (m.id === 'noBomb'){
        if (e.type==='hit' && e.grade==='bomb'){ m.value = 1; m.done = false; } // fail condition
      }
      else if (m.id === 'fever'){
        if (typeof e.feverActiveS === 'number') m.value = e.feverActiveS;
        if (m.value >= m.target) m.done = true;
      }
      else if (m.id === 'accuracy'){
        if (typeof e.accuracy === 'number') m.value = e.accuracy;
        if (m.value >= m.target) m.done = true;
      }
    }
  }

  function finalize(summary){
    // at end, lock values using summary if needed
    const acc = summary?.accuracy_pct ?? 0;
    const feverS = summary?.fever_total_time_s ?? 0;
    const bosses = summary?.bosses_cleared ?? 0;

    for (const m of chosen){
      if (m.id === 'accuracy'){
        m.value = acc;
        if (m.value >= m.target) m.done = true;
      }
      if (m.id === 'fever'){
        m.value = feverS;
        if (m.value >= m.target) m.done = true;
      }
      if (m.id === 'boss'){
        m.value = bosses;
        if (m.value >= m.target) m.done = true;
      }
      if (m.id === 'noBomb'){
        // if ever bomb happened, engine should mark it; else success
        if (summary && summary.total_bombs_hit === 0) m.done = true;
      }
    }
  }

  function statusLine(){
    // compact: ✅/⬜
    const parts = chosen.map(m=>{
      const icon = m.done ? '✅' : '⬜';
      // show progress for some missions
      let prog = '';
      if (m.id==='perfect' || m.id==='boss'){
        prog = ` (${m.value}/${m.target})`;
      } else if (m.id==='fever'){
        prog = ` (${clamp(+m.value,0,999).toFixed(1)}s/${m.target}s)`;
      } else if (m.id==='accuracy'){
        prog = ` (${(+m.value).toFixed(0)}%/${m.target}%)`;
      } else if (m.id==='combo'){
        prog = ` (best ${m.value}/${m.target})`;
      } else if (m.id==='noBomb'){
        prog = '';
      }
      return `${icon} ${m.title}${prog}`;
    });
    return parts.join('  •  ');
  }

  function allDone(){ return chosen.every(m=>m.done); }

  return { chosen, updateFromEvent, finalize, statusLine, allDone };
}
