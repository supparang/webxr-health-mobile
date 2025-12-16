// === /herohealth/vr/mode-factory.js ===
// Unified launcher for GoodJunk / Hydration / Groups

export async function boot(cfg){
  const {
    modeKey,
    judge,
    onExpire,
    duration=60
  } = cfg;

  let sec=duration;
  const tick=()=>{
    window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec}}));
    sec--;
    if(sec>=0) setTimeout(tick,1000);
  };
  tick();

  return {
    stop(reason){
      window.dispatchEvent(new CustomEvent('hha:end',{detail:{mode:modeKey,reason}}));
    }
  };
}