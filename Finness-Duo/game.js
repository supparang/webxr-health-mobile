// Fitness Duo VR — Menu v2
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
    const {color="#e2e8f0", fontSize=0.22, maxWidth=6, y=0, z=0.05} = opts;
    e.setAttribute('troika-text', `
      value: ${value};
      font: ${THAI_FONT};
      color: ${color};
      fontSize: ${fontSize};
      maxWidth: ${maxWidth};
      align: center;
    `.replace(/\s+/g,' '));
    e.setAttribute('position', `0 ${y} ${z}`);
    e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }

  // ---------- Scene UI (3D) ----------
  function buildScene(){
    while(root.firstChild) root.removeChild(root.firstChild);

    const title=text3D("Fitness Duo VR",{fontSize:0.34, y:0.9});
    root.appendChild(title);

    // แผงปุ่ม 3D (ซ้ำกับ HTML ปุ่ม เพื่อเล่นใน VR ได้)
    const panel=document.createElement('a-entity');
    panel.setAttribute('position','0 0 0.06');

    const buttons = [
      {id:"go-adventure", label:"เริ่ม Adventure", color:"#7dfcc6", route:"adventure"},
      {id:"go-rhythm",    label:"เริ่ม Rhythm",    color:"#93c5fd", route:"rhythm"}
    ];
    let y=0.4;
    for(const b of buttons){
      const btn=document.createElement('a-entity');
      btn.classList.add('clickable');
      btn.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.45');
      btn.setAttribute('material',`color:${b.color}; opacity:0.96; shader:flat`);
      btn.setAttribute('position',`0 ${y} 0`);
      const t=text3D(b.label,{color:"#082d28",fontSize:0.22, maxWidth:4, y:0, z:0.01});
      t.setAttribute('position','0 0 0.01');
      btn.appendChild(t);
      btn.addEventListener('click', ()=>routeTo(b.route));
      panel.appendChild(btn);
      y-=0.6;
    }
    root.appendChild(panel);

    const hint=text3D("เดสก์ท็อป: คลิกเมาส์ • VR: มองที่ปุ่มค้าง (fuse) • คีย์ลัด A/R/Enter",{fontSize:0.16,y:-0.6});
    root.appendChild(hint);
  }

  // ---------- Helpers ----------
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

  function routeTo(kind){
    // สร้าง query ส่งต่อ
    const diff = selDiff.value || "easy";
    const theme= selTheme.value || "jungle";
    const quest= selQuest.value || "collect";
    const bpm  = selBpm.value || "96";

    if(kind==="adventure"){
      const q = `?diff=${encodeURIComponent(diff)}&theme=${encodeURIComponent(theme)}&quest=${encodeURIComponent(quest)}&source=fitness-duo`;
      ping("enter_adventure",{diff,theme,quest});
      location.href = `./adventure/index.html${q}`;
    }else if(kind==="rhythm"){
      const q = `?diff=${encodeURIComponent(diff)}&bpm=${encodeURIComponent(bpm)}&source=fitness-duo`;
      ping("enter_rhythm",{diff,bpm});
      location.href = `./rhythm/index.html${q}`;
    }
  }

  // ---------- Events ----------
  bindClick(btnStart, ()=>{
    setHUD("เริ่มใช้งานเมนู • เลือกโหมดแล้วกด Adventure หรือ Rhythm");
    ping("start_menu",{ua:navigator.userAgent});
  });
  bindClick(btnAdventure, ()=>routeTo("adventure"));
  bindClick(btnRhythm, ()=>routeTo("rhythm"));

  window.addEventListener('keydown', (e)=>{
    const k=e.key.toLowerCase();
    if(k==='a') routeTo('adventure');
    if(k==='r') routeTo('rhythm');
    if(k==='enter') btnStart.click();
  });

  // ---------- Boot ----------
  buildScene(); setHUD();
}
