import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import net from "node:net";
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
async function startServer(){
  const port=await vacantPort();
  const child=spawn(process.execPath,["server.mjs"],{
    cwd:appDir,
    env:{...process.env,PORT:String(port),OPENAI_API_KEY:""},
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
