// === /herohealth/vr/hha-ai-director.js ===
// HHA AI Director — adaptive tuning + coaching signals (no external AI)
// ✅ estimates skill/fatigue/frustration from gameplay metrics
// ✅ returns tuning multipliers (spawnMul, sizeMul, badMul, rewardMul)
// ✅ suggests coach moments (key,text,sub,mood)

'use strict';
import { clamp } from './hha-runkit.js';

export function createAIDirector(opts={}){
  const game = String(opts.game||'game');
  const cooldownMs = clamp(opts.cooldownMs ?? 3200, 1200, 12000);
  const emit = opts.emit || (()=>{});

  let lastAt=0, lastKey='';

  function say(key, text, sub='', mood='neutral'){
    const t = performance.now();
    if (t-lastAt < cooldownMs) return;
    if (key && key===lastKey) return;
    lastAt=t; lastKey=key;
    emit('hha:coach', { game, text, sub, mood });
  }

  function estimate(ctx){
    // ctx: { acc01, missRate01, combo01, elapsed01, inMini, inBoss, shield, goal01 }
    const acc = clamp(ctx.acc01,0,1);
    const combo = clamp(ctx.combo01,0,1);
    const missR = clamp(ctx.missRate01,0,1);
    const goal = clamp(ctx.goal01,0,1);

    const skill = clamp(acc*0.7 + combo*0.3, 0, 1);
    const fatigue = clamp(ctx.elapsed01, 0, 1);
    const frustration = clamp((missR*0.75 + (1-acc)*0.25), 0, 1);

    return { skill, fatigue, frustration, goal };
  }

  function tune(ctx){
    const { skill, fatigue, frustration, goal } = estimate(ctx);

    // baseline = 1
    let spawnMul = 1.0;
    let sizeMul  = 1.0;
    let badMul   = 1.0;
    let rewardMul= 1.0;

    // if struggling -> easier
    if (frustration > 0.62){
      spawnMul *= 1.10;  // slower spawn (engine should invert properly, see patch)
      sizeMul  *= 1.08;
      badMul   *= 0.92;
      rewardMul*= 1.05;
      say('struggle','ช้า ๆ แต่ชัวร์นะ 🎯','หยุดรัว 1 วิ แล้วเล็งกลางจอ','neutral');
    }

    // if skill high -> harder
    if (skill > 0.78 && frustration < 0.45){
      spawnMul *= 0.92;
      sizeMul  *= 0.95;
      badMul   *= 1.06;
      rewardMul*= 1.02;
      say('pro','โคตรเก่ง! ลองยากขึ้นไหม ⚡','รักษาคอมโบ + เล่นให้เนียน','happy');
    }

    // fatigue high -> soften slightly
    if (fatigue > 0.70){
      spawnMul *= 1.08;
      badMul   *= 0.95;
      say('fatigue','พักสายตาแป๊บก็ได้นะ 👀','เดี๋ยว AI ผ่อนให้หน่อย','neutral');
    }

    // goal not progressing -> suggest focus
    if (goal < 0.35 && ctx.elapsed01 > 0.45){
      say('goal','โฟกัส “ทำ Goal ให้ผ่านก่อน” ✅','อย่าไล่ยิงทุกอัน เลือกอันที่ชัวร์','neutral');
    }

    return { skill, fatigue, frustration, spawnMul, sizeMul, badMul, rewardMul };
  }

  return { tune, say };
}