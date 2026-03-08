// === /herohealth/gate/helpers/bubbles.js ===
// Shared bubble minigame helper for cooldown modules

export function runBubblePhase({
  host,
  rng,
  className,
  emoji='🫧',
  countStart=3,
  goal=5,
  onPop,
  onGoal
}){
  const state = {
    pops: 0,
    ended: false
  };

  function spawnOne(){
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.textContent = emoji;
    el.style.left = `${12 + rng()*76}%`;
    el.style.top = `${18 + rng()*58}%`;

    el.addEventListener('click', ()=>{
      if(state.ended) return;
      state.pops++;
      el.remove();
      if(onPop) onPop(state.pops);

      if(state.pops >= goal){
        state.ended = true;
        if(onGoal) onGoal(state.pops);
      }else{
        spawnOne();
      }
    });

    host.appendChild(el);
  }

  for(let i=0;i<countStart;i++) spawnOne();

  return {
    get pops(){ return state.pops; },
    end(){ state.ended = true; }
  };
}
