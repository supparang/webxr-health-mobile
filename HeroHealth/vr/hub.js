// === Hero Health VR — GameHub (robust orchestrator) ===
// คุณสมบัติ:
// • อ่าน ?mode=&goal=&duration=&difficulty= จาก URL (มีค่า default)
// • สร้าง #spawnZone อัตโนมัติถ้าไม่มี
// • อัปเดต HUD (troika-text) ให้เอง ถ้าไม่มี troika-text จะข้ามอย่างนุ่มนวล
// • จัดการ pause/resume จาก blur/visibilitychange และ custom events (hha:pause/resume)
// • โหลดโหมดด้วย retry + cache-busting และรองรับ inline fallback
// • จบเกมแล้วคืน UI (menu, start panel) และรีเซ็ตสถานะ

export class GameHub {
  constructor() {
    // --- URL params ---
    const q = new URLSearchParams(location.search);
    this.mode       = q.get('mode') || null;               // จะ set ชัดเจนภายหลัง
    this.goal       = num(q.get('goal'), 40);              // เป้าคะแนน/ชิ้น (ตามเกมกำหนด)
    this.duration   = num(q.get('duration'), 60);          // วินาที
    this.difficulty = q.get('difficulty') || 'normal';     // easy|normal|hard

    // --- DOM bindings (สร้างถ้าไม่มี) ---
    this.spawnHost = document.getElementById('spawnZone') || this._ensureSpawnHost();
    this.questPanel = document.getElementById('questPanel') || null;
    this.hudRoot    = document.getElementById('hudRoot') || document.body;

    this.menu       = document.getElementById('modeMenu') || null;
    this.startPanel = document.getElementById('startPanel') || null;
    this.startLbl   = document.getElementById('startLbl') || null;
    this.bootBox    = document.getElementById('bootStatus') || null;

    this.current = null;
    this.running = false;
    this._boundVis = null;

    this._showBoot('Hub ready');
    this._bindPause();
    this._bindVisibility();

    // ถ้ามี mode มาจาก URL ให้ select เลย
    if (this.mode) this.selectMode(this.mode);
  }

  // ---------- Public API ----------
  selectMode(mode) {
    this.mode = mode || 'goodjunk';

    // อัปเดตหัว HUD ถ้ามี troika-text
    const heads = (this.hudRoot?.querySelectorAll?.('a-entity[troika-text]')) || [];
    if (heads.length) {
      safeSetTroikaText(heads[0], 'โหมด: ' + this.mode);
    }
    if (this.startLbl) {
      safeSetTroikaText(this.startLbl, 'เริ่ม: ' + this.mode.toUpperCase());
    }
    if (this.startPanel) this.startPanel.setAttribute('visible', true);
    if (this.menu) this.menu.setAttribute('visible', false);
  }

  async startGame() {
    if (this.running) return;
    this.running = true;

    // ซ่อน UI
    if (this.menu) this.menu.setAttribute('visible', false);
    if (this.startPanel) this.startPanel.setAttribute('visible', false);

    // เปิด Quest panel + ข้อความเริ่มต้น
    if (this.questPanel) {
      this.questPanel.setAttribute('visible', true);
      const tQ = document.getElementById('tQ');
      if (tQ) safeSetTroikaText(tQ, 'สุ่มมิชชัน 3 อย่าง / เก็บแต้มให้ถึงเป้า!');
    }

    const mode = this.mode || 'goodjunk';
    const moduleMap = {
      goodjunk : './modes/goodjunk.safe.js',
      groups   : './modes/groups.js',
      hydration: './modes/hydration.js',
      plate    : './modes/plate.js'
    };
    const rel = moduleMap[mode] || moduleMap.goodjunk;

    // สร้าง URL อย่างปลอดภัย (relative กับไฟล์นี้)
    const url = new URL(rel, import.meta.url).toString();

    // โหลดโหมดด้วย retry เบา ๆ
    const mod = await this._importWithRetry(url, 2).catch(()=>null);

    if (mod && typeof mod.boot === 'function') {
      this._showBoot(`Loaded mode: ${mode}`);
      // สร้างตัวควบคุมจากโหมด
      const api = await mod.boot({
        host: this.spawnHost,
        duration: this.duration,
        difficulty: this.difficulty,
        goal: this.goal,
        // สื่อสารกลับ Hub (ถ้าจำเป็น)
        emit: (type, detail)=>window.dispatchEvent(new CustomEvent(`hha:${type}`, {detail}))
      });

      this.current = api || {};

      // ฟังจบเกมจากโหมด (สองทาง: event หรือสัญญา stop())
      const onEnd = (e)=>{
        // e.detail: {reason:'win'|'timeout'|'quit', score, stats?}
        this._endGame(e?.detail || {reason:'done'});
      };
      window.addEventListener('hha:end', onEnd, {once:true});

    } else {
      console.warn('Mode import failed, using inline fallback');
      this._showBoot('Mode import failed → Inline fallback');
      if (window.inlineGoodJunkBoot) {
        window.inlineGoodJunkBoot({
          host: this.spawnHost,
          duration: this.duration,
          difficulty: this.difficulty,
          goal: this.goal
        });
        // ให้ fallback ส่ง end เองเมื่อครบเวลา/ถึงเป้า
        window.addEventListener('hha:end', (e)=>this._endGame(e?.detail||{reason:'done'}), {once:true});
      } else {
        this._showBoot('No fallback available.');
        this._endGame({reason:'failed'});
      }
    }
  }

  // ---------- Internals ----------
  _ensureSpawnHost() {
    const host = document.createElement('div');
    host.id = 'spawnZone';
    // สำหรับ DOM-based spawn (non-A-Frame) ให้ครอบเต็ม
    Object.assign(host.style, {
      position:'absolute', inset:'0', pointerEvents:'none'
    });
    (document.querySelector('.game-wrap') || document.body).appendChild(host);
    return host;
  }

  _showBoot(msg) {
    if (this.bootBox && this.bootBox.firstElementChild) {
      this.bootBox.firstElementChild.innerHTML = `<strong>Status:</strong> ${escapeHtml(msg)}`;
    } else {
      // เผื่อไม่มีกล่อง boot
      console.log('[Hub]', msg);
    }
  }

  _bindPause() {
    window.addEventListener('hha:pause', ()=>{
      if (this.current?.pause) safeCall(this.current, 'pause');
    });
    window.addEventListener('hha:resume', ()=>{
      if (this.current?.resume) safeCall(this.current, 'resume');
    });
  }

  _bindVisibility() {
    // Pause เมื่อออกนอกหน้า / blur
    const pauseLike = ()=>window.dispatchEvent(new Event('hha:pause'));
    const resumeLike = ()=>window.dispatchEvent(new Event('hha:resume'));

    this._boundVis = ()=>{
      if (document.hidden) pauseLike();
      else resumeLike();
    };
    document.addEventListener('visibilitychange', this._boundVis);
    window.addEventListener('blur', pauseLike);
    window.addEventListener('focus', resumeLike);
  }

  async _importWithRetry(url, retries=1) {
    let lastErr;
    for (let i=0;i<=retries;i++){
      try{
        // bust cache เฉพาะตอน dev
        const u = new URL(url);
        u.searchParams.set('v', Date.now().toString());
        return await import(u.toString());
      } catch (e) {
        lastErr = e;
        this._showBoot(`Load failed (${i+1}/${retries+1}): ${e.message||e}`);
        await sleep(200); // หน่วงสั้น ๆ
      }
    }
    throw lastErr;
  }

  async _endGame(detail) {
    // หยุดโหมดปัจจุบัน
    try { this.current?.pause?.(); } catch {}
    try { await this.current?.stop?.(); } catch {}

    this.current = null;
    this.running = false;

    // คืน UI
    if (this.menu) this.menu.setAttribute('visible', true);
    if (this.startPanel) this.startPanel.setAttribute('visible', true);

    // แจ้งผลบน HUD ถ้ามี
    const resultLbl = document.getElementById('resultLbl');
    if (resultLbl) {
      const txt = (detail?.reason==='win')
        ? `จบเกม: ชนะ! คะแนน ${detail?.score ?? '-'}`
        : (detail?.reason==='timeout')
          ? `จบเกม: หมดเวลา คะแนน ${detail?.score ?? '-'}`
          : `จบเกม`;
      safeSetTroikaText(resultLbl, txt);
      resultLbl.setAttribute('visible', true);
    }

    this._showBoot(`Ended (${detail?.reason||'done'})`);
  }
}

// ---------- helpers ----------
function num(n, d){ n = Number(n); return Number.isFinite(n) ? n : d; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function safeSetTroikaText(el, value){
  try { el.setAttribute('troika-text', 'value', String(value)); }
  catch { /* ไม่มี troika-text ก็ข้ามไป */ }
}
function safeCall(obj, fn){ try { return obj[fn](); } catch { return undefined; } }
function escapeHtml(s){
  return String(s).replace(/[&<>'"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'" :'&#39;','"':'&quot;' }[c]));
}
