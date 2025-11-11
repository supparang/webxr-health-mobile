<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Hero Health VR</title>
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
<link rel="icon" href="./favicon.ico">

<style>
html,body{margin:0;height:100%;background:#0b1220;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,Roboto,'Noto Sans Thai',sans-serif;}
a-scene{position:fixed;inset:0}
.pill{position:fixed;top:16px;background:#0f172acc;border:1px solid #334155;border-radius:12px;padding:8px 12px;font-weight:700}
#time{left:16px}#score{left:50%;transform:translateX(-50%)}#quest{right:16px}
#panel{position:fixed;left:16px;right:16px;bottom:16px;background:#0f172a99;border:1px solid #334155;border-radius:16px;padding:12px 16px}
.row{display:flex;justify-content:space-between;font-weight:700}
.bar{height:14px;background:#0b1222;border:1px solid #334155;border-radius:999px;overflow:hidden;margin-top:6px}
.fill{height:100%;width:0;background:linear-gradient(90deg,#22c55e,#93c5fd)}
[data-hha-ui]{pointer-events:none;}
</style>
</head>

<body>
<div id="hud" data-hha-ui>
  <div id="time" class="pill">เวลา: --s</div>
  <div id="score" class="pill">คะแนน: 0 | คอมโบ: x0</div>
  <div id="quest" class="pill">Mini Quest — กำลังเริ่ม…</div>
</div>

<div id="panel" data-hha-ui>
  <div class="row"><div>เป้า: <span id="goalLbl">—</span></div><div>ระดับ: <span id="modeLbl">-</span></div></div>
  <div class="bar"><div id="goalFill" class="fill"></div></div>
  <div style="height:8px"></div>
  <div class="row"><div>Mini Quest — <span id="miniLbl">—</span></div></div>
  <div class="bar"><div id="miniFill" class="fill"></div></div>
</div>

<a-scene id="scene" renderer="colorManagement:true;physicallyCorrectLights:true">
  <a-entity id="rig" position="0 0 0">
    <a-entity id="cam" camera look-controls position="0 1.6 0"
              cursor="rayOrigin: mouse; fuse:false"
              raycaster="objects: .clickable; far: 10; useWorldCoordinates:true"></a-entity>
  </a-entity>
  <a-entity id="spawnHost" position="0 0 -1.5"></a-entity>
</a-scene>

<script type="module">
import { waitAframe } from './vr/aframe-wait.js';

const $=s=>document.querySelector(s);
const ui={time:$('#time'),score:$('#score'),quest:$('#quest'),
goalLbl:$('#goalLbl'),goalFill:$('#goalFill'),
miniLbl:$('#miniLbl'),miniFill:$('#miniFill'),modeLbl:$('#modeLbl')};

// --- Parameters ---
const params=new URLSearchParams(location.search);
const mode=(params.get('mode')||'goodjunk').toLowerCase();
const diff=(params.get('diff')||'normal').toLowerCase();
ui.modeLbl.textContent=diff;

// เวลาอัตโนมัติ: ง่าย=90 / ปกติ=60 / ยาก=45
const dur = diff==='easy'?90:(diff==='hard'?45:60);

// --- Module Paths ---
const MODS={
 goodjunk:'./modes/goodjunk.safe.js',
 groups:'./modes/groups.safe.js',
 hydration:'./modes/hydration.quest.js',
 plate:'./modes/plate.quest.js'
};

// --- HUD Events ---
window.addEventListener('hha:time',e=>{
 const sec=e.detail?.sec??'--';
 ui.time.textContent=`เวลา: ${sec}s`;
});
window.addEventListener('hha:score',e=>{
 const s=e.detail||{};
 ui.score.textContent=`คะแนน: ${s.score||0} | คอมโบ: x${s.combo||0}`;
});
window.addEventListener('hha:quest',e=>{
 const d=e.detail||{};
 if(d.text)ui.quest.textContent=d.text;
 if(d.goal){
   ui.goalLbl.textContent=d.goal.label||'-';
   ui.goalFill.style.width=Math.min(100,(d.goal.prog/d.goal.target)*100)+'%';
 }
 if(d.mini){
   ui.miniLbl.textContent=d.mini.label||'-';
   ui.miniFill.style.width=Math.min(100,(d.mini.prog/d.mini.target)*100)+'%';
 }
});
window.addEventListener('hha:end',e=>{
 const d=e.detail||{};
 alert(`🎯 จบเกม!\nคะแนน: ${d.score||0}\nคอมโบสูงสุด: ${d.comboMax||0}\nMini Quest: ${d.questsCleared||0}/${d.questsTotal||3}\nGoal: ${d.goalCleared?'สำเร็จ':'ไม่สำเร็จ'}`);
});

// --- AFRAME & Game Boot ---
(async()=>{
 try{
   await waitAframe();
   const path=MODS[mode]||MODS.goodjunk;
   const mod=await import(path+'?v='+Date.now());
   if(!mod?.boot) throw new Error('ไม่มีฟังก์ชัน boot()');
   await mod.boot({ host:$('#spawnHost'), difficulty:diff, duration:dur });
 }catch(err){
   console.error(err);
   alert('โหลดโหมดไม่สำเร็จ: '+err.message);
 }
})();
</script>
</body>
</html>