import {createGameFromThai} from "./thai-game-planner.js";
const prompt=document.querySelector("#prompt"),age=document.querySelector("#ageLevel"),out=document.querySelector("#output"),status=document.querySelector("#status");
document.querySelector("#generate").addEventListener("click",()=>{try{const game=createGameFromThai(prompt.value,age.value);out.textContent=JSON.stringify(game,null,2);status.textContent="สร้างโครงสร้างเกมสำเร็จ (โหมดกฎภาษาไทย)";}catch(e){out.textContent="";status.textContent=e.message;}});
