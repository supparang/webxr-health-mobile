const $ = id => document.getElementById(id);
const hudText = $('hudText');
const btn = { start: $('btnStart'), reset: $('btnReset') };
const gameRoot = document.getElementById('gameRoot');

let running=false, score=0, lives=3, totalItems=0, timeLeft=60, timerId=null;
let bins={}, itemNode=null, currentFood=null;

const FOODS=[
  {name:'ข้าวกล้อง',tag:'green',imgId:'#img-rice-brown'},
  {name:'ปลาอบ',tag:'green',imgId:'#img-fish-bake'},
  {name:'ผัดผัก',tag:'green',imgId:'#img-veggies'},
  {name:'ผลไม้รวม',tag:'green',imgId:'#img-fruit-mix'},
  {name:'ไก่ย่าง',tag:'yellow',imgId:'#img-chicken-grill'},
  {name:'นมจืด',tag:'yellow',imgId:'#img-milk-plain'},
  {name:'แกงจืด',tag:'yellow',imgId:'#img-soup-clear'},
  {name:'ข้าวขาว',tag:'yellow',imgId:'#img-rice-white'},
  {name:'ของทอด',tag:'red',imgId:'#img-fried'},
  {name:'น้ำอัดลม',tag:'red',imgId:'#img-soda'},
  {name:'ขนมหวาน',tag:'red',imgId:'#img-dessert'},
  {name:'มันฝรั่งทอดกรอบ',tag:'red',imgId:'#img-chips'}
];

function randFood(){ return FOODS[Math.floor(Math.random()*FOODS.length)]; }
function setHUD(msg){ hudText.textContent=msg; }
function clearChildren(el){ while(el.firstChild) el.removeChild(el.firstChild); }

function buildScene(){
  clearChildren(gameRoot);
  const lane=document.createElement('a-entity');
  lane.setAttribute('position','0 -0.6 0');
  gameRoot.appendChild(lane);
  bins.green=makeBin('เขียว กินบ่อย','#16a34a',-1.0,'#fff');
  bins.yellow=makeBin('เหลือง พอเหมาะ','#eab308',0.0,'#111'); // เหลืองเข้ม + ข้อความดำ
  bins.red=makeBin('แดง กินน้อย','#ef4444',1.0,'#fff');
  lane.appendChild(bins.green);
  lane.appendChild(bins.yellow);
  lane.appendChild(bins.red);
  itemNode=document.createElement('a-entity');
  itemNode.setAttribute('position','0 0.35 0');
  gameRoot.appendChild(itemNode);
}

function makeBin(label,color,x,textColor){
  const bin=document.createElement('a-entity');
  bin.setAttribute('position',`${x} 0 0`);
  const panel=document.createElement('a-plane');
  panel.classList.add('selectable');
  panel.setAttribute('width','1.2'); panel.setAttribute('height','0.6');
  panel.setAttribute('material',`color:${color}; shader:flat; opacity:0.85`);
  bin.appendChild(panel);
  const txt=document.createElement('a-entity');
  txt.setAttribute('text',`value:${label}; width: 4.5; align:center; color:${textColor}`);
  txt.setAttribute('position','0 0 0.01');
  bin.appendChild(txt);
  panel.addEventListener('click',()=>{
    if(running) gradeChoice(label.includes('เขียว')?'green':label.includes('เหลือง')?'yellow':'red');
  });
  return bin;
}

function showNewFood(){
  if(!itemNode) return;
  clearChildren(itemNode);
  currentFood=randFood();
  totalItems++;
  const card=document.createElement('a-plane');
  card.setAttribute('width','1.4'); card.setAttribute('height','1.0');
  card.setAttribute('color','#fff'); card.setAttribute('position','0 0 0');
  itemNode.appendChild(card);
  const pic=document.createElement('a-image');
  pic.setAttribute('src',currentFood.imgId);
  pic.setAttribute('width','1.2'); pic.setAttribute('height','0.8');
  pic.setAttribute('position','0 0 0.01');
  itemNode.appendChild(pic);
  const label=document.createElement('a-entity');
  label.setAttribute('text',`value:${currentFood.name}; width:4; align:center; color:#111`);
  label.setAttribute('position','0 -0.55 0.02');
  itemNode.appendChild(label);
  updateHUD();
}

function gradeChoice(choice){
  if(!currentFood) return;
  if(currentFood.tag===choice){ score+=2; }
  else lives--;
  if(lives<=0 || totalItems>=20) finishGame();
  else showNewFood();
}

function updateHUD(){
  setHUD(`เวลา: ${timeLeft} วิ | คะแนน: ${score} | หัวใจ: ${'❤️'.repeat(lives)}`);
}

function startTimer(){
  timeLeft=60;
  timerId=setInterval(()=>{
    if(!running) return;
    timeLeft--; updateHUD();
    if(timeLeft<=0) finishGame();
  },1000);
}

function startGame(){
  running=true; score=0; lives=3; totalItems=0;
  buildScene(); showNewFood(); startTimer();
  btn.start.textContent='Finish';
}
function finishGame(){
  running=false; clearInterval(timerId);
  btn.start.textContent='Start';
  setHUD(`จบเกม | คะแนนรวม: ${score}`);
}
function resetGame(){
  running=false; clearInterval(timerId);
  clearChildren(gameRoot); setHUD('พร้อมเริ่ม');
  btn.start.textContent='Start';
}

btn.start.onclick=()=>{ if(!running) startGame(); else finishGame(); };
btn.reset.onclick=resetGame;
resetGame();
