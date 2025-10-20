(function(){
const x = (Math.random()*6-3).toFixed(2);
const z = (-3 - Math.random()*4).toFixed(2);
el.setAttribute('position', `${x} 1.4 ${z}`);
root.appendChild(el);
const dur = Math.max(300, 3000/cfg.speed);
el.setAttribute('animation', `property: position; to: ${x} 1.4 -0.5; dur: ${dur}; easing: linear`);
el.addEventListener('animationcomplete', ()=>{ try{ root.removeChild(el);}catch(e){} });
el.classList.add('clickable');
el.addEventListener('click', ()=>{ try{ root.removeChild(el);}catch(e){} });
setTimeout(spawn, cfg.spawn);
}
spawn();


window.addEventListener('beforeunload', ()=>{ alive=false; }, {once:true});
}


function bindUI(){
const status = $('status');
const overlay = $('overlay');


$('btnBack').onclick = () => history.back();
$('btnStart').onclick = async () => {
try{ await APP.audio.init(); }catch(e){}
APP.setState({scene:'playing'});
overlay.classList.add('hidden');
startGame();
showToast('Started');
};
$('btnLang').onclick = () => APP.i18n.set(APP.i18n.current==='en'?'th':'en');
$('btnMute').onclick = () => {
const muted = APP.audio.toggle();
$('btnMute').textContent = muted? '🔇 Muted':'🔈 Sound';
};


function render(){
const s = APP.state;
status.textContent = `scene:${s.scene} game:${s.game} mode:${s.mode} diff:${s.diff} lang:${s.lang}`;
}
document.addEventListener('app:state-change', render);
document.addEventListener('i18n:change', ()=>{
document.title = APP.i18n.t('workout_title');
document.getElementById('overlayTitle').textContent = APP.i18n.t('ready');
document.getElementById('overlayDesc').textContent = APP.i18n.t('press_start');
});


// initial
document.title = APP.i18n.t('workout_title');
render();
}


document.addEventListener('DOMContentLoaded', bindUI);
})();
