// game/core/coach.js
// Coach: แสดงข้อความให้กำลังใจ ปลุกใจ และฟีดแบ็กช่วงเล่น (TH/EN)
// ใช้งานร่วมกับ DOM: #coachHUD > #coachText

export class Coach {
  constructor(opts = {}) {
    this.lang = opts.lang || 'TH';
    this.enabled = true;

    // DOM
    this.hud = document.getElementById('coachHUD') || this._makeHUD();
    this.label = document.getElementById('coachText');

    // timing / anti-spam
    this.lastMsgAt = 0;
    this.cooldownMs = 1200;   // ขั้นต่ำระหว่างข้อความ
    this.visibleMs  = 2200;   // ค้างแสดง
    this.fadeTimer = 0;

    // heartbeat encouragement
    this.active = false;
    this.heartbeatTimer = 0;
    this.heartbeatEvery = 15000; // ถ้าเงียบเกิน 15s ปลุกใจสั้น ๆ
    this.minSince = 6000;        // ต้องห่างจากข้อความล่าสุดอย่างน้อยเท่านี้

    // remember last mood (ดี/พลาด/เฟีเวอร์) เผื่อสุ่มประโยคไม่ซ้ำ
    this.mood = 'neutral';
  }

  // ======== Public controls ========
  setLang(l) { this.lang = l || 'TH'; }
  setEnabled(on) { this.enabled = !!on; }

  say(text, opt = {}) {
    if (!this.enabled) return;
    const now = performance?.now?.() || Date.now();
    if (!opt.force && now - this.lastMsgAt < this.cooldownMs) return;
    this.lastMsgAt = now;

    if (this.label) this.label.textContent = text || '';
    if (this.hud) {
      this.hud.style.display = 'block';
      this.hud.style.opacity = '1';
    }
    clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => {
      try {
        this.hud.style.opacity = '0';
        setTimeout(()=>{ this.hud.style.display = 'none'; }, 240);
      } catch {}
    }, opt.stayMs || this.visibleMs);
  }

  // ======== Game lifecycle hooks ========
  onStart(modeKey) {
    this.active = true;
    this._startHeartbeat();
    const t = TEXT[this.lang] || TEXT.TH;
    this.say(pick(t.start[modeKey]) || pick(t.start.generic));
  }

  onEnd(score, meta={}) {
    const t = TEXT[this.lang] || TEXT.TH;
    this.active = false;
    this._stopHeartbeat();
    const grade = meta.grade || (score>=200?'A':score>=120?'B':'C');
    const msg = (score>=200) ? pick(t.end.high) :
                (score>=120) ? pick(t.end.mid)  :
                               pick(t.end.low);
    this.say(msg.replace('{score}', score).replace('{grade}', grade), { stayMs: 2800, force: true });
  }

  // ======== Moment hooks ========
  onCombo(x) {
    const t = TEXT[this.lang] || TEXT.TH;
    if (x===0) return;
    if (x===5)  this.say(pick(t.combo.c5));
    if (x===10) this.say(pick(t.combo.c10));
    if (x===20) this.say(pick(t.combo.c20));
    this.mood = 'combo';
  }

  onFever() {
    const t = TEXT[this.lang] || TEXT.TH;
    this.say(pick(t.fever.start), { force:true });
    this.mood = 'fever';
  }

  onGood() {
    const t = TEXT[this.lang] || TEXT.TH;
    if (Math.random() < 0.28) this.say(pick(t.moment.good));
    this.mood = 'good';
  }

  onBad(modeKey) {
    const t = TEXT[this.lang] || TEXT.TH;
    if (Math.random() < 0.45) this.say(pick(t.moment.bad));
    this.mood = 'bad';
  }

  // เควสในโหมดต่าง ๆ (goodjunk เรียกได้)
  onQuestStart(name) {
    const t = TEXT[this.lang] || TEXT.TH;
    if (Math.random() < 0.9) this.say((t.quest.start[name] && pick(t.quest.start[name])) || pick(t.quest.start.generic));
  }
  onQuestComplete(name) {
    const t = TEXT[this.lang] || TEXT.TH;
    this.say((t.quest.done[name] && pick(t.quest.done[name])) || pick(t.quest.done.generic), { force:true });
    this.mood = 'good';
  }
  onQuestFail(name) {
    const t = TEXT[this.lang] || TEXT.TH;
    this.say((t.quest.fail[name] && pick(t.quest.fail[name])) || pick(t.quest.fail.generic), { force:true });
    this.mood = 'bad';
  }

  // ======== Heartbeat encouragement ========
  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.active || !this.enabled) return;
      const now = performance?.now?.() || Date.now();
      if (now - this.lastMsgAt < this.minSince) return;
      // gently nudge
      const t = TEXT[this.lang] || TEXT.TH;
      this.say(pick(t.heartbeat[this.mood] || t.heartbeat.neutral));
    }, this.heartbeatEvery);
  }
  _stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = 0;
  }

  // ======== HUD ========
  _makeHUD() {
    const box = document.createElement('div');
    box.id = 'coachHUD';
    box.className = 'coach';
    box.style.cssText = `
      position:fixed;left:50%;top:84px;transform:translateX(-50%);
      padding:8px 12px;border-radius:12px;background:#111c;color:#fff;
      border:1px solid #fff3;box-shadow:0 4px 18px #0006;
      font:700 14px/1.25 ui-rounded,system-ui,Segoe UI,Arial;
      z-index:140;display:none;opacity:0;transition:opacity .24s ease;
      pointer-events:none;
    `;
    const span = document.createElement('div');
    span.id = 'coachText';
    box.appendChild(span);
    document.body.appendChild(box);
    return box;
  }
}

// ======== Texts (TH / EN) ========
const TEXT = {
  TH: {
    start: {
      generic: ['พร้อมลุย!','สู้ ๆ ไปด้วยกัน!','เริ่มกันเลย!'],
      goodjunk: ['โหมดดี vs ขยะ—เก็บของดี หลีกเลี่ยงของขยะ!','โฟกัสของดี เข้าเป้าให้ไว!'],
      groups: ['ดู 🎯 เป้า แล้วเก็บให้ตรงหมวด!'],
      hydration: ['รักษาแถบน้ำ 45–65%!','จิบน้ำให้พอดี สู้!'],
      plate: ['เติมโควตาให้ครบ แล้วไปต่อ!']
    },
    end: {
      high: ['สุดยอด! {score} แต้ม เกรด {grade}!','เทพมาก! คะแนน {score}!'],
      mid:  ['ดีมาก! {score} แต้ม ลองดันต่อรอบหน้า!','เยี่ยมเลย {score}!'],
      low:  ['ไม่เป็นไร ลองใหม่อีกนิด! {score} แต้ม','สู้ต่อ! รอบหน้าได้ดีกว่านี้แน่!']
    },
    combo: {
      c5:  ['ติดเครื่องแล้ว!','กำลังสวย!'],
      c10: ['คอมโบไฟลุก!','แรงขึ้นเรื่อย ๆ!'],
      c20: ['คอมโบเทพ! รักษาไว้!','โฟกัสดีมาก!']
    },
    fever: {
      start: ['FEVER มาแล้ว! โกยคะแนน!','ไฟลุก! จัดเต็ม!']
    },
    moment: {
      good: ['ดีมาก!','เนียน!','สวย!'],
      bad:  ['ไม่เป็นไร ตั้งสติ!','พลาดนิดเดียว ลุยต่อ!','โฟกัสใหม่นะ!']
    },
    quest: {
      start: {
        generic: ['เริ่มภารกิจ! ทำให้ทันเวลา!'],
        collect_good: ['เก็บของดีให้ครบเลย!'],
        avoid_junk:   ['เลี่ยงของขยะต่อเนื่องนะ!'],
        perfect:      ['ไล่ Perfect ให้ได้หลายครั้ง!'],
        powerups:     ['เก็บพลังพิเศษให้ครบ!'],
        reach_combo:  ['ดันคอมโบให้ถึงเป้าหมาย!']
      },
      done: {
        generic: ['ภารกิจสำเร็จ! เก่งมาก!'],
        collect_good: ['เก็บของดีครบแล้ว!'],
        avoid_junk:   ['เลี่ยงของขยะสำเร็จ!'],
        perfect:      ['Perfect สมบูรณ์แบบ!'],
        powerups:     ['เก็บพลังครบแล้ว!'],
        reach_combo:  ['คอมโบถึงเป้าแล้ว!']
      },
      fail: {
        generic: ['ภารกิจพลาด ไม่เป็นไร!'],
        collect_good: ['ไม่ทันเวลา ไปลุยใหม่!'],
        avoid_junk:   ['พลาดขยะนิดเดียวเอง!'],
        perfect:      ['ครั้งหน้าเอา Perfect ให้ได้!'],
        powerups:     ['ไม่ครบ ลองใหม่ได้!'],
        reach_combo:  ['เกือบแล้ว! ดันอีกนิด!']
      }
    },
    heartbeat: {
      neutral: ['หายใจลึก ๆ โฟกัส!','ค่อย ๆ ไป ชัวร์กว่า!'],
      good:    ['จังหวะดีมาก รักษาไว้!'],
      bad:     ['ไม่เป็นไร เด้งกลับมา!'],
      combo:   ['อย่าให้คอมโบหลุดนะ!'],
      fever:   ['เก็บให้คุ้ม FEVER!']
    }
  },

  EN: {
    start: {
      generic: ['Let’s go!','You got this!','Game on!'],
      goodjunk: ['Good vs Junk—grab healthy, avoid junk!','Focus on the greens!'],
      groups: ['Follow the 🎯 target!'],
      hydration: ['Keep hydration 45–65%!'],
      plate: ['Fill quotas and push on!']
    },
    end: {
      high: ['Awesome! {score} pts, grade {grade}!','Insane score {score}!'],
      mid:  ['Great run! {score} pts—push next time!','Nice! {score}!'],
      low:  ['No worries—try again! {score} pts','Keep going!']
    },
    combo: {
      c5:  ['You’re rolling!'],
      c10: ['Combo heating up!'],
      c20: ['Godlike combo—keep it!']
    },
    fever: {
      start: ['FEVER on—farm points!','Burning hot!']
    },
    moment: {
      good: ['Nice!','Clean!','Sweet!'],
      bad:  ['Shake it off!','Refocus!']
    },
    quest: {
      start: {
        generic: ['Quest started—beat the timer!'],
        collect_good: ['Collect those greens!'],
        avoid_junk:   ['Avoid junk continuously!'],
        perfect:      ['Stack those perfects!'],
        powerups:     ['Grab power-ups!'],
        reach_combo:  ['Push the combo target!']
      },
      done: {
        generic: ['Quest complete!'],
        collect_good: ['Greens collected!'],
        avoid_junk:   ['Clean streak—nice!'],
        perfect:      ['Perfects achieved!'],
        powerups:     ['Power-ups secured!'],
        reach_combo:  ['Combo reached!']
      },
      fail: {
        generic: ['Quest failed—no worries!'],
        collect_good: ['Out of time—try again!'],
        avoid_junk:   ['Junk slipped in—reset!'],
        perfect:      ['Next time—nail those perfects!'],
        powerups:     ['Not enough—one more run!'],
        reach_combo:  ['So close—push again!']
      }
    },
    heartbeat: {
      neutral: ['Deep breath, focus.','Steady pace wins.'],
      good:    ['Great rhythm—keep it!'],
      bad:     ['Bounce back—let’s go!'],
      combo:   ['Don’t drop the combo!'],
      fever:   ['Max out the FEVER!']
    }
  }
};

// utils
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
