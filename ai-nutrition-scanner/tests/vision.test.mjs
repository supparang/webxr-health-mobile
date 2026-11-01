import test from "node:test";
import assert from "node:assert/strict";
import {buildVisionRequest,parseVisionResponse,classifyFood,MODEL_OUTPUT_SCHEMA} from "../vision.mjs";

const response=(record)=>({
  status:"completed",
  output:[{content:[{type:"output_text",text:JSON.stringify(record)}]}]
});
const image="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";
test("vision request uses schema-bound food IDs with image, no nutrients or portions",()=>{
  const result=buildVisionRequest(image);
  assert.equal(result.store,false);
  assert.equal(result.text.format.type,"json_schema");
  assert.equal(result.text.format.strict,true);
  assert.equal(MODEL_OUTPUT_SCHEMA.additionalProperties,false);
  assert.ok(MODEL_OUTPUT_SCHEMA.properties.foodId.enum.includes("unknown"));
  assert.equal(result.input[0].content[1].image_url,image);
  assert.doesNotMatch(JSON.stringify(result.text.format.schema),/kcal|protein|sodium/);
});
test("accept matched food, reject unknown, incompatible, refusal and incomplete",()=>{
  assert.deepEqual(parseVisionResponse(response({foodId:"kaprao",status:"matched"})),{foodId:"kaprao",status:"matched"});
  assert.deepEqual(parseVisionResponse(response({foodId:"unknown",status:"uncertain"})),{foodId:null,status:"uncertain"});
  assert.deepEqual(parseVisionResponse(response({foodId:"unknown",status:"not_food"})),{foodId:null,status:"not_food"});
  assert.throws(()=>parseVisionResponse(response({foodId:"invented",status:"matched"})),/VISION_INVALID_OUTPUT/);
  assert.throws(()=>parseVisionResponse(response({foodId:"kaprao",status:"uncertain"})),/VISION_INVALID_OUTPUT/);
  assert.throws(()=>parseVisionResponse({status:"incomplete",output:[]}),/VISION_INCOMPLETE/);
  assert.throws(()=>parseVisionResponse({status:"completed",output:[{content:[{type:"refusal",refusal:"no"}]}]}),/VISION_REFUSED/);
});
test("provider mock validates payload, uses server-only key and maps results",async()=>{
  let seen;
  const mock=async(url,options)=>{
    seen={url,options};
    return {ok:true,json:async()=>response({foodId:"som-tam",status:"matched"})};
  };
  const result=await classifyFood(image,{apiKey:"server-secret-fixture",fetcher:mock});
  assert.deepEqual(result,{foodId:"som-tam",status:"matched"});
  assert.equal(seen.options.headers.Authorization,"Bearer server-secret-fixture");
  assert.equal(JSON.parse(seen.options.body).store,false);
  assert.ok(!seen.options.body.includes("server-secret-fixture"));
});
test("provider rejection does not produce invented match",async()=>{
  await assert.rejects(
    ()=>classifyFood(image,{apiKey:"mock",fetcher:async()=>({ok:false,status:429})}),
    /VISION_PROVIDER_HTTP_429/
  );
  await assert.rejects(()=>classifyFood(image,{apiKey:""}),/VISION_NO_KEY/);
});
