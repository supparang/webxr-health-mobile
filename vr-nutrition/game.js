(() => {
  const $ = s => document.querySelector(s);

  // สถานะย่อให้เล่นได้
  const APP = {
    mode: localStorage.getItem("vrn_mode") || "goodjunk",
    difficulty: localStorage.getItem("vrn_diff") || "Normal",
    score:0, timeLeft:60, running:false, paused:false, combo:1, comboMax:1,
    best: parseInt(localStorage.getItem("vrn_best")||"0")
  };

  function updateHUD(){
    $("#score").textContent=APP.score;
    $("#time").textContent=APP.timeLeft;
    $("#best").textContent=APP.best;
    $("#difficulty").textContent=APP.difficulty;
    $("#combo").textContent="x"+APP.combo;
    $("#modeName").textContent=(
      APP.mode==="goodjunk"?"Good vs Junk":
      APP.mode==="groups"?"Food Groups":
      APP.mode==="hydration"?"Hydration":"Build Plate"
    );
  }
  function setMode(m){ APP.mode=m; localStorage.setItem("vrn_mode",m); updateHUD(); }
  function setDiff(d){ APP.difficulty=d; localStorage.setItem("vrn_diff",d); updateHUD(); }

  // spawn สั้น ๆ ให้เห็นผล
  const ACTIVE=new Set(), FOODS=["#apple","#broccoli","#water","#burger","#soda","#donut","#g_grains","#g_protein","#g_veggies","#g_fruits","#g_dairy"];
  function spawnOne(){
    const root=$("#spawnerRoot"); if(!root) return;
    if(ACTIVE.size >= (APP.difficulty==="Hard"?5:APP.difficulty==="Easy"?3:4)) return;
    const ent=document.createElement("a-image");
    ent.setAttribute("src", FOODS[Math.floor(Math.random()*FOODS.length)]);
    const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
    ent.setAttribute("position", `${pick([-0.9,0,0.9])} ${pick([-0.05,0.12,0.29])} ${pick([-0.36,0,0.36])}`);
    ent.setAttribute("scale","0.78 0.78 0.78");
    ent.setAttribute("class","clickable");
    ent.setAttribute("geometry","primitive:plane;width:1;height:1");
    ent.setAttribute("material","shader:flat;transparent:true;opacity:0.98");
    ent.addEventListener("click", ()=>{
      APP.score += 5; APP.combo = Math.min(5, APP.combo+1); APP.comboMax = Math.max(APP.comboMax, APP.combo);
      updateHUD(); ent.remove(); ACTIVE.delete(ent);
    });
    root.appendChild(ent); ACTIVE.add(ent);
    const life=APP.difficulty==="Hard"?1900:APP.difficulty==="Easy"?4200:3000;
    setTimeout(()=>{ if(ent.parentNode){ ent.remove(); ACTIVE.delete(ent); } }, life);
  }

  let loopH=null, timerH=null;
  function loop(){ if(!APP.running||APP.paused) return; spawnOne(); const base=760, rate=APP.difficulty==="Hard"?base*0.8:APP.difficulty==="Easy"?base*1.25:base; loopH=setTimeout(loop,rate); }
  function timer(){ if(!APP.running||APP.paused) return; timerH=setTimeout(()=>{ APP.timeLeft--; updateHUD(); if(APP.timeLeft<=0){ endGame(); } else timer(); },1000); }
  function showSummary(){ document.getElementById("summary").classList.add("show"); }
  function hideSummary(){ document.getElementById("summary").classList.remove("show"); }

  function startGame(){
    if(APP.running && !APP.paused) return;
    if(!APP.running){ APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD(); }
    APP.running=true; APP.paused=false;
    hideSummary();
    document.body.classList.add('game-running');
    setTimeout(()=>{ spawnOne(); loop(); timer(); }, 400);
  }
  function pauseGame(){ if(!APP.running) return; APP.paused=!APP.paused; if(APP.paused){ clearTimeout(loopH); clearTimeout(timerH);} else { loop(); timer(); } }
  function endGame(){ APP.running=false; APP.paused=false; clearTimeout(loopH); clearTimeout(timerH);
    if(APP.score>APP.best){ APP.best=APP.score; localStorage.setItem("vrn_best", String(APP.best)); }
    document.getElementById("sumStars").textContent = (APP.score>=200?"★★★":APP.score>=140?"★★☆":"★☆☆");
    document.getElementById("sumBody").textContent  = `Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`;
    showSummary(); document.body.classList.remove('game-running');
  }

  // === HOW (แทน alert) ===
  function openHowFromGame(){
    if(typeof window.openHow==='function'){
      const html = `
        <div><b>โหมด ดี vs ขยะ:</b> จ้อง/คลิกอาหารที่ดี หลีกเลี่ยงขยะ รักษาคอมโบ</div>
        <div><b>โหมด จาน 5 หมู่:</b> ดูหมู่เป้าหมายมุมขวาบน เก็บให้ตรงหมู่</div>
        <div><b>โหมด Hydration:</b> เก็บน้ำ 💧 หลีกเลี่ยงน้ำหวาน สะสมสตรีคเพิ่มเวลา</div>
        <div><b>โหมด Build Plate:</b> เก็บตามโควตา Plate ครบชุดรับโบนัส</div>
        <div><b>การควบคุม:</b> เมาส์/แตะ หรือจ้องใน VR จนวงแหวนครบ</div>`;
      window.openHow(html);
    }
  }

  // === bind ให้เมนูเรียกได้จริง ===
  const REAL = {
    start: startGame, pause: pauseGame,
    restart: ()=>{ hideSummary(); APP.running=false; APP.paused=false; clearTimeout(loopH); clearTimeout(timerH);
                   document.body.classList.add('game-running'); APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD();
                   setTimeout(()=>{ spawnOne(); loop(); timer(); },400); },
    how: openHowFromGame,
    setMode: (m)=> setMode(m),
    setDiff: (d)=> setDiff(d),
    toggleLang: ()=>{}, toggleVoice: ()=>{}
  };
  if(window.GAME_UI && typeof window.GAME_UI._bind==='function'){ window.GAME_UI._bind(REAL); } else { window.GAME_UI=REAL; }

  // init
  updateHUD(); setMode(APP.mode);
})();
