// === /fitness/js/ai-coach.js ===
// Explainable AI Coach (rate-limited)
// - Reads live stats: miss/rt/zone mistakes/bomb/decoy
// - Produces short tips with "why" and "what to do"
// - No external services; safe for research (can disable in research mode)

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ try{ return performance.now(); }catch{ return Date.now(); } }

export class AICoach {
  constructor(opts={}){
    this.enabled = true;
    this.cooldownMs = opts.cooldownMs ?? 1500;
    this.lastTipAt = 0;

    // rolling stats (lightweight)
    this.window = [];
    this.windowMax = opts.windowMax ?? 28;

    this.zoneMiss = new Array(6).fill(0);
    this.zoneHit  = new Array(6).fill(0);

    this.bombHits = 0;
    this.decoyHits = 0;

    this.normalRt = [];
    this.normalRtMax = 24;

    this.lastDangerZone = null;
  }

  setEnabled(v){ this.enabled = !!v; }

  setDangerZone(z){
    if (z == null || z === '') { this.lastDangerZone = null; return; }
    const zi = clamp(parseInt(z,10), 0, 5);
    this.lastDangerZone = zi;
  }

  // evt = { type: 'hit'|'timeout', zoneId, targetType, grade, rtMs }
  onEvent(evt){
    if (!evt) return;

    const zoneId = (evt.zoneId != null) ? clamp(evt.zoneId,0,5) : null;

    // rolling window
    this.window.push({
      t: nowMs(),
      type: evt.type,
      zoneId,
      targetType: evt.targetType || '',
      grade: evt.grade || '',
      rtMs: (evt.rtMs != null) ? Number(evt.rtMs) : null
    });
    if (this.window.length > this.windowMax) this.window.shift();

    // zone counters
    if (zoneId != null){
      if (evt.type === 'timeout') this.zoneMiss[zoneId] += 1;
      if (evt.type === 'hit') this.zoneHit[zoneId] += 1;
    }

    // bombs/decoy
    if (evt.type === 'hit'){
      if (evt.targetType === 'bomb') this.bombHits += 1;
      if (evt.targetType === 'decoy') this.decoyHits += 1;
    }

    // normal RT
    if (evt.type === 'hit' && evt.targetType === 'normal' && evt.rtMs != null){
      this.normalRt.push(Number(evt.rtMs));
      if (this.normalRt.length > this.normalRtMax) this.normalRt.shift();
    }
  }

  _missRate(){
    if (!this.window.length) return 0;
    let trials = 0, miss = 0;
    for (const w of this.window){
      if (w.type === 'hit' || w.type === 'timeout'){
        // count only real misses? keep it simple: timeout = miss
        trials++;
        if (w.type === 'timeout') miss++;
      }
    }
    return trials ? (miss / trials) : 0;
  }

  _avgRt(){
    if (!this.normalRt.length) return null;
    const s = this.normalRt.reduce((a,b)=>a+b,0);
    return s / this.normalRt.length;
  }

  _worstZone(){
    // pick zone with highest miss dominance
    let best = { z: null, score: -1 };
    for (let z=0; z<6; z++){
      const m = this.zoneMiss[z];
      const h = this.zoneHit[z];
      const score = m * 1.0 + Math.max(0, m - h) * 0.6;
      if (score > best.score){
        best = { z, score };
      }
    }
    return (best.score >= 2) ? best.z : null; // threshold
  }

  maybeTip(state){
    if (!this.enabled) return null;
    const t = nowMs();
    if (t - this.lastTipAt < this.cooldownMs) return null;

    // Only tip during running
    if (!state || !state.running) return null;

    const missRate = this._missRate();
    const avgRt = this._avgRt();
    const worstZone = this._worstZone();
    const dz = this.lastDangerZone;

    // Priority tips (short + explainable)
    let tip = null;

    // 1) too many bombs/decoys hit
    if ((this.bombHits + this.decoyHits) >= 2 && Math.random() < 0.7){
      tip = {
        tone: 'bad',
        text: 'โค้ช AI: คุณตี “เป้าลวง/ระเบิด” บ่อย 🔥 เหตุผล: รีบเกินไป → วิธีแก้: รอ 0.2 วิ แล้วค่อยตีเป้าที่ “นิ่ง” กว่า'
      };
    }
    // 2) miss rate high
    else if (missRate >= 0.35){
      tip = {
        tone: 'miss',
        text: `โค้ช AI: พลาดบ่อย (${Math.round(missRate*100)}%) ✋ เหตุผล: จังหวะยังไม่ทัน → วิธีแก้: มองกลางจอ + ตีทันทีที่เป้าโผล่ (อย่าลากนิ้ว)`
      };
    }
    // 3) slow RT
    else if (avgRt != null && avgRt >= 520){
      tip = {
        tone: 'combo',
        text: `โค้ช AI: Reaction ช้าเฉลี่ย ${Math.round(avgRt)}ms 🕒 วิธีแก้: “ตีเป้าแรกให้ไว” ก่อน แล้วค่อยเล็งเป้าถัดไป`
      };
    }
    // 4) danger zone reminder
    else if (dz != null && Math.random() < 0.55){
      tip = {
        tone: 'storm',
        text: `โค้ช AI: ตอนนี้โซน ${dz+1} อันตราย 🔥 วิธีแก้: เลี่ยงโซนนั้น/ตีโซนอื่นเพื่อทำคอมโบ`
      };
    }
    // 5) zone weakness
    else if (worstZone != null){
      tip = {
        tone: 'miss',
        text: `โค้ช AI: คุณพลาดโซน ${worstZone+1} บ่อย 🎯 วิธีแก้: เล็ง “กลางโซน” ก่อน ไม่ต้องไล่ขอบ`
      };
    }

    if (!tip) return null;
    this.lastTipAt = t;
    return tip;
  }
}