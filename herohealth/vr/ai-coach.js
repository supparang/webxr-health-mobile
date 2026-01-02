// === /herohealth/vr/ai-coach.js ===
// HeroHealth AI Coach — PRODUCTION (Explainable micro-tips + rate-limit)
// ✅ emit('hha:coach', {text,mood,tag,...})
// ✅ Rate-limit + priority interrupts
// ✅ Deterministic-ish tip pick (seed) when provided
// ✅ Default OFF in research unless ?coach=1

'use strict';

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function hashStr(s){
  s=String(s||'');
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0);
}
function pick(list, key){
  if (!Array.isArray(list) || !list.length) return '';
  const idx = (hashStr(key) % list.length) | 0;
  return list[idx];
}

export function createAICoach(opts={}){
  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : (name,detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){} };

  const game = String(opts.game || 'herohealth');
  const cooldownMs = Math.max(900, Number(opts.cooldownMs || 3200));
  const forceOn = String(qs('coach','0')).toLowerCase();
  const run = String(qs('run', qs('runMode','play'))).toLowerCase();
  const enabled = (run !== 'research') || (forceOn==='1' || forceOn==='true');

  const state = {
    enabled,
    lastSayAt: 0,
    lastTag: '',
    lastMood: 'neutral',
    lastText: '',
    lastKey: '',
    // small memory to avoid spam
    seen: Object.create(null),
    started:false,
  };

  function canSay(tag, priority=false){
    if (!state.enabled) return false;
    const now = performance.now();
    if (priority) return true;
    if (now - state.lastSayAt < cooldownMs) return false;
    if (tag && tag === state.lastTag) return false;
    return true;
  }

  function say(text, mood='neutral', tag='tip', extra={}, priority=false){
    if (!text) return false;
    if (!canSay(tag, priority)) return false;

    state.lastSayAt = performance.now();
    state.lastTag = String(tag||'tip');
    state.lastMood = String(mood||'neutral');
    state.lastText = String(text||'');

    emit('hha:coach', Object.assign({
      game, text: state.lastText, mood: state.lastMood, tag: state.lastTag
    }, extra||{}));

    return true;
  }

  function explainablePack(ctx){
    // ctx: {skill,fatigue,frustration,inStorm,inEndWindow,waterZone,shield,misses,combo}
    const skill = clamp(ctx.skill ?? 0.5, 0, 1);
    const fatigue = clamp(ctx.fatigue ?? 0, 0, 1);
    const fr = clamp(ctx.frustration ?? 0, 0, 1);
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;
    const zone = String(ctx.waterZone || '');
    const shield = (ctx.shield|0);
    const misses = (ctx.misses|0);
    const combo = (ctx.combo|0);

    // deterministic key (ถ้ามี seed จะนิ่งขึ้น)
    const seed = String(qs('seed','')||'');
    const keyBase = `${game}|${seed}|${zone}|${inStorm?1:0}|${inEnd?1:0}|${shield}|${misses}|${combo}|${Math.round(skill*100)}`;

    // Tip pools
    const T = {
      start: [
        'เริ่มเลย! โฟกัสยิง 💧 ให้คุมน้ำอยู่ GREEN ก่อนนะ',
        'ทริค: ยิงแบบ “ค้างเล็งนิด” แล้วค่อยแตะ จะคมขึ้นมาก',
        'เก็บ 🛡️ ไว้ก่อนพายุ แล้วค่อย BLOCK ช่วงท้าย (End Window)'
      ],
      lowAcc: [
        'Accuracy ยังต่ำ—ชะลอการรัว แล้วเลือกเป้าที่ “ชัวร์”',
        'ลองเล็งให้นิ่ง 0.2 วิ ก่อนยิง 💧 จะเข้าเป้าขึ้น',
        'คุมจังหวะยิง: 1–2 นัดคม ๆ ดีกว่ารัวพลาด'
      ],
      comboUp: [
        'คอมโบกำลังมา! รักษาจังหวะต่อเนื่อง เกรดจะพุ่ง 🔥',
        'ดีมาก! ตอนนี้เหมาะลากคอมโบ—อย่ารัวพลาด',
        'ฟอร์มดี! เล่นนิ่ง ๆ แล้วคอมโบจะยาวเอง'
      ],
      stormPrep: [
        'พายุมาแล้ว! ทำให้น้ำ “ไม่ GREEN” (LOW/HIGH) ก่อน แล้วเตรียม BLOCK ช่วงท้าย',
        'Storm Mini: เป้าคือ LOW/HIGH + รอ End Window แล้วค่อย BLOCK',
        'ช่วงพายุอย่าโดน BAD—ถ้าโดน Mini จะหลุดง่าย'
      ],
      endWindow: [
        '⏱️ End Window! ตอนนี้แหละ—ใช้ 🛡️ BLOCK ให้ได้!',
        'ท้ายพายุแล้ว! เก็บแต้มด้วยการ BLOCK ช่วง End Window',
        'ตอนนี้ต้อง BLOCK—อย่าพลาดนะ!'
      ],
      needShield: [
        'ยังไม่มี 🛡️ เลย—พยายามเก็บไว้ก่อนพายุ 1–2 อัน',
        'ถ้ามี 🛡️ จะผ่าน Mini ง่ายมาก—เก็บไว้ก่อน',
        'เจอ 🛡️ แล้วรีบเก็บ! ใช้ช่วยผ่านช่วงท้ายพายุ'
      ],
      tooManyMiss: [
        'MISS เยอะไปนิด—ลดการรัว แล้วตั้งใจยิงเฉพาะเป้าเด่น ๆ',
        'พักจังหวะครึ่งวิแล้วค่อยยิง จะลด MISS ได้เร็ว',
        'คุมใจนิ่ง ๆ: ยิงช้าแต่แม่น = แต้มขึ้นไวกว่า'
      ],
      tired: [
        'เริ่มล้าแล้ว—หายใจลึก ๆ แล้วกลับมายิงคม ๆ',
        'ช้าลงนิดแต่แม่นขึ้น จะทำให้ผ่านสเตจได้ไว',
        'พักมือสั้น ๆ แล้วค่อยลากคอมโบต่อ'
      ],
      stage: [
        'Stage เปลี่ยนแล้ว! ปรับโฟกัสตามข้อความภารกิจด้านล่างซ้าย',
        'เข้าสเตจถัดไปแล้ว—ดู GOAL/MINI แล้วเล่นตามจังหวะ',
        'ยกระดับแล้ว! เป้าหมายเปลี่ยน—ตามภารกิจด้านล่าง'
      ],
      end: [
        'จบเกมแล้ว! ดู Tips ในสรุปผลแล้วลองใหม่ให้เกรดสูงขึ้นนะ',
        'เยี่ยม! รอบหน้าโฟกัสลด MISS แล้วจะได้ S/SS/SSS ง่ายขึ้น',
        'พร้อมอัปเกรด! รอบหน้าลากคอมโบยาวขึ้นอีกนิด'
      ]
    };

    // Rules → choose tag + mood
    let tag='tip', mood='neutral', text='';

    // Priority: end window callout
    if (inStorm && inEnd){
      mood = 'fever';
      tag = 'endwindow';
      text = pick(T.endWindow, keyBase+'|end');
      return {text,mood,tag};
    }

    // Storm general guidance
    if (inStorm){
      tag='storm';
      mood = (shield>0) ? 'happy' : 'neutral';
      text = (shield<=0)
        ? pick(T.stormPrep.concat(T.needShield), keyBase+'|storm0')
        : pick(T.stormPrep, keyBase+'|storm1');
      return {text,mood,tag};
    }

    // Between storms: encourage shield
    if (!inStorm && shield<=0 && (misses<12)){
      tag='needshield';
      mood='neutral';
      text = pick(T.needShield, keyBase+'|shield');
      return {text,mood,tag};
    }

    // Low accuracy / high misses
    if (skill<0.45){
      tag='lowacc';
      mood = (misses>=18) ? 'sad' : 'neutral';
      text = pick(T.lowAcc, keyBase+'|acc');
      return {text,mood,tag};
    }

    if (misses>=22 || fr>0.75){
      tag='miss';
      mood='sad';
      text = pick(T.tooManyMiss, keyBase+'|miss');
      return {text,mood,tag};
    }

    // Combo hype
    if (combo>=10 && skill>=0.6){
      tag='combo';
      mood='happy';
      text = pick(T.comboUp, keyBase+'|combo');
      return {text,mood,tag};
    }

    // Fatigue
    if (fatigue>0.78){
      tag='tired';
      mood='neutral';
      text = pick(T.tired, keyBase+'|tired');
      return {text,mood,tag};
    }

    // Default gentle hint
    tag='start';
    mood='neutral';
    text = pick(T.start, keyBase+'|start');
    return {text,mood,tag};
  }

  function onStart(){
    state.started=true;
    // เปิดด้วยคำแนะนำสั้น ๆ (priority=false แต่จะผ่านเพราะ lastSayAt=0)
    const pack = explainablePack({ skill:0.5, fatigue:0, frustration:0, inStorm:false, inEndWindow:false, waterZone:'GREEN', shield:0, misses:0, combo:0 });
    say(pack.text, pack.mood, 'start', { when:'start' }, false);
  }

  function onUpdate(ctx={}){
    if (!state.started) return;
    // ลดถี่: เฉพาะบางจังหวะ หรือเมื่อ conditions เด่น ๆ
    const inStorm = !!ctx.inStorm;
    const inEnd = !!ctx.inEndWindow;

    // priority interrupt ตอน endwindow
    if (inStorm && inEnd){
      const pack = explainablePack(ctx);
      say(pack.text, pack.mood, pack.tag, { when:'endwindow' }, true);
      return;
    }

    // otherwise rate-limited suggestion
    const pack = explainablePack(ctx);
    say(pack.text, pack.mood, pack.tag, { when:'update' }, false);
  }

  function onStage(stage=1){
    const seed = String(qs('seed','')||'');
    const key = `${game}|${seed}|stage|${stage}`;
    const texts = [
      'Stage ใหม่แล้ว! อ่านภารกิจด้านล่างซ้ายแล้วโฟกัสตามนั้นเลย',
      'เข้าสเตจถัดไปแล้ว—เป้าหมายเปลี่ยน อย่าลืมดูข้อความภารกิจ',
      'อัปเกรดสเตจ! เล่นตาม GOAL/MINI แล้วจะผ่านเร็ว'
    ];
    say(pick(texts, key), 'happy', 'stage', { stage }, true);
  }

  function onEnd(summary){
    const seed = String(qs('seed','')||'');
    const key = `${game}|${seed}|end|${summary?.grade||''}|${summary?.misses||0}`;
    const texts = [
      'จบแล้ว! รอบหน้าลด MISS แล้วเกรดจะกระโดดทันที',
      'เยี่ยม! ลองอีกครั้งโดยโฟกัส Accuracy ให้เกิน 70% ดูนะ',
      'สุดยอด! รอบหน้า “ลากคอมโบ” ให้ยาวขึ้น จะได้ S/SS ง่ายขึ้น'
    ];
    say(pick(texts, key), 'happy', 'end', { when:'end' }, true);
  }

  return { onStart, onUpdate, onStage, onEnd, say };
}