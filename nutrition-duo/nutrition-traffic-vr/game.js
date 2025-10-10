// Nutrition Traffic VR — troika-text + ไทย, input เดสก์ท็อป/มือถือ, วงจรเกมเสถียร
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), root=$("#root");
  const scoreEl=$("#score"), okEl=$("#ok"), missEl=$("#miss");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset"), btnExport=$("#btnExport");
  const modeSel=$("#mode"), importInput=$("#importFoods"), bins=$("#bins");

  const THAI_FONT_URL = document.querySelector("#thaiFont")?.getAttribute("src");

  // ===== helper: troika text =====
  function makeText(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#fff",fontSize=0.16,maxWidth=4,align="center",anchorX="center",anchorY="middle"}=opts;
    e.setAttribute('troika-text',`
      value:${value};
      font:${THAI_FONT_URL};
      color:${color};
      fontSize:${fontSize};
      maxWidth:${maxWidth};
      align:${align};
      anchorX:${anchorX};
      anchorY:${anchorY};
    `.replace(/\s+/g,' '));
    e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }

  // ===== Cursor mode switch (desktop↔VR) =====
  const cursor=$("#cursor");
  function setCursorMode(vr){
    if(!cursor) return;
    if(vr){
      cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900");
      cursor.setAttribute("raycaster","objects: .clickable; far: 12; interval: 0");
      cursor.setAttribute("visible","true");
    }else{
      cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false");
      cursor.setAttribute("raycaster","objects: .clickable; far: 12; interval: 0");
      cursor.setAttribute("visible","false");
    }
  }
  setCursorMode(false);
  scene?.addEventListener("enter-vr", ()=>setCursorMode(true));
  scene?.addEventListener("exit-vr",  ()=>setCursorMode(false));

  // ===== Data =====
  const GROUPS = {
    grain:{ th:"ธัญพืช/แป้ง", color:"#fde68a" },
    vegetable:{ th:"ผัก", color:"#bbf7d0" },
    fruit:{ th:"ผลไม้", color:"#fecaca" },
    protein:{ th:"โปรตีน", color:"#c7d2fe" },
    dairy:{ th:"นม", color:"#e0e7ff" }
  };
  const FALLBACK = { rice:"#img-rice", noodle:"#img-noodle", lettuce:"#img-lettuce", carrot:"#img-carrot", banana:"#img-banana", orange:"#img-orange", fish:"#img-fish", egg:"#img-egg", milk:"#img-milk", yogurt:"#img-yogurt" };

  let FOODS = [
    {id:"rice",name:"ข้าวสวย",group:"grain"},
    {id:"noodle",name:"ก๋วยเตี๋ยว",group:"grain"},
    {id:"lettuce",name:"ผักกาดหอม",group:"vegetable"},
    {id:"carrot",name:"แครอท",group:"vegetable"},
    {id:"banana",name:"กล้วย",group:"fruit"},
    {id:"orange",name:"ส้ม",group:"fruit"},
    {id:"fish",name:"ปลาเผา",group:"protein"},
    {id:"egg",name:"ไข่ต้ม",group:"protein"},
    {id:"milk",name:"นมจืด",group:"dairy"},
    {id:"yogurt",name:"โยเกิร์ต",group:"dairy"},
  ];

  const state = {
    running:false,
    selectedGroup:"grain",
    t0:0, elapsed:0, duration:60,
    speed:1.0, spawnEvery:1.2, lastSpawn:0,
    items:[], raf:0,
    score:0, ok:0, miss:0, log:[]
  };

  // ===== Audio (เบา ๆ) =====
  let actx=null, sfxGain=null;
  function ensureAudio(){
    if(actx) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); sfxGain=actx.createGain(); sfxGain.gain.value=0.12; sfxGain.connect(actx.destination);
  }
  ["pointerdown","touchend","click"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,passive:true}));
  function beep(freq=880,dur=0.05,g=0.12){
    if(!actx) return;
    const o=actx.createOscillator(), gg=actx.createGain();
    o.type="sine"; o.frequency.value=freq; o.connect(gg); gg.connect(sfxGain);
    const t=actx.currentTime;
    gg.gain.setValueAtTime(0,t); gg.gain.linearRampToValueAtTime(g,t+0.005);
    gg.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.start(t); o.stop(t+dur+0.01);
  }

  // ===== HUD =====
  let hud=null;
  function setHUD(msg){
    if(!hud){
      hud=makeText("พร้อมเริ่ม",{fontSize:0.17,maxWidth:6,align:"center",color:"#e2e8f0"});
      hud.setAttribute('position','0 0.9 0.1');
      root.appendChild(hud);
    }
    const base=`หมู่ที่เลือก: ${GROUPS[state.selectedGroup].th} • เหลือเวลา: ${Math.max(0,Math.ceil(state.duration-state.elapsed))}s`;
    const text = msg ? `${msg}\n${base}` : base;
    hud.setAttribute('troika-text', `
      value: ${text};
      font: ${THAI_FONT_URL};
      color: #e2e8f0;
      fontSize: 0.17;
      maxWidth: 6;
      align: center;
    `.replace(/\s+/g,' '));
    scoreEl.textContent=state.score; okEl.textContent=state.ok; missEl.textContent=state.miss;
  }

  // ===== Utils =====
  function bindClick(el, fn){
    if(!el) return;
    const h=e=>{ e.preventDefault(); e.stopPropagation(); fn(e); };
    el.addEventListener("click",h);
    el.addEventListener("pointerup",h);
    el.addEventListener("touchend",h,{passive:false});
  }

  function toast3D(text,color="#ffffff"){
    const el=makeText(text,{color,fontSize:0.16,maxWidth:5});
    el.setAttribute('position','0 0.7 0.08');
    root.appendChild(el);
    try{
      el.setAttribute('animation__up','property: position; to: 0 0.95 0.08; dur: 380; easing:easeOutCubic');
      el.setAttribute('animation__fade','property: opacity; to: 0; dur: 380; delay:120');
    }catch(e){}
    setTimeout(()=>el.parentNode&&el.parentNode.removeChild(el),420);
  }

  function resolveSrc(food){
    if(food.img) return food.img;
    return FALLBACK[food.id] || null;
  }

  function makeItem(food){
    const holder=document.createElement('a-entity'); holder.classList.add('food');
    holder.object3D.position.set(0,0,2.8);

    const bg=document.createElement('a-entity');
    bg.setAttribute('geometry','primitive: plane; width: 1.0; height: 0.68');
    bg.setAttribute('material','color:#0b1220; opacity:0.45; shader:flat');
    holder.appendChild(bg);

    const pic=document.createElement('a-entity');
    pic.setAttribute('geometry','primitive: plane; width: 0.86; height: 0.5');
    const src=resolveSrc(food);
    if(src && src.startsWith("#")) pic.setAttribute('material',`src:${src}; shader:flat; opacity:0.98`);
    else if(src) pic.setAttribute('material',`src:url(${src}); shader:flat; opacity:0.98`);
    else pic.setAttribute('material','color:#94a3b8; shader:flat; opacity:0.95');
    pic.setAttribute('position','0 0.06 0.01');
    holder.appendChild(pic);

    const name=makeText(food.name,{color:"#ffffff",fontSize:0.16,maxWidth:2.4});
    name.setAttribute('position','0 -0.32 0.02');
    holder.appendChild(name);

    root.appendChild(holder);
    return holder;
  }

  function spawn(){
    const food=FOODS[Math.floor(Math.random()*FOODS.length)];
    const el=makeItem(food);
    state.items.push({food, el, judged:false, z:2.8});
  }

  function judge(it){
    if(it.judged) return;
    it.judged=true;
    const ok=(state.selectedGroup===it.food.group);
    if(ok){ state.score+=10; state.ok++; beep(1000,0.05,0.12); toast3D("ถูกต้อง +10","#7dfcc6"); }
    else { state.miss++; beep(260,0.06,0.14); toast3D("หมู่ไม่ตรง","#fecaca"); }
    state.log.push({id:it.food.id,name:it.food.name,chosen:state.selectedGroup,correct:it.food.group,t:Date.now()});
    try{ it.el.setAttribute("animation__pop","property: scale; to: 1.08 1.08 1.08; dur: 100; dir: alternate"); }catch(e){}
    setTimeout(()=>{ it.el?.parentNode?.removeChild(it.el); }, 120);
  }

  function applyMode(){
    const m=modeSel.value;
    if(m==="easy"){state.speed=0.9; state.spawnEvery=1.6; state.duration=70;}
    if(m==="normal"){state.speed=1.0; state.spawnEvery=1.2; state.duration=60;}
    if(m==="hard"){state.speed=1.25; state.spawnEvery=0.95; state.duration=55;}
    setHUD();
  }

  // ===== Game Loop =====
  function start(){
    cancelAnimationFrame(state.raf);
    state.running=true;
    state.items.forEach(x=>x.el?.parentNode?.removeChild(x.el));
    state.items.length=0;
    state.score=state.ok=state.miss=0; state.log=[];
    state.t0=performance.now()/1000; state.elapsed=0; state.lastSpawn=0;
    setHUD("เริ่มเกม");
    loop();
  }
  function reset(){
    state.running=false; cancelAnimationFrame(state.raf);
    state.items.forEach(x=>x.el?.parentNode?.removeChild(x.el));
    state.items.length=0; state.score=state.ok=state.miss=0; state.elapsed=0;
    setHUD("รีเซ็ตแล้ว");
    scoreEl.textContent=0; okEl.textContent=0; missEl.textContent=0;
  }
  function end(){
    state.running=false; cancelAnimationFrame(state.raf);
    beep(1200,0.07,0.16); setHUD(`จบเกม! คะแนน: ${state.score} (ถูก ${state.ok} / พลาด ${state.miss})`);
  }

  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000;
    state.elapsed=now - state.t0;

    // spawn
    if(now - state.lastSpawn >= state.spawnEvery){
      spawn(); state.lastSpawn = now;
    }

    // move + judge
    const dz = state.speed * (1/60);
    for(const it of state.items){
      it.z = Math.max(0, it.z - dz);
      it.el.object3D.position.z = it.z;
      if(!it.judged && it.z <= 0.06){ judge(it); }
    }
    // clear DOM ที่ถูกลบ
    state.items = state.items.filter(x=>x.el && x.el.parentNode);

    setHUD();
    if(state.elapsed >= state.duration){ end(); return; }
    state.raf=requestAnimationFrame(loop);
  }

  // ===== Events =====
  function bindBins(){
    bins.addEventListener('click',e=>{
      const b=e.target.closest('.b'); if(!b) return;
      state.selectedGroup=b.dataset.g; setHUD(); beep(760,0.03,0.09);
    });
    // touch/pointer fallback
    ["pointerup","touchend"].forEach(ev=>{
      bins.addEventListener(ev, e=>{
        const b=e.target.closest('.b'); if(!b) return;
        state.selectedGroup=b.dataset.g; setHUD(); beep(760,0.03,0.09);
      }, {passive:false});
    });
  }

  bindClick(btnStart, ()=>{ applyMode(); start(); });
  bindClick(btnReset, reset);
  bindBins();

  importInput.addEventListener('change', async e=>{
    const f=e.target.files?.[0]; if(!f) return;
    try{
      const txt=await f.text(); const obj=JSON.parse(txt);
      if(Array.isArray(obj.foods)) FOODS=obj.foods;
      else if(Array.isArray(obj)) FOODS=obj;
      else throw new Error("รูปแบบ JSON ไม่ถูกต้อง");
      setHUD(`นำเข้าเมนูแล้ว: ${FOODS.length} รายการ`);
    }catch(err){ alert("อ่านไฟล์ไม่สำเร็จ"); console.error(err); }
    finally{ importInput.value=""; }
  });

  bindClick(btnExport, ()=>{
    const payload={game:"traffic",mode:modeSel.value,score:state.score,ok:state.ok,miss:state.miss,log:state.log,ts:Date.now()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`traffic-result-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // boot
  applyMode(); setHUD("พร้อมเริ่ม");
}
