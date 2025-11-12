// === /HeroHealth/game/main.js (2025-11-12 hybrid SAFE+QUEST support) ===
console.log("[main] boot");

(async function () {
  const qs   = new URLSearchParams(location.search);
  let MODE   = (qs.get("mode") || "goodjunk").toLowerCase();
  const DIFF = (qs.get("diff") || "normal").toLowerCase();
  const AUTO = qs.get("autostart") === "1";
  const DURATION = 60;

  // ---------- HUD refs ----------
  const elScore = document.getElementById("hudScore");
  const elCombo = document.getElementById("hudCombo");
  const elFeverDock = document.getElementById("feverBarDock");
  let score=0, combo=0, maxCombo=0, misses=0;

  // ---------- Map ไฟล์ของแต่ละโหมด ----------
  // safe = เกมพื้นฐาน, quest = ภารกิจเฉพาะ
  const MODE_FILE = {
    goodjunk : "goodjunk.safe.js",
    groups   : "groups.safe.js",
    hydration: "hydration.quest.js",
    plate    : "plate.quest.js"
  };

  const MODES_BASE = new URL("../modes/", import.meta.url).href;

  function modeUrl(mode){
    const file = MODE_FILE[mode] || MODE_FILE.goodjunk;
    return `${MODES_BASE}${file}?v=${Date.now()}`;
  }

  // ---------- import mode / fallback ----------
  async function importModeOrFallback(mode){
    const url = modeUrl(mode);
    try{
      console.log("[main] importing:", url);
      const mod = await import(url);
      return mod.boot || (mod.default && mod.default.boot);
    }catch(e){
      console.warn("[main] import failed for", mode, e);
      if (mode !== "goodjunk"){
        alert(`โหมด ${mode} ยังไม่พร้อม ใช้โหมด Good vs Junk แทน`);
        MODE = "goodjunk";
        const mod2 = await import(modeUrl("goodjunk"));
        return mod2.boot || (mod2.default && mod2.default.boot);
      }
      throw e;
    }
  }

  // ---------- HUD ----------
  function upd(){ if(elScore) elScore.textContent = score.toLocaleString(); if(elCombo) elCombo.textContent = combo; }
  function miss(){ misses++; combo=0; upd(); }
  function add(delta){ score+=delta; combo++; maxCombo=Math.max(maxCombo,combo); upd(); }

  function ensureTimerBar(){
    let bar = elFeverDock?.querySelector("progress");
    if(!bar && elFeverDock){
      bar = document.createElement("progress");
      bar.max = DURATION; bar.value = 0;
      bar.style.width="100%"; bar.style.height="8px"; bar.style.accentColor="#3b82f6";
      elFeverDock.appendChild(bar);
    }
    return bar;
  }
  function onTime(e){
    const sec = e?.detail?.sec ?? DURATION;
    const bar = ensureTimerBar();
    if(bar) bar.value = (DURATION - sec);
  }

  // ---------- Result ----------
  function showResult(){
    const old=document.getElementById("resultOverlay"); if(old) old.remove();
    const o=document.createElement("div"); o.id="resultOverlay";
    o.innerHTML=`
      <div class="card">
        <h2>สรุปผล: ${MODE} (${DIFF})</h2>
        <div class="grid">
          <div><b>คะแนนรวม</b><div>${score.toLocaleString()}</div></div>
          <div><b>คอมโบสูงสุด</b><div>${maxCombo}</div></div>
          <div><b>พลาด</b><div>${misses}</div></div>
          <div><b>เวลา</b><div>${DURATION}s</div></div>
        </div>
        <div class="btns">
          <button id="btnRetry">เล่นอีกครั้ง</button>
          <button id="btnHub">กลับ Hub</button>
        </div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector("#btnRetry").onclick = ()=>location.reload();
    o.querySelector("#btnHub").onclick   = ()=>location.href="./hub.html";
    const css=document.createElement("style"); css.textContent=`
      #resultOverlay{position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:999}
      #resultOverlay .card{background:#0f172a;color:#fff;border-radius:16px;box-shadow:0 10px 30px #0009;padding:22px;min-width:280px}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:12px 0}
      .btns{display:flex;gap:12px;justify-content:center;margin-top:10px}
      .btns button{padding:8px 14px;border:0;border-radius:10px;font-weight:700;cursor:pointer}
      #btnRetry{background:#22c55e;color:#fff} #btnHub{background:#3b82f6;color:#fff}
    `; document.head.appendChild(css);
  }

  // ---------- start ----------
  async function start(){
    const boot = await importModeOrFallback(MODE);

    window.addEventListener("hha:score",   (e)=>add(e.detail?.delta||0));
    window.addEventListener("hha:expired", ()=>miss());
    window.addEventListener("hha:time",    onTime);
    window.addEventListener("hha:end",     ()=>showResult());

    const ctrl = await boot({
      duration: DURATION,
      difficulty: DIFF,
      onExpire: ()=>miss(),
      judge: (ch,info)=>({good: !!info.isGood, scoreDelta: info.isGood?20:-10})
    });
    ctrl.start();
  }

  if (AUTO) start();
})();