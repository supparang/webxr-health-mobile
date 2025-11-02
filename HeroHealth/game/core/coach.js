// === core/coach.js (production; HUD-aware + fallback bubble + queue/ratelimit) ===
'use strict';

export class Coach {
  constructor({ lang='TH', rateMs=900, holdMs=1200 } = {}) {
    // Language
    this.lang = String(lang||'TH').toUpperCase();

    // Output targets
    this._hudApi = (typeof window!=='undefined' && window.__HHA_HUD_API) || null;

    // Rate-limit & queue
    this._rateMs = Math.max(200, rateMs|0);
    this._holdMs = Math.max(600, holdMs|0);
    this._lastAt = 0;
    this._queue = [];
    this._showing = false;

    // Ensure fallback bubble if HUD API not available
    this._ensureBubble();
  }

  /* ---------- low-level speak ---------- */
  _ensureBubble(){
    if (this._hudApi?.say) return; // HUD handles it

    this._box = document.getElementById('coachBox');
    if (!this._box) {
      const b = document.createElement('div');
      b.id = 'coachBox';
      b.style.cssText = [
        'position:fixed;right:12px;bottom:92px',
        'background:#0e1f3a;color:#e6f4ff;border:1px solid #1a3b6a',
        'border-radius:12px;padding:8px 10px;max-width:48ch',
        'box-shadow:0 10px 28px rgba(0,0,0,.45)',
        'pointer-events:auto;display:none;z-index:2001',
        'font:600 14px/1.35 ui-rounded,system-ui'
      ].join(';');
      document.body.appendChild(b);
      this._box = b;
    }
  }

  _displayNow(text) {
    if (this._hudApi?.say) {
      // Use HUD API if provided by HUD
      try { this._hudApi.say(String(text||'')); } catch {}
      return;
    }
    // Fallback bubble
    if (!this._box) this._ensureBubble();
    const el = this._box;
    el.textContent = String(text||'');
    el.style.display = 'block';
    clearTimeout(this._hideTO);
    this._hideTO = setTimeout(()=>{ el.style.display='none'; }, this._holdMs);
  }

  _enqueue(text) {
    const now = performance.now ? performance.now() : Date.now();
    // rate-limit: if last speak was too recent, push to queue
    if (now - this._lastAt < this._rateMs) {
      this._queue.push(String(text||''));
      if (!this._showing) this._drain();
      return;
    }
    this._lastAt = now;
    this._displayNow(text);
  }

  async _drain() {
    if (this._showing) return;
    this._showing = true;
    while (this._queue.length) {
      const msg = this._queue.shift();
      this._lastAt = performance.now ? performance.now() : Date.now();
      this._displayNow(msg);
      await new Promise(r=>setTimeout(r, this._holdMs));
    }
    this._showing = false;
  }

  say(m){ this._enqueue(m); }

  /* ---------- i18n helpers ---------- */
  _T(key, vars={}) {
    const en = {
      READY: 'Ready? Go!',
      NICE: '+Nice!',
      PERFECT: 'PERFECT!',
      WATCH: 'Watch out!',
      TIME10: '10s left—push!',
      QUEST: 'Quest: {t}',
      QUEST_DONE: 'Quest complete!',
      FEVER: 'FEVER TIME!',
      END_GOOD: 'Awesome!',
      END_OK: 'Nice!',
      PAUSE: 'Paused',
      RESUME: 'Resume',
      MISS: 'Miss!',
      JUNK: 'Oops!'
    };
    const th = {
      READY: 'พร้อมไหม? ลุย!',
      NICE: '+ดีมาก!',
      PERFECT: 'เป๊ะเว่อร์!',
      WATCH: 'ระวัง!',
      TIME10: 'เหลือ 10 วิ สุดแรง!',
      QUEST: 'ภารกิจ: {t}',
      QUEST_DONE: 'ภารกิจสำเร็จ!',
      FEVER: 'โหมดไฟลุก!',
      END_GOOD: 'สุดยอด!',
      END_OK: 'ดีมาก!',
      PAUSE: 'หยุดพัก',
      RESUME: 'เล่นต่อ',
      MISS: 'พลาด!',
      JUNK: 'เฮ้ย! ของไม่ดี'
    };
    const L = (this.lang==='EN') ? en : th;
    const raw = L[key] || key;
    return raw.replace(/\{(\w+)\}/g, (_,k)=> (vars[k]!=null?String(vars[k]):''));
  }

  /* ---------- high-level hooks (used by main/quests/modes) ---------- */
  onStart(){ this.say(this._T('READY')); }
  onGood(){ this.say(this._T('NICE')); }
  onPerfect(){ this.say(this._T('PERFECT')); }
  onBad(){ this.say(this._T('WATCH')); }
  onMiss(){ this.say(this._T('MISS')); }
  onJunk(){ this.say(this._T('JUNK')); }
  onTimeLow(){ this.say(this._T('TIME10')); }

  onQuestStart(label){ this.say(this._T('QUEST',{t:label||''})); }
  onQuestDone(){ this.say(this._T('QUEST_DONE')); }

  onFever(){ this.say(this._T('FEVER')); }

  onPause(){ this.say(this._T('PAUSE')); }
  onResume(){ this.say(this._T('RESUME')); }

  onEnd(score){
    const good = (score|0)>=200;
    this.say(good ? this._T('END_GOOD') : this._T('END_OK'));
  }
}
