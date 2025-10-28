// === Hero Health Academy — game/core/coach.js (hardened + queue + auto HUD) ===
// โค้ช: ข้อความเชียร์สดระหว่างเล่น + ปลุกใจ + แจ้งเควสต์/FEVER/เวลาใกล้หมด
// ใช้กับ index ที่มี #coachHUD + #coachText (ไม่มี = สร้างให้อัตโนมัติ)

export class Coach {
  constructor(opts = {}) {
    this.lang = (opts.lang || (document.documentElement.getAttribute('data-hha-lang') || 'TH')).toUpperCase();
    this.minGap = Number.isFinite(opts.minGap) ? opts.minGap : 700;        // กันยิงรัว
    this.visibleMs = Number.isFinite(opts.visibleMs) ? opts.visibleMs : 1600;
    this.priorityEnabled = opts.priorityEnabled ?? true;                   // เปิดระบบ priority
    this.cooldownScaleOnBlur = opts.cooldownScaleOnBlur ?? 1.6;            // หน้าไม่โฟกัส → ลดสแปม
    this.mergeDuplicatesMs = opts.mergeDuplicatesMs ?? 600;                // ข้อความเดิมซ้ำติด ๆ กัน

    // DOM
    this.elHUD = document.getElementById('coachHUD') || this._ensureHUD();
    this.elText = document.getElementById('coachText') || this._ensureHUD(true);

    // State
    this._lastShownAt = 0;
    this._timerHide = 0;
    this._queue = []; // {text, at, prio}
    this._lastText = '';
    this._lastEnqAt = 0;
    this._loop = null;

    // Pause/Blur awareness (ลดสแปมเวลาผู้ใช้สลับแท็บ)
    this._blurred = false;
    try {
      window.addEventListener('blur',  () => { this._blurred = true;  }, { passive:true });
      window.addEventListener('focus', () => { this._blurred = false; }, { passive:true });
    } catch {}

    this._startLoop();
  }

  /* ============================= Public ============================= */
  setLang(l){ this.lang = (l||'TH').toUpperCase(); }
  setHUD(elHUD, elText){
    if (elHUD) this.elHUD = elHUD;
    if (elText) this.elText = elText;
  }

  // เมธอดช่วย: พูดด้วยข้อความดิบ หรือด้วย key
  say(text, prio = 1){ if (text) this._enqueue(String(text), prio); }
  sayKey(key, vars = [], prio = 1){ this._enqueue(this._t(key, vars), prio); }

  // ===== Hooks ที่ main/modes เรียก (API เผื่อใช้งานเร็ว) =====
  onStart(){ this._enqueue(this._t('start'), 2); }
  onGood(){ this._enqueue(this._t('good'), 1); }
  onPerfect(){ this._enqueue(this._t('perfect'), 2); }
  onBad(){ this._enqueue(this._t('bad'), 2); }
  onCombo(n){ if (n && n % 5 === 0) this._enqueue(this._t('combo', [n]), 2); }
  onFever(){ this._enqueue(this._t('fever'), 3); }
  onFeverEnd(){ this._enqueue(this._t('feverEnd'), 2); }
  onPower(kind){
    if (kind === 'boost' || kind === 'x2')  this._enqueue(this._t('power_x2'), 3);
    if (kind === 'freeze')                  this._enqueue(this._t('power_freeze'), 3);
  }
  onQuestRoll(){ this._enqueue(this._t('quest_roll'), 2); }
  onQuestProgress(name, p, need){ this._enqueue(this._t('quest_prog', [name, p, need]), 1); }
  onQuestDone(){ this._enqueue(this._t('quest_done'), 3); }
  onQuestFail(){ this._enqueue(this._t('quest_fail'), 1); }
  onCountdown(n){ if (n>0) this._enqueue(this._t('countdown', [n]), 3); }
  onTimeLow(){ this._enqueue(this._t('t10'), 3); }
  onEnd(score){ this._enqueue((Number(score)||0) >= 200 ? this._t('end_good') : this._t('end_ok'), 2); }

  /* ============================= i18n ============================= */
  _t(key, vars = []) {
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
    const L = (this.lang === 'EN' ? EN : TH);
    const v = L[key];
    if (typeof v === 'function') return v(...([].concat(vars)));
    return v || key;
  }

  /* ============================= Internals ============================= */
  _enqueue(text, prio = 1) {
    const now = performance?.now?.() || Date.now();

    // กัน duplicate ชิด ๆ กัน
    if (text === this._lastText && (now - this._lastEnqAt) < this.mergeDuplicatesMs) return;
    this._lastText = text;
    this._lastEnqAt = now;

    // เข้าคิว (ให้ข้อความ prio สูงชนะ และข้อความใหม่กว่าแทรกก่อน)
    this._queue.push({ text, prio: Number(prio) || 1, at: now });
    if (this.priorityEnabled) {
      this._queue.sort((a,b)=> (b.prio - a.prio) || (a.at - b.at));
    }
    this._tryFlush(); // เผื่อโชว์ได้เลย
  }

  _tryFlush() {
    if (!this.elHUD || !this.elText) return;
    const now = performance?.now?.() || Date.now();

    // ลดสแปมตาม focus
    const minGap = this._blurred ? (this.minGap * this.cooldownScaleOnBlur) : this.minGap;
    if (now - this._lastShownAt < minGap) return;

    const next = this._queue.shift();
    if (!next) return;

    this._show(next.text);
  }

  _show(text) {
    if (!this.elHUD || !this.elText) return;
    const now = performance?.now?.() || Date.now();

    this._lastShownAt = now;
    this.elHUD.style.display = 'flex';
    this.elHUD.classList.remove('pulse');

    // restart CSS anim
    // eslint-disable-next-line no-unused-expressions
    this.elHUD.offsetHeight;

    this.elText.textContent = text;
    this.elHUD.classList.add('pulse');

    clearTimeout(this._timerHide);
    this._timerHide = setTimeout(() => {
      this.elHUD.classList.remove('pulse');
      this._tryFlush();
    }, this.visibleMs);
  }

  _startLoop() {
    if (this._loop) return;
    const loop = () => {
      this._tryFlush();
      this._loop = requestAnimationFrame(loop);
    };
    this._loop = requestAnimationFrame(loop);
  }

  _ensureHUD(returnTextElOnly = false) {
    // ถ้าไม่มีโครง HUD เลย ให้สร้าง DOM เบา ๆ (สอดคล้อง CSS ใหม่: top 104px; z-index 96)
    let hud = document.getElementById('coachHUD');
    let txt = document.getElementById('coachText');

    if (!hud) {
      // ถ้ามี #hudWrap ให้แนบไว้ข้างใน (เลเยอร์ถูกต้องอยู่แล้ว)
      const host = document.getElementById('hudWrap') || document.body;

      hud = document.createElement('div');
      hud.id = 'coachHUD';
      hud.style.cssText = [
        'position:fixed',
        'top:104px','left:50%','transform:translateX(-50%)',
        'display:flex','align-items:center','justify-content:center',
        'padding:10px 14px',
        'background:rgba(0,0,0,.55)','backdrop-filter:blur(4px)',
        'color:#fff','font:800 14px/1.2 ui-rounded,system-ui,Segoe UI,Arial',
        'border-radius:12px','border:1px solid rgba(255,255,255,.12)',
        'box-shadow:0 6px 18px rgba(0,0,0,.25)',
        'z-index:96','pointer-events:none','opacity:1'
      ].join(';');

      txt = document.createElement('span');
      txt.id = 'coachText';
      hud.appendChild(txt);
      host.appendChild(hud);

      // inject keyframes pulse (ถ้ายังไม่มี)
      if (!document.getElementById('coachPulseStyle')) {
        const st = document.createElement('style');
        st.id = 'coachPulseStyle';
        st.textContent = `
          #coachHUD.pulse { animation: coachPulse 1.6s ease; }
          @keyframes coachPulse {
            0% { transform: translate(-50%, 8px) scale(.98); opacity:.0; }
            12%{ transform: translate(-50%, 0) scale(1);   opacity:1; }
            84%{ opacity:1; }
            100%{ opacity:.0; }
          }
        `;
        document.head.appendChild(st);
      }
    }

    if (returnTextElOnly) {
      return txt || document.getElementById('coachText');
    }
    return hud;
  }
}
