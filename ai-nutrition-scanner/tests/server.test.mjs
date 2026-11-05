import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import net from "node:net";
import {createServer} from "node:http";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";

const dirnameHere=dirname(fileURLToPath(import.meta.url));
const appDir=resolve(dirnameHere,"..");
async function vacantPort(){
  const server=net.createServer();
  await new Promise((accept,reject)=>server.once("error",reject).listen(0,"127.0.0.1",accept));
  const port=server.address().port;
  await new Promise((accept,reject)=>server.close(error=>error?reject(error):accept()));
  return port;
}
async function startServer(overrides={}){
  const port=await vacantPort();
  const child=spawn(process.execPath,["server.mjs"],{
    cwd:appDir,
    env:{...process.env,PORT:String(port),OPENAI_API_KEY:"",...overrides},
    stdio:["ignore","pipe","pipe"]
  });
  const origin="http://127.0.0.1:"+port;
  let exited=false;
  child.once("exit",()=>{exited=true;});
  for(let attempt=0;attempt<50;attempt++){
    if(exited)throw Error("Application server exited during boot");
    try{
      const response=await fetch(origin+"/api/status");
      if(response.ok)return {child,origin};
    }catch{}
    await new Promise(done=>setTimeout(done,100));
  }
  child.kill();
  throw Error("Application server was not ready");
}
test("HTTP/API smoke tests without AI secrets",async t=>{
  const {child,origin}=await startServer();
  t.after(()=>child.kill());

  await t.test("serves Thai homepage and JavaScript",async()=>{
    const response=await fetch(origin+"/");
    assert.equal(response.status,200);
    assert.match(response.headers.get("content-type"),/text\/html/);
    assert.match(await response.text(),/NutriLens TH/);
    const script=await fetch(origin+"/app.js");
    assert.equal(script.status,200);
    assert.match(script.headers.get("content-type"),/javascript/);
  });

  await t.test("status clearly reports unconfigured AI and demo data source",async()=>{
    const response=await fetch(origin+"/api/status");
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{
      aiConfigured:false,
      dataSource:"illustrative-not-validated"
    });
  });

  await t.test("does not silently analyze or invent AI results without API key",async()=>{
    const response=await fetch(origin+"/api/analyze",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({image:"data:image/png;base64,AAAA"})
    });
    assert.equal(response.status,503);
    const body=await response.json();
    assert.match(body.error,/OPENAI_API_KEY/);
    assert.equal(body.foodId,undefined);
  });

  await t.test("non-allowlisted path is not served",async()=>{
    const response=await fetch(origin+"/does-not-exist");
    assert.equal(response.status,404);
  });
});


test("AI gateway integration with local mock provider, no external API access",async t=>{
  const input=Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YC8siAAAAAASUVORK5CYII=",
    "base64"
  );
  const image="data:image/png;base64,"+input.toString("base64");
  let replyData={status:"completed",output:[{content:[{type:"output_text",
    text:JSON.stringify({foodId:"kaprao",status:"matched"})}]}]};
  let sentRequest=null;
  const mock=createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    sentRequest={headers:req.headers,body:JSON.parse(Buffer.concat(chunks).toString("utf8"))};
    res.writeHead(200,{"Content-Type":"application/json"});
    res.end(JSON.stringify(replyData));
  });
  await new Promise((resolve,reject)=>mock.once("error",reject).listen(0,"127.0.0.1",resolve));
  t.after(()=>mock.close());
  const mockPort=mock.address().port;
  const {child,origin}=await startServer({
    NODE_ENV:"test",
    OPENAI_API_KEY:"test-not-real-secret",
    OPENAI_VISION_TEST_ENDPOINT:"http://127.0.0.1:"+mockPort+"/v1/responses"
  });
  t.after(()=>child.kill());
  const request=body=>fetch(origin+"/api/analyze",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });

  await t.test("rejects invalid image bytes before model invocation",async()=>{
    const response=await request({image:"data:image/png;base64,AAAA"});
    assert.equal(response.status,400);
    assert.equal(sentRequest,null);
  });

  await t.test("sends structured vision request and returns only known food ID",async()=>{
    const response=await request({image});
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{foodId:"kaprao",status:"matched"});
    assert.equal(sentRequest.headers.authorization,"Bearer test-not-real-secret");
    assert.equal(sentRequest.body.text.format.type,"json_schema");
    assert.equal(sentRequest.body.store,false);
    assert.deepEqual(sentRequest.body.input[0].content[1].image_url,image);
    assert.ok(!JSON.stringify(sentRequest.body).includes("test-not-real-secret"));
  });

  await t.test("unknown food returns 422 and never invents nutrient information",async()=>{
    replyData={status:"completed",output:[{content:[{type:"output_text",
      text:JSON.stringify({foodId:"unknown",status:"uncertain"})}]}]};
    const response=await request({image});
    assert.equal(response.status,422);
    const payload=await response.json();
    assert.equal(payload.foodId,undefined);
    assert.equal(payload.nutrients,undefined);
  });

  await t.test("invalid provider payload fails closed with 502",async()=>{
    replyData={status:"completed",output:[{content:[{type:"output_text",
      text:JSON.stringify({foodId:"not-in-catalog",status:"matched"})}]}]};
    const response=await request({image});
    assert.equal(response.status,502);
    const payload=await response.json();
    assert.equal(payload.foodId,undefined);
    assert.equal(payload.nutrients,undefined);
  });
});
