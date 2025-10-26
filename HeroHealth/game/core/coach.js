// game/core/coach.js
// โค้ช: ข้อความเชียร์สดระหว่างเล่น + ปลุกใจ + แจ้งเควสต์/FEVER/เวลาใกล้หมด
// ใช้กับ index ที่มี #coachHUD + #coachText

export class Coach {
  constructor(opts={}){
    this.lang = opts.lang || 'TH';
    this.elHUD = document.getElementById('coachHUD');
    this.elText = document.getElementById('coachText');
    this._cool = 0;       // anti-spam cooldown ms
    this._last = 0;       // last show time
    this._timerHide = 0;
    this.minGap = 700;    // กันข้อความยิงรัวเกินไป
    this.visibleMs = 1600;// ค้างโชว์กี่ ms
  }

  setLang(l){ this.lang = l || 'TH'; }
  _t(key, vars={}){
    const TH = {
      start:"พร้อมไหม? ลุยเลย!",
      good:"+ดีมาก!",
      perfect:"เป๊ะเว่อร์!",
      bad:"ระวังของขยะนะ!",
      combo:(n)=>`คอมโบ x${n}! สู้ต่อ!`,
      fever:"โหมดไฟลุก! ✦",
      feverEnd:"ไฟเริ่มเบาลง ตั้งคอมโบใหม่!",
      power_x2:"คะแนน ×2 ไปเลย!",
      power_freeze:"หยุดเวลา! รีบเก็บ!",
      quest_roll:"ภารกิจมาแล้ว: เลือก 3 อย่างให้สำเร็จ!",
      quest_prog:(name,p,need)=>`${name}: ${p}/${need}`,
      quest_done:"ภารกิจสำเร็จ! 🏁",
      quest_fail:"ไม่เป็นไร รอบหน้าเอาใหม่!",
      t10:"เหลือ 10 วิ สุดแรง!",
      end_good:"สุดยอด! ไปต่อ!",
      end_ok:"ดีมาก! ลองอีกทีจะดีกว่าเดิม",
      countdown:(n)=>`เริ่มใน ${n}…`
    };
    const EN = {
      start:"Ready? Go!",
      good:"+Nice!",
      perfect:"PERFECT!",
      bad:"Watch out for junk!",
      combo:(n)=>`Combo x${n}! Keep going!`,
      fever:"FEVER on! ✦",
      feverEnd:"Fever ending—build again!",
      power_x2:"Score ×2!",
      power_freeze:"Time freeze! Grab more!",
      quest_roll:"Mini Quests up: clear 3!",
      quest_prog:(name,p,need)=>`${name}: ${p}/${need}`,
      quest_done:"Quest Complete! 🏁",
      quest_fail:"Quest Failed—next time!",
      t10:"10s left—push!",
      end_good:"Awesome! Again?",
      end_ok:"Nice! One more try?",
      countdown:(n)=>`Start in ${n}…`
    };
    const L = (this.lang==='EN'?EN:TH);
    const v = L[key];
    if (typeof v === 'function') return v(...([].concat(vars)));
    return v || key;
  }

  _show(text){
    if (!this.elHUD || !this.elText) return;
    const now = performance?.now?.() || Date.now();
    if (now - this._last < this.minGap) return;
    this._last = now;
    this.elHUD.style.display = 'flex';
    this.elHUD.classList.remove('pulse');
    // force reflow for animation reset
    // eslint-disable-next-line no-unused-expressions
    this.elHUD.offsetHeight;
    this.elText.textContent = text;
    this.elHUD.classList.add('pulse');
    clearTimeout(this._timerHide);
    this._timerHide = setTimeout(()=>{ this.elHUD.classList.remove('pulse'); }, this.visibleMs);
  }

  // ========== Hooks ที่ main/modes เรียก ==========
  onStart(){ this._show(this._t('start')); }
  onGood(){ this._show(this._t('good')); }
  onPerfect(){ this._show(this._t('perfect')); }
  onBad(){ this._show(this._t('bad')); }
  onCombo(n){ if (n%5===0) this._show(this._t('combo',[n])); }
  onFever(){ this._show(this._t('fever')); }
  onFeverEnd(){ this._show(this._t('feverEnd')); }
  onPower(kind){
    if (kind==='boost') this._show(this._t('power_x2'));
    if (kind==='freeze') this._show(this._t('power_freeze'));
  }

  onQuestRoll(){ this._show(this._t('quest_roll')); }
  onQuestProgress(name, p, need){ this._show(this._t('quest_prog',[name,p,need])); }
  onQuestDone(){ this._show(this._t('quest_done')); }
  onQuestFail(){ this._show(this._t('quest_fail')); }

  onCountdown(n){ this._show(this._t('countdown',[n])); }
  onTimeLow(){ this._show(this._t('t10')); }

  onEnd(score, grade){ this._show(score>=200 ? this._t('end_good') : this._t('end_ok')); }
}
