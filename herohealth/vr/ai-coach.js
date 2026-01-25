// === /herohealth/vr/ai-coach.js ===
// AI Coach (Explainable micro-tips) — HHA Standard
// ✅ createAICoach({ emit, game, cooldownMs })
// ✅ onStart(), onUpdate(state), onEnd(summary)
// Emits: emit('hha:coach', { game, type:'tip', level, text, why, at, stateMini })

'use strict';

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function' ? opts.emit : ()=>{};
  const game = String(opts.game || 'game');
  const cooldownMs = Number(opts.cooldownMs || 2800);

  const C = {
    lastAt: 0,
    started: false,
    lastKey: '',
    nTips: 0,
  };

  function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }

  function say(key, payload){
    const t = now();
    if (t - C.lastAt < cooldownMs) return;
    if (key && key === C.lastKey) return;

    C.lastAt = t;
    C.lastKey = key || '';
    C.nTips++;

    emit('hha:coach', Object.assign({
      game,
      type:'tip',
      at: new Date().toISOString(),
      n: C.nTips
    }, payload));
  }

  function pickTip(s){
    // state fields ที่ hydration.safe.js ส่งมา:
    // skill, fatigue, frustration, inStorm, inEndWindow, waterZone, shield, misses, combo
    const skill = clamp(s.skill, 0, 1);
    const fatigue = clamp(s.fatigue, 0, 1);
    const frustration = clamp(s.frustration, 0, 1);
    const inStorm = !!s.inStorm;
    const inEnd = !!s.inEndWindow;
    const zone = String(s.waterZone || '');
    const shield = Number(s.shield || 0);
    const misses = Number(s.misses || 0);
    const combo = Number(s.combo || 0);

    // “โหด+สนุก” = แนะนำแบบจับจังหวะ ไม่ spam
    if (inStorm && inEnd){
      if (shield <= 0){
        return ['end_no_shield', {
          level:'urgent',
          text:'⚠️ End Window มาแล้ว แต่ไม่มี 🛡️ — อย่ายิงรัว! เล็งให้ชัวร์เพื่อไม่โดน 🥤',
          why:'ช่วงท้ายพายุคือจุดตัดสิน Mini ถ้าโดน BAD จะพังเงื่อนไขผ่าน'
        }];
      }
      return ['end_block', {
        level:'urgent',
        text:'🔥 End Window! ใช้ 🛡️ BLOCK ให้ติด “ช่วงท้าย” แล้วจะผ่าน Mini ง่ายมาก',
        why:'Mini ต้องมี “BLOCK ใน End Window” + โซนไม่ GREEN + ห้ามโดน BAD'
      }];
    }

    if (inStorm && shield === 0){
      return ['storm_get_shield', {
        level:'hint',
        text:'🌀 เข้า Storm แล้ว: โฟกัสหา 🛡️ ก่อน—เก็บไว้รอ End Window',
        why:'ถ้าไม่มีโล่ จะกัน BAD ช่วงท้ายไม่ได้'
      }];
    }

    if (!inStorm && shield < 1){
      return ['pre_storm_stock', {
        level:'hint',
        text:'🛡️ สะสมโล่ไว้ 1–2 อันก่อนพายุมา จะ “กันรัว” ช่วงท้ายได้สวยมาก',
        why:'Stage2/3 ใช้โล่เป็นกุญแจผ่าน Storm และ Boss'
      }];
    }

    if (zone === 'GREEN' && skill < 0.45){
      return ['keep_green_simple', {
        level:'coach',
        text:'💧 เป้าหมายตอนนี้: “ยิงให้คุมน้ำอยู่ GREEN” ไม่ต้องรีบ—จังหวะชัวร์สำคัญกว่า',
        why:'Stage1 ต้องสะสมเวลา GREEN ให้ครบ'
      }];
    }

    if (misses >= 18 && frustration > 0.55){
      return ['calm_down', {
        level:'coach',
        text:'😤 MISS เริ่มสูง—หยุดรัว 1 วิ แล้วกลับมา “ยิงเฉพาะเป้าที่อยู่กลางสายตา”',
        why:'ลด MISS = เกรดขึ้นไวกว่าเพิ่มคะแนนแบบเสี่ยง'
      }];
    }

    if (combo >= 12 && skill >= 0.65){
      return ['combo_push', {
        level:'praise',
        text:'⚡ คอมโบสวย! ตอนนี้ลดเสี่ยง + รักษาจังหวะ จะได้เกรด S/SS ง่ายมาก',
        why:'ระบบเกรดให้ค่าน้ำหนักกับ Accuracy + Miss'
      }];
    }

    if (fatigue > 0.70 && !inStorm){
      return ['late_game_focus', {
        level:'hint',
        text:'⏳ ช่วงท้ายเกม: เล่น “ปลอดภัย” รักษา Accuracy อย่าให้ MISS พุ่ง',
        why:'ท้ายเกมมักพังเพราะรีบ—เล่นนิ่ง ๆ จะจบสวย'
      }];
    }

    // default (ไม่พูดก็ได้)
    return null;
  }

  return {
    onStart(){
      if (C.started) return;
      C.started = true;
      say('start', {
        level:'start',
        text:'🎮 เริ่มแล้ว! โฟกัส Stage1: คุม GREEN ให้ครบ แล้วค่อยลุย Storm/Boss',
        why:'Hydration เป็นเกม “คุมสมดุล + จังหวะ” ไม่ใช่ยิงรัว'
      });
    },

    onUpdate(state={}){
      const res = pickTip(state);
      if (!res) return;
      const [key, payload] = res;
      say(key, Object.assign({ stateMini:{
        inStorm: !!state.inStorm,
        inEndWindow: !!state.inEndWindow,
        waterZone: String(state.waterZone||''),
        shield: Number(state.shield||0),
        misses: Number(state.misses||0),
        combo: Number(state.combo||0),
      }}, payload));
    },

    onEnd(summary={}){
      say('end', {
        level:'end',
        text:'🏁 จบเกมแล้ว! ดู “Next” ในสรุปผล แล้วลอง Retry เพื่ออัปเกรดเกรดให้สูงขึ้น',
        why:'สรุปจะบอกว่าติด Stage ไหน (GREEN / Mini / Boss)'
      });
    }
  };
}
