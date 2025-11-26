// === js/dom-renderer-rb.js — Rhythm Boxer DOM renderer (2025-11-30a) ===
'use strict';

(function () {

  class RbDomRenderer {
    /**
     * lanesEl  : element ของ .rb-lanes (มี .rb-lane 5 ช่อง)
     * opts     : callback เสริม
     *    - onScorePop({x,y,kind})  ถ้าอยาก override popup เอง
     */
    constructor(lanesEl, opts = {}) {
      this.lanesEl = lanesEl;
      this.opts = opts;
      this.notes = new Map(); // id -> { el, lane }
    }

    /** สร้างโน้ตใหม่ใน lane ที่กำหนด */
    createNote(id, laneIndex, emoji) {
      if (!this.lanesEl) return;
      const laneEl = this.lanesEl.querySelector(
        `.rb-lane[data-lane="${laneIndex}"]`
      );
      if (!laneEl) return;

      const noteEl = document.createElement('div');
      noteEl.className = 'rb-note rb-note-spawned';

      const inner = document.createElement('div');
      inner.className = 'rb-note-inner';
      inner.textContent = emoji || '🎵';
      noteEl.appendChild(inner);

      laneEl.appendChild(noteEl);
      this.notes.set(id, { el: noteEl, lane: laneIndex });
    }

    /** ปรับตำแหน่ง Y ของโน้ต (หน่วย px จากด้านบนของ lane) */
    updateNoteY(id, yPx) {
      const rec = this.notes.get(id);
      if (!rec || !rec.el) return;
      // translateX(-50%) เพื่อให้กลาง lane, translateY ใช้ yPx
      rec.el.style.transform = `translate(-50%, ${yPx}px)`;
    }

    /** ลบโน้ต พร้อม effect เล็กน้อยถ้าตีโดน */
    removeNote(id, reason = 'hit') {
      const rec = this.notes.get(id);
      if (!rec || !rec.el) return;

      if (reason === 'hit') {
        rec.el.classList.add('rb-note-hit');
        setTimeout(() => rec.el && rec.el.remove(), 160);
      } else {
        rec.el.remove();
      }

      this.notes.delete(id);
    }

    /**
     * เอฟเฟกต์ตอนตี (คะแนนเด้ง + เศษกระจาย)
     * kind: 'perfect' | 'great' | 'good' | 'miss' | 'bomb'
     */
    playHitFx(id, kind = 'good') {
      const rec = this.notes.get(id);
      if (!rec || !rec.el) return;

      const r = rec.el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;

      // 1) score popup
      if (this.opts.onScorePop) {
        this.opts.onScorePop({ x, y, kind });
      } else {
        this._defaultScorePop(x, y, kind);
      }

      // 2) particle shards แบบ Shadow Breaker
      const host = document.getElementById('rb-field');
      if (host && window.Particles?.burstHit) {
        const emoji =
          kind === 'perfect' ? '✨' :
          kind === 'great'   ? '⭐' :
          kind === 'good'    ? '🎶' :
          kind === 'miss'    ? '💥' : '💣';

        window.Particles.burstHit(host, { x, y }, {
          emoji,
          count: kind === 'perfect' ? 10 : 6,
          spread: 48,
          lifeMs: 520,
          className: 'rb-hit-particle'
        });
      }
    }

    _defaultScorePop(x, y, kind) {
      const host = document.getElementById('rb-field');
      if (!host) return;

      const pop = document.createElement('div');
      pop.className = 'rb-score-popup';

      if (kind === 'perfect') pop.classList.add('rb-score-perfect');
      else if (kind === 'great') pop.classList.add('rb-score-great');
      else if (kind === 'good') pop.classList.add('rb-score-good');
      else if (kind === 'miss') pop.classList.add('rb-score-miss');
      else if (kind === 'bomb') pop.classList.add('rb-score-bomb');

      pop.style.left = x + 'px';
      pop.style.top = (y - 40) + 'px';

      let label = kind.toUpperCase();
      if (kind === 'perfect') label = 'PERFECT';
      else if (kind === 'great') label = 'GREAT';
      else if (kind === 'good') label = 'GOOD';
      else if (kind === 'miss') label = 'MISS';
      else if (kind === 'bomb') label = 'BOMB';

      pop.textContent = label;
      host.appendChild(pop);
      setTimeout(() => pop.remove(), 650);
    }
  }

  // ⭐ ผูกไว้บน window เพื่อให้ new window.RbDomRenderer(...) ใช้งานได้
  window.RbDomRenderer = RbDomRenderer;

})();
