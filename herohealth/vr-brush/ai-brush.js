// === /herohealth/vr-brush/ai-brush.js ===
// AI Hooks (Prediction/ML/DL-ready) v20260216a
// ✅ Emits brush:ai events for HUD/BigPop in brush.boot.js
// ✅ Deterministic by seed (research-friendly)
// ✅ Baseline heuristic predictor (replace with ML later)

(function(){
  'use strict';
  const WIN = window;

  function seededRng(seed){
    let t = (Number(seed)||Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function emit(type, detail){
    try{ WIN.dispatchEvent(new CustomEvent('brush:ai', { detail:{ type, ...detail } })); }catch(_){}
  }

  // Public AI API
  const AI = {
    rng: seededRng(Date.now()),
    seed: Date.now(),
    // Simple online features (for ML later)
    feat: {
      shots:0, hits:0, miss:0, combo:0, comboMax:0,
      clean:0, feverCharge:0, bossActive:false,
      t:0
    },
    configure({seed}){
      this.seed = seed || Date.now();
      this.rng = seededRng(this.seed);
    },
    onStart(meta){
      this.feat = { shots:0,hits:0,miss:0,combo:0,comboMax:0,clean:0,feverCharge:0,bossActive:false,t:0 };
      emit('tip', { emo:'🧠', title:'AI Coach', sub:'เริ่มแล้ว!', mini:'คุมคอมโบ + เล็งแม่น ๆ จะเข้า FEVER ไว' });
    },
    onTick(meta){
      // meta: {t, left, clean, combo, miss, feverOn, feverCharge, bossActive}
      Object.assign(this.feat, meta||{});

      // “Prediction baseline”: ถ้า miss เริ่มถี่ → เตือนเล่นช้าลง
      if(this.feat.miss > 0 && this.feat.shots > 0){
        const acc = this.feat.hits / this.feat.shots;
        if(acc < 0.55 && this.rng() < 0.05){
          emit('tip', { emo:'🎯', title:'ปรับจังหวะ', sub:'ความแม่นตก', mini:'เล่นช้าลงนิด แต่เล็งให้ชัวร์ (คอมโบจะกลับมา)' });
        }
      }

      // 10s warning
      if(meta && meta.left <= 10 && meta.left > 9.6){
        emit('time_10s', {});
      }

      // Fever moment
      if(meta && meta.feverOn && this.rng() < 0.12){
        emit('streak', { emo:'⚡', title:'ต่อคอมโบ!', sub:'ตอนนี้ FEVER กวาดคะแนน', mini:'อย่าพลาด—ยิงให้แม่นแล้วไล่เก็บต่อเนื่อง' });
      }
    },
    onBossStart(){
      this.feat.bossActive = true;
      emit('boss_start', {});
    },
    onBossPhase(phase, hp){
      emit('boss_phase', { phase, hp });
    },
    onFeverOn(){
      emit('fever_on', {});
    },
    onAction(a){
      // a: {shots,hits,miss,combo,comboMax,clean}
      if(!a) return;
      this.feat.shots = a.shots ?? this.feat.shots;
      this.feat.hits  = a.hits  ?? this.feat.hits;
      this.feat.miss  = a.miss  ?? this.feat.miss;
      this.feat.combo = a.combo ?? this.feat.combo;
      this.feat.comboMax = Math.max(this.feat.comboMax, this.feat.combo||0);
      this.feat.clean = a.clean ?? this.feat.clean;
    }
  };

  WIN.BrushAI = AI;
})();