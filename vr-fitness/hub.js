// ----- Config: เส้นทางเกม (ใช้ path จริงของโปรเจกต์คุณ) -----
const GAME_URLS = {
  "shadow-breaker": "/webxr-health-mobile/vr-fitness/games/shadow-breaker/play.html",
  "rhythm-boxer":   "/webxr-health-mobile/vr-fitness/games/rhythm-boxer/play.html",
  "jump-duck":      "/webxr-health-mobile/vr-fitness/games/jump-duck/play.html",
  "balance-hold":   "/webxr-health-mobile/vr-fitness/games/balance-hold/play.html"
};
// ถ้าโครงสร้างคุณต่างจากนี้ ให้แก้ path ให้ตรง

// ----- Elements -----
const $ = (s)=>document.querySelector(s);
const hubEl    = $("#hub");
const stageEl  = $("#stage");
const frameEl  = $("#gameFrame");
const backBtn  = $("#btnBack");
const overlay  = $("#overlay");
const result   = $("#resultModal");
const rGame = $("#rGame"), rScore=$("#rScore"), rCombo=$("#rCombo"), rStars=$("#rStars"), rTime=$("#rTime");
const btnRetry = $("#btnRetry"), btnClose=$("#btnClose");

// ----- State -----
let currentGame = null;
let lastStartURL = null;
let audioUnlocked = false;

// ----- Helpers -----
function getControlsFor(game){
  switch(game){
    case "shadow-breaker":
      return {
        diff: document.querySelector('[data-name="diff-sb"]').value,
        time: clampNum(document.querySelector('[data-name="time-sb"]').value, 30, 180, 90)
      };
    case "rhythm-boxer":
      return {
        diff: document.querySelector('[data-name="diff-rb"]').value,
        time: clampNum(document.querySelector('[data-name="time-rb"]').value, 45, 180, 85)
      };
    case "jump-duck":
      return {
        diff: document.querySelector('[data-name="diff-jd"]').value,
        time: clampNum(document.querySelector('[data-name="time-jd"]').value, 45, 180, 80)
      };
    case "balance-hold":
      return {
        diff: document.querySelector('[data-name="diff-bh"]').value,
        time: clampNum(document.querySelector('[data-name="time-bh"]').value, 30, 180, 75)
      };
  }
  return { diff:"normal", time:90 };
}

function clampNum(v,min,max,def){ v = +v; if(Number.isNaN(v)) return def; return Math.max(min, Math.min(max, v)); }

function buildURL(game){
  const base = GAME_URLS[game];
  const { diff, time } = getControlsFor(game);
  // รองรับพารามิเตอร์มาตรฐานของเกม (ปรับให้เข้ากับเกมจริงของคุณได้)
  const q = new URLSearchParams({ game, mode:"timed", diff, time:String(time) });
  return `${base}?${q.toString()}`;
}

function showHub(){
  stageEl.classList.add("hidden");
  hubEl.classList.remove("hidden");
  backBtn.classList.add("hidden");
  currentGame = null;
  frameEl.removeAttribute("src");
  overlay.style.display = "none";
  if(result.open) result.close();
}

function showStage(){
  hubEl.classList.add("hidden");
  stageEl.classList.remove("hidden");
  backBtn.classList.remove("hidden");
}

// ป้องกันเสียงไม่เล่น (Autoplay Guard) — ปลดล็อก AudioContext หลังคลิกปุ่ม Play ครั้งแรก
function unlockAudioOnce(){
  if (audioUnlocked) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    osc.connect(ac.destination);
    osc.start();
    osc.stop();
    setTimeout(()=>ac.close(), 50);
    audioUnlocked = true;
  } catch(e){}
}

// ส่ง pause เข้ากรอบเกม
function postPause(toPause=true){
  if(!frameEl.contentWindow) return;
  frameEl.contentWindow.postMessage({ type:"hub:pause", value: !!toPause }, "*");
}

// ----- Event Handlers -----
document.addEventListener("click", (ev)=>{
  const a = ev.target.closest("[data-action]");
  if(!a) return;

  // ปุ่มเล่น
  if(a.dataset.action === "play"){
    const game = a.dataset.game;
    currentGame = game;
    const url = buildURL(game);
    lastStartURL = url;
    unlockAudioOnce();
    frameEl.src = url;
    showStage();
  }

  // ปุ่ม Back
  if(a.dataset.action === "back"){
    showHub();
  }
});

// Pause on blur (สลับแอป/แท็บ)
window.addEventListener("blur", ()=> {
  if(currentGame) {
    overlay.style.display = "flex";
    postPause(true);
  }
});
window.addEventListener("focus", ()=> {
  if(currentGame) {
    overlay.style.display = "none";
    postPause(false);
  }
});

// รับ event จากเกม (score tick / end / ready)
window.addEventListener("message", (ev)=>{
  const msg = ev.data || {};
  if(!msg.type) return;

  if(msg.type === "game:ready"){
    // เกมโหลดพร้อม
    overlay.style.display = "none";
  }

  if(msg.type === "game:score"){
    // คุณจะเอาไปโชว์ HUD แบบสดๆ ที่ overlay ก็ได้
    // msg = { type:'game:score', score, combo, timeLeft, stars }
  }

  if(msg.type === "game:end"){
    // แสดงผลลัพธ์
    rGame.textContent  = currentGame || "-";
    rScore.textContent = msg.score ?? 0;
    rCombo.textContent = msg.maxCombo ?? 0;
    rStars.textContent = msg.stars ?? 0;
    rTime.textContent  = (msg.time ?? 0) + "s";
    if(!result.open) result.showModal();
  }
});

// ปุ่มใน Result Modal
btnRetry.addEventListener("click", ()=>{
  if(lastStartURL){
    frameEl.src = lastStartURL; // reset state ด้วยการรีโหลด
    overlay.style.display = "none";
    result.close();
  }
});
btnClose.addEventListener("click", ()=>{
  result.close();
});

// เริ่มต้นที่ Hub
showHub();
