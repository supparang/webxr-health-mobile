// === /fitness/js/ai-coach.js ===
// AICoach: explainable micro tips (not spam) + "why" messages
// Uses existing UI: setFeedback(...) and JuiceFX.toastMsg(...)

'use strict';

export class AICoach{
  constructor(){
    this.reset();
  }

  reset(){
    this.lastTipAt = 0;
    this.tipCooldownMs = 4200;     // rate limit
    this.lastReason = '';
  }

  maybeTip(now, adj, state, setFeedback, juice){
    if (!adj || !state || !state.running) return;
    if (now - this.lastTipAt < this.tipCooldownMs) return;

    // Only tip if situation is meaningful
    const r = adj.risk;
    const fat = adj.fatigue;

    // decide message
    let msg = '';
    let tone = 'good';

    if (state.playerHp <= 0.38 && fat > 0.55){
      msg = 'พักหายใจ 1 วิ แล้ว “เล็งช้าแต่ชัวร์” จะคัมแบ็คได้ ✅';
      tone = 'warn';
      this.tipCooldownMs = 5200;

    } else if (adj.reason === 'weak-zone'){
      msg = `โซนที่พลาดบ่อย: Z${adj.weakZoneId+1} — ลอง “วางสายตารอ” จุดนั้นก่อนเป้าออก 👀`;
      tone = 'warn';
      this.tipCooldownMs = 4700;

    } else if (adj.reason === 'rt-slow'){
      msg = 'คุณเริ่มช้าลงนิดนึง → ใช้ “แตะทันทีเมื่อเห็น” แล้วค่อยเล็งละเอียดรอบถัดไป ⚡';
      tone = 'warn';
      this.tipCooldownMs = 4500;

    } else if (adj.reason === 'miss-streak'){
      msg = 'พลาดติดกัน 2 ครั้งแล้ว → ลดความเร็วมือ 10% แต่เพิ่มความแม่น จะกลับมาคอมโบได้ 🎯';
      tone = 'warn';
      this.tipCooldownMs = 4600;

    } else if (r < 0.22 && fat < 0.38 && state.combo >= 6){
      msg = 'สวยมาก! ตอนนี้ฟอร์มกำลังมา 🔥 ลอง “ไล่ PERFECT” ต่อเนื่อง!';
      tone = 'good';
      this.tipCooldownMs = 5200;
    }

    if (!msg) return;

    // commit tip
    this.lastTipAt = now;
    this.lastReason = adj.reason;

    try{
      if (setFeedback) setFeedback(msg, tone === 'good' ? 'good' : 'miss');
      if (juice && juice.toastMsg) juice.toastMsg(tone === 'good' ? 'COACH TIP' : 'COACH', tone === 'good' ? 'good' : 'warn');
    }catch(_){}
  }
}