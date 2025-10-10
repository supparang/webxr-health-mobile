// Fitness Duo VR — Menu v3 (เพิ่ม Weekly Board)
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), root=$("#root"), cursor=$("#cursor"), hud=$("#hud");

  const btnStart=$("#btnStart");
  const btnAdventure=$("#btnAdventure");
  const btnRhythm=$("#btnRhythm");
  const selDiff=$("#difficulty");
  const selTheme=$("#theme");
  const selQuest=$("#quest");
  const selBpm=$("#bpm");

  // ---------- Cursor desktop/VR ----------
  function setCursorMode(mode){
    if(!cursor) return;
    if(mode==="vr"){
      cursor.setAttribute("cursor","rayOrigin: entity; fuse: true; fuseTimeout: 900");
      cursor.setAttribute("raycaster","objects: .clickable; far: 15; interval: 0");
      cursor.setAttribute("visible","true");
    }else{
      cursor.setAttribute("cursor","rayOrigin: mouse; fuse: false");
      cursor.setAttribute("raycaster","objects: .clickable; far: 15; interval: 0");
      cursor.setAttribute("visible","false");
    }
  }
  setCursorMode("desktop");
  scene?.addEventListener("enter-vr", ()=>setCursorMode("vr"));
  scene?.addEventListener("exit-vr",  ()=>setCursorMode("desktop"));

  // ---------- Analytics (เบา ๆ ผ่าน Image Ping) ----------
  function ping(ev, extra={}){
    try{
      const payload = {event:ev, t:Date.now(), ...extra};
      const url = "https://api.count.ly/collect?d="+encodeURIComponent(JSON.stringify(payload));
      const img = new Image(); img.src = url;
    }catch(e){}
  }

  // ---------- 3D Labels (troika-text) ----------
  const THAI_FONT = "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts/hinted/ttf/NotoSansThai/NotoSansThai-Regular.ttf";
  function text3D(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#e2e8f0", fontSize=0.22, maxWidth=6, x=0, y=0, z=0.05} = opts;
    e.setAttribute('troika-text', `
      value: ${value};
      font: ${THAI_FONT};
      color: ${color};
      fontSize: ${fontSize};
      maxWidth: ${maxWidth};
      align: center;
    `.replace(/\s+/g,' '));
    e.setAttribute('position', `${x} ${y} ${z}`);
    e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }

  // ---------- Scene UI (3D) ----------
  function buildScene(){
    while(root.firstChild) root.removeChild(root.firstChild);

    const title=text3D("Fitness Duo VR",{fontSize:0.34, y:0.9});
    root.appendChild(title);

    // ปุ่ม Weekly Board (3D)
    const weeklyBtn=document.createElement('a-entity');
    weeklyBtn.classList.add('clickable');
    weeklyBtn.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.45');
    weeklyBtn.setAttribute('material','color:#fde68a; opacity:0.96; shader:flat');
    weeklyBtn.setAttribute('position','0 0.0 0.06');
    weeklyBtn.appendChild(text3D("กระดานภารกิจรายสัปดาห์ (W)",{color:"#2b2100",fontSize:0.2, y:0, z:0.01}));
    weeklyBtn.addEventListener('click', openWeeklyBoard);
    root.appendChild(weeklyBtn);

    // ปุ่มเริ่มเกม (3D)
    const panel=document.createElement('a-entity');
    panel.setAttribute('position','0 0 0.06');
    const buttons = [
      {id:"go-adventure", label:"เริ่ม Adventure", color:"#7dfcc6", route:"adventure", y:0.6},
      {id:"go-rhythm",    label:"เริ่ม Rhythm",    color:"#93c5fd", route:"rhythm",    y:-0.6}
    ];
    for(const b of buttons){
      const btn=document.createElement('a-entity');
      btn.classList.add('clickable');
      btn.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.45');
      btn.setAttribute('material',`color:${b.color}; opacity:0.96; shader:flat`);
      btn.setAttribute('position',`0 ${b.y} 0`);
      const t=text3D(b.label,{color:"#082d28",fontSize:0.22, maxWidth:4, y:0, z:0.01});
      btn.appendChild(t);
      btn.addEventListener('click', ()=>routeTo(b.route));
      panel.appendChild(btn);
    }
    root.appendChild(panel);

    const hint=text3D("เดสก์ท็อป: คลิก • VR: จ้องค้าง • คีย์ลัด A/R/W/Enter",{fontSize:0.16,y:-1.1});
    root.appendChild(hint);
  }

  function setHUD(msg){
    hud.textContent = msg || "Fitness Duo VR — Menu\nพร้อมเริ่ม";
  }

  function bindClick(el, fn){
    if(!el) return;
    const h=e=>{ e.preventDefault(); e.stopPropagation(); fn(e); };
    el.addEventListener("click",h);
    el.addEventListener("pointerup",h);
    el.addEventListener("touchend",h,{passive:false});
    el.addEventListener("keydown",e=>{ if(e.key===" "||e.key==="Enter") h(e); });
  }

  function routeTo(kind, extraQuery=""){
    const diff = selDiff.value || "easy";
    const theme= selTheme.value || "jungle";
    const quest= selQuest.value || "collect";
    const bpm  = selBpm.value || "96";

    if(kind==="adventure"){
      const q = `?diff=${encodeURIComponent(diff)}&theme=${encodeURIComponent(theme)}&quest=${encodeURIComponent(quest)}&source=fitness-duo${extraQuery}`;
      ping("enter_adventure",{diff,theme,quest});
      location.href = `./adventure/index.html${q}`;
    }else if(kind==="rhythm"){
      const q = `?diff=${encodeURIComponent(diff)}&bpm=${encodeURIComponent(bpm)}&source=fitness-duo${extraQuery}`;
      ping("enter_rhythm",{diff,bpm});
      location.href = `./rhythm/index.html${q}`;
    }
  }

  // ---------- Weekly Board ----------
  function getISOWeek(d=new Date()){
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (dt.getUTCDay()+6)%7; // Mon=0
    dt.setUTCDate(dt.getUTCDate()-dayNum+3);
    const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(),0,4));
    const weekNo = 1 + Math.round(((dt - firstThursday)/86400000 - 3 + ((firstThursday.getUTCDay()+6)%7))/7);
    return {year: dt.getUTCFullYear(), week: weekNo};
  }
  function rand(seed){ // mulberry32
    let a=seed|0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296; };
  }
  function hash(s){ let h=0; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return h; }

  // สร้างรายการภารกิจสัปดาห์นี้ (3 Adventure + 3 Rhythm)
  function genWeekly(){
    const {year,week}=getISOWeek(); const seed=`${year}-W${week}`;
    const r=rand(hash(seed));
    const adv = [
      {type:"collect", label:"Adventure: เก็บ Orb", target: 8 + ((r()*8)|0), query:(t)=>`&autoChallenge=0&wtype=collect&wtarget=${t}`},
      {type:"streak",  label:"Adventure: สตรีคหลบ", target: 6 + ((r()*10)|0), query:(t)=>`&autoChallenge=0&wtype=streak&wtarget=${t}`},
      {type:"survive", label:"Adventure: เอาตัวรอด", target: 1,                         query:(t)=>`&autoChallenge=0&wtype=survive&wtarget=${t}`}
    ];
    const bpmSel = selBpm.value||"96";
    const rhy = [
      {type:"score",   label:`Rhythm: ทำคะแนนรวม`, target: 2200 + ((r()*1800)|0), query:(t)=>`&autoChallenge=0&wtype=score&wtarget=${t}&bpm=${bpmSel}`},
      {type:"combo",   label:`Rhythm: คอมโบยาว`,   target: 12 + ((r()*18)|0),     query:(t)=>`&autoChallenge=0&wtype=combo&wtarget=${t}&bpm=${bpmSel}`},
      {type:"accuracy",label:`Rhythm: ความแม่นยำ`, target: 0.82 + r()*0.1,        query:(t)=>`&autoChallenge=0&wtype=accuracy&wtarget=${t.toFixed(2)}&bpm=${bpmSel}`}
    ];
    return {seed, adv, rhy};
  }

  function openWeeklyBoard(){
    const {seed, adv, rhy} = genWeekly();
    setHUD(`Weekly Board • ${seed}`);

    // แสดง modal แบบ 3D ง่าย ๆ
    const old = root.querySelector('#weeklyPanel'); if(old) old.remove();
    const panel=document.createElement('a-entity'); panel.setAttribute('id','weeklyPanel');
    panel.setAttribute('position','0 0 0.08');

    const bg=document.createElement('a-entity');
    bg.setAttribute('geometry','primitive: plane; width: 3.2; height: 2.0');
    bg.setAttribute('material','color:#0b1220; opacity:0.92; shader:flat');
    bg.setAttribute('position','0 0 0');
    panel.appendChild(bg);

    panel.appendChild(text3D(`กระดานภารกิจรายสัปดาห์ • ${seed}`,{y:0.8,fontSize:0.22}));

    let y=0.45;
    const mk=(label,desc,route,queryMaker)=>{
      const row=document.createElement('a-entity');
      const plate=document.createElement('a-entity');
      plate.classList.add('clickable');
      plate.setAttribute('geometry','primitive: plane; width: 2.8; height: 0.28');
      plate.setAttribute('material','color:#111827; opacity:0.95; shader:flat');
      plate.setAttribute('position',`0 ${y} 0.01`);
      const t1=text3D(label,{x:-1.2,y:0.04,fontSize:0.18,maxWidth:2.2});
      t1.setAttribute('anchorX','left'); t1.setAttribute('position',`-1.2 ${y+0.04} 0.02`);
      const t2=text3D(desc,{x:-1.2,y:-0.06,fontSize:0.14,maxWidth:2.6,color:"#cbd5e1"});
      t2.setAttribute('anchorX','left'); t2.setAttribute('position',`-1.2 ${y-0.06} 0.02`);
      plate.appendChild(t1); plate.appendChild(t2);

      // ปุ่ม “เล่น”
      const play=document.createElement('a-entity');
      play.classList.add('clickable');
      play.setAttribute('geometry','primitive: plane; width: 0.6; height: 0.24');
      play.setAttribute('material','color:#7dfcc6; opacity:0.96; shader:flat');
      play.setAttribute('position',`1.15 ${y} 0.02`);
      play.appendChild(text3D("เล่น",{color:"#053b2a",fontSize:0.18}));
      play.addEventListener('click',()=>routeTo(route, queryMaker()));
      panel.appendChild(plate); panel.appendChild(play);
      y-=0.34;
    };

    adv.forEach(a=>mk(a.label, `เป้า: ${a.type==="survive"?"ไม่เสียชีวิตครั้งเดียว":a.target}`, "adventure", ()=>a.query(a.target)));
    rhy.forEach(r=>mk(r.label, `เป้า: ${r.type==="accuracy" ? `${(r.target*100).toFixed(0)}%` : r.target}`, "rhythm", ()=>r.query(r.target)));

    // ปุ่มปิด
    const close=document.createElement('a-entity');
    close.classList.add('clickable');
    close.setAttribute('geometry','primitive: plane; width: 1.0; height: 0.3');
    close.setAttribute('material','color:#fde68a; opacity:0.96; shader:flat');
    close.setAttribute('position','0 -0.9 0.02');
    close.appendChild(text3D("ปิด",{color:"#2b2100",fontSize:0.18}));
    close.addEventListener('click',()=>panel.remove());
    panel.appendChild(close);

    root.appendChild(panel);
  }

  // ---------- Events ----------
  bindClick(btnStart, ()=>{
    setHUD("เริ่มใช้งานเมนู • เลือกโหมด หรือเปิดกระดานภารกิจรายสัปดาห์");
  });
  bindClick(btnAdventure, ()=>routeTo("adventure"));
  bindClick(btnRhythm, ()=>routeTo("rhythm"));

  window.addEventListener('keydown', (e)=>{
    const k=e.key.toLowerCase();
    if(k==='a') routeTo('adventure');
    if(k==='r') routeTo('rhythm');
    if(k==='w') openWeeklyBoard();
    if(k==='enter') btnStart.click();
  });

  // ---------- Boot ----------
  buildScene(); setHUD();
}
