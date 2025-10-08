// Healthy Plate Builder VR — จัดจาน 5 หมู่ + Import/Export JSON + คำแนะนำเด็ก ป.5
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const root=$("#root"), hud=$("#hudText");
  const scoreEl=$("#score"), okEl=$("#ok"), missEl=$("#miss");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset"), btnExport=$("#btnExport"), modeSel=$("#mode"), importInput=$("#importFoods");

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
    picks:[],         // [{id, group, name}]
    count:{grain:0,vegetable:0,fruit:0,protein:0,dairy:0},
    score:0, ok:0, miss:0
  };

  // ===== Plate & UI in 3D =====
  function buildScene(){
    while(root.firstChild) root.removeChild(root.firstChild);

    // จานพื้น
    const plate=document.createElement('a-entity');
    plate.setAttribute('geometry','primitive: circle; radius: 1.1; segments:64');
    plate.setAttribute('material','color:#f8fafc; shader:flat; opacity:0.98');
    plate.setAttribute('position','0 0 0.02');
    root.appendChild(plate);

    // 5 โซน (วงกลมห้าเค้ก)
    ORDER.forEach((g,i)=>{
      const seg=document.createElement('a-entity');
      seg.setAttribute('geometry',`primitive: ring; radiusInner:${0.1+i*0.18}; radiusOuter:${0.18+i*0.18}; thetaStart:0; thetaLength:300`);
      seg.setAttribute('material',`color:${GROUPS[g].color}; opacity:0.28; shader:flat`);
      seg.setAttribute('position','0 0 0.03');
      root.appendChild(seg);

      // ตัวเลขสรุป
      const t=document.createElement('a-entity');
      t.setAttribute('text',`value:${GROUPS[g].th}: 0; width: 4; align:center; color:#fff`);
      t.setAttribute('position',`0 ${0.9 - i*0.35} 0.05`);
      t.setAttribute('id',`txt-${g}`);
      root.appendChild(t);
    });

    // เมนูซ้ายมือ (5 หมู่)
    const menu=document.createElement('a-entity');
    menu.setAttribute('position','-1.8 0 0');
    root.appendChild(menu);

    const groups = ORDER.map((g,ix)=>({g, y: 0.8 - ix*0.4}));
    groups.forEach(({g,y})=>{
      const title=document.createElement('a-entity');
      title.setAttribute('text',`value:${GROUPS[g].th}; width:4; color:#e2e8f0; align:left`);
      title.setAttribute('position',`0 ${y+0.18} 0.05`);
      menu.appendChild(title);

      // ปุ่มอาหารในหมู่นั้น
      const foods=FOODS.filter(f=>f.group===g).slice(0,3);
      foods.forEach((f,idx)=>{
        const btn=document.createElement('a-entity');
        btn.classList.add('clickable');
        btn.setAttribute('geometry','primitive: plane; width: 1.4; height: 0.28');
        btn.setAttribute('material','color:#111827; opacity:0.95; shader:flat');
        btn.setAttribute('position',`${0.0} ${y - idx*0.3} 0.06`);
        const txt=document.createElement('a-entity');
        txt.setAttribute('text',`value:+ ${f.name}; width:3.5; align:center; color:#7dfcc6`);
        txt.setAttribute('position','0 0 0.01');
        btn.appendChild(txt);
        btn.addEventListener('click',()=>addFood(f));
        menu.appendChild(btn);
      });
    });

    // ปุ่มจบ/ให้คะแนน
    const finish=document.createElement('a-entity');
    finish.classList.add('clickable');
    finish.setAttribute('geometry','primitive: plane; width: 1.4; height: 0.36');
    finish.setAttribute('material','color:#7dfcc6; opacity:0.96; shader:flat');
    finish.setAttribute('position','1.8 -1.0 0.06');
    const ft=document.createElement('a-entity');
    ft.setAttribute('text','value:ให้คะแนน; width:4; align:center; color:#053b2a');
    ft.setAttribute('position','0 0 0.01');
    finish.appendChild(ft);
    finish.addEventListener('click', scoreNow);
    root.appendChild(finish);

    // Hint ป.5
    const hint=document.createElement('a-entity');
    hint.setAttribute('text','value:เป้าหมาย: แป้ง1–2 | ผัก≥2 | ผลไม้≥1 | โปรตีน1 | นม1; width:5.5; align:center; color:#cbd5e1');
    hint.setAttribute('position','0 -1.1 0.06');
    root.appendChild(hint);
  }

  function addFood(f){
    if(!state.running) return;
    state.picks.push({id:f.id,name:f.name,group:f.group});
    state.count[f.group] = (state.count[f.group]||0) + 1;
    updateTexts();
    popToast(`+ ${f.name} (${GROUPS[f.group].th})`,"#7dfcc6");
  }

  function updateTexts(){
    ORDER.forEach(g=>{
      const el=document.getElementById(`txt-${g}`);
      if(el) el.setAttribute('text',`value:${GROUPS[g].th}: ${state.count[g]||0}; width:4; align:center; color:#fff`);
    });
  }

  function scoreNow(){
    // คำนวณคะแนนแบบไฟจราจร
    let ok=0, miss=0, score=0;
    ORDER.forEach(g=>{
      const [min,max]=GROUPS[g].target;
      const val=state.count[g]||0;
      if(val>=min && val<=max){ ok++; score+=20; }
      else miss++;
    });
    // โบนัสสมดุลครบทุกหมู่
    if(ok===ORDER.length) score+=60;

    state.ok=ok; state.miss=miss; state.score=score;
    scoreEl.textContent=score; okEl.textContent=ok; missEl.textContent=miss;
    hud.textContent=`ให้คะแนนแล้ว\nคะแนน: ${score} • ครบหมู่: ${ok} • ขาด/เกิน: ${miss}`;
  }

  function reset(){
    state.running=false;
    state.picks=[]; state.count={grain:0,vegetable:0,fruit:0,protein:0,dairy:0};
    state.score=0; state.ok=0; state.miss=0;
    scoreEl.textContent=0; okEl.textContent=0; missEl.textContent=0;
    buildScene(); updateTexts();
    hud.textContent="Healthy Plate Builder VR\nพร้อมเริ่ม";
  }

  function start(){
    reset();
    state.running=true;
    hud.textContent="เริ่มจัดจานได้เลย! เลือกอาหารจากเมนูด้านซ้าย";
  }

  function popToast(text,color="#7dfcc6"){
    const el=document.createElement('a-entity');
    el.setAttribute('text',`value:${text}; width:5; align:center; color:#fff`);
    el.setAttribute('position','0 0.85 0.08');
    root.appendChild(el);
    try{
      el.setAttribute('animation__up','property: position; to: 0 1.05 0.08; dur: 420; easing: easeOutCubic');
      el.setAttribute('animation__fade','property: opacity; to: 0; dur: 420; delay:140');
    }catch(e){}
    setTimeout(()=>el.parentNode&&el.parentNode.removeChild(el), 520);
  }

  // Import/Export เมนู
  importInput.addEventListener('change', async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const txt=await file.text(); const obj=JSON.parse(txt);
      if(Array.isArray(obj.foods)) FOODS=obj.foods;
      else if(Array.isArray(obj)) FOODS=obj;
      else throw new Error("รูปแบบ JSON ไม่ถูกต้อง");
      hud.textContent="อัปเดตเมนูเรียบร้อย";
      start(); // รีเฟรชเมนู
    }catch(err){ alert("อ่านไฟล์ไม่สำเร็จ"); console.error(err); }
    finally{ importInput.value=""; }
  });

  btnExport.addEventListener('click', ()=>{
    const payload = {
      game:"builder", mode:modeSel.value,
      picks:state.picks, counts:state.count,
      score:state.score, ok:state.ok, miss:state.miss, ts:Date.now()
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`builder-result-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  btnStart.addEventListener('click', ()=>{ if(!state.running) start(); });
  btnReset.addEventListener('click', reset);

  // init
  reset();
}
