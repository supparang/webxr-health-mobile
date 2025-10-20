function(){
let ctx,gain,muted=false,ready=false;
async function init(){ if(ready) return; ctx=new (window.AudioContext||window.webkitAudioContext)(); gain=ctx.createGain(); gain.gain.value=0.6; gain.connect(ctx.destination); ready=true; }
function toggle(){ muted=!muted; if(gain) gain.gain.value = muted?0:0.6; return muted; }
window.APP = window.APP || {}; APP.audio={init,toggle};
})();
