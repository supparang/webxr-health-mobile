// Hygiene VR — 4 interactive stations using A-Frame
const HUD = {
  status: document.getElementById('status'),
  doneCount: document.getElementById('doneCount'),
  resetBtn: document.getElementById('btnReset')
};

const sfx = {
  pickup: document.getElementById('pickup'),
  place: document.getElementById('place'),
  error: document.getElementById('error'),
  win: document.getElementById('win')
};

function play(a){ try{ a.currentTime=0; a.play(); }catch(e){} }

let completed = { s1:false, s2:false, s3:false, s4:false };
function refreshDone(){
  const n = Object.values(completed).filter(Boolean).length;
  HUD.doneCount.textContent = n;
  if (n===4){ HUD.status.textContent = 'เยี่ยมมาก! คุณผ่านทุกสถานีแล้ว 🎉'; play(sfx.win); }
}

HUD.resetBtn.addEventListener('click', ()=>{
  completed = {s1:false,s2:false,s3:false,s4:false};
  setupHandwash(); setupTooth(); setupMask(); setupCough();
  HUD.status.textContent = 'รีเซ็ตเรียบร้อย ลองใหม่ได้เลย';
  refreshDone();
});

// ---------- Station 1: Handwashing (7 steps) ----------
function setupHandwash(){
  const panel = document.getElementById('handPanel');
  // Clear previous children
  while(panel.firstChild) panel.removeChild(panel.firstChild);
  const steps = ['ฝ่ามือถูฝ่ามือ','หลังมือ','ซอกนิ้ว','หลังนิ้ว','รอบนิ้วหัวแม่มือ','ปลายนิ้ว/เล็บ','รอบข้อมือ'];
  const cols = 3;
  steps.forEach((name,i)=>{
    const x = (i%cols - 1)*0.7;
    const y = Math.floor(i/cols)*-0.25;
    const btn = document.createElement('a-box');
    btn.setAttribute('class','clickable');
    btn.setAttribute('position', `${x} ${y} 0.02`);
    btn.setAttribute('color', '#23395b'); btn.setAttribute('width','0.6'); btn.setAttribute('height','0.18'); btn.setAttribute('depth','0.06');
    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${i+1}. ${name}; align:center; width:2; color:#e6eefc`);
    label.setAttribute('position', '0 0 0.05');
    btn.appendChild(label);
    panel.appendChild(btn);
  });
  let done = 0;
  panel.addEventListener('click', (e)=>{
    const clicked = e.target.closest('a-box');
    if (!clicked) return;
    const boxes = panel.querySelectorAll('a-box');
    const idx = Array.from(boxes).indexOf(clicked);
    if (idx===done){ boxes[idx].setAttribute('color','#28c76f'); done++; play(sfx.place); }
    else { play(sfx.error); }
    if (done===7){ completed.s1 = true; refreshDone(); }
  });
}

// ---------- Station 2: Toothbrushing (zones + timer) ----------
function setupTooth(){
  const panel = document.getElementById('toothPanel');
  while(panel.firstChild) panel.removeChild(panel.firstChild);
  // Mouth disk
  const mouth = document.createElement('a-cylinder');
  mouth.setAttribute('position','0 0 0.02');
  mouth.setAttribute('radius','0.45'); mouth.setAttribute('height','0.02');
  mouth.setAttribute('color','#23395b');
  panel.appendChild(mouth);
  // Zones (4 arcs + center)
  const zones = [
    {name:'บนซ้าย', pos:'-0.25 0.20 0.05'},
    {name:'บนขวา', pos:'0.25 0.20 0.05'},
    {name:'ล่างซ้าย', pos:'-0.25 -0.20 0.05'},
    {name:'ล่างขวา', pos:'0.25 -0.20 0.05'},
    {name:'บดเคี้ยว', pos:'0 0 0.06'}
  ];
  zones.forEach(z=>{
    const p = document.createElement('a-sphere');
    p.setAttribute('class','clickable');
    p.setAttribute('position', z.pos);
    p.setAttribute('radius','0.12');
    p.setAttribute('color','#79a8ff');
    p.setAttribute('opacity','0.6');
    p.setAttribute('zname', z.name);
    panel.appendChild(p);
    const label = document.createElement('a-entity');
    label.setAttribute('text', `value:${z.name}; align:center; width:2; color:#e6eefc`);
    const [x,y,_z] = z.pos.split(' ').map(parseFloat);
    label.setAttribute('position', `${x} ${y+0.16} 0.05`);
    panel.appendChild(label);
  });
  let brushed = new Set();
  panel.addEventListener('click', (e)=>{
    const s = e.target.closest('a-sphere');
    if (!s) return;
    s.setAttribute('color','#28c76f'); play(sfx.place);
    brushed.add(s.getAttribute('zname'));
    if (brushed.size===zones.length){ completed.s2 = true; refreshDone(); }
  });
}

// ---------- Station 3: Mask wearing ----------
function setupMask(){
  const panel = document.getElementById('maskPanel');
  while(panel.firstChild) panel.removeChild(panel.firstChild);
  // face rectangle
  const face = document.createElement('a-box');
  face.setAttribute('position','0 0 0');
  face.setAttribute('width','0.9'); face.setAttribute('height','1.0'); face.setAttribute('depth','0.05');
  face.setAttribute('color','#23395b');
  panel.appendChild(face);
  // mask object (draggable style via click to cycle positions for simplicity)
  const mask = document.createElement('a-box');
  mask.setAttribute('class','clickable');
  mask.setAttribute('position','0 0.15 0.06');
  mask.setAttribute('width','0.7'); mask.setAttribute('height','0.3'); mask.setAttribute('depth','0.06');
  mask.setAttribute('color','#79a8ff');
  panel.appendChild(mask);
  const maskLabel = document.createElement('a-entity');
  maskLabel.setAttribute('text', 'value:หน้ากาก; align:center; width:2; color:#001');
  maskLabel.setAttribute('position','0 0.18 0.09');
  panel.appendChild(maskLabel);
  // target area
  const target = {x:0, y:0.05, w:0.8, h:0.6};
  function isOK(p){
    const dx = Math.abs(p.x - target.x) <= target.w/2 - 0.1;
    const dy = Math.abs(p.y - target.y) <= target.h/2 - 0.1;
    return dx && dy;
  }
  panel.addEventListener('click', (e)=>{
    if (e.target===mask){
      // cycle through a few positions to simulate dragging using laser
      const choices = [{x:0,y:0.35},{x:0.35,y:0.05},{x:0,y:0.05},{x:-0.35,y:0.05},{x:0,y:-0.1}];
      const cur = mask.object3D.position;
      let idx = choices.findIndex(c=> Math.abs(c.x-cur.x)<0.01 && Math.abs(c.y-cur.y)<0.01 );
      idx = (idx+1)%choices.length;
      mask.setAttribute('position', `${choices[idx].x} ${choices[idx].y} 0.06`);
      if (isOK(mask.object3D.position)){ play(sfx.place); completed.s3 = true; refreshDone(); }
      else { play(sfx.error); }
    }
  });
  // label
  const label = document.createElement('a-entity');
  label.setAttribute('text','value: คลิกหน้ากากเพื่อปรับตำแหน่งให้ปิดจมูก-ปาก; align:center; width:3; color:#e6eefc');
  label.setAttribute('position','0 -0.65 0.06'); panel.appendChild(label);
}

// ---------- Station 4: Cough etiquette ----------
function setupCough(){
  const panel = document.getElementById('coughPanel');
  while(panel.firstChild) panel.removeChild(panel.firstChild);
  // body box + mouth
  const body = document.createElement('a-box');
  body.setAttribute('position','0 0 0'); body.setAttribute('width','0.9'); body.setAttribute('height','1.0'); body.setAttribute('depth','0.05'); body.setAttribute('color','#23395b');
  panel.appendChild(body);
  const mouth = document.createElement('a-sphere');
  mouth.setAttribute('position','0 0.1 0.06'); mouth.setAttribute('radius','0.06'); mouth.setAttribute('color','#e6eefc'); panel.appendChild(mouth);
  // elbow (click to move across positions)
  const elbow = document.createElement('a-box');
  elbow.setAttribute('class','clickable');
  elbow.setAttribute('position','-0.35 -0.05 0.06'); elbow.setAttribute('width','0.4'); elbow.setAttribute('height','0.18'); elbow.setAttribute('depth','0.06'); elbow.setAttribute('color','#ffd166');
  panel.appendChild(elbow);
  const elbowLabel = document.createElement('a-entity');
  elbowLabel.setAttribute('text','value:ศอก; align:center; width:2; color:#001'); elbowLabel.setAttribute('position','-0.35 0.04 0.09'); panel.appendChild(elbowLabel);
  // tissue + trash
  const tissue = document.createElement('a-box');
  tissue.setAttribute('class','clickable');
  tissue.setAttribute('position','0.35 0.35 0.06'); tissue.setAttribute('width','0.3'); tissue.setAttribute('height','0.16'); tissue.setAttribute('depth','0.06'); tissue.setAttribute('color','#e6eefc');
  panel.appendChild(tissue);
  const trash = document.createElement('a-box');
  trash.setAttribute('position','0.35 -0.45 0.02'); trash.setAttribute('width','0.3'); trash.setAttribute('height','0.2'); trash.setAttribute('depth','0.06'); trash.setAttribute('color','#3b5b85');
  panel.appendChild(trash);
  const trashLabel = document.createElement('a-entity');
  trashLabel.setAttribute('text','value:ถังขยะ; align:center; width:2; color:#e6eefc'); trashLabel.setAttribute('position','0.35 -0.35 0.09'); panel.appendChild(trashLabel);

  let covered = false, thrown = false;
  panel.addEventListener('click',(e)=>{
    if (e.target===elbow){
      // move elbow to mouth in one click
      if (!covered){
        elbow.setAttribute('position','0 0.1 0.06'); elbow.setAttribute('color','#28c76f'); covered = true; play(sfx.place);
      }else{
        elbow.setAttribute('position','-0.35 -0.05 0.06'); elbow.setAttribute('color','#ffd166'); covered = false;
      }
    }
    if (e.target===tissue){
      // toggle "thrown"
      if (!thrown){ tissue.setAttribute('position','0.35 -0.35 0.06'); tissue.setAttribute('color','#28c76f'); thrown=true; play(sfx.place); }
      else { tissue.setAttribute('position','0.35 0.35 0.06'); tissue.setAttribute('color','#e6eefc'); thrown=false; }
    }
    if (covered && thrown){ completed.s4 = true; refreshDone(); }
  });
}

// Initialize all stations
setupHandwash(); setupTooth(); setupMask(); setupCough(); refreshDone();
