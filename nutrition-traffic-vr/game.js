// ===== Boot after DOM ready =====
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

function init(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const hudText = $("#hudText");
  const scoreEl = $("#score");
  const okEl = $("#ok");
  const missEl = $("#miss");
  const timeBar = $("#timeBar");
  const btnStart = $("#btnStart");
  const btnReset = $("#btnReset");
  const btnExport = $("#btnExport");
  const modeSel = $("#mode");
  const hintSel = $("#hints");
  const importInput = $("#importFoods");
  const binsWrap = $("#bins");
  const root = document.getElementById("root");

  // ===== Audio =====
  let actx=null, sfxGain=null;
  function ensureAudio(){
    if(actx) return;
    const AC = window.AudioContext||window.webkitAudioContext;
    if(!AC) return;
    actx = new AC();
    sfxGain = actx.createGain(); sfxGain.gain.value=0.12; sfxGain.connect(actx.destination);
  }
  function beep(freq=800, dur=0.05, gain=0.12){
    ensureAudio(); if(!actx) return;
    const o=actx.createOscillator(), g=actx.createGain();
    o.type="sine"; o.frequency.value=freq; o.connect(g); g.connect(sfxGain);
    const t=actx.currentTime;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.start(t); o.stop(t+dur+0.01);
  }
  // ปลดล็อกเสียงเมื่อแตะครั้งแรก
  ["pointerdown","touchend","click"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,passive:true}));

  // ===== Groups & Foods =====
  const GROUPS = {
    grain:     { th: "ธัญพืช/แป้ง",   color: "#fde68a" },
    vegetable: { th: "ผัก",           color: "#bbf7d0" },
    fruit:     { th: "ผลไม้",         color: "#fecaca" },
    protein:   { th: "โปรตีน",        color: "#c7d2fe" },
    dairy:     { th: "นม/ผลิตภัณฑ์นม", color: "#e0e7ff" },
  };
  const GROUP_KEYS = Object.keys(GROUPS);

  // mapping id → fallback asset id (ใน a-assets)
  const FALLBACK_IMG = {
    rice:"#img-rice", noodle:"#img-noodle",
    lettuce:"#img-lettuce", carrot:"#img-carrot",
    banana:"#img-banana", orange:"#img-orange",
    fish:"#img-fish", egg:"#img-egg",
    milk:"#img-milk", yogurt:"#img-yogurt"
  };

  let FOODS = [
    { id:"rice", name:"ข้าวสวย", group:"grain", img:"" },
    { id:"noodle", name:"ก๋วยเตี๋ยว", group:"grain", img:"" },
    { id:"lettuce", name:"ผักกาดหอม", group:"vegetable", img:"" },
    { id:"carrot", name:"แครอท", group:"vegetable", img:"" },
    { id:"banana", name:"กล้วย", group:"fruit", img:"" },
    { id:"orange", name:"ส้ม", group:"fruit", img:"" },
    { id:"fish", name:"ปลาเผา", group:"protein", img:"" },
    { id:"egg", name:"ไข่ต้ม", group:"protein", img:"" },
    { id:"milk", name:"นมจืด", group:"dairy", img:"" },
    { id:"yogurt", name:"โยเกิร์ต", group:"dairy", img:"" }
  ];
  // หมายเหตุ: ถ้าคุณมีไฟล์จริง ให้ตั้ง img เป็นทางเช่น "assets/foods/rice.jpg"

  // ===== Game State =====
  const state = {
    running:false, elapsed:0, duration:60,
    speed:0.9, spawnEvery:1.3, lastSpawn:0,
    items:[], selectedGroup:"grain",
    score:0, ok:0, miss:0,
    resultLog:[], hint:true, raf:0, startTs:0
  };

  // ===== UI =====
  function applyMode(){
    const m = modeSel.value;
    if(m==="easy"){ state.speed=0.8; state.spawnEvery=1.5; state.duration=70; }
    if(m==="normal"){ state.speed=1.0; state.spawnEvery=1.2; state.duration=60; }
    if(m==="hard"){ state.speed=1.25; state.spawnEvery=1.0; state.duration=55; }
    state.hint = (hintSel.value==="on");
    setHUD();
  }
  function setHUD(msg){
    const left = state.duration - Math.max(0, Math.floor(state.elapsed));
    const a = `Nutrition Traffic VR\nโหมด: ${modeSel.value.toUpperCase()} • หมู่ที่เลือก: ${GROUPS[state.selectedGroup].th}\nHint: ${state.hint?"On":"Off"} • เวลา: ${left}s`;
    hudText.textContent = msg ? `${msg}\n${a}` : a;
    scoreEl.textContent = state.score; okEl.textContent = state.ok; missEl.textContent = state.miss;
    timeBar.style.width = `${Math.max(0,Math.min(100,(state.elapsed/state.duration)*100))}%`;
  }
  function flashHUD(text, color="#7dfcc6"){
    const el = document.createElement('div');
    el.className = 'card';
    el.style.position='fixed'; el.style.right='12px'; el.style.bottom='12px';
    el.style.background='rgba(0,0,0,.7)'; el.style.border=`2px solid ${color}`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 650);
  }

  // ===== Items as IMAGES =====
  function resolveImageSrc(food){
    // 1) ถ้ามี food.img (เช่น assets/foods/rice.jpg) ใช้เลย
    if(food.img) return food.img;
    // 2) fallback เป็น asset id ภายในหน้า
    const fid = FALLBACK_IMG[food.id];
    return fid || null;
  }

  function makeFoodEntity(food){
    const src = resolveImageSrc(food);

    // โครง item: พื้นหลังบาง + รูปอาหาร (plane) + แถบชื่อ/หมู่ (option)
    const holder = document.createElement('a-entity');
    holder.classList.add('food');
    holder.object3D.position.set(0, 0, 2.8);

    // พื้นหลังโปร่งนิดหน่อย (ให้รูปอ่านง่าย)
    const bg = document.createElement('a-entity');
    bg.setAttribute('geometry','primitive: plane; width: 0.9; height: 0.6');
    bg.setAttribute('material','color: #0b1220; opacity: 0.35; shader: flat');
    bg.setAttribute('position','0 0 0');
    holder.appendChild(bg);

    // รูปอาหาร
    const pic = document.createElement('a-entity');
    pic.setAttribute('geometry','primitive: plane; width: 0.78; height: 0.48');
    if(src && src.startsWith('#')) pic.setAttribute('material', `src: ${src}; shader: flat; opacity: 0.98`);
    else if(src) pic.setAttribute('material', `src: url(${src}); shader: flat; opacity: 0.98`);
    else pic.setAttribute('material', 'color: #94a3b8; shader: flat; opacity:0.95'); // สุดท้ายจริง ๆ
    pic.setAttribute('position','0 0 0.01');
    holder.appendChild(pic);

    // ข้อความ (ช่วยเด็กอ่าน)
    if(state.hint){
      const t = document.createElement('a-entity');
      t.setAttribute('text', `value: ${food.name} • ${GROUPS[food.group].th}; width: 2.6; align: center; color: #fff`);
      t.setAttribute('position','0 -0.36 0.02');
      holder.appendChild(t);
    }else{
      const t = document.createElement('a-entity');
      t.setAttribute('text', `value: ${food.name}; width: 2.4; align: center; color: #fff`);
      t.setAttribute('position','0 -0.36 0.02');
      holder.appendChild(t);
    }

    root.appendChild(holder);
    return holder;
  }

  // ===== Game flow =====
  function randFood(){ return FOODS[Math.floor(Math.random()*FOODS.length)]; }
  function spawnItem(){
    const food = randFood();
    const el = makeFoodEntity(food);
    state.items.push({ food, el, judged:false });
  }
  function judgeItem(it){
    if(it.judged) return;
    it.judged = true;
    const correct = (state.selectedGroup === it.food.group);
    if(correct){ state.score+=10; state.ok++; beep(1000,0.05,0.12); toast3D("ถูกต้อง +10","#7dfcc6"); }
    else { state.miss++; beep(260,0.06,0.14); toast3D("หมู่ไม่ตรง","#fecaca"); }
    state.resultLog.push({id:it.food.id, name:it.food.name, chosen:state.selectedGroup, correct:it.food.group, t:Date.now()});
    try{ it.el.setAttribute("animation__pop","property: scale; to: 1.12 1.12 1.12; dur: 100; dir: alternate"); }catch(e){}
    setTimeout(()=>{ it.el?.parentNode?.removeChild(it.el); }, 120);
  }
  function toast3D(text,color="#7dfcc6"){
    const el=document.createElement('a-entity');
    el.setAttribute('text',`value:${text}; width:4; align:center; color:#fff`);
    el.setAttribute('position','0 0.85 0.05');
    el.setAttribute('material',`color:${color}; opacity:0`);
    root.appendChild(el);
    try{
      el.setAttribute('animation__up','property: position; to: 0 1.05 0.05; dur: 380; easing:easeOutCubic');
      el.setAttribute('animation__fade','property: opacity; to: 1; dur: 120; dir: alternate');
    }catch(e){}
    setTimeout(()=>{ el.parentNode && el.parentNode.removeChild(el); }, 420);
  }

  function startGame(){
    ensureAudio();
    state.running=true; state.elapsed=0; state.lastSpawn=0;
    state.items=[]; state.score=0; state.ok=0; state.miss=0; state.resultLog=[]; state.startTs=performance.now()/1000;
    root.innerHTML='';
    setHUD("เริ่มเกมแล้ว!");
    loop();
  }
  function resetGame(){
    state.running=false; cancelAnimationFrame(state.raf);
    state.items=[]; root.innerHTML='';
    state.elapsed=0; state.score=0; state.ok=0; state.miss=0; setHUD("รีเซ็ตแล้ว พร้อมเริ่ม");
  }

  function loop(){
    if(!state.running) return;
    const now = performance.now()/1000;
    state.elapsed = now - state.startTs;

    if(now - state.lastSpawn >= state.spawnEvery){
      spawnItem(); state.lastSpawn = now;
    }

    const speed = state.speed;
    for(const it of state.items){
      if(!it.el) continue;
      const pos = it.el.object3D.position;
      pos.z = Math.max(0, pos.z - speed * (1/60));
      if(!it.judged && pos.z <= 0.02){ judgeItem(it); }
    }
    state.items = state.items.filter(x=> x.el && x.el.parentNode && !x.judged);

    setHUD();
    if(state.elapsed >= state.duration){
      state.running=false; endGame(); return;
    }
    state.raf = requestAnimationFrame(loop);
  }
  function endGame(){
    beep(1200,0.07,0.16);
    setHUD(`จบเกม! คะแนนรวม: ${state.score}\nถูก: ${state.ok} • พลาด: ${state.miss}`);
  }

  // ===== Events =====
  const bindClick = (el, fn) => {
    if(!el) return;
    const h = (e)=>{ e.preventDefault(); e.stopPropagation(); fn(e); };
    el.addEventListener('click', h); el.addEventListener('pointerup', h); el.addEventListener('touchend', h, {passive:false});
    el.addEventListener('keydown', (e)=>{ if(e.key===' '||e.key==='Enter'){ h(e); } });
  };
  bindClick(btnStart, ()=>{ if(!state.running){ applyMode(); startGame(); }});
  bindClick(btnReset, ()=> resetGame());
  bindClick(btnExport, ()=>{
    const payload = {
      game:"nutrition-traffic-vr", mode: modeSel.value, hint: state.hint,
      score: state.score, ok: state.ok, miss: state.miss, log: state.resultLog, ts: Date.now()
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `nutrition-traffic-result-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // เลือกหมู่ด้วยปุ่มแถบล่าง
  binsWrap?.addEventListener('click', (e)=>{
    const target = e.target.closest('.b'); if(!target) return;
    state.selectedGroup = target.dataset.g;
    flashHUD(`เลือกหมู่: ${GROUPS[state.selectedGroup].th}`, GROUPS[state.selectedGroup].color);
    beep(880,0.03,0.08);
  }, true);

  // คีย์บอร์ด 1..5 เลือกหมู่
  window.addEventListener('keydown', (e)=>{
    const idx = ["1","2","3","4","5"].indexOf(e.key); if(idx>=0){
      state.selectedGroup = GROUP_KEYS[idx];
      flashHUD(`เลือกหมู่: ${GROUPS[state.selectedGroup].th}`, GROUPS[state.selectedGroup].color);
      beep(760+idx*60,0.03,0.09);
    }
  });

  // Import เมนู (รองรับรูปจริง)
  importInput?.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    try{
      const text = await file.text();
      const obj = JSON.parse(text);
      if(Array.isArray(obj.foods)) FOODS = obj.foods;
      else if(Array.isArray(obj))   FOODS = obj;
      else throw new Error("รูปแบบ JSON ไม่ถูกต้อง");
      // แนวทางรูป: ตั้งค่า img ให้ชี้ไปไฟล์ในโปรเจกต์ เช่น "assets/foods/rice.jpg"
      flashHUD(`อัปเดตเมนู ${FOODS.length} รายการ (รองรับรูป img)`, "#7dfcc6");
    }catch(err){
      flashHUD("อ่านไฟล์ไม่สำเร็จ","red"); console.error(err);
    }finally{ importInput.value=""; }
  });

  // เริ่มแรก
  applyMode();
  setHUD("พร้อมเริ่ม — ตอนนี้ไอเท็มเป็นรูปภาพแล้ว (มี fallback SVG ในตัว)");
}
