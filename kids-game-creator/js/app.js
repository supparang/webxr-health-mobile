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
const workspace=document.querySelector("#ageWorkspace"),numericPanel=document.querySelector("#numericPanel"),promptLabel=document.querySelector("#promptLabel");
const choices={theme:"forest",score:5,enemyCount:2,timeLimit:90,character:"กระต่าย"};
const nextToDesign=document.querySelector("#nextToDesign");
const steps=document.querySelector("#learningSteps"),chooseStep=document.querySelector("#chooseStep"),designStep=document.querySelector("#designStep"),gameArea=document.querySelector("#gameArea"),editGame=document.querySelector("#editGame"),backToChoose=document.querySelector("#backToChoose");
let beginnerStep="choose";
function setBeginnerStep(step,{scroll=false}={}){
 beginnerStep=step;
 const beginner=age.value==="p1";
 steps.hidden=!beginner;
 nextToDesign.hidden=!beginner||step!=="choose";
 chooseStep.hidden=beginner&&step!=="choose";
 designStep.hidden=beginner&&step!=="design";
 document.querySelector("#designActions").hidden=beginner&&step!=="design";
 document.querySelector("#learningGoal").hidden=beginner&&step==="play";
 gameArea.hidden=beginner&&step!=="play";
 backToChoose.hidden=!beginner;
 editGame.hidden=!beginner;
 for(const el of steps.querySelectorAll("[data-step]")){
  if(beginner&&el.dataset.step===step)el.setAttribute("aria-current","step");
  else el.removeAttribute("aria-current");
 }
 if(scroll){(step==="choose"?chooseStep:step==="design"?designStep:gameArea).scrollIntoView({behavior:"auto",block:"start"});}
}
nextToDesign.addEventListener("click",()=>setBeginnerStep("design",{scroll:true}));
editGame.addEventListener("click",()=>setBeginnerStep("design",{scroll:true}));
backToChoose.addEventListener("click",()=>setBeginnerStep("choose",{scroll:true}));
const completion=document.querySelector("#completionPanel"),completionText=document.querySelector("#completionText"),restartButton=document.querySelector("#restart");
function handleGameStatus(message){
 const ended=/ชนะแล้ว|แพ้แล้ว|เกมจบ/.test(message);
 const beginner=age.value==="p1";
 completion.hidden=!(beginner&&ended);
 controls.hidden=beginner&&ended;
 restartButton.hidden=beginner&&ended;
 completionText.textContent=message.includes("ชนะ")?"ยอดเยี่ยม! ทำภารกิจสำเร็จแล้ว 🎉":"ลองอีกครั้งนะ! ฝึกฝนแล้วจะเก่งขึ้น 💪";
 status.textContent=beginner&&ended?"":message;
}
const themes=[["forest","🌳 ป่า"],["space","🌌 อวกาศ"],["castle","🏰 ปราสาท"],["ocean","🌊 ทะเล"]];
const themeThai={forest:"ป่า",space:"อวกาศ",castle:"ปราสาท",ocean:"ทะเล"};
function addText(parent,tag,value,className=""){
 const el=document.createElement(tag);el.textContent=value;if(className)el.className=className;parent.append(el);return el;
}
function addChoices(parent,title,key,options){
 addText(parent,"p",title,"task");
 const group=document.createElement("div");group.className="choices";group.setAttribute("role","group");group.setAttribute("aria-label",title);
 for(const [value,label] of options){
  const button=document.createElement("button");button.type="button";button.textContent=label;button.setAttribute("aria-pressed",String(choices[key]===value));
  button.addEventListener("click",()=>{choices[key]=value;for(const b of group.children)b.setAttribute("aria-pressed",String(b===button));updatePrompt();});
  group.append(button);
 }
 parent.append(group);
}
function addNumber(parent,label,key,min,max){
 const field=document.createElement("label");field.textContent=label;
 const input=document.createElement("input");input.type="number";input.min=String(min);input.max=String(max);input.value=String(choices[key]);
 input.dataset.rule=key;input.addEventListener("change",()=>{choices[key]=clamp(input.value,min,max,choices[key]);input.value=choices[key];updatePrompt();});
 field.append(input);parent.append(field);
}
function renderWorkspace(){
 const level=age.value;workspace.replaceChildren();
 const titles={p1:"🧸 เลือกภาพแล้วสร้างเกม",p4:"🛠️ นักออกแบบเกมรุ่นเยาว์",m1:"🧪 ห้องทดลองกฎของเกม",m4:"📊 ห้องวิเคราะห์และปรับสมดุลเกม"};
 addText(workspace,"h3",titles[level]);
 if(level==="p1"){
  addText(workspace,"p","ไม่ต้องพิมพ์! เลือกภาพ ฉาก และเป้าหมาย แล้วกดสร้างเกม");
  addChoices(workspace,"เลือกตัวละคร","character",[["กระต่าย","🐰 กระต่าย"],["แมว","🐱 แมว"],["หมี","🐻 หมี"],["หุ่นยนต์","🤖 หุ่นยนต์"]]);
  addChoices(workspace,"เลือกฉาก", "theme",themes);
  addChoices(workspace,"เก็บกี่คะแนนดี?", "score",[[3,"⭐ 3 คะแนน"],[5,"⭐⭐ 5 คะแนน"],[10,"🏆 10 คะแนน"]]);
 }else if(level==="p4"){
  addText(workspace,"p","เลือกฉากและเป้าหมาย แล้วลองเปลี่ยนจำนวนชีวิตหรือด่านด้วยตนเอง");
  addChoices(workspace,"เลือกฉาก","theme",themes);
  addText(workspace,"p","ภารกิจ: สร้างเกมให้เพื่อนเล่นจนจบอย่างน้อย 1 รอบ","task");
 }else if(level==="m1"){
  addText(workspace,"p","ตั้งสมมติฐาน: เมื่อเพิ่มศัตรูหรือจำกัดเวลา เกมจะยากขึ้นหรือไม่?");
  addChoices(workspace,"เลือกฉาก","theme",themes);
  addNumber(workspace,"จำนวนศัตรู (0–5)","enemyCount",0,5);
  addNumber(workspace,"เวลาเป้าหมาย (15–300 วินาที)","timeLimit",15,300);
  addText(workspace,"p","ภารกิจ: ทดลอง 2 ชุดกติกา แล้วเปรียบเทียบผล","task");
 }else{
  addText(workspace,"p","วิเคราะห์ความยาก: ปรับตัวแปรหลายค่า และอธิบายเหตุผลก่อนทดสอบ");
  addChoices(workspace,"สภาพแวดล้อม","theme",themes);
  addNumber(workspace,"จำนวนศัตรู (0–10)","enemyCount",0,10);
  addNumber(workspace,"เวลาเป้าหมาย (15–300 วินาที)","timeLimit",15,300);
  const label=document.createElement("label");label.textContent="สมมติฐานการออกแบบ";
  const note=document.createElement("input");note.id="designHypothesis";note.placeholder="เช่น เพิ่มศัตรูจะทำให้ชนะยากขึ้น";label.append(note);workspace.append(label);
  addText(workspace,"p","ภารกิจ: เปรียบเทียบคะแนนและจำนวนครั้งที่แพ้ก่อน–หลังปรับกฎ","task");
 }
 numericPanel.hidden=level==="p1";
 promptLabel.textContent=level==="p1"?"คำสั่งที่ระบบสร้างให้ (ไม่ต้องพิมพ์)":level==="p4"?"อธิบายเกม (แก้ไขได้)":"คำสั่งออกแบบเกม (แก้ไขและทดลองได้)";
 prompt.readOnly=level==="p1";
}
function updatePrompt(){
 const level=age.value;
 const base=exampleFor(selectedType,level);
 if(level==="p1"){
  const kind=selectedType==="adventure"?"สร้างเกม"+choices.character+"ผจญภัย":base.replace(/ เก็บ \d+ คะแนน.*$/,"");
  prompt.value=kind+" ฉาก"+themeThai[choices.theme]+(selectedType==="adventure"||selectedType==="dodge"?" เก็บ "+choices.score+" คะแนน":"");
 }else{
  prompt.value=base+" ฉาก"+themeThai[choices.theme]+(level==="m1"||level==="m4"?" ศัตรู "+choices.enemyCount+" ตัว มีเวลา "+choices.timeLimit+" วินาที":"");
 }
 for(const b of document.querySelectorAll(".genre-card"))b.setAttribute("aria-pressed",String(b.dataset.genre===selectedType));
}

function refreshAge(){
 const p=CREATION_LEVELS[age.value]||CREATION_LEVELS.p4;
 document.body.dataset.age=age.value;
 document.querySelector("#learningGoal").textContent="เป้าหมายการเรียนรู้: "+p.goal;
 document.querySelector("#ageHelp").textContent=p.help;
 targetInput.value=p.score;livesInput.value=age.value==="p1"?5:age.value==="m4"?2:3;levelsInput.value=p.levels;
 const beginner=age.value==="p1";
 choices.score=p.score;choices.enemyCount=2;choices.timeLimit=age.value==="m4"?45:age.value==="m1"?60:90;choices.theme="forest";choices.character="กระต่าย";
 renderWorkspace();
 setBeginnerStep("choose");
 gameArea.dataset.ready="false";completion.hidden=true;
 targetInput.disabled=beginner;livesInput.disabled=beginner;levelsInput.disabled=beginner;
 updatePrompt();
}
for(const [i,b] of [...document.querySelectorAll(".genre-card")].entries()){
 b.dataset.genre=GENRES[i].type;
 b.addEventListener("click",()=>{selectedType=b.dataset.genre;updatePrompt();if(age.value==="p1")setBeginnerStep("design",{scroll:true});});
}
age.addEventListener("change",refreshAge);
refreshAge();
document.querySelector("#generate").addEventListener("click",()=>{
 try{
  const game=createGameFromThai(prompt.value,age.value);
  if(game.type===selectedType && age.value!=="p1"){
   const p=CREATION_LEVELS[age.value]||CREATION_LEVELS.p4;
   game.rules.targetScore=clamp(targetInput.value,1,100,p.score);
   game.player.lives=clamp(livesInput.value,1,10,3);
   game.rules.levels=clamp(levelsInput.value,1,10,p.levels);
   if(age.value==="m1"||age.value==="m4"){game.rules.enemyCount=choices.enemyCount;game.rules.timeLimit=choices.timeLimit;}
  }
  if(age.value==="p1" && game.type===selectedType){game.rules.targetScore=choices.score;if(selectedType==="adventure")game.player.name=choices.character;}
  game.theme=choices.theme;
  out.textContent=JSON.stringify(game,null,2);
  active?.destroy();active=null;completion.hidden=true;quizPanel.hidden=true;quizPanel.replaceChildren();controls.hidden=true;document.querySelector("#restart").hidden=false;
  if(game.type==="adventure"||game.type==="maze"||game.type==="dodge"){active=game.type==="maze"?mountMaze(canvas,game,handleGameStatus):game.type==="dodge"?mountDodge(canvas,game,message=>status.textContent=message):mountAdventure(canvas,game,message=>status.textContent=message);canvas.hidden=false;controls.hidden=false;for(const b of controls.querySelectorAll("[data-control]"))b.hidden=game.type==="maze"?b.dataset.control==="jump":!["left","right",...(game.type==="adventure"?["jump"]:[])].includes(b.dataset.control);status.textContent="เกมพร้อมเล่น — ใช้ลูกศรหรือปุ่มบนจอ";}
  else if(game.type==="quiz"){canvas.hidden=true;active=mountQuiz(quizPanel,game,prompt.value,message=>status.textContent=message);status.textContent="เลือกคำตอบเพื่อเริ่มเล่น";}
  else{canvas.hidden=true;status.textContent="สร้าง JSON สำเร็จ — Game Engine ประเภทนี้อยู่ระหว่างพัฒนา";}
  gameArea.dataset.ready="true";
  if(age.value==="p1")setBeginnerStep("play",{scroll:true});
 }catch(e){out.textContent="";status.textContent=e.message;active?.destroy();active=null;canvas.hidden=true;quizPanel.hidden=true;controls.hidden=true;}
});
function restartCurrentGame(){completion.hidden=true;restartButton.hidden=false;if(canvas.hidden===false)controls.hidden=false;active?.restart();}
restartButton.addEventListener("click",restartCurrentGame);
document.querySelector("#playAgain").addEventListener("click",restartCurrentGame);
document.querySelector("#createAnother").addEventListener("click",()=>setBeginnerStep("choose",{scroll:true}));
for(const button of document.querySelectorAll("[data-control]")){
 const control=button.dataset.control;
 const release=()=>active?.setTouch(control,false);
 button.addEventListener("pointerdown",e=>{e.preventDefault();button.setPointerCapture(e.pointerId);active?.setTouch(control,true);});
 button.addEventListener("pointerup",release);
 button.addEventListener("pointercancel",release);
 button.addEventListener("lostpointercapture",release);
}
