// === Hero Health Academy — game/main.js (quests scaling & fever wiring) ===
window.__HHA_BOOT_OK = 'main';
(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;this.combo=0;this.bestCombo=0;} add(n=0){this.value+=n;} get(){return this.value|0;} reset(){this.value=0;this.combo=0;this.bestCombo=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ constructor(){this.enabled=true;} setEnabled(v){this.enabled=!!v;} isEnabled(){return !!this.enabled} good(){} bad(){} perfect(){} power(){} tick(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch { CoachClass = class { constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); } onStart(){ hud.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); } onGood(){ hud.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); } onPerfect(){ hud.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); } onBad(){ hud.say(this.lang==='EN'?'Watch out!':'ระวัง!'); } onTimeLow(){ hud.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); } onEnd(score){ hud.say((score|0)>=200?(this.lang==='EN'?'Awesome!':'สุดยอด!'):(this.lang==='EN'?'Nice!':'ดีมาก!')); } }; }
  }

  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key) {
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name || key,
      create: mod.create || null,
