import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join,dirname,extname} from "node:path";
import {FOODS,foodById} from "./nutrition.js";
const dir=dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT)||3000;
const allowed={"/":"index.html","/index.html":"index.html","/app.js":"app.js","/nutrition.js":"nutrition.js","/styles.css":"styles.css"};
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};
function reply(res,code,data){res.writeHead(code,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(JSON.stringify(data));}
function readBody(req){return new Promise((resolve,reject)=>{let size=0;const chunks=[];req.on("data",c=>{size+=c.length;if(size>5_000_000){reject(new Error("รูปภาพใหญ่เกินขนาดที่อนุญาต"));req.destroy();return;}chunks.push(c);});req.on("end",()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));}catch{reject(new Error("คำขอไม่ถูกต้อง"));}});req.on("error",reject);});}
async function analyze(image){
  const model=process.env.OPENAI_VISION_MODEL||"gpt-4.1-mini";
  const choices=FOODS.map(x=>x.id+" = "+x.name).join("; ");
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",signal:controller.signal,
      headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({model,store:false,max_output_tokens:160,
        instructions:"Identify Thai food from the photo. Return only valid JSON: {\"foodId\":string|null,\"confidence\":number}. Choose only an ID from the list. If not visually matchable or unclear return null. Confidence 0-1 is an uncalibrated model self-estimate. Never infer nutrients, quantities, health status, or diagnoses.",
        input:[{role:"user",content:[{type:"input_text",text:"Match visible dish to one of these food IDs: "+choices},{type:"input_image",image_url:image,detail:"low"}]}]})
    });
    if(!response.ok)throw new Error("AI provider returned "+response.status);
    const payload=await response.json();
    const output=(payload.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==="output_text").map(item=>item.text).join("");
    const result=JSON.parse(output);
    if(!foodById(result.foodId))return {foodId:null,confidence:null};
    const confidence=Number(result.confidence);
    return {foodId:result.foodId,confidence:Number.isFinite(confidence)?Math.min(1,Math.max(0,confidence)):null};
  }finally{clearTimeout(timeout);}
}
const app=createServer(async(req,res)=>{
  const url=new URL(req.url||"/","http://localhost");
  if(req.method==="GET"&&url.pathname==="/api/status"){return reply(res,200,{aiConfigured:Boolean(process.env.OPENAI_API_KEY),dataSource:"illustrative-not-validated"});}
  if(req.method==="POST"&&url.pathname==="/api/analyze"){
    if(!process.env.OPENAI_API_KEY)return reply(res,503,{error:"ยังไม่ได้ตั้งค่า OPENAI_API_KEY บนเซิร์ฟเวอร์"});
    try{
      const {image}=await readBody(req);
      if(typeof image!=="string"||!/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(image)||Buffer.byteLength(image,"utf8")>4_500_000)return reply(res,400,{error:"กรุณาส่งภาพ JPEG/PNG/WebP ที่มีขนาดไม่เกิน 3 MB"});
      const result=await analyze(image);
      if(!result.foodId)return reply(res,422,{error:"ยังไม่สามารถระบุรายการอาหารในฐานข้อมูลตัวอย่างจากภาพนี้ได้"});
      return reply(res,200,result);
    }catch(error){console.error("analyze failed:",error.name||"Error");if(!res.headersSent)return reply(res,502,{error:"บริการ AI ไม่พร้อมใช้งาน โปรดลองใหม่หรือตรวจสอบการตั้งค่าเซิร์ฟเวอร์"});return;}
  }
  if(req.method!=="GET"||!Object.hasOwn(allowed,url.pathname)){res.writeHead(404);return res.end("Not found");}
  try{const file=join(dir,allowed[url.pathname]);const content=await readFile(file);res.writeHead(200,{"Content-Type":mime[extname(file)],"X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(content);}catch{res.writeHead(500);res.end("Server error");}
});
app.listen(port,()=>console.log("NutriLens TH listening on http://localhost:"+port));
