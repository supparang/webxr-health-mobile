/* Fitness Adventure VR — Storyboard Preview (A-Frame)
   - 12 ฉากตามแนว Fitness Adventure 2.0
   - ปุ่ม Next/Prev + ป้ายในฉาก (gaze fuse) + คีย์ลัด ← → Space
   - พร็อพ low-poly เพื่อสื่อไอเดีย (โลโก้, เมนู, อุปสรรค, พลังงาน, บอส, ฯลฯ)
*/

const $ = (id)=>document.getElementById(id);
const root = $("root");
const sky = $("sky");
const titleEl = $("sceneTitle");
const descEl = $("sceneDesc");

const btnPrev = $("btnPrev");
const btnNext = $("btnNext");
const btnReplay = $("btnReplay");
const navPrev3D = $("navPrev");
const navNext3D = $("navNext");

let SCENE_INDEX = 0;

// ---------- ข้อมูล 12 ฉาก ----------
const STORY = [
  {
    name: "Splash / Logo",
    desc: "โลโก้เกม + โลโก้โรงเรียน + เสียงอินโทร (จำลอง)",
    sky: "#dbeafe",
    build: () => {
      addLogo("Fitness Adventure VR", "โรงเรียนสุขภาพดี");
    }
  },
  {
    name: "Main Menu",
    desc: "ปุ่ม Start / Options / Exit (จำลองเมนู)",
    sky: "#e0f2fe",
    build: () => {
      addMenu(["Start", "Options", "Exit"]);
    }
  },
  {
    name: "Select Mode",
    desc: "เลือกความยาก Easy / Normal / Hard",
    sky: "#e0fbf2",
    build: () => {
      addModeSelector(["Easy","Normal","Hard"]);
    }
  },
  {
    name: "Tutorial",
    desc: "สอนท่าพื้นฐาน: ย่อ – เหยียด – เอียงตัว",
    sky: "#f1f5f9",
    build: () => {
      addTutorialAvatars();
    }
  },
  {
    name: "Mission Start",
    desc: "นับถอยหลัง 3-2-1- Go! พร้อมเลนวิ่ง",
    sky: "#fff7ed",
    build: () => {
      addCountdown();
      addLane();
    }
  },
  {
    name: "Run Path 1",
    desc: "เริ่มวิ่ง เก็บ Energy Orb ตามทาง",
    sky: "#f0fdf4",
    build: () => {
      addLane();
      addEnergyOrbs(5, {zStart:-3.5, spacing:0.8});
    }
  },
  {
    name: "Obstacle Zone",
    desc: "เพิ่มสิ่งกีดขวาง ต้องย่อ/เอียงเพื่อหลบ",
    sky: "#fef9c3",
    build: () => {
      addLane();
      addObstacles([{x:-0.8,z:-2.8},{x:0,z:-1.8},{x:0.8,z:-0.8}]);
    }
  },
  {
    name: "Energy Boost",
    desc: "เก็บลูกบอลพลังงานสีสว่างพร้อมแสงเรือง",
    sky: "#fae8ff",
    build: () => {
      addLane();
      addEnergyOrbs(6, {zStart:-3.5, spacing:0.6, glow:true});
    }
  },
  {
    name: "Run Path 2",
    desc: "ทางวิ่งเร็วขึ้น + สิ่งกีดขวางมากขึ้น",
    sky: "#eef2ff",
    build: () => {
      addLane();
      addObstacles([{x:-0.8,z:-3.2},{x:0.8,z:-2.4},{x:0,z:-1.6},{x:-0.8,z:-0.8}]);
      addEnergyOrbs(3, {zStart:-3, spacing:0.9});
    }
  },
  {
    name: "Boss Challenge",
    desc: "ทำท่าออกแรง 5 ครั้ง (ยกแขน-ย่อ-หมุนไหล่) จำลองด้วยเป้า",
    sky: "#fee2e2",
    build: () => {
      addBossTargets(5);
    }
  },
  {
    name: "Cool Down",
    desc: "ผ่อนคลาย หายใจเข้า-ออก ยืดเหยียดเบา ๆ",
    sky: "#ecfeff",
    build: () => {
      addCoolDownGuide();
    }
  },
  {
    name: "Result & Reward",
    desc: "สรุปคะแนน ระยะทาง แคลอรี + ปลดล็อก Badge",
    sky: "#f5f3ff",
    build: () => {
      addResultPanel();
      addBadge();
    }
  }
];

// ---------- Utilities ----------
function clearRoot(){ while(root.firstChild) root.removeChild(root.firstChild); }

function setHUD(i){
  const total = STORY.length;
  titleEl.textContent = `Scene ${i+1}/${total} — ${STORY[i].name}`;
  descEl.textContent = STORY[i].desc;
  sky.setAttribute("color", STORY[i].sky || "#eaf2ff");
}

function renderScene(i){
  SCENE_INDEX = (i + STORY.length) % STORY.length;
  clearRoot();
  setHUD(SCENE_INDEX);

  // สร้างพื้นโปร่ง + เฟรมหน้าจอ (เหมือนบอร์ด)
  const frame = document.createElement("a-entity");
  frame.setAttribute("geometry","primitive: plane; width: 3.6; height: 2.0");
  frame.setAttribute("material","color:#ffffff; opacity:0.9; shader:flat");
  frame.setAttribute("position","0 0 -0.02");
  root.appendChild(frame);

  // ป้ายชื่อซีนบนเฟรม
  const label = document.createElement("a-entity");
  label.setAttribute("text", `value:${STORY[SCENE_INDEX].name}; width:6; align:center; color:#0b1220`);
  label.setAttribute("position","0 0.85 0.01");
  root.appendChild(label);

  // เนื้อหาซีน
  if (typeof STORY[SCENE_INDEX].build === "function"){
    STORY[SCENE_INDEX].build();
  }

  // ปุ่มโค้ชในฉาก (อธิบาย)
  const coach = document.createElement("a-entity");
  coach.setAttribute("geometry","primitive: plane; width: 3.2; height: 0.36");
  coach.setAttribute("material","color:#0ea5e9; opacity:0.1; shader:flat");
  coach.setAttribute("position","0 -0.85 0");
  const coachText = document.createElement("a-entity");
  coachText.setAttribute("text", `value:${STORY[SCENE_INDEX].desc}; width:6.4; align:center; color:#0b1220`);
  coachText.setAttribute("position","0 0 0.01");
  coach.appendChild(coachText);
  root.appendChild(coach);
}

// ---------- Builders (พร็อพอย่างง่าย) ----------
function addLogo(title="Fitness Adventure VR", subtitle=""){
  const t = document.createElement("a-entity");
  t.setAttribute("text", `value:${title}; width:6; align:center; color:#111827`);
  t.setAttribute("position","0 0.3 0.02");
  root.appendChild(t);

  if (subtitle){
    const s = document.createElement("a-entity");
    s.setAttribute("text", `value:${subtitle}; width:4.5; align:center; color:#334155`);
    s.setAttribute("position","0 0.05 0.02");
    root.appendChild(s);
  }

  // โลโก้สัญลักษณ์ (วงกลม + สายฟ้า)
  const circle = document.createElement("a-entity");
  circle.setAttribute("geometry","primitive: circle; radius:0.35; segments:48");
  circle.setAttribute("material","color:#22c55e; opacity:0.9; shader:flat");
  circle.setAttribute("position","0 -0.35 0.02");
  root.appendChild(circle);

  const bolt = document.createElement("a-entity");
  bolt.setAttribute("geometry","primitive: box; width:0.12; height:0.5; depth:0.02");
  bolt.setAttribute("material","color:#111827; opacity:0.9; shader:flat");
  bolt.setAttribute("rotation","0 0 30");
  bolt.setAttribute("position","0 -0.35 0.03");
  root.appendChild(bolt);
}

function addMenu(items=["Start","Options","Exit"]){
  items.forEach((txt, i)=>{
    const y = 0.4 - i*0.35;
    const btn = document.createElement("a-entity");
    btn.classList.add("selectable");
    btn.setAttribute("geometry","primitive: plane; width: 1.8; height: 0.3");
    btn.setAttribute("material","color:#ffffff; opacity:0.95; shader:flat");
    btn.setAttribute("position",`0 ${y} 0.01`);
    const t = document.createElement("a-entity");
    t.setAttribute("text", `value:${txt}; width:4; align:center; color:#0b1220`);
    t.setAttribute("position","0 0 0.01");
    btn.appendChild(t);
    root.appendChild(btn);
  });
}

function addModeSelector(modes=["Easy","Normal","Hard"]){
  modes.forEach((m, i)=>{
    const x = -1.1 + i*1.1;
    const card = document.createElement("a-entity");
    card.classList.add("selectable");
    card.setAttribute("geometry","primitive: plane; width: 1.0; height: 1.2");
    const color = i===0?"#dcfce7": i===1?"#e0f2fe":"#fee2e2";
    card.setAttribute("material",`color:${color}; opacity:0.95; shader:flat`);
    card.setAttribute("position",`${x} 0 0.01`);
    const t = document.createElement("a-entity");
    t.setAttribute("text", `value:${m}; width:2.8; align:center; color:#0b1220`);
    t.setAttribute("position","0 0.45 0.01");
    card.appendChild(t);
    root.appendChild(card);
  });
}

function addTutorialAvatars(){
  const poses = [
    {name:"ย่อ",     rot:0,   pos:"-1 0 0.01", scale:"0.9 0.7 0.9"},
    {name:"เหยียด",  rot:0,   pos:"0 0 0.01",  scale:"1.0 1.2 1.0"},
    {name:"เอียง",   rot:20,  pos:"1 0 0.01",  scale:"1.0 1.0 1.0"},
  ];
  poses.forEach(p=>{
    const body = document.createElement("a-entity");
    body.setAttribute("geometry","primitive: box; width:0.6; height:1.0; depth:0.2");
    body.setAttribute("material","color:#60a5fa; opacity:0.95; shader:flat");
    body.setAttribute("position",p.pos);
    body.setAttribute("rotation",`0 0 ${p.rot}`);
    body.setAttribute("scale",p.scale);
    root.appendChild(body);

    const head = document.createElement("a-entity");
    head.setAttribute("geometry","primitive: sphere; radius:0.2");
    head.setAttribute("material","color:#fde68a; opacity:0.95; shader:flat");
    head.setAttribute("position",`${parseFloat(p.pos.split(' ')[0])} 0.7 0.02`);
    root.appendChild(head);

    const label = document.createElement("a-entity");
    label.setAttribute("text", `value:${p.name}; width:2.8; align:center; color:#0b1220`);
    label.setAttribute("position",`${parseFloat(p.pos.split(' ')[0])} -0.8 0.01`);
    root.appendChild(label);
  });
}

function addCountdown(){
  const plate = document.createElement("a-entity");
  plate.setAttribute("geometry","primitive: circle; radius:0.32; segments:48");
  plate.setAttribute("material","color:#0ea5e9; opacity:0.9; shader:flat");
  plate.setAttribute("position","0 0.2 0.02");
  root.appendChild(plate);

  ["3","2","1","Go!"].forEach((txt,i)=>{
    const t = document.createElement("a-entity");
    t.setAttribute("text", `value:${txt}; width:4.5; align:center; color:#ffffff`);
    t.setAttribute("position","0 0.2 0.03");
    t.setAttribute("animation__fade",`property: text.opacity; delay:${i*450}; dur:350; from:0; to:1; dir:alternate; easing:easeOutQuad`);
    root.appendChild(t);
  });
}

function addLane(){
  const lane = document.createElement("a-entity");
  lane.setAttribute("geometry","primitive: plane; width: 3.6; height: 2.0");
  lane.setAttribute("material","color:#94a3b8; opacity:0.12; shader:flat");
  lane.setAttribute("position","0 0 0");
  root.appendChild(lane);

  // เสา/หลักบอกเลน
  [-1.2, 0, 1.2].forEach(x=>{
    const post = document.createElement("a-entity");
    post.setAttribute("geometry","primitive: box; width:0.06; height:1.6; depth:0.02");
    post.setAttribute("material","color:#94a3b8; opacity:0.4; shader:flat");
    post.setAttribute("position",`${x} 0 0.02`);
    root.appendChild(post);
  });
}

function addEnergyOrbs(count=5, {zStart=-3, spacing=0.8, glow=false}={}){
  for (let i=0;i<count;i++){
    const orb = document.createElement("a-entity");
    const x = [-1.2, 0, 1.2][i%3];
    const z = zStart + i*spacing;
    orb.setAttribute("geometry","primitive: sphere; radius:0.16; segmentsWidth:16; segmentsHeight:16");
    orb.setAttribute("material",`color:${glow?'#22c55e':'#38bdf8'}; opacity:0.95; shader:flat`);
    orb.setAttribute("position",`${x} 0 ${z}`);
    if (glow){
      orb.setAttribute("animation__pulse","property: scale; dir:alternate; dur:600; from:0.9 0.9 0.9; to:1.15 1.15 1.15; loop:true; easing:easeInOutSine");
    }
    root.appendChild(orb);
  }
}

function addObstacles(list=[{x:0,z:-2}]){
  list.forEach(({x,z})=>{
    const box = document.createElement("a-entity");
    box.setAttribute("geometry","primitive: box; width:0.7; height:0.5; depth:0.3");
    box.setAttribute("material","color:#ef4444; opacity:0.9; shader:flat");
    box.setAttribute("position",`${x} -0.25 ${z}`);
    root.appendChild(box);
  });
}

function addBossTargets(n=5){
  for (let i=0;i<n;i++){
    const x = -1.2 + (i%3)*1.2;
    const y = i<3 ? 0.3 : -0.2;
    const target = document.createElement("a-entity");
    target.setAttribute("geometry","primitive: plane; width:0.6; height:0.6");
    target.setAttribute("material","color:#fde047; opacity:0.95; shader:flat");
    target.setAttribute("position",`${x} ${y} -1.2`);
    target.setAttribute("animation__pop","property: scale; dir:alternate; dur:700; from:0.9 0.9 1; to:1.05 1.05 1; loop:true; easing:easeInOutSine");
    const t = document.createElement("a-entity");
    t.setAttribute("text","value:Hit!; width:2.5; align:center; color:#0b1220");
    t.setAttribute("position","0 0 0.01");
    target.appendChild(t);
    root.appendChild(target);
  }
}

function addCoolDownGuide(){
  const panel = document.createElement("a-entity");
  panel.setAttribute("geometry","primitive: plane; width: 2.8; height: 1.2");
  panel.setAttribute("material","color:#ffffff; opacity:0.95; shader:flat");
  panel.setAttribute("position","0 0 0.01");
  const t = document.createElement("a-entity");
  t.setAttribute("text","value:หายใจเข้า – ออก ช้า ๆ \\nยืดแขนเหนือศีรษะ 10 วินาที; width:5.2; align:center; color:#0b1220");
  t.setAttribute("position","0 0 0.02");
  panel.appendChild(t);
  root.appendChild(panel);
}

function addResultPanel(){
  const panel = document.createElement("a-entity");
  panel.setAttribute("geometry","primitive: plane; width: 2.8; height: 1.4");
  panel.setAttribute("material","color:#ffffff; opacity:0.95; shader:flat");
  panel.setAttribute("position","0 0 0.01");
  const text = [
    "คะแนน: 1230",
    "ระยะทาง: 1.2 km",
    "พลังงานที่ใช้: ~45 kcal"
  ].join("\\n");
  const t = document.createElement("a-entity");
  t.setAttribute("text",`value:${text}; width:5.2; align:center; color:#0b1220`);
  t.setAttribute("position","0 0 0.02");
  panel.appendChild(t);
  root.appendChild(panel);
}

function addBadge(){
  const ring = document.createElement("a-entity");
  ring.setAttribute("geometry","primitive: ring; radiusInner:0.25; radiusOuter:0.32; segmentsTheta:48");
  ring.setAttribute("material","color:#22c55e; opacity:0.95; shader:flat");
  ring.setAttribute("position","0 0.65 0.02");
  root.appendChild(ring);

  const star = document.createElement("a-entity");
  star.setAttribute("geometry","primitive: box; width:0.12; height:0.6; depth:0.02");
  star.setAttribute("material","color:#22c55e; opacity:0.95; shader:flat");
  star.setAttribute("rotation","0 0 45");
  star.setAttribute("position","0 0.65 0.03");
  root.appendChild(star);

  const label = document.createElement("a-entity");
  label.setAttribute("text","value:Badge Unlocked: Healthy Hero; width:4.8; align:center; color:#16a34a");
  label.setAttribute("position","0 0.45 0.02");
  root.appendChild(label);
}

// ---------- Navigation ----------
function nextScene(){ renderScene(SCENE_INDEX+1); }
function prevScene(){ renderScene(SCENE_INDEX-1); }

btnNext.onclick = nextScene;
btnPrev.onclick = prevScene;
btnReplay.onclick = ()=> renderScene(0);

// ป้ายในฉากสำหรับ gaze fuse
navNext3D.addEventListener("click", nextScene);
navPrev3D.addEventListener("click", prevScene);

// คีย์ลัด
window.addEventListener("keydown",(e)=>{
  const k = e.key.toLowerCase();
  if (k === 'arrowright' || k === ' ') { e.preventDefault(); nextScene(); }
  if (k === 'arrowleft') { e.preventDefault(); prevScene(); }
});

// เริ่มต้นที่ฉาก 1
renderScene(0);
