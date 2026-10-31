import {createGameFromThai} from "./thai-game-planner.js";
import {mountAdventure} from "./adventure-engine.js";
const prompt=document.querySelector("#prompt"),age=document.querySelector("#ageLevel"),out=document.querySelector("#output"),status=document.querySelector("#status"),canvas=document.querySelector("#gameCanvas");
let active=null;
document.querySelector("#generate").addEventListener("click",()=>{
 try{
  const game=createGameFromThai(prompt.value,age.value);
  out.textContent=JSON.stringify(game,null,2);
  active?.destroy();active=null;
  if(game.type==="adventure"){active=mountAdventure(canvas,game,message=>status.textContent=message);canvas.hidden=false;status.textContent="เกมพร้อมเล่น — ใช้ลูกศรหรือปุ่มบนจอ";}
  else{canvas.hidden=true;status.textContent="สร้าง JSON สำเร็จ — Game Engine ประเภทนี้อยู่ระหว่างพัฒนา";}
 }catch(e){out.textContent="";status.textContent=e.message;active?.destroy();active=null;canvas.hidden=true;}
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
