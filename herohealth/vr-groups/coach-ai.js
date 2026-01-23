// === /herohealth/vr-groups/coach-ai.js ===
// GroupsVR AI Coach — Explainable + Rate-limit (Kid-friendly)
// ✅ play only when enabled=true (ai-hooks decides; ?ai=1)
// ✅ research/practice OFF hard
// ✅ explainable tips: why + what to do
// ✅ rate-limit + per-reason cooldown
//
// Usage:
//   GroupsVR.CoachAI.attach({ enabled, runMode, seed })
//   GroupsVR.CoachAI.onEvent({ type:'hit_wrong', groupName:'ผัก', ... })
//   Coach will emit hha:coach {text,mood}

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const nowMs = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  function makeRng(u32){
    let s = (u32>>>0) || 1;
    return ()=>((s = (Math.imul(1664525, s) + 1013904223)>>>0) / 4294967296);
  }
  function hashSeed(str){
    str = String(str ?? '');
    let h = 2166136261>>>0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h>>>0;
  }
  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  const MOODS = { happy:'happy', neutral:'neutral', fever:'fever', sad:'sad' };

  function CoachAI(){
    this.enabled = false;
    this.runMode = 'play';
    this.seed = '0';
    this.rng = makeRng(123);

    this.minGapMs = 1400;          // กันพูดถี่
    this.lastSayAt = 0;

    this.reasonCooldown = {        // กัน “พูดเรื่องเดิมซ้ำ”
      hit_wrong: 1800,
      hit_junk:  1900,
      miss:      1700,
      expire:    2000,
      mini_start:2500,
      mini_urgent:2000,
      mini_end:  2200,
      storm_on:  4200,
      storm_off: 4200,
      boss_spawn:4200,
      boss_phase2:5200,
      praise:    3200,
      pressure:  2400
    };
    this.lastReasonAt = Object.create(null);

    // memory
    this.lastGroup = '';
    this.lastAcc = 0;
    this.lastCombo = 0;
    this.lastMiss = 0;
    this.lastPressure = 0;
  }

  CoachAI.prototype.attach = function(cfg){
    cfg = cfg || {};
    const rm = String(cfg.runMode||'play').toLowerCase();
    this.runMode = rm;

    this.enabled = !!cfg.enabled && (rm === 'play');
    if (rm === 'research' || rm === 'practice') this.enabled = false;

    this.seed = String(cfg.seed ?? '0');
    this.rng = makeRng(hashSeed(this.seed + '::coach'));

    this.lastSayAt = 0;
    this.lastReasonAt = Object.create(null);

    this.lastGroup = '';
    this.lastAcc = 0;
    this.lastCombo = 0;
    this.lastMiss = 0;
    this.lastPressure = 0;
  };

  CoachAI.prototype._canSay = function(reason){
    if(!this.enabled) return false;

    const t = nowMs();
    if (t - this.lastSayAt < this.minGapMs) return false;

    const cd = this.reasonCooldown[reason] ?? 1800;
    const last = this.lastReasonAt[reason] ?? 0;
    if (t - last < cd) return false;

    this.lastSayAt = t;
    this.lastReasonAt[reason] = t;
    return true;
  };

  CoachAI.prototype._say = function(text, mood){
    emit('hha:coach', { text: String(text||''), mood: String(mood||'neutral') });
  };

  // explainable templates (เด็ก ป.5)
  CoachAI.prototype._tipWrong = function(groupName){
    const r = this.rng;
    const g = groupName ? `“${groupName}”` : 'หมู่ที่ถูก';
    return pick(r, [
      `อันนี้ไม่ใช่หมู่ ${g} นะ 👀 ดูการ์ด GOAL ด้านบนก่อนแล้วยิง`,
      `เล็งดี ๆ! ตอนนี้ต้องยิงหมู่ ${g} ✅ ถ้าไม่แน่ใจรอเป้าใหม่ก็ได้`,
      `ผิดหมู่แล้ว 😅 เคล็ดลับ: อ่านชื่อหมู่บน GOAL แล้วค่อยแตะยิง`
    ]);
  };

  CoachAI.prototype._tipJunk = function(){
    const r = this.rng;
    return pick(r, [
      `หลบ “ขยะ” สีแดงไว้ก่อน 🗑️ เห็นลายเตือน = อย่ายิง/อย่าแตะ`,
      `ขยะมาแล้ว! ถ้าไม่ชัวร์ “หยุดมือ 1 วิ” แล้วค่อยยิง 🎯`,
      `ทริคง่าย ๆ: เป้าแดง ๆ กับลายเตือน = อันตราย ❌`
    ]);
  };

  CoachAI.prototype._tipMiss = function(){
    const r = this.rng;
    return pick(r, [
      `พลาดได้ แต่รีบเกินไปจะพลาดซ้ำ 😄 ช้าลงนิดแล้วเล็งกลางวง`,
      `ลอง “เล็งก่อน 1 จังหวะ” แล้วค่อยยิง จะคอมโบยาวขึ้น 🔥`,
      `โอเค ๆ ตั้งสติ แล้วค่อย ๆ เก็บทีละเป้า ✅`
    ]);
  };

  CoachAI.prototype._tipExpire = function(){
    const r = this.rng;
    return pick(r, [
      `เป้าหลุดไปแล้ว ⏳ ถ้าเห็นเป้าดี ให้รีบเก็บก่อนนะ`,
      `ทริค: เลือกยิง “เป้าที่ใกล้กลางจอ” ก่อน จะไม่หลุดง่าย`,
      `อย่าไล่ทุกอัน! เลือกอันที่ชัวร์ แล้วคอมโบจะมาเอง ✨`
    ]);
  };

  CoachAI.prototype._tipMiniStart = function(need, forbidJunk, sec){
    const r = this.rng;
    const s = sec ? `${sec} วิ` : 'เวลาจำกัด';
    if (forbidJunk){
      return pick(r, [
        `MINI เริ่ม! ต้องถูก ${need} ใน ${s} และ “ห้ามโดนขยะ” 😱`,
        `โหมด MINI! ถูก ${need} ภายใน ${s} + ระวังขยะนะ!`,
      ]);
    }
    return pick(r, [
      `MINI เริ่ม! เก็บให้ได้ ${need} ใน ${s} ⚡`,
      `MINI มาแล้ว! โฟกัสเป้าถูกหมู่ให้ครบ ${need} 🔥`
    ]);
  };

  CoachAI.prototype._tipMiniUrgent = function(leftSec){
    const r = this.rng;
    return pick(r, [
      `เหลือ ${leftSec}s! เลือกยิงอันที่ชัวร์ก่อน!`,
      `อีก ${leftSec}s! เร่งได้ แต่ต้อง “ไม่ยิงมั่ว” นะ!`,
    ]);
  };

  CoachAI.prototype._tipMiniEnd = function(ok){
    const r = this.rng;
    return ok
      ? pick(r, [`MINI ผ่านแล้ว! เก่งมาก! 🎉`, `สุดยอด! MINI เคลียร์ ✅`])
      : pick(r, [`เกือบแล้ว! รอบหน้าทำได้แน่ 💪`, `พลาดนิดเดียว! ลองใหม่ได้ 😤`]);
  };

  CoachAI.prototype._tipStormOn = function(){
    const r = this.rng;
    return pick(r, [
      `พายุมา! เป้าจะถี่ขึ้น 🌪️ เลือกยิงเฉพาะอันที่ชัวร์`,
      `STORM! เร็วขึ้นได้ แต่ต้องแม่นไว้ก่อน 🔥`,
    ]);
  };

  CoachAI.prototype._tipBoss = function(){
    const r = this.rng;
    return pick(r, [
      `บอสมาแล้ว! 👊 ยิงให้ถูกหมู่เดิมเพื่อแตกบอส`,
      `BOSS! เล็งให้ตรงหมู่ แล้วรัวแบบมีสติ 😄`,
    ]);
  };

  CoachAI.prototype._tipPraise = function(acc, combo){
    const r = this.rng;
    return pick(r, [
      `โหดมาก! แม่น ${acc}% + คอมโบ ${combo} 🔥`,
      `สุดยอด! คอมโบยาวแล้ว! รักษาจังหวะนี้ไว้ ✨`,
      `เก่งมาก! ตอนนี้เล่นแบบมือโปรแล้ว 😎`,
    ]);
  };

  CoachAI.prototype._tipPressure = function(level){
    if (level>=3) return `อันตราย! หยุดยิงมั่วก่อน 😤 เลือกเป้าที่ถูกหมู่เท่านั้น`;
    if (level>=2) return `เริ่มกดดันแล้ว! ช้าลงนิด เล็งให้ชัวร์ 🔥`;
    if (level>=1) return `เริ่มพลาดบ่อยนะ 👀 มอง GOAL แล้วค่อยยิง`;
    return `กลับมาได้แล้ว! เล่นนิ่ง ๆ จะคุมเกมได้ ✅`;
  };

  CoachAI.prototype.onEvent = function(ev){
    if(!this.enabled) return false;
    ev = ev || {};
    const type = String(ev.type||'');

    // update memory (optional)
    if (ev.groupName) this.lastGroup = String(ev.groupName||'');
    if (ev.accuracy!=null) this.lastAcc = Number(ev.accuracy||0);
    if (ev.combo!=null) this.lastCombo = Number(ev.combo||0);
    if (ev.misses!=null) this.lastMiss = Number(ev.misses||0);
    if (ev.pressure!=null) this.lastPressure = Number(ev.pressure||0);

    if (type === 'hit_wrong'){
      if(!this._canSay('hit_wrong')) return false;
      this._say(this._tipWrong(ev.groupName||this.lastGroup), MOODS.sad);
      return true;
    }
    if (type === 'hit_junk'){
      if(!this._canSay('hit_junk')) return false;
      this._say(this._tipJunk(), MOODS.sad);
      return true;
    }
    if (type === 'miss'){
      if(!this._canSay('miss')) return false;
      this._say(this._tipMiss(), MOODS.neutral);
      return true;
    }
    if (type === 'expire_good'){
      if(!this._canSay('expire')) return false;
      this._say(this._tipExpire(), MOODS.neutral);
      return true;
    }
    if (type === 'mini_start'){
      if(!this._canSay('mini_start')) return false;
      this._say(this._tipMiniStart(ev.need||5, !!ev.forbidJunk, ev.sec||9), MOODS.neutral);
      return true;
    }
    if (type === 'mini_urgent'){
      if(!this._canSay('mini_urgent')) return false;
      this._say(this._tipMiniUrgent(ev.leftSec||3), MOODS.fever);
      return true;
    }
    if (type === 'mini_end'){
      if(!this._canSay('mini_end')) return false;
      this._say(this._tipMiniEnd(!!ev.ok), ev.ok ? MOODS.happy : MOODS.sad);
      return true;
    }
    if (type === 'storm_on'){
      if(!this._canSay('storm_on')) return false;
      this._say(this._tipStormOn(), MOODS.fever);
      return true;
    }
    if (type === 'storm_off'){
      if(!this._canSay('storm_off')) return false;
      this._say(`พายุผ่านแล้ว! กลับมาเก็บแต้มต่อ ✨`, MOODS.happy);
      return true;
    }
    if (type === 'boss_spawn'){
      if(!this._canSay('boss_spawn')) return false;
      this._say(this._tipBoss(), MOODS.fever);
      return true;
    }
    if (type === 'boss_phase2'){
      if(!this._canSay('boss_phase2')) return false;
      this._say(`บอสเฟส 2! ระวังลูกสมุน 😱 เลือกยิงอันที่ชัวร์!`, MOODS.fever);
      return true;
    }
    if (type === 'pressure'){
      if(!this._canSay('pressure')) return false;
      this._say(this._tipPressure(Number(ev.level||0)), Number(ev.level||0)>=2 ? MOODS.fever : MOODS.neutral);
      return true;
    }
    if (type === 'praise'){
      if(!this._canSay('praise')) return false;
      this._say(this._tipPraise(ev.accuracy||this.lastAcc, ev.combo||this.lastCombo), MOODS.happy);
      return true;
    }
    return false;
  };

  // export
  NS.CoachAI = new CoachAI();
})(window);