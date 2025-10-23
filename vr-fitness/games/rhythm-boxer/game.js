(function(){
"use strict";

const $ = id => document.getElementById(id);
const getQ = k => new URLSearchParams(location.search).get(k);
const ASSET_BASE = (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'') || '';

let running=false, paused=false;
let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
let bank=0, songTimer=null, hudTimer=null;

const DIFFS={
  easy:{bpm:95,noteLife:1600,spawnLead:1600,scoreMul:0.9,lanes:3,title:'EASY'},
  normal:{bpm:120,noteLife:1300,spawnLead:1300,scoreMul:1,lanes:4,title:'NORMAL'},
  hard:{bpm:140,noteLife:1050,spawnLead:1100,scoreMul:1.1,lanes:4,title:'HARD'},
  final:{bpm:160,noteLife:900,spawnLead:950,scoreMul:1.2,lanes:5,title:'FINAL'}
};
function getDiffKey(){return getQ('diff')||localStorage.getItem('rb_diff')||'normal';}
let D=DIFFS.normal;

function updateHUD(){
  $('score').textContent=Math.round((score+bank)*D.scoreMul);
  $('combo').textContent=combo;
  $('time').textContent=timeLeft;
}
function onComboChange(){
  $('combo').textContent=combo;
  if(combo>maxCombo)maxCombo=combo;
}
function safeRemove(el){try{if(el&&el.parentNode)el.parentNode.removeChild(el);}catch(_){}}

function floatText(text,color,pos){
  const e=document.createElement('a-entity');
  const p=(pos||new THREE.Vector3(0,1.2,-2.1)).clone();p.y+=0.15;
  e.setAttribute('text',{value:text,color,align:'center',width:2.4});
  e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
  e.setAttribute('scale','0.001 0.001 0.001');
  e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:80});
  e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.5} ${p.z}`,dur:520});
  e.setAttribute('animation__fade',{property:'opacity',to:0,dur:420,delay:120});
  $('arena').appendChild(e);
  setTimeout(()=>safeRemove(e),760);
}

function laneX(i,l){const width=Math.min(1.8,l*0.45);return -width/2+(width/(l-1||1))*i;}
function spawnNote(lane,tHit){
  spawns++;
  const el=document.createElement('a-cylinder');
  el.classList.add('clickable');
  el.setAttribute('radius','0.11');el.setAttribute('height','0.08');
  el.setAttribute('color','#00d0ff');
  el.setAttribute('position',`${laneX(lane,D.lanes)} 1.6 -2.2`);
  $('arena').appendChild(el);
  const born=performance.now();const life=D.noteLife;
  function step(){
    if(!el.parentNode)return;
    const now=performance.now();
    const p=Math.min(1,(now-born)/life);
    const y=1.6-0.6*p;
    el.setAttribute('position',`${laneX(lane,D.lanes)} ${y} -2.2`);
    if(p>=1){miss(el);return;}
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  el.addEventListener('click',()=>{
    const pos=el.object3D.getWorldPosition(new THREE.Vector3());
    floatText('HIT','#00ffa3',pos);
    score+=30;hits++;combo++;onComboChange();
    safeRemove(el);updateHUD();
  });
}
function miss(el){
  if(!el.parentNode)return;
  combo=0;onComboChange();
  const pos=el.object3D.getWorldPosition(new THREE.Vector3());
  floatText('MISS','#ff5577',pos);
  safeRemove(el);
  updateHUD();
}

function buildChart(){
  const bpm=D.bpm,beat=60000/bpm,T=60000,chart=[];
  let t=0,i=0;
  while(t<T){chart.push({t, lane:i%D.lanes});t+=beat/2;i++;}
  return chart;
}

function start(){
  if(running)return;
  const key=getDiffKey();D=DIFFS[key]||DIFFS.normal;
  localStorage.setItem('rb_diff',key);
  score=combo=maxCombo=hits=spawns=bank=0;timeLeft=60;
  $('results').style.display='none';updateHUD();
  const chart=buildChart();const startAt=performance.now()+600;
  chart.forEach(n=>setTimeout(()=>spawnNote(n.lane,startAt+n.t),Math.max(0,(startAt+n.t-D.spawnLead)-performance.now())));
  running=true;paused=false;
  songTimer=setInterval(()=>{if(paused)return;timeLeft--;updateHUD();if(timeLeft<=0)end();},1000);
  hudTimer=setInterval(()=>{if(running&&!paused)updateHUD();},500);
}
function end(){
  running=false;clearInterval(songTimer);clearInterval(hudTimer);
  const acc=spawns?Math.round((hits/spawns)*100):0;
  $('rScore').textContent=Math.round((score+bank)*D.scoreMul);
  $('rMaxCombo').textContent=maxCombo;
  $('rAcc').textContent=acc+'%';
  $('rDiff').textContent=D.title;
  $('results').style.display='flex';
}
function togglePause(){if(running)paused=!paused;}
function bankNow(){bank+=Math.floor(combo*3);combo=0;onComboChange();updateHUD();}

document.addEventListener('DOMContentLoaded',()=>{
  $('startBtn').addEventListener('click',start);
  $('replayBtn').addEventListener('click',start);
  $('pauseBtn').addEventListener('click',togglePause);
  $('bankBtn').addEventListener('click',bankNow);
  $('backBtn').addEventListener('click',()=>{location.href=`${ASSET_BASE}/`;});
  // ปุ่ม Enter VR
  const btn=document.createElement('button');
  btn.textContent='Enter VR';
  Object.assign(btn.style,{position:'fixed',left:'50%',bottom:'12px',transform:'translateX(-50%)',
    zIndex:10050,padding:'10px 14px',borderRadius:'10px',border:'0',
    background:'#0e2233',color:'#e6f7ff',cursor:'pointer'});
  btn.onclick=()=>{try{document.querySelector('a-scene')?.enterVR?.();}catch(e){}};
  document.body.appendChild(btn);
});

// Pointer raycast
(function(){
  const scene=document.querySelector('a-scene');
  if(!scene)return;
  const ray=new THREE.Raycaster();const pt=new THREE.Vector2();
  function pick(x,y){
    const cam=scene.camera;if(!cam)return;
    pt.x=(x/window.innerWidth)*2-1;pt.y=-(y/window.innerHeight)*2+1;
    ray.setFromCamera(pt,cam);
    const objs=Array.from(document.querySelectorAll('.clickable')).map(e=>e.object3D);
    const list=[];objs.forEach(o=>o.traverse(c=>list.push(c)));
    const hits=ray.intersectObjects(list,true);
    if(hits.length){let o=hits[0].object;while(o&&!o.el)o=o.parent;if(o&&o.el)o.el.emit('click');}
  }
  window.addEventListener('mousedown',e=>pick(e.clientX,e.clientY));
  window.addEventListener('touchstart',e=>{const t=e.touches[0];pick(t.clientX,t.clientY);});
})();
})();
