import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {join,dirname,extname} from "node:path";
import {classifyFood} from "./vision.mjs";

const dir=dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT)||3000;
const allowed={"/":"index.html","/index.html":"index.html","/app.js":"app.js","/nutrition.js":"nutrition.js","/styles.css":"styles.css"};
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8"};
const MAX_BODY=4_300_000;
function reply(res,status,data){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"});
  res.end(JSON.stringify(data));
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let size=0;let excess=false;const chunks=[];
    req.on("data",chunk=>{
      size+=chunk.length;
      if(size>MAX_BODY){excess=true;reject(Object.assign(new Error("BODY_TOO_LARGE"),{httpStatus:413}));return;}
      if(!excess)chunks.push(chunk);
    });
    req.on("end",()=>{
      if(excess)return;
      try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));}
      catch{reject(Object.assign(new Error("INVALID_JSON"),{httpStatus:400}));}
    });
    req.on("error",reject);
  });
}
function validImage(value){
  if(typeof value!=="string"||value.length>MAX_BODY)return false;
  const m=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!m)return false;
  const bytes=Buffer.from(m[2],"base64");
  if(!bytes.length||bytes.length>3*1024*1024)return false;
  if(m[1]==="jpeg")return bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(m[1]==="png")return bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"));
  if(m[1]==="webp")return bytes.length>12&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
  return false;
}
const app=createServer(async(req,res)=>{
  let url;
  try{url=new URL(req.url||"/","http://localhost");}
  catch{return reply(res,400,{error:"คำขอไม่ถูกต้อง"});}
  if(req.method==="GET"&&url.pathname==="/api/status"){
    return reply(res,200,{aiConfigured:Boolean(process.env.OPENAI_API_KEY),dataSource:"illustrative-not-validated"});
  }
  if(req.method==="POST"&&url.pathname==="/api/analyze"){
    if(!process.env.OPENAI_API_KEY)return reply(res,503,{error:"ยังไม่ได้ตั้งค่า OPENAI_API_KEY บนเซิร์ฟเวอร์"});
    try{
      const body=await readBody(req);
      if(!validImage(body?.image))return reply(res,400,{error:"กรุณาส่งภาพ JPEG/PNG/WebP ที่มีขนาดไม่เกิน 3 MB และเป็นไฟล์รูปภาพที่ถูกต้อง"});
      const result=await classifyFood(body.image,{
        apiKey:process.env.OPENAI_API_KEY,
        model:process.env.OPENAI_VISION_MODEL||"gpt-4.1-mini",
        ...(process.env.NODE_ENV==="test"&&process.env.OPENAI_VISION_TEST_ENDPOINT
          ?{endpoint:process.env.OPENAI_VISION_TEST_ENDPOINT}:{})
      });
      if(!result.foodId)return reply(res,422,{error:result.status==="not_food"
        ?"AI ไม่พบอาหารในภาพนี้ กรุณาถ่ายภาพอาหารใหม่"
        :"AI ยังไม่สามารถจำแนกอาหารนี้ได้อย่างชัดเจน กรุณาลองภาพใหม่หรือใช้โหมดสาธิต"});
      return reply(res,200,result);
    }catch(error){
      if(error.httpStatus===413)return reply(res,413,{error:"ภาพที่ส่งมีขนาดใหญ่เกินกำหนด"});
      if(error.httpStatus===400)return reply(res,400,{error:"รูปแบบคำขอไม่ถูกต้อง"});
      // Avoid exposing provider responses, credentials, or user image data in error logs.
      console.error("Vision gateway failed:",error.name==="AbortError"?"timeout":"provider_or_schema_error");
      return reply(res,502,{error:"บริการ AI ไม่พร้อมใช้งาน หรือไม่สามารถอ่านผลได้อย่างปลอดภัย กรุณาลองใหม่"});
    }
  }
  if(req.method!=="GET"||!Object.hasOwn(allowed,url.pathname)){
    res.writeHead(404,{"Cache-Control":"no-store"});return res.end("Not found");
  }
  try{
    const content=await readFile(join(dir,allowed[url.pathname]));
    res.writeHead(200,{
      "Content-Type":mime[extname(allowed[url.pathname])],
      "X-Content-Type-Options":"nosniff",
      "Referrer-Policy":"no-referrer",
      "Content-Security-Policy":"default-src 'self'; img-src 'self' blob: data:; connect-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    res.end(content);
  }catch{res.writeHead(500);res.end("Server error");}
});
const host=process.env.HOST||"127.0.0.1";
app.listen(port,host,()=>console.log("NutriLens TH listening on http://"+host+":"+port));
