/* Vision recognition only. Nutrients and portions are NEVER inferred here. */
import {FOODS,foodById} from "./nutrition.js";

const IDS=FOODS.map(food=>food.id);
export const MODEL_OUTPUT_SCHEMA={
  type:"object",
  additionalProperties:false,
  properties:{
    foodId:{type:"string",enum:[...IDS,"unknown"]},
    status:{type:"string",enum:["matched","uncertain","not_food"]}
  },
  required:["foodId","status"]
};

export function buildVisionRequest(image,model="gpt-4.1-mini"){
  return {
    model,
    store:false,
    max_output_tokens:220,
    text:{format:{
      type:"json_schema",
      name:"thai_food_classification",
      strict:true,
      schema:MODEL_OUTPUT_SCHEMA
    }},
    instructions:[
      "Classify the PRIMARY dish visible in the supplied photo using only the given food IDs.",
      "Return status matched and foodId only when image evidence clearly supports that exact dish.",
      "For more than one distinct dish, ambiguous photos, or any dish absent from the catalog, use status uncertain and foodId unknown.",
      "For photos without food, use status not_food and foodId unknown.",
      "Never guess from cuisine context or file metadata.",
      "Do not estimate portion size, calories, nutrients, ingredients, or health advice."
    ].join(" "),
    input:[{
      role:"user",
      content:[
        {type:"input_text",text:"Allowed Thai foods: "+FOODS.map(f=>f.id+" = "+f.name).join("; ")},
        {type:"input_image",image_url:image,detail:"low"}
      ]
    }]
  };
}

export function parseVisionResponse(payload){
  if(!payload||payload.status!=="completed")throw new Error("VISION_INCOMPLETE");
  const content=(payload.output||[]).flatMap(item=>item.content||[]);
  if(content.some(item=>item.type==="refusal"))throw new Error("VISION_REFUSED");
  const text=content.filter(item=>item.type==="output_text").map(item=>item.text).join("");
  let record;
  try{record=JSON.parse(text);}catch{throw new Error("VISION_INVALID_OUTPUT");}
  const status=record?.status,foodId=record?.foodId;
  if(!["matched","uncertain","not_food"].includes(status))throw new Error("VISION_INVALID_OUTPUT");
  if(status==="matched" && foodById(foodId))return {foodId,status:"matched"};
  if(foodId==="unknown" && status!=="matched")return {foodId:null,status};
  throw new Error("VISION_INVALID_OUTPUT");
}

export async function classifyFood(image,{
  apiKey,
  model="gpt-4.1-mini",
  endpoint="https://api.openai.com/v1/responses",
  fetcher=globalThis.fetch
}={}){
  if(!apiKey)throw new Error("VISION_NO_KEY");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetcher(endpoint,{
      method:"POST",
      signal:controller.signal,
      headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
      body:JSON.stringify(buildVisionRequest(image,model))
    });
    if(!response.ok)throw new Error("VISION_PROVIDER_HTTP_"+response.status);
    const payload=await response.json();
    return parseVisionResponse(payload);
  }finally{clearTimeout(timer);}
}
