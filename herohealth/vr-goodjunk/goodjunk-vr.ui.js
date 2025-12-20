// === /herohealth/vr-goodjunk/goodjunk-vr.ui.js ===
// UI helpers: coach, countdown, badges, celebration, DOM shortcuts

export function $(id){ return document.getElementById(id); }

export function clamp(v,min,max){
  v = Number(v)||0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
export function normDiff(v){
  v = String(v||'normal').toLowerCase();
  return (v==='easy'||v==='normal'||v==='hard') ? v : 'normal';
}
export function normCh(v){
  v = String(v||'rush').toLowerCase();
  return (v==='rush'||v==='boss'||v==='survival') ? v : 'rush';
}
export function normRun(v){
  v = String(v||'play').toLowerCase();
  return (v==='research') ? 'research' : 'play';
}

export function makeCoach(elCoachBubble, elCoachText, elCoachEmoji){
  const COACH_IMG = {
    neutral: './img/coach-neutral.png',
    happy:   './img/coach-happy.png',
    sad:     './img/coach-sad.png',
    fever:   './img/coach-fever.png'
  };

  let lastCoachTimeout = null;

  function setCoachFace(mood){
    const m = COACH_IMG[mood] ? mood : 'neutral';
    if (!elCoachEmoji) return;

    elCoachEmoji.style.backgroundImage = `url('${COACH_IMG[m]}')`;
    elCoachEmoji.classList.remove('coach-neutral','coach-happy','coach-sad','coach-fever');
    elCoachEmoji.classList.add('coach-' + m);
  }

  function setCoach(text, mood='neutral'){
    if (elCoachBubble) elCoachBubble.classList.add('show');
    if (elCoachText) elCoachText.textContent = text || '';
    setCoachFace(mood);

    if (lastCoachTimeout) clearTimeout(lastCoachTimeout);
    lastCoachTimeout = setTimeout(()=>{
      elCoachBubble && elCoachBubble.classList.remove('show');
    }, 4200);
  }

  function celebrateEmoji(){
    if (!elCoachEmoji) return;
    elCoachEmoji.classList.add('coach-celebrate');
    setTimeout(()=> elCoachEmoji.classList.remove('coach-celebrate'), 800);
  }

  return { setCoachFace, setCoach, celebrateEmoji };
}

export function runCountdown(elCountdown, onDone){
  if (!elCountdown){ onDone && onDone(); return; }
  const steps = ['3','2','1','Go!'];
  let idx = 0;
  elCountdown.classList.remove('countdown-hidden');
  elCountdown.textContent = steps[0];

  const t = setInterval(()=>{
    idx++;
    if (idx >= steps.length){
      clearInterval(t);
      elCountdown.classList.add('countdown-hidden');
      onDone && onDone();
    }else{
      elCountdown.textContent = steps[idx];
    }
  }, 650);
}

export function waitSceneReady(cb){
  const scene = document.querySelector('a-scene');
  if (!scene) { cb(); return; }
  const tryReady = ()=>{
    if (scene.hasLoaded && scene.camera){ cb(); return true; }
    return false;
  };
  if (tryReady()) return;

  scene.addEventListener('loaded', ()=>{
    let tries=0;
    const it = setInterval(()=>{
      tries++;
      if (tryReady() || tries>80){ clearInterval(it); cb(); }
    }, 50);
  }, { once:true });
}

export function initVRButton(btnVR){
  if (!btnVR) return;
  const scene = document.querySelector('a-scene');
  if (!scene) return;

  btnVR.addEventListener('click', async ()=>{
    try{ await scene.enterVR(); }
    catch(err){ console.warn('[GoodJunkVR] enterVR error:', err); }
  });
}

export async function tryEnterVR(){
  const scene = document.querySelector('a-scene');
  if (!scene) return false;
  try{ await scene.enterVR(); return true; }
  catch(err){ console.warn('[GoodJunkVR] enterVR blocked:', err); return false; }
}

export function makeLoggerBadge(logDot, logText){
  const state = { pending:true, ok:false, message:'' };

  function set(stateKey, text){
    if (!logDot || !logText) return;
    logDot.classList.remove('ok','bad');
    if (stateKey === 'ok') logDot.classList.add('ok');
    else if (stateKey === 'bad') logDot.classList.add('bad');
    logText.textContent = text || (stateKey==='ok' ? 'logger: ok' : stateKey==='bad' ? 'logger: error' : 'logger: pending…');
  }

  function onEvent(e){
    const d = (e && e.detail) ? e.detail : {};
    state.pending = false;
    state.ok = !!d.ok;
    state.message = d.msg || '';
    set(d.ok ? 'ok' : 'bad', d.msg || '');
  }

  return { state, set, onEvent };
}

export function celebrateQuest(kind, coach){
  const P = (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
  const cx = window.innerWidth/2;
  const y  = window.innerHeight*0.22;

  if (P && P.burstAt) P.burstAt(cx, y, { count: 18, good: true });
  if (P && P.scorePop) P.scorePop(cx, y, (kind==='goal'?'GOAL CLEAR!':'MINI CLEAR!'), { judgment:'GREAT!', good:true });

  coach && coach.celebrateEmoji && coach.celebrateEmoji();
  coach && coach.setCoach && coach.setCoach('เยี่ยม! ผ่านภารกิจแล้ว ไปต่อเลย! 🌟', 'happy');
}

export function bigCelebrateAll(elBigCelebrate, callback){
  if (!elBigCelebrate){ callback && callback(); return; }

  const P = (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
  const cx = window.innerWidth/2;
  const cy = window.innerHeight*0.35;

  if (P && P.burstAt){
    for (let i=0;i<3;i++) setTimeout(()=>P.burstAt(cx,cy,{ count:26, good:true }), i*240);
  }
  if (P && P.scorePop) P.scorePop(cx,cy,'ALL QUESTS CLEAR!',{ judgment:'AMAZING', good:true });

  elBigCelebrate.classList.add('show');
  setTimeout(()=>{
    elBigCelebrate.classList.remove('show');
    callback && callback();
  }, 1200);
}
