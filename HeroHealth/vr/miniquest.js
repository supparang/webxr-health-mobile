// ===== Mini Quest (10 types) — pick 3 per run =====
var Quest = (function(){
  // ---- Reward & helpers ----
  function reward(kind){
    if (kind === 'fever') feverStart();
    else if (kind === 'bonus150') { score += 150; emit('hha:score', {score, combo}); popupText('+150', 0, 1.0, '#ffe08a'); }
    else if (kind === 'bonus250') { score += 250; emit('hha:score', {score, combo}); popupText('+250', 0, 1.0, '#ffd166'); }
  }
  function txt(s){ return (typeof s==='function') ? s() : (s||'Mini Quest'); }
  function hud(s){ emit('hha:quest', { text: txt(s) }); }

  // ---- Built-in signals for quests ----
  var totalGood = 0, totalBad = 0, feverStarted = 0;
  function noteGood(){ totalGood++; }
  function noteBad(){ totalBad++; }
  function noteFever(){ feverStarted++; }

  // ---- 10 quest templates (ทั่วไป/อิงกลไกปัจจุบัน) ----
  var BANK = [
    // 1) เก็บของดีติดกัน N ชิ้น → Fever
    { id:'good-streak', reward:'fever',
      mk: ()=>({need:10, have:0}),
      label: s=>`Mini Quest — เก็บของดีติดกัน ${s.have}/${s.need} ชิ้น เพื่อเปิด FEVER!`,
      onGood: s=>{ s.have++; return s.have>=s.need; },
      onBad:  s=>{ s.have=0; return false; },
      tick:   s=>false
    },
    // 2) หลีกเลี่ยงของขยะ T วิ → โบนัส 150
    { id:'no-junk', reward:'bonus150',
      mk: ()=>({t:15, ok:true}),
      label: s=>`Mini Quest — หลีกเลี่ยงของขยะให้ครบ ${s.t} วิ`,
      onGood: s=>false,
      onBad:  s=>{ s.ok=false; return false; },
      tick:   s=>{ s.t--; return (s.t<=0 && s.ok); }
    },
    // 3) ทำคอมโบให้ถึง X → Fever
    { id:'reach-combo', reward:'fever',
      mk: ()=>({need:12}),
      label: s=>`Mini Quest — ทำคอมโบให้ถึง x${s.need}`,
      onGood: s=> combo>=s.need,
      onBad:  s=> false,
      tick:   s=> combo>=s.need
    },
    // 4) เก็บคะแนนเพิ่ม +Y ใน T วิ → โบนัส 150
    { id:'score-in-time', reward:'bonus150',
      mk: ()=>({t:12, base:score, need:200}),
      label: s=>`Mini Quest — เก็บเพิ่มอีก ${Math.max(0,s.need-(score-s.base))} คะแนน ใน ${s.t} วิ`,
      onGood: s=> (score-s.base)>=s.need,
      onBad:  s=> false,
      tick:   s=>{ s.t--; return (s.t<=0 ? (score-s.base)>=s.need : false); }
    },
    // 5) โดนของไม่ดีได้ไม่เกิน M ครั้งใน T วิ → โบนัส 150
    { id:'limited-bad', reward:'bonus150',
      mk: ()=>({t:14, m:1, bad:0}),
      label: s=>`Mini Quest — อย่ากดของขยะเกิน ${s.m} ครั้ง ใน ${s.t} วิ`,
      onGood: s=>false,
      onBad:  s=>{ s.bad++; return false; },
      tick:   s=>{ s.t--; return (s.t<=0 && s.bad<=s.m); }
    },
    // 6) สะสมของดีรวม N ชิ้น (ไม่ต้องติดกัน) → โบนัส 150
    { id:'collect-good', reward:'bonus150',
      mk: ()=>({base:totalGood, need:25}),
      label: s=>`Mini Quest — สะสมของดีให้ครบ ${s.need} ชิ้น (อีก ${Math.max(0,s.need-(totalGood-s.base))})`,
      onGood: s=> (totalGood - s.base) >= s.need,
      onBad:  s=> false,
      tick:   s=> (totalGood - s.base) >= s.need
    },
    // 7) เปิด FEVER ให้ได้ K ครั้งในเกม → โบนัส 250 (นับจากจุดเริ่มเควสต์)
    { id:'fever-count', reward:'bonus250',
      mk: ()=>({base:feverStarted, need:1}),
      label: s=>`Mini Quest — เปิด FEVER ให้ได้ ${s.need} ครั้ง`,
      onGood: s=> false,
      onBad:  s=> false,
      tick:   s=> (feverStarted - s.base) >= s.need
    },
    // 8) รักษา FEVER ให้นาน T วิ (ถ้าเข้า FEVER แล้วเริ่มนับ) → โบนัส 150
    { id:'fever-hold', reward:'bonus150',
      mk: ()=>({t:8, counting:false}),
      label: s=>`Mini Quest — รักษา FEVER ให้นาน ${s.t} วิ`,
      onGood: s=> false,
      onBad:  s=> false,
      tick:   s=>{ if(FEVER_ACTIVE){ s.counting=true; s.t--; if(s.t<=0) return true; } return false; }
    },
    // 9) ห้ามพลาด (timeout พลาด/ไม่คลิก) เกิน M ครั้งใน T วิ → โบนัส 150
    { id:'miss-guard', reward:'bonus150',
      mk: ()=>({t:15, baseMiss:misses, m:1}),
      label: s=>`Mini Quest — ห้ามพลาดเกิน ${s.m} ครั้งใน ${s.t} วิ`,
      onGood: s=> false,
      onBad:  s=> false,
      tick:   s=>{ s.t--; return (s.t<=0 && (misses - s.baseMiss) <= s.m); }
    },
    // 10) จบเควสต์ด้วยคอมโบคงเหลือ ≥ X (รักษาคอมโบ) → โบนัส 250
    { id:'finish-with-combo', reward:'bonus250',
      mk: ()=>({need:8}),
      label: s=>`Mini Quest — รักษาคอมโบให้ถึงตอนจบเควสต์ (≥ x${s.need})`,
      onGood: s=> false,
      onBad:  s=> false,
      tick:   s=> combo>=s.need   // เมื่อวน tick ใด ๆ ถึงเกณฑ์ ก็ผ่าน
    }
  ];

  // ---- pick 3 per run ----
  var queue = [];      // 3 เควสต์ของรอบนี้
  var idx = 0;         // active index
  var cur = null, st=null, tickId=null;

  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function pick3(){ queue = shuffle(BANK.slice()).slice(0,3); idx=0; }

  function mount(i){
    cur = queue[i]; st = cur.mk();
    hud(()=>cur.label(st));
    if (tickId) clearInterval(tickId);
    tickId = setInterval(function(){
      if(!running || !cur) return;
      if(cur.tick(st)){ done(); } else { hud(()=>cur.label(st)); }
    }, 1000);
  }

  function done(){
    if(!cur) return;
    var rw = cur.reward;
    clearInterval(tickId); tickId=null;
    reward(rw);
    idx++;
    if(idx>=queue.length){ // จบ 3 เควสต์ → สุ่มชุดใหม่
      pick3(); idx=0;
    }
    setTimeout(function(){ mount(idx); }, 1100);
  }

  // ---- public hooks ----
  function start(){ pick3(); mount(0); }
  function stop(){ if(tickId) clearInterval(tickId); tickId=null; cur=null; }
  function onGood(){ noteGood(); if(!cur) return; if(cur.onGood(st)) done(); else hud(()=>cur.label(st)); }
  function onBad(){  noteBad();  if(!cur) return; if(cur.onBad(st))  done(); else hud(()=>cur.label(st)); }
  function onFever(){ noteFever(); } // เรียกเมื่อ Fever เริ่ม

  return { start, stop, onGood, onBad, onFever };
})();
