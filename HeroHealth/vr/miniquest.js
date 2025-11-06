// === vr/miniquest.js — Mini Quest system (10 quests, random 3 per game) ===
// 2025-11-06 (robust + pause/resume + serialize + HUD-safe)
//
// ความเปลี่ยนแปลงหลัก
// - Backward compatible: ยังเรียก start/second/good/junk/fever/mission ได้เหมือนเดิม
// - เพิ่ม pause()/resume()/reset() และ setGoal(goal), setHUD(hud), setAudio(audio)
// - ปรับ HUD renderer ให้รองรับทั้ง troika-text ('value') และ DOM textContent แบบ fallback
// - ป้องกันเสียงพัง (null-safe), รวมทั้งการอัปเดต HUD เมื่อ element หาย/เพิ่มใหม่
// - เพิ่ม serialize()/load() สำหรับเซฟสถานะรอบเกม (เช่น resume หลัง reload)
// - ปรับเลือกเควส 3 ข้อแบบกันเควสซ้ำกลุ่ม (good/score คล้ายกัน) เพื่อความหลากหลายเล็กน้อย
// - มี _emit(event, detail) → window.dispatchEvent CustomEvent('hha:miniquest', {...})

export class MiniQuest {
  /**
   * @param {object} hud  - { tQ1, tQ2, tQ3 } (A-Frame entity ที่มี troika-text หรือ HTMLElement ปกติ)
   * @param {object} audio - { coach_start, coach_good, coach_warn, coach_fever, coach_quest, coach_clear }
   * @param {object} opts  - { pickCount=3, i18n?:{...}, templates?:Template[] }
   */
  constructor(hud, audio, opts = {}) {
    this.hud = hud || {};
    this.audio = audio || {};
    this.opts = { pickCount: 3, ...opts };

    // --- state ---
    this.quests = [];
    this.done = 0;
    this.elapsed = 0;
    this.lastJunkAt = 0;
    this.goodTimestamps = [];   // sliding window (seconds) สำหรับ burst 10s
    this.feverCount = 0;
    this._goal = 40;
    this._shownClearCheer = false;
    this._paused = false;

    // i18n (เผื่อปรับข้อความภายหลัง)
    this.i18n = {
      startCoach: 'สุ่มมิชชั่น 3 อย่าง / เก็บแต้มให้ถึงเป้า!',
      markDone: '✅',
      markTodo: '⬜',
      // labels สำหรับ templates ค่าเริ่มต้น
      labels: {
        G10:  'เก็บของดี 10 ชิ้น',
        G20:  'เก็บของดี 20 ชิ้น',
        C5:   'ทำคอมโบ x5',
        C10:  'ทำคอมโบ x10',
        F1:   'เปิดโหมด Fever 1 ครั้ง',
        ST8:  'ทำสตรีคติดกัน 8 ชิ้น',
        S300: 'ทำคะแนนถึง 300 คะแนน',
        NJ15: 'ไม่โดนของขยะ 15 วินาที',
        B5:   'เก็บของดี 5 ชิ้นใน 10 วิ',
        MGOAL:'ผ่านภารกิจหลักของรอบนี้'
      },
      ...(opts.i18n || {})
    };

    // เทมเพลตพื้นฐาน (อนุญาตให้ override ผ่าน opts.templates)
    this.baseTemplates = (opts.templates && Array.isArray(opts.templates))
      ? opts.templates
      : [
          { id:'G10',  label:this.i18n.labels.G10,  type:'good',   target:10,  prog:0, group:'good'   },
          { id:'G20',  label:this.i18n.labels.G20,  type:'good',   target:20,  prog:0, group:'good'   },
          { id:'C5',   label:this.i18n.labels.C5,   type:'combo',  target:5,   prog:0, group:'combo'  },
          { id:'C10',  label:this.i18n.labels.C10,  type:'combo',  target:10,  prog:0, group:'combo'  },
          { id:'F1',   label:this.i18n.labels.F1,   type:'fever',  target:1,   prog:0, group:'fever'  },
          { id:'ST8',  label:this.i18n.labels.ST8,  type:'streak', target:8,   prog:0, group:'streak' },
          { id:'S300', label:this.i18n.labels.S300, type:'score',  target:300, prog:0, group:'score'  },
          { id:'NJ15', label:this.i18n.labels.NJ15, type:'nojunk', target:15,  prog:0, group:'nojunk' },
          { id:'B5',   label:this.i18n.labels.B5,   type:'burst',  target:5,   prog:0, group:'burst'  }, // window 10s
          { id:'MGOAL',label:this.i18n.labels.MGOAL,type:'mission',target:1,   prog:0, group:'mission'}
        ];
  }

  // ---------- lifecycle ----------
  start(goal = 40) {
    this._goal = Number.isFinite(goal) ? goal : 40;
    this.elapsed = 0;
    this.lastJunkAt = 0;
    this.goodTimestamps.length = 0;
    this.feverCount = 0;
    this._shownClearCheer = false;
    this._paused = false;

    // สุ่ม 3 เควสแบบ "กันซ้ำกลุ่ม" เท่าที่ทำได้ เพื่อความหลากหลาย
    this.quests = this._pickQuests(this.baseTemplates, this.opts.pickCount || 3);
    this.done = 0;

    this._render();
    this._play(this.audio?.coach_start);
    this._emit('start', { goal: this._goal, quests: this._brief() });
    return this.quests;
  }

  pause(){ this._paused = true; }
  resume(){ this._paused = false; }
  reset(){
    this.quests = [];
    this.done = 0;
    this.elapsed = 0;
    this.lastJunkAt = 0;
    this.goodTimestamps.length = 0;
    this.feverCount = 0;
    this._shownClearCheer = false;
    this._paused = false;
    this._render();
    this._emit('reset', {});
  }

  setGoal(goal=40){ this._goal = Number.isFinite(goal) ? goal : this._goal; }
  setHUD(hud={}){ this.hud = hud || {}; this._render(); }
  setAudio(audio={}){ this.audio = audio || {}; }

  // เรียกทุก 1 วินาที
  second() {
    if (this._paused) return;
    this.elapsed++;
    // update "no junk for 15s"
    this._updateNoJunk();
    // clean old good timestamps >10s สำหรับ burst
    const cutoff = this.elapsed - 10;
    this.goodTimestamps = this.goodTimestamps.filter(t => t > cutoff);
    this._render();
  }

  // ---------- event hooks from game ----------
  good({ score=0, combo=1, streak=0, missionGood=0 } = {}) {
    if (this._paused) return;
    this.goodTimestamps.push(this.elapsed);

    for (const q of this.quests) {
      if (q.type === 'good') {
        q.prog = Math.min(q.target, Math.max(q.prog, missionGood)); // total good = missionGood
      }
      if (q.type === 'combo') {
        q.prog = Math.min(q.target, Math.max(q.prog, combo));
      }
      if (q.type === 'streak') {
        q.prog = Math.min(q.target, Math.max(q.prog, streak));
      }
      if (q.type === 'score') {
        q.prog = Math.min(q.target, Math.max(q.prog, score));
      }
      if (q.type === 'burst') {
        // count goods within last 10 seconds
        const c = this.goodTimestamps.length;
        q.prog = Math.min(q.target, Math.max(q.prog, c));
      }
      if (q.type === 'mission') {
        if (missionGood >= this._goal) q.prog = 1;
      }
    }

    const cleared = this._checkComplete();
    this._render();
    this._play(this.audio?.coach_good, cleared > 0 ? null : 'good');
  }

  junk() {
    if (this._paused) return;
    this.lastJunkAt = this.elapsed;
    // (streak จะถูกคำนวณจากฝั่งเกม) → แค่รีเฟรช HUD
    this._render();
    this._play(this.audio?.coach_warn, 'warn');
  }

  fever() {
    if (this._paused) return;
    this.feverCount++;
    for (const q of this.quests) {
      if (q.type === 'fever') {
        q.prog = Math.min(q.target, this.feverCount);
      }
    }
    const cleared = this._checkComplete();
    this._render();
    this._play(this.audio?.coach_fever, cleared > 0 ? null : 'fever');
  }

  mission(missionGood) {
    if (this._paused) return;
    for (const q of this.quests) {
      if (q.type === 'mission' && missionGood >= this._goal) q.prog = 1;
    }
    const cleared = this._checkComplete();
    this._render();
    if (cleared > 0) this._play(this.audio?.coach_quest, 'quest');
  }

  // ---------- persistence ----------
  serialize() {
    return {
      quests: this.quests.map(q => ({...q})),
      done: this.done,
      elapsed: this.elapsed,
      lastJunkAt: this.lastJunkAt,
      goodTimestamps: [...this.goodTimestamps],
      feverCount: this.feverCount,
      goal: this._goal,
      shownClearCheer: this._shownClearCheer
    };
  }

  load(state = {}) {
    try {
      if (Array.isArray(state.quests)) this.quests = state.quests.map(q => ({...q}));
      if (Number.isFinite(state.done)) this.done = state.done;
      if (Number.isFinite(state.elapsed)) this.elapsed = state.elapsed;
      if (Number.isFinite(state.lastJunkAt)) this.lastJunkAt = state.lastJunkAt;
      if (Array.isArray(state.goodTimestamps)) this.goodTimestamps = state.goodTimestamps.slice(0);
      if (Number.isFinite(state.feverCount)) this.feverCount = state.feverCount;
      if (Number.isFinite(state.goal)) this._goal = state.goal;
      this._shownClearCheer = !!state.shownClearCheer;
      this._render();
    } catch { /* ignore bad state */ }
  }

  // ---------- internals ----------
  _pickQuests(templates, count) {
    const pool = templates.map(t => ({...t, prog:0, _done:false}));
    const out = [];
    const usedGroups = new Set();
    // พยายามกระจาย group ต่างกันก่อน
    while (out.length < count && pool.length) {
      // 1) ลองหยิบที่ group ยังไม่เคยใช้
      const idx = this._pickIndex(pool, (t => !usedGroups.has(t.group)));
      const pick = pool.splice(idx, 1)[0];
      out.push(pick);
      usedGroups.add(pick.group);
    }
    // ถ้ายังได้น้อยกว่า count ให้เติมแบบสุ่ม
    while (out.length < count && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(i,1)[0]);
    }
    return out;
  }

  _pickIndex(arr, predicate) {
    const cand = [];
    for (let i=0;i<arr.length;i++) if (predicate(arr[i])) cand.push(i);
    if (cand.length) return cand[Math.floor(Math.random()*cand.length)];
    return Math.floor(Math.random()*arr.length);
  }

  _updateNoJunk() {
    for (const q of this.quests) {
      if (q.type === 'nojunk') {
        const seconds = Math.max(0, this.elapsed - this.lastJunkAt);
        q.prog = Math.min(q.target, Math.max(q.prog, seconds));
      }
    }
  }

  _checkComplete() {
    let newlyCleared = 0;
    for (const q of this.quests) {
      const ok = (q.type === 'mission') ? (q.prog >= 1) : (q.prog >= q.target);
      if (!q._done && ok) {
        q._done = true;
        newlyCleared++;
        this._play(this.audio?.coach_quest, 'quest'); // เสียงแจ้งเควสเสร็จ
        this._emit('quest', { id:q.id, type:q.type, prog:q.prog, target:(q.type==='mission'?1:q.target) });
      }
    }
    if (newlyCleared > 0) this._render();
    return newlyCleared;
  }

  _render() {
    const els = [this.hud?.tQ1, this.hud?.tQ2, this.hud?.tQ3];
    for (let i = 0; i < 3; i++) {
      const q = this.quests[i];
      const el = els[i];
      if (!el) continue;

      if (!q) { this._setText(el, ''); continue; }

      const mark = q._done ? this.i18n.markDone : this.i18n.markTodo;
      const tgt = (q.type === 'mission') ? 1 : q.target;
      const showProg = (q.type !== 'mission');
      const prog = showProg ? ` (${Math.min(q.prog, tgt)}/${tgt})` : '';
      this._setText(el, `${mark} ${q.label}${prog}`);
    }

    // ถ้าทำครบทั้ง 3 ข้อ → cheer (ครั้งเดียว)
    if (!this._shownClearCheer && this.quests.length && this.quests.every(q => q._done)) {
      this._play(this.audio?.coach_clear, 'clear');
      this._shownClearCheer = true;
      this._emit('clear', { elapsed: this.elapsed });
    }
  }

  _setText(el, text) {
    // รองรับทั้ง troika-text ('value') และ textContent
    try {
      if (el.hasAttribute && el.hasAttribute('troika-text')) {
        el.setAttribute('troika-text', 'value', text);
      } else if (el.setAttribute) {
        // A-Frame <a-entity text="value: ..."> กรณีใช้ text component ธรรมดา
        if (el.hasAttribute && el.getAttribute('text') != null) {
          const cur = el.getAttribute('text');
          // ป้องกันทับค่าคอนฟิกอื่น ๆ
          const next = (typeof cur === 'object') ? {...cur, value: text} : { value: text };
          el.setAttribute('text', next);
        } else {
          el.setAttribute('value', text);
        }
      } else if ('textContent' in el) {
        el.textContent = text;
      }
    } catch {
      // เงียบอย่างนุ่มนวล
      try { el.textContent = text; } catch {}
    }
  }

  _play(node, tag = null) {
    // node: A-Frame entity ที่มี components.sound
    try {
      const s = node?.components?.sound;
      if (s && typeof s.playSound === 'function') s.playSound();
      else if (node && typeof node.play === 'function') node.play(); // เผื่อ HTMLAudioElement
      if (tag) this._emit('sfx', { tag });
    } catch { /* no-op */ }
  }

  _brief() {
    return this.quests.slice(0,3).map(q => ({
      id:q.id, type:q.type, target:(q.type==='mission'?1:q.target)
    }));
  }

  _emit(type, detail) {
    try {
      window.dispatchEvent(new CustomEvent('hha:miniquest', { detail:{ type, ...detail } }));
    } catch {}
  }
}

try { window.__MINIQUEST_OK = true; } catch(e) {}
export default MiniQuest;
