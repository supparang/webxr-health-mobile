// === /fitness/js/ai-coach.js — Explainable micro-tips + rate-limit (A-39) ===
'use strict';

const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));

export class AICoach {
  constructor(opts = {}) {
    this.enabled = !!opts.enabled;
    this.cooldownMs = Math.max(1200, opts.cooldownMs || 2600);
    this.minPlayMs = Math.max(1500, opts.minPlayMs || 2200);
    this.lastTipAt = 0;

    this.lastState = null;

    this.missStreak = 0;
    this.bombStreak = 0;
    this.slowStreak = 0;

    this.lastShownKey = '';
    this.repeatBlockMs = Math.max(4000, opts.repeatBlockMs || 6500);
    this.lastShownAt = 0;

    this.onTip = typeof opts.onTip === 'function' ? opts.onTip : null;
  }

  setEnabled(v){ this.enabled = !!v; }

  reset(now){
    this.lastTipAt = 0;
    this.lastState = null;
    this.missStreak = 0;
    this.bombStreak = 0;
    this.slowStreak = 0;
    this.lastShownKey = '';
    this.lastShownAt = 0;
  }

  // event: {type:'hit'|'miss'|'bomb'|'decoy'|'heal'|'shield'|'phase', rtMs?, grade?, bossPhase?, inBurst?}
  observeEvent(state, event, now){
    if (!this.enabled) return;

    if (!state || !state.running) return;
    const playedMs = now - (state.startedAt || now);
    if (playedMs < this.minPlayMs) return;

    // --- update streaks ---
    const et = event && event.type;

    if (et === 'miss') this.missStreak++;
    else this.missStreak = Math.max(0, this.missStreak - 1);

    if (et === 'bomb' || et === 'decoy') this.bombStreak++;
    else this.bombStreak = Math.max(0, this.bombStreak - 1);

    // slow: rt high on normal hits
    const rt = event && typeof event.rtMs === 'number' ? event.rtMs : null;
    const isSlow = rt != null && rt > 520;
    if (et === 'hit' && isSlow) this.slowStreak++;
    else if (et === 'hit') this.slowStreak = Math.max(0, this.slowStreak - 1);

    // --- decide tip ---
    const tip = this._decideTip(state, now, event);
    if (tip) this._emit(tip, now);
  }

  // periodic check (call from gameLoop sometimes)
  tick(state, now){
    if (!this.enabled) return;
    if (!state || !state.running) return;
    const playedMs = now - (state.startedAt || now);
    if (playedMs < this.minPlayMs) return;

    // low-hp coaching (not too often)
    const lowHp = (state.playerHp != null && state.playerHp <= 0.30);
    if (lowHp && this._canSpeak(now)) {
      const tip = {
        key: 'lowhp',
        tone: 'bad',
        msg: 'HP ต่ำแล้ว! โฟกัส “เป้าเขียว (normal)” ก่อน หลีกเลี่ยง bomb/decoy 🧠',
        why: `เพราะ HP=${(state.playerHp*100).toFixed(0)}% และ missEwma=${((state.missEwma||0)*100).toFixed(0)}%`
      };
      this._emit(tip, now);
    }
  }

  _canSpeak(now){
    if (now - this.lastTipAt < this.cooldownMs) return false;
    if (this.lastShownKey && (now - this.lastShownAt) < this.repeatBlockMs) return false;
    return true;
  }

  _emit(tip, now){
    if (!this._canSpeak(now)) return;

    // block repeats
    if (tip.key) {
      this.lastShownKey = tip.key;
      this.lastShownAt = now;
    }

    this.lastTipAt = now;
    if (this.onTip) {
      try { this.onTip(tip); } catch(_) {}
    }
  }

  _decideTip(state, now, event){
    // no spam during fever text bursts: allow only high priority
    const feverOn = !!state.feverOn;
    const phase = state.bossPhase || 1;

    // priority 1: miss streak
    if (this.missStreak >= 2 && this._canSpeak(now)) {
      return {
        key: 'missstreak',
        tone: 'bad',
        msg: 'พลาดติดกัน! ลอง “รอให้เป้าเข้ากลางวง” 0.2 วิ แล้วค่อยชก 🎯',
        why: `เพราะ missStreak=${this.missStreak}, rtMean=${(state.rtMean||0).toFixed(0)}ms`
      };
    }

    // priority 2: bomb/decoy streak
    if (this.bombStreak >= 2 && this._canSpeak(now)) {
      return {
        key: 'bombstreak',
        tone: 'bad',
        msg: 'โดน bomb/decoy บ่อย! ให้สังเกต “สีแดง/ม่วง” แล้วเว้นชก 👀',
        why: `เพราะ bombStreak=${this.bombStreak}, bombEwma=${((state.bombEwma||0)*100).toFixed(0)}%`
      };
    }

    // priority 3: too slow
    if (this.slowStreak >= 2 && this._canSpeak(now)) {
      return {
        key: 'slow',
        tone: 'good',
        msg: 'ช้าไปนิด! ลอง “เล็งล่วงหน้า” ตามแพทเทิร์นเฟสนี้ แล้วชกไวขึ้น ⚡️',
        why: `เพราะ slowStreak=${this.slowStreak}, rtMean=${(state.rtMean||0).toFixed(0)}ms, phase=${phase}`
      };
    }

    // priority 4: phase guidance (only sometimes)
    if (!feverOn && event && event.type === 'phase' && this._canSpeak(now)) {
      if (phase === 2) {
        return {
          key: 'phase2',
          tone: 'good',
          msg: 'เข้าสู่ Phase 2! เป้าจะ “สลับซ้าย-ขวา” ชัดขึ้น — ตามจังหวะให้ทัน 🔁',
          why: `phase=${phase}`
        };
      }
      if (phase === 3) {
        return {
          key: 'phase3',
          tone: 'good',
          msg: 'Phase 3 แล้ว! เป้าเล็ก/เร็วขึ้น — โฟกัส normal ก่อน แล้วค่อยเก็บโบนัส 🥊',
          why: `phase=${phase}`
        };
      }
    }

    // priority 5: burst info (if inBurst)
    if (event && event.inBurst && !feverOn && this._canSpeak(now)) {
      return {
        key: 'burst',
        tone: 'perfect',
        msg: '🔥 Burst มาแล้ว! ช่วงนี้ตีต่อเนื่อง จะได้คะแนนพุ่ง + FEVER ขึ้นไว!',
        why: `inBurst=1, combo=${state.combo||0}`
      };
    }

    return null;
  }
}