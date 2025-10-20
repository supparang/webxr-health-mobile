(function(){
function showToast(msg){
const t = $('toast');
t.textContent = msg; t.style.display='block';
clearTimeout(window.__t); window.__t = setTimeout(()=> t.style.display='none', 1400);
}


function startGame(){
const s = APP.state;
const cfgByDiff = { easy:{speed:0.8, spawn:1200}, normal:{speed:1.0, spawn:900}, hard:{speed:1.3, spawn:700} };
const cfg = cfgByDiff[s.diff] || cfgByDiff.normal;
const root = document.getElementById('gameRoot');
while(root.firstChild) root.removeChild(root.firstChild);


let alive = true;
function spawn(){
if (!alive) return;
const el = document.createElement('a-sphere');
el.setAttribute('radius', '0.25');
el.setAttribute('color', s.game==='rhythm' ? '#39f' : s.game==='cardio' ? '#3f9' : '#f93');
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
