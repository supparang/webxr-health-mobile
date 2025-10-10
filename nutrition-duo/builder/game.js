// Healthy Plate Builder VR — เมนูด้านบน + Toggle + Desktop/VR cursor + ฟอนต์ไทย
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);

  const scene=$("#scene"), cursor=$("#cursor");
  const root=$("#root"), hud=$("#hudText");
  const scoreEl=$("#score"), okEl=$("#ok"), missEl=$("#miss");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset"), btnExport=$("#btnExport"), modeSel=$("#mode"), importInput=$("#importFoods");
  const btnToggleMenu=$("#btnToggleMenu");

  // ใช้ฟอนต์ไทยกับทุก a-entity text
  const FONT = "font: #thaiFont;";

  // ---------- Cursor desktop/VR ----------
  function setCursorMode(mode){
    if(!cursor) return;
    if(mode==="vr"){
      cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900");
      cursor.setAttribute("raycaster","objects: .clickable; far: 12; interval: 0");
      cursor.setAttribute("visible","true");
    }else{
      cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false");
      cursor.setAttribute("raycaster","objects: .clickable; far: 12; interval: 0");
      cursor.setAttribute("visible","false");
    }
  }
  setCursorMode("desktop");
  scene?.addEventListener("enter-vr", ()=>setCursorMode("vr"));
  scene?.addEventListener("exit-vr",  ()=>setCursorMode("desktop"));

  // ---------- Data ----------
  const GROUPS = {
    grain:{ th:"แป้ง/ธัญพืช", color:"#fde68a", target:[1,2] },
    vegetable:{ th:"ผัก", color:"#bbf7d0", target:[2,4] },
    fruit:{ th:"ผลไม้", color:"#fecaca", target:[1,2] },
    protein:{ th:"โปรตีน", color:"#c7d2fe", target:[1,2] },
    dairy:{ th:"นม", color:"#e0e7ff", target:[1,1] }
  };
  const ORDER = ["grain","vegetable","fruit","protein","dairy"];

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
    picks:[],
    count:{grain:0,vegetable:0,fruit:0,protein:0,dairy:0},
    score:0, ok:0, miss:0,
    menuVisible:true
  };

  // ---------- Utils ----------
  function bindClick(el, fn){
    if(!el) return;
    const h=e=>{ e.preventDefault(); e.stopPropagation(); fn(e); };
    el.addEventListener("click",h);
    el.addEventListener("pointerup",h);
    el.addEventListener("touchend",h,{passive:false});
    el.addEventListener("keydown",e=>{ if(e.key===" "||e.key==="Enter") h(e); });
  }

  function setHUD(msg){
    hud.textContent = msg || "Healthy Plate Builder VR\nพร้อมเริ่ม";
    scoreEl.textContent=state.score; okEl.textContent=state.ok; missEl.textContent=state.miss;
  }

  function popToast(text){
    const el=document.createElement('a-entity');
    el.setAttribute('text',`value:${text}; ${FONT} width:5; align:center; color:#fff`);
    el.setAttribute('position','0 0.85 0.12');
    root.appendChild(el);
    try{
      el.setAttribute('animation__up','property: position; to: 0 1.05 0.12; dur: 420; easing:easeOutCubic');
      el.setAttribute('animation__fade','property: opacity; to: 0; dur: 420; delay:140');
    }catch(e){}
    setTimeout(()=>el.parentNode&&el.parentNode.removeChild(el), 520);
  }

  // ---------- Build Scene ----------
  let menuPanel=null; // ใช้ toggle
  function buildScene(){
    while(root.firstChild) root.removeChild(root.firstChild);

    // จาน
    const plate=document.createElement('a-entity');
    plate.setAttribute('geometry','primitive: circle; radius: 1.1; segments:64');
    plate.setAttribute('material','color:#f8fafc; shader:flat; opacity:0.98');
    plate.setAttribute('position','0 0 0.02');
    root.appendChild(plate);

    // โซน 5 ชั้น (ring)
    ORDER.forEach((g,i)=>{
      const seg=document.createElement('a-entity');
      seg.setAttribute('geometry',`primitive: ring; radiusInner:${0.1+i*0.18}; radiusOuter:${0.18+i*0.18}; thetaStart:0; thetaLength:300`);
      seg.setAttribute('material',`color:${GROUPS[g].color}; opacity:0.28; shader:flat`);
      seg.setAttribute('position','0 0 0.03');
      root.appendChild(seg);

      const t=document.createElement('a-entity');
      t.setAttribute('text',`value:${GROUPS[g].th}: 0; ${FONT} width: 4.2; align:center; color:#fff`);
      t.setAttribute('position',`0 ${0.9 - i*0.35} 0.05`);
      t.setAttribute('id',`txt-${g}`);
      root.appendChild(t);
    });

    // ===== เมนูอาหาร (ด้านบน-กลาง) =====
    menuPanel=document.createElement('a-entity');

    const bg=document.createElement('a-entity');
    bg.setAttribute('geometry','primitive: plane; width: 2.8; height: 1.48');
    bg.setAttribute('material','color:#0b1220; opacity:0.72; shader:flat');
    bg.setAttribute('position','0 0 0');
    menuPanel.appendChild(bg);

    const title=document.createElement('a-entity');
    title.setAttribute('text',`value:เมนูอาหาร (กดปุ่มเพื่อเพิ่มลงจาน); ${FONT} width:6; align:center; color:#7dfcc6`);
    title.setAttribute('position','0 0.56 0.01');
    menuPanel.appendChild(title);

    const ICON = { grain:"🍚", vegetable:"🥬", fruit:"🍊", protein:"🍗", dairy:"🥛" };

    const groups=ORDER;
    let rowY=0.18;
    groups.forEach((g)=>{
      const gTitle=document.createElement('a-entity');
      gTitle.setAttribute('text',`value:${ICON[g]||"•"} ${GROUPS[g].th}; ${FONT} width:4.6; align:left; color:#e2e8f0`);
      gTitle.setAttribute('position',`-1.22 ${rowY} 0.01`);
      menuPanel.appendChild(gTitle);

      const foods=FOODS.filter(f=>f.group===g);
      if(!foods.length){
        const warn=document.createElement('a-entity');
        warn.setAttribute('text',`value:(ไม่มีรายการ — ตรวจ JSON); ${FONT} width:3.6; align:left; color:#fecaca`);
        warn.setAttribute('position',`-0.2 ${rowY} 0.01`);
        menuPanel.appendChild(warn);
      }else{
        foods.slice(0,3).forEach((f,idx)=>{
          const x=-0.2 + idx*0.85;
          const btn=document.createElement('a-entity');
          btn.classList.add('clickable');
          btn.setAttribute('geometry','primitive: plane; width: 0.78; height: 0.3');
          btn.setAttribute('material','color:#111827; opacity:0.95; shader:flat');
          btn.setAttribute('position',`${x} ${rowY} 0.02`);
          const txt=document.createElement('a-entity');
          txt.setAttribute('text',`value:+ ${f.name}; ${FONT} width:2.4; align:center; color:#7dfcc6`);
          txt.setAttribute('position','0 0 0.01');
          btn.appendChild(txt);
          btn.addEventListener('click',()=>addFood(f));
          menuPanel.appendChild(btn);
        });
      }
      rowY -= 0.36;
    });

    // ตำแหน่งเมนู: ด้านบน ตรงกลาง และขยับมาใกล้ผู้เล่น
    menuPanel.setAttribute('position','0 0.78 0.12');
    root.appendChild(menuPanel);

    // ปุ่ม “ให้คะแนน”
    const finish=document.createElement('a-entity');
    finish.classList.add('clickable');
    finish.setAttribute('geometry','primitive: plane; width: 1.6; height: 0.38');
    finish.setAttribute('material','color:#7dfcc6; opacity:0.96; shader:flat');
    finish.setAttribute('position','1.8 -1.0 0.06');
    const ft=document.createElement('a-entity');
    ft.setAttribute('text',`value:ให้คะแนน; ${FONT} width:4; align:center; color:#053b2a`);
    ft.setAttribute('position','0 0 0.01');
    finish.appendChild(ft);
    finish.addEventListener('click', scoreNow);
    root.appendChild(finish);

    const hint=document.createElement('a-entity');
    hint.setAttribute('text',`value:เป้าหมาย: แป้ง1–2 | ผัก≥2 | ผลไม้≥1 | โปรตีน1 | นม1; ${FONT} width:5.8; align:center; color:#cbd5e1`);
    hint.setAttribute('position','0 -1.1 0.06');
    root.appendChild(hint);

    // แสดง/ซ่อนเมนูตามสถานะ
    menuPanel.setAttribute('visible', state.menuVisible);
  }

  function toggleMenu(){
    state.menuVisible = !state.menuVisible;
    if(menuPanel) menuPanel.setAttribute('visible', state.menuVisible);
    popToast(state.menuVisible ? "แสดงเมนู" : "ซ่อนเมนู");
  }

  function updateTexts(){
    ["grain","vegetable","fruit","protein","dairy"].forEach(g=>{
      const el=document.getElementById(`txt-${g}`);
      if(el) el.setAttribute('text',`value:${GROUPS[g].th}: ${state.count[g]||0}; ${FONT} width:4.2; align:center; color:#fff`);
    });
  }

  // ---------- Game Flow ----------
  function addFood(f){
    if(!state.running) return;
    state.picks.push({id:f.id,name:f.name,group:f.group});
    state.count[f.group] = (state.count[f.group]||0) + 1;
    updateTexts();
    popToast(`+ ${f.name} (${GROUPS[f.group].th})`);
  }

  function scoreNow(){
    let ok=0, miss=0, score=0;
    for(const g of ["grain","vegetable","fruit","protein","dairy"]){
      const [min,max]=GROUPS[g].target, val=state.count[g]||0;
      if(val>=min && val<=max){ ok++; score+=20; } else miss++;
    }
    if(ok===5) score+=60;
    state.ok=ok; state.miss=miss; state.score=score;
    setHUD(`ให้คะแนนแล้ว\nคะแนน: ${score} • ครบหมู่: ${ok} • ขาด/เกิน: ${miss}`);
  }

  function reset(){
    state.running=false;
    state.picks=[]; state.count={grain:0,vegetable:0,fruit:0,protein:0,dairy:0};
    state.score=0; state.ok=0; state.miss=0;
    scoreEl.textContent=0; okEl.textContent=0; missEl.textContent=0;
    buildScene(); updateTexts();
    setHUD();
  }

  function start(){
    reset(); state.running=true;
    setHUD("เริ่มจัดจานได้เลย! ใช้เมนูด้านบนเพื่อเพิ่มอาหาร");
  }

  // ---------- Import/Export ----------
  importInput.addEventListener('change', async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const txt=await file.text(); const obj=JSON.parse(txt);
      if(Array.isArray(obj.foods)) FOODS=obj.foods;
      else if(Array.isArray(obj)) FOODS=obj;
      else throw new Error("รูปแบบ JSON ไม่ถูกต้อง");
      start(); // รีเฟรชเมนูใหม่
    }catch(err){ alert("อ่านไฟล์ไม่สำเร็จ"); console.error(err); }
    finally{ importInput.value=""; }
  });

  bindClick(btnExport, ()=>{
    const payload = {
      game:"builder", mode:modeSel.value,
      picks:state.picks, counts:state.count,
      score:state.score, ok:state.ok, miss:state.miss, ts:Date.now()
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url;
    a.download=`builder-result-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  bindClick(btnStart, ()=>{ if(!state.running) start(); });
  bindClick(btnReset, reset);
  bindClick(btnToggleMenu, toggleMenu);

  // ปุ่มคีย์ลัด M
  window.addEventListener('keydown', (e)=>{ if(e.key.toLowerCase()==='m') toggleMenu(); });

  // ---------- Boot ----------
  reset();
}
