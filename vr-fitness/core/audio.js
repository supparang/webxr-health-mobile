window.AudioBus=(function(){let bgm,click;let enabled=true;
function load(cfg){bgm=new Audio(cfg.audio.bgm);bgm.loop=true;bgm.volume=0.3;click=new Audio(cfg.audio.click);click.volume=0.7;}
function playBgm(){if(enabled&&bgm){bgm.play().catch(()=>{});}}
function stopBgm(){if(bgm)bgm.pause();}
function tap(){if(enabled&&click)click.play().catch(()=>{});}
function mute(v){enabled=!v;if(!enabled)stopBgm();else playBgm();}
return{load,playBgm,stopBgm,tap,mute};})();