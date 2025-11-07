<script type="module">
// === Hydration (Balance Meter) — SAFE ===
let running=false, host=null, score=0, combo=0, maxCombo=0, spawnTimer=null, misses=0;

var __emojiCache={};
function emojiSprite(emo,px){
  var s=px||128,k=emo+'@'+s; if(__emojiCache[k])return __emojiCache[k];
  var c=document.createElement('canvas'); c.width=c.height=s;
  var x=c.getContext('2d'); x.textAlign='center'; x.textBaseline='middle';
  x.font=(s*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  x.shadowColor='rgba(0,0,0,0.25)'; x.shadowBlur=s*0.06; x.fillText(emo,s/2,s/2);
  return (__emojiCache[k]=c.toDataURL('image/png'));
}
function emit(n,d){ window.dispatchEvent(new CustomEvent(n,{detail:d})); }

function waterDrop(){
  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite('💧',192));
  img.setAttribute('position', (Math.random()*1.6-0.8)+' '+(Math.random()*0.9+0.6)+' -1.2');
  img.setAttribute('width',0.42); img.set