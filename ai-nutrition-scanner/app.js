import {FOODS,NUTRIENT_META,foodById,nutritionFor,SOURCE} from "./nutrition.js";
const $=(id)=>document.getElementById(id);
const STORAGE="nutrilens_th_history_v1";
const elements={photo:$("photo"),preview:$("preview"),remove:$("remove-photo"),mode:$("mode"),demoFood:$("demo-food"),demoField:$("demo-field"),analyze:$("analyze"),message:$("message"),panel:$("result-panel"),food:$("food-select"),grams:$("grams"),confidence:$("confidence"),energy:$("energy"),nutrients:$("nutrients"),history:$("history-list"),export:$("export"),clear:$("clear"),save:$("save"),source:$("source-notice")};
let photoUrl=null;let currentMode="demo";let analysisConfidence=null;
for(const food of FOODS){for(const select of [elements.demoFood,elements.food]){const option=document.createElement("option");option.value=food.id;option.textContent=food.name;select.append(option);}}
function message(text,error=false){elements.message.textContent=text;elements.message.className="message"+(error?" error":"");}
function revokePhoto(){if(photoUrl){URL.revokeObjectURL(photoUrl);photoUrl=null;}elements.preview.hidden=true;elements.preview.removeAttribute("src");elements.remove.hidden=true;}
elements.photo.addEventListener("change",()=>{revokePhoto();const file=elements.photo.files?.[0];if(!file)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>3*1024*1024){elements.photo.value="";message("รองรับเฉพาะ JPEG/PNG/WebP ขนาดไม่เกิน 3 MB",true);return;}photoUrl=URL.createObjectURL(file);elements.preview.src=photoUrl;elements.preview.hidden=false;elements.remove.hidden=false;message("เพิ่มภาพเรียบร้อย แต่ยังไม่ได้วิเคราะห์");});
elements.remove.addEventListener("click",()=>{elements.photo.value="";revokePhoto();message("ลบภาพออกแล้ว");});
elements.mode.addEventListener("change",()=>{elements.demoField.hidden=elements.mode.value!=="demo";elements.panel.hidden=true;message(elements.mode.value==="demo"?"โหมดสาธิตไม่อ่านหรือรู้จำภาพ":"โหมด AI จะส่งรูปให้บริการ OpenAI ผ่านเซิร์ฟเวอร์ หลังจากกดวิเคราะห์");});
function readDataURL(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("อ่านรูปภาพไม่สำเร็จ"));reader.readAsDataURL(file);});}
function showResult(id,mode){
  const food=foodById(id);
  if(!food)throw Error("ไม่พบอาหารในรายการที่รองรับ");
  currentMode=mode;
  elements.food.value=food.id;
  elements.grams.value=String(food.defaultGrams);
  elements.confidence.textContent=mode==="ai"
    ?"AI เสนอชื่ออาหารจากภาพเท่านั้น กรุณาตรวจสอบและแก้ไขรายการอาหารและน้ำหนักที่รับประทานด้วยตนเอง"
    :"โหมดสาธิต: ใช้รายการอาหารที่ผู้ใช้เลือก ไม่ได้จำแนกภาพ";
  elements.source.textContent=mode==="ai"
    ?"ผลจาก AI = การเสนอชื่ออาหารเท่านั้น · ยังไม่มีค่าพลังงานหรือสารอาหารที่ตรวจสอบอ้างอิงได้"
    :"ฐานข้อมูลอาหาร: "+SOURCE+" — ตัวเลขเพื่อทดสอบการทำงานเท่านั้น ห้ามตีความเป็นข้อมูลโภชนาการอ้างอิง";
  elements.panel.hidden=false;
  updateNutrition();
  elements.panel.scrollIntoView({behavior:"smooth",block:"start"});
}
elements.analyze.addEventListener("click",async()=>{elements.analyze.disabled=true;elements.panel.hidden=true;try{if(elements.mode.value==="demo"){showResult(elements.demoFood.value,"demo",null);message("แสดงผลจากข้อมูลสาธิตแล้ว — ไม่ใช่การวิเคราะห์ภาพ");return;}const file=elements.photo.files?.[0];if(!file)throw Error("กรุณาเลือกรูปภาพก่อนวิเคราะห์ด้วย AI");const image=await readDataURL(file);message("กำลังวิเคราะห์ภาพด้วย AI...");const response=await fetch("./api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image})});let payload=null;try{payload=await response.json();}catch{throw Error("เซิร์ฟเวอร์ AI ไม่พร้อมใช้งาน (โฮสต์แบบ static จะไม่รองรับ API)");}if(!response.ok)throw Error(payload.error||"วิเคราะห์ภาพไม่สำเร็จ");if(!foodById(payload.foodId))throw Error("ภาพนี้ยังไม่สามารถจับคู่กับรายการอาหารตัวอย่างได้ กรุณาเลือกเมนูในโหมดสาธิต");showResult(payload.foodId,"ai",payload.confidence);message("AI เสนอรายการอาหารแล้ว กรุณาตรวจสอบชนิดและปริมาณด้วยตนเอง");}catch(error){message(error.message||"เกิดข้อผิดพลาด",true);}finally{elements.analyze.disabled=false;}});
function updateNutrition(){
  try{
    const food=foodById(elements.food.value);
    const grams=Number(elements.grams.value);
    if(!food||!Number.isFinite(grams)||grams<1||grams>2000)throw Error("INVALID_PORTION");
    if(currentMode==="ai"){
      elements.energy.textContent="—";
      elements.nutrients.replaceChildren();
      const note=document.createElement("p");
      note.className="empty";
      note.textContent="ยังไม่มีค่าพลังงานและสารอาหารจากฐานข้อมูลที่ผ่านการตรวจสอบ · บันทึกได้เฉพาะชื่ออาหารและน้ำหนักที่ผู้ใช้ยืนยัน";
      elements.nutrients.append(note);
      elements.save.disabled=false;
      return null;
    }
    const n=nutritionFor(food,grams);
    elements.energy.textContent=Math.round(n.kcal).toLocaleString("th-TH");
    elements.nutrients.replaceChildren();
    for(const [key,label,unit] of NUTRIENT_META){
      const box=document.createElement("div");box.className="nutrient";
      const title=document.createElement("span");title.textContent=label;
      const value=document.createElement("strong");value.textContent=n[key].toLocaleString("th-TH")+" "+unit;
      box.append(title,value);elements.nutrients.append(box);
    }
    elements.save.disabled=false;
    return n;
  }catch{
    elements.energy.textContent="—";
    elements.nutrients.replaceChildren();
    elements.save.disabled=true;
    return null;
  }
}
elements.food.addEventListener("change",()=>{const food=foodById(elements.food.value);elements.grams.value=food.defaultGrams;updateNutrition();});elements.grams.addEventListener("input",updateNutrition);
function loadHistory(){try{const value=JSON.parse(localStorage.getItem(STORAGE)||"[]");return Array.isArray(value)?value.filter(item=>item&&foodById(item.foodId)&&Number.isFinite(item.grams)).slice(0,100):[];}catch{return [];}}
function saveHistory(items){localStorage.setItem(STORAGE,JSON.stringify(items.slice(0,100)));}
function renderHistory(){
  const entries=loadHistory();elements.history.replaceChildren();
  if(!entries.length){
    const empty=document.createElement("p");empty.className="empty";
    empty.textContent="ยังไม่มีข้อมูลที่บันทึก";elements.history.append(empty);
  }
  for(const item of entries){
    const food=foodById(item.foodId);
    const row=document.createElement("div");row.className="history-row";
    const left=document.createElement("div");
    const title=document.createElement("strong");title.textContent=food.name;
    const sub=document.createElement("small");
    sub.textContent=new Date(item.date).toLocaleString("th-TH")+" · "+item.grams+" กรัม · "
      +(item.mode==="ai"?"AI เสนอชื่อ/ผู้ใช้ยืนยัน":"ตัวอย่างสาธิต");
    left.append(title,sub);
    const calories=document.createElement("span");
    calories.textContent=item.mode==="ai"||!Number.isFinite(item.nutrients?.kcal)
      ?"ยังไม่มีค่าพลังงาน":Math.round(item.nutrients.kcal)+" kcal";
    row.append(left,calories);elements.history.append(row);
  }
}
elements.save.addEventListener("click",()=>{
  const nutrients=updateNutrition();
  if(elements.save.disabled)return;
  try{
    const source=currentMode==="ai"
      ?"AI_CLASSIFICATION_ONLY_NO_VERIFIED_NUTRIENTS":SOURCE;
    saveHistory([{
      date:new Date().toISOString(),
      foodId:elements.food.value,
      grams:Number(elements.grams.value),
      mode:currentMode,
      source,
      nutrients:currentMode==="ai"?null:nutrients
    },...loadHistory()]);
    renderHistory();
    message("บันทึกข้อมูลที่ผู้ใช้ยืนยันแล้วในเครื่องนี้ (ไม่มีรูปภาพ)");
    elements.panel.hidden=true;
  }catch{
    message("บันทึกไม่ได้: โปรดตรวจสอบการอนุญาตให้เก็บข้อมูลของเบราว์เซอร์",true);
  }
});
elements.clear.addEventListener("click",()=>{if(!loadHistory().length)return;if(confirm("ลบประวัติทั้งหมดจากเบราว์เซอร์เครื่องนี้?")){localStorage.removeItem(STORAGE);renderHistory();}});
function csvCell(value){let text=String(value??"");if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
elements.export.addEventListener("click",()=>{
  const rows=loadHistory();
  if(!rows.length){message("ไม่มีประวัติให้ส่งออก",true);return;}
  const columns=["date","food_name","grams","mode","source","kcal","protein_g","carb_g","fat_g","sugar_g","sodium_mg"];
  const lines=[columns.join(",")];
  for(const x of rows){
    const n=x.mode==="ai"?null:x.nutrients;
    lines.push([x.date,foodById(x.foodId).name,x.grams,x.mode,
      x.mode==="ai"?"AI_CLASSIFICATION_ONLY_NO_VERIFIED_NUTRIENTS":SOURCE,
      n?.kcal??"",n?.protein??"",n?.carb??"",n?.fat??"",n?.sugar??"",n?.sodium??""
    ].map(csvCell).join(","));
  }
  const url=URL.createObjectURL(new Blob(["\uFEFF"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="nutrilens-history.csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
});
renderHistory();message("พร้อมใช้งานโหมดสาธิต · ตัวเลขสารอาหารยังไม่ผ่านการตรวจสอบความถูกต้อง");