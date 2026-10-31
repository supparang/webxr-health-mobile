import {createGameFromThai} from "./thai-game-planner.js";
import {mountAdventure} from "./adventure-engine.js";
import {mountMaze} from "./maze-engine.js";
import {mountQuiz} from "./quiz-engine.js";
import {mountDodge} from "./dodge-engine.js";
import {CREATION_LEVELS,GENRES,exampleFor} from "./creation-presets.js";
const prompt=document.querySelector("#prompt"),age=document.querySelector("#ageLevel"),out=document.querySelector("#output"),status=document.querySelector("#status"),canvas=document.querySelector("#gameCanvas"),quizPanel=document.querySelector("#quizPanel"),controls=document.querySelector("#gameControls");
let active=null,selectedType="adventure";
const targetInput=document.querySelector("#targetInput"),livesInput=document.querySelector("#livesInput"),levelsInput=document.querySelector("#levelsInput");
const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))&&value!==""?Math.max(min,Math.min(max,Math.round(Number(value)))):fallback;
function updatePrompt(){
 prompt.value=exampleFor(selectedType,age.value);
 for(const b of document.querySelectorAll(".genre-card"))b.setAttribute("aria-pressed",String(b.dataset.genre===selectedType));
}
function refreshAge(){
 const p=CREATION_LEVELS[age.value]||CREATION_LEVELS.p4;
 document.body.dataset.age=age.value;
 document.querySelector("#learningGoal").textContent="เป้าหมายการเรียนรู้: "+p.goal;
 document.querySelector("#ageHelp").textContent=p.help;
 targetInput.value=p.score;livesInput.value=age.value==="p1"?5:age.value==="m4"?2:3;levelsInput.value=p.levels;
 const beginner=age.value==="p1";
 targetInput.disabled=beginner;livesInput.disabled=beginner;levelsInput.disabled=beginner;
 updatePrompt();
}
for(const [i,b] of [...document.querySelectorAll(".genre-card")].entries()){
 b.dataset.genre=GENRES[i].type;
 b.addEventListener("click",()=>{selectedType=b.dataset.genre;updatePrompt();});
}
age.addEventListener("change",refreshAge);
refreshAge();
document.querySelector("#generate").addEventListener("click",()=>{
 try{
  const game=createGameFromThai(prompt.value,age.value);
  if(game.type===selectedType){
   const p=CREATION_LEVELS[age.value]||CREATION_LEVELS.p4;
   game.rules.targetScore=clamp(targetInput.value,1,100,p.score);
   game.player.lives=clamp(livesInput.value,1,10,3);
   game.rules.levels=clamp(levelsInput.value,1,10,p.levels);
  }
  out.textContent=JSON.stringify(game,null,2);
  active?.destroy();active=null;quizPanel.hidden=true;quizPanel.replaceChildren();controls.hidden=true;document.querySelector("#restart").hidden=false;
  if(game.type==="adventure"||game.type==="maze"||game.type==="dodge"){active=game.type==="maze"?mountMaze(canvas,game,message=>status.textContent=message):game.type==="dodge"?mountDodge(canvas,game,message=>status.textContent=message):mountAdventure(canvas,game,message=>status.textContent=message);canvas.hidden=false;controls.hidden=false;for(const b of controls.querySelectorAll("[data-control]"))b.hidden=game.type==="maze"?b.dataset.control==="jump":!["left","right",...(game.type==="adventure"?["jump"]:[])].includes(b.dataset.control);status.textContent="เกมพร้อมเล่น — ใช้ลูกศรหรือปุ่มบนจอ";}
  else if(game.type==="quiz"){canvas.hidden=true;active=mountQuiz(quizPanel,game,prompt.value,message=>status.textContent=message);status.textContent="เลือกคำตอบเพื่อเริ่มเล่น";}
  else{canvas.hidden=true;status.textContent="สร้าง JSON สำเร็จ — Game Engine ประเภทนี้อยู่ระหว่างพัฒนา";}
 }catch(e){out.textContent="";status.textContent=e.message;active?.destroy();active=null;canvas.hidden=true;quizPanel.hidden=true;controls.hidden=true;}
});
document.querySelector("#restart").addEventListener("click",()=>active?.restart());
for(const button of document.querySelectorAll("[data-control]")){
 const control=button.dataset.control;
 const release=()=>active?.setTouch(control,false);
 button.addEventListener("pointerdown",e=>{e.preventDefault();button.setPointerCapture(e.pointerId);active?.setTouch(control,true);});
 button.addEventListener("pointerup",release);
 button.addEventListener("pointercancel",release);
 button.addEventListener("lostpointercapture",release);
}
