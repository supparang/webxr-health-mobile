export const GAME_TYPES = ["adventure","maze","quiz","dodge"];
export const AGE_LEVELS = ["p1","p4","m1","m4"];
export const AGE_PRESETS = {p1:{difficulty:1,lives:5,timeLimit:120},p4:{difficulty:2,lives:3,timeLimit:90},m1:{difficulty:3,lives:3,timeLimit:60},m4:{difficulty:4,lives:2,timeLimit:45}};
const THEMES = ["forest","space","castle","ocean"];
const integer=(v,f,min,max)=>{if(v===null||v===undefined||v==="")return f;const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):f;};
const label=(v,f,max)=>typeof v==="string"?(v.trim().slice(0,max)||f):f;
export function validateGame(input){
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("ข้อมูลเกมไม่ถูกต้อง");
 if(!GAME_TYPES.includes(input.type))throw Error("ประเภทเกมไม่ถูกต้อง");
 if(!AGE_LEVELS.includes(input.ageLevel))throw Error("ระดับชั้นไม่ถูกต้อง");
 const p=AGE_PRESETS[input.ageLevel];
 return {schemaVersion:1,type:input.type,ageLevel:input.ageLevel,title:label(input.title,"เกมของฉัน",80),theme:THEMES.includes(input.theme)?input.theme:"forest",player:{name:label(input.player?.name,"ผู้เล่น",40),lives:integer(input.player?.lives,p.lives,1,10)},rules:{difficulty:integer(input.rules?.difficulty,p.difficulty,1,5),timeLimit:integer(input.rules?.timeLimit,p.timeLimit,15,600),targetScore:integer(input.rules?.targetScore,10,1,100),enemyCount:integer(input.rules?.enemyCount,2,0,20),levels:integer(input.rules?.levels,1,1,10)}};
}
