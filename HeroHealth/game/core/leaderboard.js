// === Hero Health Academy — core/leaderboard.js (v2 hardened) ===
export class Leaderboard {
  constructor(opts = {}) {
    this.keyV2 = opts.key || 'hha_board_v2';
    this.keyLegacy = 'hha_board'; // for migration
    this.maxKeep = Math.max(50, opts.maxKeep || 500);      // เก็บสูงสุด
    this.retentionDays = Math.max(7, opts.retentionDays || 365); // อายุข้อมูล
    this._uidKey = 'hha_uid';
    this._uid = this._ensureUid();
    // migrate once
    this._migrateFromLegacy();
    // prune on init
    this._prune();
  }

  /* ================== Public API (backward-compatible) ================== */

  /**
   * submit(mode, diff, score, extras?)
   * extras: { name?: string, meta?: object }
   */
  submit(mode, diff, score, extras = {}) {
    try {
      const arr = this._load();
      const now = Date.now();
      const item = {
        v: 2,
        id: `${now.toString(36)}_${Math.random().toString(36).slice(2,7)}`,
        t: now,
        mode: String(mode || 'unknown'),
        diff: String(diff || 'Normal'),
        score: Number(score) || 0,
        uid: this._uid,                // ผูกกับเครื่อง/ผู้ใช้ (local)
        name: extras.name ? String(extras.name).slice(0, 24) : undefined,
        meta: (typeof extras.meta === 'object' && extras.meta) ? extras.meta : undefined
      };
      arr.push(item);
      // hard limits + save
      const trimmed = this._trim(arr);
      this._save(trimmed);
      return item;
    } catch {
      return null;
    }
  }

  /**
   * getTop(n=5, filter?)
   * filter: { mode?, diff?, since?: 'day'|'week'|'month'|'year'|'all'|number(ms), uniqueByUser?:boolean }
   * - ถ้าไม่ส่ง filter (เวอร์ชันเดิม) => คืน top รวมทั้งหมด n รายการ
   */
  getTop(n = 5, filter = {}) {
    try {
      const arr = this._filter(this._load(), filter);
      return arr
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, n));
    } catch {
      return [];
    }
  }

  /* ================== Extra helpers (optional to use) ================== */

  /** ส่งคืนสถิติอย่างเร็ว */
  stats(filter = {}) {
    const rows = this._filter(this._load(), filter);
    if (!rows.length) return { count: 0, avg: 0, max: 0, min: 0 };
    const scores = rows.map(r => r.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    return {
      count: rows.length,
      avg: +(sum / rows.length).toFixed(2),
      max: Math.max(...scores),
      min: Math.min(...scores)
    };
  }

  /** Top ล่าสุด (ตามเวลา) */
  getRecent(n = 10, filter = {}) {
    const rows = this._filter(this._load(), filter);
    return rows.sort((a, b) => b.t - a.t).slice(0, n);
  }

  /** personal best ของผู้เล่นปัจจุบัน (ตาม uid) */
  getPersonalBest({ mode, diff } = {}) {
    const me = this._load().filter(r =>
      r.uid === this._uid &&
      (mode ? r.mode === mode : 1) &&
      (diff ? r.diff === diff : 1)
    );
    if (!me.length) return null;
    return me.sort((a, b) => b.score - a.score)[0];
  }

  /** ลบทั้งหมด (ใช้ระวัง) */
  clearAll() {
    try { localStorage.removeItem(this.keyV2); } catch {}
  }

  /** export เป็น JSON string (สำหรับดาวน์โหลด/backup) */
  exportJSON(filter = {}) {
    const rows = this._filter(this._load(), filter);
    return JSON.stringify({ version: 2, exportedAt: Date.now(), rows }, null, 2);
  }

  /** import จาก JSON string (merge=true จะรวม, false จะทับ) */
  importJSON(json, { merge = true } = {}) {
    try {
      const parsed = JSON.parse(json);
      const rows = Array.isArray(parsed?.rows) ? parsed.rows : (Array.isArray(parsed) ? parsed : []);
      const normalized = rows.map(r => this._normalize(r)).filter(Boolean);
      const cur = merge ? this._load() : [];
      const merged = this._dedupe([...cur, ...normalized]);
      this._save(this._trim(merged));
      return merged.length;
    } catch {
      return 0;
    }
  }

  /* ================== Internals ================== */

  _load() {
    try {
      const raw = localStorage.getItem(this.keyV2);
      const arr = JSON.parse(raw || '[]');
      return Array.isArray(arr) ? arr.map(r => this._normalize(r)).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  _save(arr) {
    try { localStorage.setItem(this.keyV2, JSON.stringify(arr)); } catch {}
  }

  _normalize(r) {
    if (!r) return null;
    // รองรับ legacy (v1) บางแบบ
    if (!r.v) {
      // v1 shape: { t, mode, diff, score }
      return {
        v: 2,
        id: `${(r.t||Date.now()).toString(36)}_${Math.random().toString(36).slice(2,7)}`,
        t: Number(r.t) || Date.now(),
        mode: String(r.mode || 'unknown'),
        diff: String(r.diff || 'Normal'),
        score: Number(r.score) || 0,
        uid: r.uid || this._uid,
        name: r.name,
        meta: r.meta
      };
    }
    return {
      v: 2,
      id: String(r.id || `${(r.t||Date.now()).toString(36)}_${Math.random().toString(36).slice(2,7)}`),
      t: Number(r.t) || Date.now(),
      mode: String(r.mode || 'unknown'),
      diff: String(r.diff || 'Normal'),
      score: Number(r.score) || 0,
      uid: r.uid || this._uid,
      name: r.name ? String(r.name).slice(0, 24) : undefined,
      meta: (typeof r.meta === 'object' && r.meta) ? r.meta : undefined
    };
  }

  _trim(arr) {
    // อายุข้อมูล
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    let out = arr.filter(r => (r.t || 0) >= cutoff);
    // จำกัดจำนวนสูงสุด (เก็บตัวสูงคะแนนไว้มากกว่า)
    if (out.length > this.maxKeep) {
      out = out
        .sort((a, b) => b.score - a.score || b.t - a.t)
        .slice(0, this.maxKeep)
        .concat(
          out
            .sort((a, b) => b.t - a.t) // ส่วน recent เผื่อความหลากหลาย
            .slice(0, Math.min(50, Math.floor(this.maxKeep * 0.1)))
        );
      // dedupe อีกครั้ง
      out = this._dedupe(out);
    }
    return out;
  }

  _filter(arr, filter = {}) {
    let rows = arr.slice();

    // by mode/diff
    if (filter.mode) rows = rows.filter(r => r.mode === filter.mode);
    if (filter.diff) rows = rows.filter(r => r.diff === filter.diff);

    // by time
    const since = this._sinceMs(filter.since);
    if (since > 0) {
      const cutoff = Date.now() - since;
      rows = rows.filter(r => r.t >= cutoff);
    }

    // unique by user (keep the best entry per uid)
    if (filter.uniqueByUser) {
      const bestMap = new Map();
      for (const r of rows) {
        const key = r.uid || 'anon';
        const cur = bestMap.get(key);
        if (!cur || r.score > cur.score) bestMap.set(key, r);
      }
      rows = [...bestMap.values()];
    }

    return rows;
  }

  _sinceMs(since) {
    if (!since || since === 'all') return 0;
    if (typeof since === 'number') return Math.max(0, since|0);
    const day = 24 * 60 * 60 * 1000;
    if (since === 'day') return day;
    if (since === 'week') return 7 * day;
    if (since === 'month') return 30 * day;
    if (since === 'year') return 365 * day;
    return 0;
    }

  _dedupe(arr) {
    // dedupe by id (ล่าสุดชนะ)
    const map = new Map();
    for (const r of arr) map.set(r.id, r);
    return [...map.values()];
  }

  _migrateFromLegacy() {
    try {
      const oldRaw = localStorage.getItem(this.keyLegacy);
      if (!oldRaw) return;
      const old = JSON.parse(oldRaw || '[]');
      if (!Array.isArray(old) || !old.length) return;
      const cur = this._load();
      const merged = this._dedupe([...cur, ...old.map(r => this._normalize(r)).filter(Boolean)]);
      this._save(this._trim(merged));
      // เก็บ legacy ไว้ก่อน (ไม่ลบทันที), หรือจะลบก็ได้:
      // localStorage.removeItem(this.keyLegacy);
    } catch {}
  }

  _ensureUid() {
    try {
      let uid = localStorage.getItem(this._uidKey);
      if (!uid) {
        uid = `U_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`;
        localStorage.setItem(this._uidKey, uid);
      }
      return uid;
    } catch {
      // fallback (ไม่มี localStorage): uid ชั่วคราว
      return `U_${Math.random().toString(36).slice(2,10)}`;
    }
  }
}
