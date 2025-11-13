// === /HeroHealth/vr/ui-coach.js (Coach bubble under Fever bar) ===
export function ensureCoach(dock){
  const ID = 'hha-coach-wrap';
  if (document.getElementById(ID)) return window.Coach;

  // CSS
  if(!document.getElementById('hha-coach-css')){
    const css = document.createElement('style'); css.id='hha-coach-css';
    css.textContent = `
    #${ID}{margin-top:10px; pointer-events:none;}
    #${ID} .coach{
      display:flex; align-items:center; gap:10px;
      background:#0b1220cc; border:1px solid #334155; border-radius:12px;
      padding:8px 10px; color:#e2e8f0; box-shadow:0 6px 20px rgba(0,0,0,.35);
    }
    #${ID} .av{
      width:28px; height:28px; border-radius:999px; background:#1f2937; display:grid; place-items:center;
      box-shadow:0 2px 8px rgba(0,0,0,.4); font-size:18px;
    }
    #${ID} .tx{font:800 12px system-ui; line-height:1.3}
    #${ID}.show{animation:coachIn .25s ease}
    @keyframes coachIn{from{opacity:0; transform:translateY(4px)} to{opacity:1; transform:translateY(0)}}
    `;
    document.head.appendChild(css);
  }

  // host
  const host = dock || document.getElementById('feverBarDock') || document.getElementById('hudTop') || document.body;
  const wrap = document.createElement('div'); wrap.id = ID;
  wrap.innerHTML = `<div class="coach"><div class="av">🧑‍⚕️</div><div class="tx" id="coachTx">พร้อมลุย!</div></div>`;
  host.appendChild(wrap);

  // tiny queue
  let t=null;
  function say(msg){
    const el = document.getElementById('coachTx'); if(!el) return;
    el.textContent = String(msg||'');
    wrap.classList.remove('show'); void wrap.offsetWidth; // reflow
    wrap.classList.add('show');
    clearTimeout(t); t=setTimeout(()=>wrap.classList.remove('show'), 2200);
  }

  // expose
  window.Coach = { say };
  return window.Coach;
}
export default { ensureCoach };