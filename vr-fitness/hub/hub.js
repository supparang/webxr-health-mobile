(function(){
const $ = (s, el=document)=> el.querySelector(s);
const $$ = (s, el=document)=> Array.from(el.querySelectorAll(s));


function ready(){
const title = document.getElementById('title');
const pill = document.getElementById('pill');
const desc = document.getElementById('desc');
const status = document.getElementById('status');


// i18n wiring
document.getElementById('btnLang').onclick = () => {
APP.i18n.set(APP.i18n.current==='en'?'th':'en');
};
document.addEventListener('i18n:change', () => {
title.textContent = APP.i18n.t('hub_title');
desc.textContent = APP.i18n.t('hub_desc');
});


// sound toggle
document.getElementById('btnMute').onclick = () => {
const muted = APP.audio.toggle();
document.getElementById('btnMute').textContent = muted? '🔇 Muted':'🔈 Sound';
};


// cards
$$('.card').forEach(card => {
const game = card.getAttribute('data-game');
const selMode = $('.selMode', card);
const selDiff = $('.selDiff', card);
$('.start', card).addEventListener('click', async () => {
try{ await APP.audio.init(); }catch(e){}
const params = new URLSearchParams({game, mode: selMode.value, diff: selDiff.value, lang: APP.i18n.current});
location.href = `./workout.html?${params.toString()}`;
});
});


function render(){
const s = APP.state;
pill.textContent = `lang:${s.lang}`;
status.textContent = `scene:${s.scene} game:${s.game} mode:${s.mode} diff:${s.diff} lang:${s.lang}`;
}
document.addEventListener('app:state-change', render);
render();
}


document.addEventListener('DOMContentLoaded', ready);
})();
