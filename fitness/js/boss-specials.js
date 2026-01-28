// === /fitness/js/boss-specials.js ===
// Boss Specials (fun + fair):
// 1) ZONE LOCK: 1 โซนถูก "ล็อก" ชั่วคราว -> ถ้าสุ่มเกิดในโซนนั้นจะกลายเป็น bomb/decoy
// 2) SHIELD WALL: บอสลดดาเมจที่ได้รับช่วงสั้น ๆ (ยกเว้น perfect จะทะลุบางส่วน)
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class BossSpecials {
  constructor(){
    this.active = null; // { type, until, zoneId, startedAt }
    this.cooldownUntil = 0;
    this.lastType = '';
  }

  isActive(now=performance.now()){
    return !!(this.active && now < this.active.until);
  }

  type(){
    return this.active ? this.active.type : '';
  }

  zoneId(){
    return this.active ? this.active.zoneId : null;
  }

  clear(){
    this.active = null;
  }

  // Decide to trigger specials
  maybeTrigger(state){
    const now = performance.now();
    if (this.isActive(now)) return false;
    if (now < this.cooldownUntil) return false;

    // เพิ่มโอกาสตอน phase 2-3
    const p =
      state.bossPhase === 3 ? 0.16 :
      state.bossPhase === 2 ? 0.10 : 0.05;

    if (Math.random() > p) return false;

    const pick = Math.random();
    let type = 'zoneLock';
    if (pick > 0.62) type = 'shieldWall';

    // กันซ้ำแบบติด ๆ
    if (type === this.lastType && Math.random() < 0.55) {
      type = (type === 'zoneLock') ? 'shieldWall' : 'zoneLock';
    }

    if (type === 'zoneLock'){
      const z = clamp(Math.floor(Math.random()*6), 0, 5);
      this.active = { type, zoneId: z, startedAt: now, until: now + 3000 };
      this.cooldownUntil = now + 2200;
    } else {
      this.active = { type, zoneId: null, startedAt: now, until: now + 4200 };
      this.cooldownUntil = now + 2600;
    }

    this.lastType = type;
    return true;
  }

  // Apply damage modifier
  bossDamageMultiplier(grade){
    if (!this.active) return 1;
    if (this.active.type !== 'shieldWall') return 1;

    // perfect ทะลุได้บางส่วน
    if (grade === 'perfect') return 0.82;
    return 0.55;
  }
}