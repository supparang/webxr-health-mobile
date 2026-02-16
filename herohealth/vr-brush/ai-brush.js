// === /herohealth/vr-brush/ai-brush.js ===
// AI Hooks (Prediction/ML/DL-ready) v20260216b (PACK 1–3)
// ✅ Deterministic by seed
// ✅ Reads basic performance signals + recommends micro-tips
// ✅ Emits brush:ai types compatible with brush.boot.js HUD + BigPop

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

  const AI = {
    rng: seededRng(Date.now()),
    seed: Date.now(),
    feat: {
      shots:0, hits:0, miss:0, combo:0, comboMax:0,
      clean:0, feverOn:false, bossActive:false, left:0
    },
    lastTipAt: 0,
    minTipMs: 2200,

    configure({seed}){
      this.seed = seed || Date.now();
      this.rng = seededRng(this.seed);
    },

    onStart(){
      this.feat = { shots:0,hits:0,miss:0,combo:0,comboMax:0,clean:0,feverOn:false,bossActive:false,left:0 };
      this.lastTipAt = 0;
      emit('tip', { emo:'🧠', title:'AI Coach', sub:'เริ่มแล้ว!', mini:'เล็งแม่นก่อน เร็วทีหลัง' });
    },

    onAction(a){
      if(!a) return;
      this.feat.shots = a.shots ?? this.feat.shots;
      this.feat.hits  = a.hits  ?? this.feat.hits;
      this.feat.miss  = a.miss  ?? this.feat.miss;
      this.feat.combo = a.combo ?? this.feat.combo;
      this.feat.comboMax = Math.max(this.feat.comboMax, this.feat.combo||0);
      this.feat.clean = a.clean ?? this.feat.clean;
    },

    onTick(meta){
      if(!meta) return;
      this.feat.left = meta.left ?? this.feat.left;
      this.feat.feverOn = !!meta.feverOn;
      this.feat.bossActive = !!meta.bossActive;

      // 10s warning handled in engine too, but safe here:
      if(meta.left <= 10 && meta.left > 9.6) emit('time_10s', {});

      const now = Date.now();
      if(now - this.lastTipAt < this.minTipMs) return;

      const shots = this.feat.shots || 0;
      const hits = this.feat.hits || 0;
      const acc = shots>0 ? hits/shots : 0.7;

      // Tip rules (baseline)
      if(this.feat.bossActive && this.rng() < 0.25){
        this.lastTipAt = now;
        emit('tip', { emo:'💎', title:'โหมดบอส', sub:'มี Hazard', mini:'ถ้าเห็น STOP/Timing ให้รอแล้วค่อยยิง' , tag:'BOSS' });
        return;
      }

      if(acc < 0.55 && shots >= 10){
        this.lastTipAt = now;
        emit('tip', { emo:'🎯', title:'ความแม่นตก', sub:`acc=${Math.round(acc*100)}%`, mini:'ช้าลงนิด แต่ยิงให้ชัวร์ (คอมโบจะกลับมา)' , tag:'TIP' });
        return;
      }

      if(this.feat.comboMax >= 12 && !this.feat.feverOn && this.rng() < 0.35){
        this.lastTipAt = now;
        emit('streak', { emo:'⚡', title:'ใกล้เข้า FEVER', sub:'คอมโบกำลังมา', mini:'อย่าพลาด! เล็งให้แม่น แล้วค่อยเร่ง' , tag:'STREAK' });
        return;
      }

      if(this.feat.feverOn && this.rng() < 0.30){
        this.lastTipAt = now;
        emit('fever_on', { emo:'💗', title:'FEVER!', sub:'คะแนนคูณ', mini:'ยิงต่อเนื่องแบบแม่น ๆ กวาดคะแนน!', tag:'FEVER' });
        return;
      }
    },

    onBossStart(){ emit('boss_start', {}); },
    onBossPhase(phase, hp){ emit('boss_phase', { phase, hp }); },
    onFeverOn(){ emit('fever_on', {}); }
  };

  WIN.BrushAI = AI;
})();