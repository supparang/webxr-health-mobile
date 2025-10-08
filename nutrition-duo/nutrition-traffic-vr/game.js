// Nutrition Traffic VR (รูปภาพ) — เลือกหมู่ให้ถูกก่อนถึงเส้นตัดสิน
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const hud=$("#hudText"), root=$("#root");
  const scoreEl=$("#score"), okEl=$("#ok"), missEl=$("#miss");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset"), btnExport=$("#btnExport");
  const modeSel=$("#mode"), importInput=$("#importFoods");
  const bins=$("#bins");

  const GROUPS = {
    grain:{ th:"ธัญพืช/แป้ง", color:"#fde68a" },
    vegetable:{ th:"ผัก", color:"#bbf7d0" },
    fruit:{ th:"ผลไม้", color:"#fecaca" },
    protein:{ th:"โปรตีน", color:"#c7d2fe" },
    dairy:{ th:"นม", color:"#e0e7ff" }
  };
  const ORDER=Object.keys(GROUPS);
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
    running:false, selectedGroup:"grain",
    elapsed:0, duration:60, speed:1.0, spawnEvery:1.2, lastSpawn:0,
    items:[], score:0, ok:0, miss:0, log:[], startTs:0, raf:0
  };

  // Audio
  let actx=null, sfxGain=null;
  function ensureAudio(){
    if(actx) return;
    const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    actx=new AC(); sfxGain=actx.createGain(); sfxGain.gain.value=0.12; sfxGain.connect(actx.destination);
  }
  ["pointerdown","touchend","click"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,passive:true}));
  function beep(freq=880,dur=0.05,gain=0.12){
    ensureAudio(); if(!actx) return;
    const o=actx.createOscillator(), g=actx.createGain();
    o.type="sine"; o.frequency.value=freq; o.connect(g); g.connect(sfxGain);
    const t=actx.currentTime;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(gain,t+0.005);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.start(t); o.stop(t+dur+0.01);
  }

  // UI
  function setHUD(msg){
    const left=state.duration - Math.max(0,Math.floor(state.elapsed));
    const base=`Nutrition Traffic VR\nหมู่ที่เลือก: ${GROUPS[state.selectedGroup].th} • เวลา: ${left}s`;
    hud.textContent = msg ? `${msg}\n${base}` : base;
    scoreEl.textContent=state.score; okEl.textContent=state.ok; missEl.textContent=state.miss;
  }
  function applyMode(){
    const m=modeSel.value;
    if(m==="easy"){state.speed=0.9; state.spawnEvery=1.5; state.duration=70;}
    if(m==="normal"){state.speed=1.0; state.spawnEvery=1.2; state.duration=60;}
    if(m==="hard"){state.speed=1.25; state.spawnEvery=1.0; state.duration=55;}
    setHUD();
  }

  // Items
  function resolveSrc(food){
    if(food.img) return food.img; // ไฟล์จริง
    const fb=FALLBACK[food.id]; return fb || null; // asset id
  }
  function makeItem(food){
    const holder=document.createElement('a-entity'); holder.classList.add('food'); holder.object3D.position.set(0,0,2.8);
    const bg=document.createElement('a-entity');
    bg.setAttribute('geometry','primitive: plane; width: 0.9; height: 0.6');
    bg.setAttribute('material','color:#0b1220; opacity:0.35; shader:flat'); holder.appendChild(bg);
    const pic=document.createElement('a-entity');
    pic.setAttribute('geometry','primitive: plane; width: 0.78; height: 0.48');
    const src=resolveSrc(food);
    if(src && src.startsWith("#")) pic.setAttribute('material',`src:${src}; shader:flat; opacity:0.98`);
    else if(src) pic.setAttribute('material',`src:url(${src}); shader:flat; opacity:0.98`);
    else pic.setAttribute('material','color:#94a3b8; shader:flat; opacity:0.95');
    pic.setAttribute('position','0 0 0.01'); holder.appendChild(pic);
    const name=document.createElement('a-entity');
    name.setAttribute('text',`value:${food.name}; width: 2.4; align:center; color:#fff`);
    name.setAttribute('position','0 -0.36 0.02'); holder.appendChild(name);
    root.appendChild(holder);
    return holder;
  }
  function spawn(){
    const food=FOODS[Math.floor(Math.random()*FOODS.length)];
    const el=makeItem(food);
    state.items.push({food, el, judged:false});
  }
  function judge(it){
    if(it.judged) return; it.judged=true;
    const ok=(state.selectedGroup===it.food.group);
    if(ok){ state.score+=10; state.ok++; beep(1000,0.05,0.12); toast3D("ถูกต้อง +10","#7dfcc6"); }
    else { state.miss++; beep(260,0.06,0.14); toast3D("หมู่ไม่ตรง","#fecaca"); }
    state.log.push({id:it.food.id,name:it.food.name,chosen:state.selectedGroup,correct:it.food.group,t:Date.now()});
    try{ it.el.setAttribute("animation__pop","property: scale; to: 1.12 1.12 1.12; dur: 100; dir: alternate"); }catch(e){}
    setTimeout(()=>{ it.el?.parentNode?.removeChild(it.el); }, 120);
  }
  function toast3D(text,color){
    const el=document.createElement('a-entity');
    el.setAttribute('text',`value:${text}; width:4; align:center; color:#fff`);
    el.setAttribute('position','0 0.85 0.05'); root.appendChild(el);
    try{
      el.setAttribute('animation__up','property: position; to: 0 1.05 0.05; dur: 380; easing:easeOutCubic');
      el.setAttribute('animation__fade','property: opacity; to: 0; dur: 380; delay:120');
    }catch(e){}
    setTimeout(()=>el.parentNode&&el.parentNode.removeChild(el),420);
  }

  // Loop
  function start(){ state.running=true; state.elapsed=0; state.lastSpawn=0; state.items=[]; state.score=0; state.ok=0; state.miss=0; state.log=[]; state.startTs=performance.now()/1000; root.innerHTML=''; setHUD("เริ่มเกม"); loop(); }
  function reset(){ state.running=false; cancelAnimationFrame(state.raf); state.items=[]; root.innerHTML=''; state.elapsed=0; state.score=0; state.ok=0; state.miss=0; setHUD("รีเซ็ตแล้ว"); }
  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.startTs;
    if(now-state.lastSpawn>=state.spawnEvery){ spawn(); state.lastSpawn=now; }
    for(const it of state.items){
      const pos=it.el.object3D.position; pos.z=Math.max(0,pos.z - state.speed*(1/60));
      if(!it.judged && pos.z<=0.02) judge(it);
    }
    state.items = state.items.filter(x=>x.el&&x.el.parentNode&&!x.judged);
    setHUD();
    if(state.elapsed>=state.duration){ state.running=false; end(); return; }
    state.raf=requestAnimationFrame(loop);
  }
  function end(){ beep(1200,0.07,0.16); setHUD(`จบเกม! คะแนน: ${state.score} (ถูก ${state.ok} / พลาด ${state.miss})`); }

  // Events
  btnStart.addEventListener('click', ()=>{ if(!state.running){ applyMode(); start(); }});
  btnReset.addEventListener('click', reset);
  bins.addEventListener('click', e=>{
    const b=e.target.closest('.b'); if(!b) return;
    state.selectedGroup=b.dataset.g; setHUD(); beep(760,0.03,0.09);
  });
  importInput.addEventListener('change', async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const text=await file.text(); const obj=JSON.parse(text);
      if(Array.isArray(obj.foods)) FOODS=obj.foods;
      else if(Array.isArray(obj)) FOODS=obj;
      else throw new Error("รูปแบบ JSON ไม่ถูกต้อง");
      setHUD(`นำเข้าเมนูแล้ว: ${FOODS.length} รายการ`);
    }catch(err){ alert("อ่านไฟล์ไม่สำเร็จ"); console.error(err); }
    finally{ importInput.value=""; }
  });
  btnExport.addEventListener('click', ()=>{
    const payload={game:"traffic",score:state.score,ok:state.ok,miss:state.miss,log:state.log,ts:Date.now()};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=`traffic-result-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // init
  applyMode(); setHUD("พร้อมเริ่ม");
}
