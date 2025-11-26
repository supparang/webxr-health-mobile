// === js/dom-renderer-rb.js — Rhythm Boxer DOM renderer + FX (2025-11-30) ===
'use strict';

(function () {

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  class RbDomRenderer {
    constructor(fieldEl, opts = {}) {
      this.field = fieldEl || document.body;
      this.wrap  = opts.wrapEl || document.body;
      this.flashEl    = opts.flashEl || null;
      this.feedbackEl = opts.feedbackEl || null;

      this.noteMap = new Map();  // id → note.el
      this.preSpawnSec = 2.0;
    }

    setPreSpawn(seconds) {
      this.preSpawnSec = seconds || 2.0;
    }

    // สำหรับสร้างโน้ตใหม่
    spawnNote(note) {
      if (!this.field || !note) return;

      const laneEl = document.querySelector(`.rb-lane[data-lane="${note.lane}"]`);
      if (!laneEl) return;

      const el = document.createElement('div');
      el.className = 'rb-note rb-note-spawned';

      const inner = document.createElement('div');
      inner.className = 'rb-note-inner';
      inner.textContent = this._emojiForLane(note.lane);
      el.appendChild(inner);

      laneEl.appendChild(el);

      this.noteMap.set(note.id, el);
      note.el = el;
    }

    removeNote(noteId) {
      const el = this.noteMap.get(noteId);
      if (!el) return;
      el.remove();
      this.noteMap.delete(noteId);
    }

    // อัปเดตตำแหน่งของโน้ตทั้งหมดตาม songTime
    updatePositions(notes, songTime, preSpawnSec) {
      if (!this.field || !notes) return;
      const rect = this.field.getBoundingClientRect();
      const h    = rect.height || 1;
      const travel = h * 0.85; // ระยะจากบนลงมาถึงเส้นตี
      const pre  = preSpawnSec || this.preSpawnSec;

      for (const n of notes) {
        if (!n.el || n.removed) continue;
        const dt = n.time - songTime;      // เวลาที่เหลือก่อนถึงจังหวะ
        const progress = 1 - dt / pre;     // 0 → spawn, 1 → ถึงเส้นตี
        const p = clamp(progress, 0, 1.2);

        const y = (1 - p) * -travel;       // เริ่มสูงกว่าจอ แล้วค่อย ๆ ลงมาที่ 0

        n.el.style.transform = `translate(-50%, ${y}px)`;
        n.el.style.opacity = p <= 1.0 ? 1 : clamp(1.2 - p, 0, 1);
      }
    }

    // เอฟเฟกต์ popup คะแนน + ข้อความใต้หัว
    playHitPopup(grade, scoreDelta) {
      if (!this.field) return;
      const popup = document.createElement('div');
      popup.className = 'rb-score-popup';

      let cls = '';
      let label = '';
      if (grade === 'perfect') {
        cls = 'rb-score-perfect';
        label = `PERFECT +${scoreDelta}`;
      } else if (grade === 'great') {
        cls = 'rb-score-great';
        label = `GREAT +${scoreDelta}`;
      } else if (grade === 'good') {
        cls = 'rb-score-good';
        label = `GOOD +${scoreDelta}`;
      } else if (grade === 'bomb') {
        cls = 'rb-score-bomb';
        label = 'BOMB!';
      } else if (grade === 'shield') {
        cls = 'rb-score-shield';
        label = `SHIELD +${scoreDelta}`;
      } else if (grade === 'miss') {
        cls = 'rb-score-miss';
        label = 'MISS';
      } else {
        label = `+${scoreDelta}`;
      }

      if (cls) popup.classList.add(cls);
      popup.textContent = label;

      // ตำแหน่งกลางจอ field
      popup.style.left = '50%';
      popup.style.bottom = '80px';

      this.field.appendChild(popup);
      setTimeout(() => popup.remove(), 650);
    }

    // flash ตอนโดน damage
    flashDamage() {
      if (!this.flashEl) return;
      this.flashEl.classList.add('active');
      setTimeout(() => {
        this.flashEl && this.flashEl.classList.remove('active');
      }, 140);
    }

    setFeedback(text, type) {
      if (!this.feedbackEl) return;
      this.feedbackEl.textContent = text;
      this.feedbackEl.className = 'rb-feedback';
      if (type === 'perfect') this.feedbackEl.classList.add('perfect');
      else if (type === 'good') this.feedbackEl.classList.add('good');
      else if (type === 'miss') this.feedbackEl.classList.add('miss');
      else if (type === 'bomb') this.feedbackEl.classList.add('bomb');
    }

    // เอฟเฟกต์ FEVER mode (ไฟลุกทั้งจอ)
    setFever(on) {
      if (!this.field) return;
      this.field.classList.toggle('rb-fever-on', !!on);
    }

    _emojiForLane(lane) {
      const arr = ['🎵', '🎶', '🎵', '🎶', '🎼'];
      return arr[lane] || '🎵';
    }
  }

  window.RbDomRenderer = RbDomRenderer;
})();
