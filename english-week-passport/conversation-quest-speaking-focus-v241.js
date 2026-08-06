(function(){
'use strict';
function init(){
  const mission=document.getElementById('mission');
  const gate=document.getElementById('speakGate');
  const playarea=document.querySelector('.playarea');
  const choices=document.getElementById('choices');
  if(!mission||!gate||!playarea||!choices)return;

  const style=document.createElement('style');
  style.textContent=`
    .mission.speaking-focus{grid-template-rows:auto minmax(88px,13dvh) auto minmax(0,1fr) auto}
    .mission.speaking-focus .choices{display:none!important}
    .mission.speaking-focus .playarea{align-content:start;overflow-y:auto;padding-top:2px}
    .mission.speaking-focus .speak-gate{display:grid!important;margin:0}
    .mission.speaking-focus .stage{min-height:88px}
    .mission.speaking-focus .npc-face{font-size:2.25rem}
    @media(max-height:760px){
      .mission.speaking-focus{grid-template-rows:auto minmax(76px,11dvh) auto minmax(0,1fr) auto}
      .mission.speaking-focus .stage{min-height:76px}
      .mission.speaking-focus .dialogue{padding:5px 7px}
      .mission.speaking-focus .speak-gate{padding:7px}
    }
  `;
  document.head.appendChild(style);

  function sync(){
    const active=gate.classList.contains('show');
    mission.classList.toggle('speaking-focus',active);
    if(active){
      requestAnimationFrame(()=>{
        playarea.scrollTop=0;
        gate.scrollTop=0;
      });
    }else{
      playarea.scrollTop=0;
    }
  }

  new MutationObserver(sync).observe(gate,{attributes:true,attributeFilter:['class']});
  sync();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
