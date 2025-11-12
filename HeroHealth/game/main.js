// === Hero Health VR main.js (A-Frame 1.4.2 stable) ===
import { GameHub } from '../hub.js';

// --------- Boot logic ---------
window.addEventListener('DOMContentLoaded', () => {
  console.log('[main] DOM ready');

  // HUD ready event
  const hudReady = () => {
    window.dispatchEvent(new CustomEvent('hha:hud-ready'));
    console.log('[main] HUD ready');
  };
  setTimeout(hudReady, 300);

  // parse params
  const p = new URLSearchParams(location.search);
  const mode = p.get('mode') || 'goodjunk';
  const diff = p.get('diff') || 'normal';
  const dur = parseInt(p.get('time') || '60', 10);
  console.log('[main] start mode', mode, diff, dur);

  // โหลดโหมดเกม
  import(`../modes/${mode}.safe.js`)
    .then(mod => mod.boot({ difficulty: diff, duration: dur }))
    .catch(e => console.error('[main] load mode failed', e));

  // จับ event สิ้นสุดเกม
  window.addEventListener('hha:end', e => showResult(e.detail));
});

// --------- Result Overlay ---------
function showResult(detail) {
  const old = document.getElementById('resultOverlay');
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = 'resultOverlay';
  wrap.innerHTML = `
    <div class="card">
      <h2>สรุปผล</h2>
      <div class="stats">
        <div>โหมด: ${detail.mode}</div>
        <div>ระดับ: ${detail.difficulty}</div>
        <div>คะแนน: ${detail.score.toLocaleString()}</div>
        <div>คอมโบสูงสุด: ${detail.comboMax}</div>
        <div>พลาด: ${detail.misses}</div>
        <div>เวลา: ${detail.duration}s</div>
        <div class="questBadge">QUESTS ${detail.questsCleared}/${detail.questsTotal}</div>
      </div>
      <div class="btns">
        <button id="btnHub">กลับ Hub</button>
        <button id="btnRetry">เล่นอีกครั้ง</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  const badge = wrap.querySelector('.questBadge');
  paintQuestBadge(badge, detail.questsCleared, detail.questsTotal);

  wrap.querySelector('#btnHub').onclick = () => {
    const url = `../hub.html?last=${detail.mode}&diff=${detail.difficulty}`;
    window.location.href = url;
  };
  wrap.querySelector('#btnRetry').onclick = () => location.reload();
}

// --------- Badge paint ---------
function paintQuestBadge(el, x, y) {
  const r = y ? x / y : 0;
  const color =
    r >= 1 ? '#16a34a' : r >= 0.5 ? '#f59e0b' : '#ef4444';
  const bg =
    r >= 1 ? '#16a34a22' : r >= 0.5 ? '#f59e0b22' : '#ef444422';
  const fg =
    r >= 1 ? '#bbf7d0' : r >= 0.5 ? '#fde68a' : '#fecaca';
  Object.assign(el.style, {
    borderColor: color,
    background: bg,
    color: fg,
  });
}

// --------- Style ---------
const css = document.createElement('style');
css.textContent = `
#resultOverlay {
  position:fixed; inset:0; background:rgba(0,0,0,.7);
  display:flex; align-items:center; justify-content:center;
  z-index:999;
}
#resultOverlay .card {
  background:#1e293b; border-radius:16px;
  padding:24px; min-width:280px; color:#fff;
  text-align:center; box-shadow:0 0 20px #000a;
}
.questBadge {
  margin-top:8px; padding:4px 8px;
  border:2px solid #444; border-radius:8px;
  display:inline-block; font-weight:600;
}
.btns { margin-top:16px; display:flex; justify-content:center; gap:12px; }
.btns button {
  padding:6px 12px; border-radius:8px;
  border:none; font-weight:600; cursor:pointer;
}
.btns #btnHub { background:#0f172a; color:#fff; }
.btns #btnRetry { background:#22c55e; color:#fff; }
`;
document.head.appendChild(css);
