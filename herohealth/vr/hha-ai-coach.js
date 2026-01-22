// === /herohealth/vr/hha-ai-coach.js ===
// HHA AI Coach — Micro Tips (Explainable + Rate-limited + Research-safe)
// Emits: window.dispatchEvent(new CustomEvent('hha:coach', {detail:{...}}))
// API: window.HHA_AICoach.create({ gameId, seed, runMode, lang }) -> coach
// coach.onEvent(type, payload)
// coach.getSummaryExtras()

(function(root){
  'use strict';

  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };
  const now = ()=>Date.now();
  const emit = (n,d)=>{ try{ root.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  function makeRNG(seed){
    // deterministic LCG
    let x = (Number(seed)||123456789) >>> 0;
    return ()=> (x = (1664525*x + 1013904223) >>> 0) / 4294967296;
  }

  // ---------- Tip library (Hygiene 7 steps) ----------
  const STEP = [
    { icon:'🫧', name:'ฝ่ามือ', key:'palm'  },
    { icon:'🤚', name:'หลังมือ', key:'back'  },
    { icon:'🧩', name:'ซอกนิ้ว', key:'gaps'  },
    { icon:'👊', name:'ข้อนิ้ว', key:'knuck' },
    { icon:'👍', name:'หัวแม่มือ', key:'thumb' },
    { icon:'💅', name:'ปลายนิ้ว/เล็บ', key:'nails' },
    { icon:'⌚', name:'ข้อมือ', key:'wrist' },
  ];

  // Explainable: cause -> action
  const TIPS = {
    wrong_step: (ctx)=>[
      `ดูไอคอนขั้นตอนบน HUD แล้วทำตาม: ${ctx.stepIcon} ${ctx.stepName}`,
      `ตอนนี้เป็นขั้น ${ctx.stepIdx+1}/7: ${ctx.stepIcon} ${ctx.stepName} นะ`,
      `ลองช้าอีกนิด แล้วโฟกัส “${ctx.stepName}”`,
    ],
    gaps_confuse: (ctx)=>[
      `ซอกนิ้ว: เอานิ้วสอดกันแล้วถูไปมา (เหมือนสานมือ) 🧩`,
      `ทริคซอกนิ้ว: “สอด–ถู–สลับ” ทำให้ครบทุกช่อง 🧩`,
    ],
    nails_confuse: (ctx)=>[
      `ปลายนิ้ว/เล็บ: ขูดวนบนฝ่ามือเบา ๆ 💅`,
      `ทริคเล็บ: “ปลายนิ้ววนบนฝ่ามือ” 💅`,
    ],
    thumb_confuse: (ctx)=>[
      `หัวแม่มือ: จับแล้วหมุนรอบ ๆ 👍`,
      `ทริคหัวแม่มือ: “กำ–หมุน–สลับข้าง” 👍`,
    ],
    hazard_warn: (_ctx)=>[
      `ระวังเชื้อ 🦠 หลบให้ไว แล้วกลับไปทำขั้นตอนต่อ`,
      `โฟกัสไอคอนขั้นตอน + หลบ 🦠 จะคอมโบยาวขึ้น`,
    ],
    speed_vs_acc: (ctx)=>[
      `เร็วได้ แต่ให้แม่นก่อนนะ 🎯 (ตอนนี้ ${Math.round((ctx.stepAcc||0)*100)}%)`,
      `ลองช้าลงนิดเดียว accuracy จะพุ่ง 🚀`,
    ],
    combo_keep: (ctx)=>[
      `คอมโบสวย! รักษาจังหวะนี้ไว้ 🔥 (combo ${ctx.combo||0})`,
      `เยี่ยม! อย่าโดน 🦠 แล้วคอมโบจะยาวมาก 🔥`,
    ],
  };

  function pickOne(list, rnd){
    if(!list || !list.length) return '';
    const i = Math.floor(rnd()*list.length);
    return list[i];
  }

  // ---------- Coach factory ----------
  function create(cfg){
    cfg = cfg || {};
    const gameId  = String(cfg.gameId||'hygiene').toLowerCase();
    const runMode = String(cfg.runMode || qs('run','play') || 'play').toLowerCase();
    const lang    = String(cfg.lang||'th').toLowerCase();
    const seed    = (cfg.seed != null ? cfg.seed : (qs('seed')||Date.now()));
    const rnd     = makeRNG(seed);

    // switches
    const coachOn = String(qs('coach','1')) !== '0';  // ?coach=0 ปิด
    const isResearch = runMode === 'research';

    // rate limit
    const MAX_TIPS = isResearch ? 3 : 6;             // research น้อยลง
    const COOLDOWN_MS = isResearch ? 9000 : 6500;    // research ช้าลง
    const MIN_GAP_BETWEEN_SAME_MS = 14000;

    // state
    let tipCount = 0;
    let lastTipAt = 0;
    const lastById = {}; // tipId -> ts
    const shown = [];    // for summary

    // performance tracking for explainable triggers
    let wrongStreak = 0;
    let hazardStreak = 0;
    let correctStreak = 0;

    const stepWrong = Array(7).fill(0);
    const stepRight = Array(7).fill(0);

    // optionally feed current summary-ish metrics to coach
    const live = {
      stepIdx: 0,
      stepAcc: 0,
      combo: 0
    };

    function canSpeak(tipId){
      if(!coachOn) return false;
      if(tipCount >= MAX_TIPS) return false;
      const t = now();
      if(t - lastTipAt < COOLDOWN_MS) return false;
      const last = lastById[tipId] || 0;
      if(t - last < MIN_GAP_BETWEEN_SAME_MS) return false;
      return true;
    }

    function speak(tipId, text, meta){
      if(!text) return;
      if(!canSpeak(tipId)) return;

      tipCount++;
      lastTipAt = now();
      lastById[tipId] = lastTipAt;

      const payload = Object.assign({
        gameId,
        tipId,
        text,
        atMs: lastTipAt,
        runMode,
        explain: meta && meta.explain ? meta.explain : '',
        severity: meta && meta.severity ? meta.severity : 'info'
      }, meta||{});

      shown.push({
        tipId,
        text,
        explain: payload.explain,
        atMs: payload.atMs,
        stepIdx: payload.stepIdx
      });

      emit('hha:coach', payload);
    }

    function ctxForStep(stepIdx){
      const s = STEP[clamp(stepIdx,0,6)] || STEP[0];
      return {
        stepIdx: clamp(stepIdx,0,6),
        stepIcon: s.icon,
        stepName: s.name,
        stepAcc: live.stepAcc,
        combo: live.combo
      };
    }

    function onWrongStep(stepIdx, wrongStepIdx){
      wrongStreak++;
      correctStreak = 0;

      // if confused repeatedly on a specific step -> specialized tip
      const c = ctxForStep(stepIdx);

      // triggers: 2 wrong in a row -> remind current step
      if(wrongStreak >= 2){
        const id = 'wrong_step';
        const text = pickOne(TIPS.wrong_step(c), rnd);
        speak(id, text, {
          stepIdx,
          explain: `wrong_step_streak=${wrongStreak}`,
          severity: 'warn'
        });
      }

      // specialized help for hard steps
      if(stepIdx === 2 && stepWrong[2] >= 2){ // gaps
        const id = 'gaps_confuse';
        speak(id, pickOne(TIPS.gaps_confuse(c), rnd), {
          stepIdx,
          explain: `step=ซอกนิ้ว wrong=${stepWrong[2]}`,
          severity:'warn'
        });
      }
      if(stepIdx === 4 && stepWrong[4] >= 2){ // thumb
        const id = 'thumb_confuse';
        speak(id, pickOne(TIPS.thumb_confuse(c), rnd), {
          stepIdx,
          explain: `step=หัวแม่มือ wrong=${stepWrong[4]}`,
          severity:'warn'
        });
      }
      if(stepIdx === 5 && stepWrong[5] >= 2){ // nails
        const id = 'nails_confuse';
        speak(id, pickOne(TIPS.nails_confuse(c), rnd), {
          stepIdx,
          explain: `step=เล็บ wrong=${stepWrong[5]}`,
          severity:'warn'
        });
      }
    }

    function onHazardHit(){
      hazardStreak++;
      correctStreak = 0;

      if(hazardStreak >= 1){
        const id = 'hazard_warn';
        speak(id, pickOne(TIPS.hazard_warn({}), rnd), {
          explain:`hazard_hits_streak=${hazardStreak}`,
          severity:'bad'
        });
      }
    }

    function onCorrect(stepIdx){
      correctStreak++;
      wrongStreak = 0;
      hazardStreak = 0;

      // motivational: rare & not spam
      if(correctStreak === 6 && live.combo >= 8){
        const id = 'combo_keep';
        const c = ctxForStep(stepIdx);
        speak(id, pickOne(TIPS.combo_keep(c), rnd), {
          stepIdx,
          explain:`correct_streak=${correctStreak}, combo=${live.combo}`,
          severity:'good'
        });
      }
    }

    function onStepClear(stepIdx, timeToClearMs){
      // if slow and accuracy low -> speed vs acc tip
      const c = ctxForStep(stepIdx);
      if((live.stepAcc||0) < 0.65 && Number(timeToClearMs||0) < 1200){
        const id = 'speed_vs_acc';
        speak(id, pickOne(TIPS.speed_vs_acc(c), rnd), {
          stepIdx,
          explain:`fast_but_inaccurate stepAcc=${(live.stepAcc||0).toFixed(2)} t=${timeToClearMs|0}`,
          severity:'warn'
        });
      }
    }

    // ---------- public: feed events ----------
    function onEvent(type, payload){
      payload = payload || {};
      if(payload.stepIdx != null) live.stepIdx = clamp(payload.stepIdx,0,6);
      if(payload.stepAcc != null) live.stepAcc = clamp(payload.stepAcc,0,1);
      if(payload.combo != null) live.combo = clamp(payload.combo,0,9999);

      if(type === 'step_hit'){
        const stepIdx = clamp(payload.stepIdx,0,6);
        if(payload.ok){
          stepRight[stepIdx]++; onCorrect(stepIdx);
        }else{
          stepWrong[stepIdx]++; onWrongStep(stepIdx, payload.wrongStepIdx);
        }
      }
      else if(type === 'haz_hit'){
        onHazardHit();
      }
      else if(type === 'step_clear'){
        onStepClear(clamp(payload.stepIdx,0,6), payload.timeToClearMs);
      }
    }

    function getSummaryExtras(){
      // “Explainable” summary fields
      const worstStepIdx = (()=>{
        let best = { idx:0, wrong:stepWrong[0] };
        for(let i=1;i<7;i++){
          if(stepWrong[i] > best.wrong) best = { idx:i, wrong:stepWrong[i] };
        }
        return best.idx;
      })();

      const hard = STEP[worstStepIdx] || STEP[0];

      return {
        coachOn,
        coachTipCount: tipCount,
        coachTipsShown: shown.slice(0, 12),
        coachWorstStepIdx: worstStepIdx,
        coachWorstStepName: hard.name,
        coachWrongByStep: stepWrong.slice(0),
        coachRightByStep: stepRight.slice(0),
      };
    }

    return { onEvent, getSummaryExtras };
  }

  root.HHA_AICoach = { create };

})(window);