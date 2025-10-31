// === Hero Health Academy — game/modes/goodjunk.js (no optional chaining; safe build) ===
export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🍭','🧈','🥓','🧃','🍮','🥟','🍨','🧇','🌮'];

function ensurePlayfield(){
  var layer = document.getElementById('gameLayer');
  if(!layer){
    layer = document.createElement('section');
    layer.id = 'gameLayer';
    layer.style.position='relative';
    layer.style.minHeight='360px';
    layer.style.overflow='hidden';
    document.body.appendChild(layer);
  }
  var host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.position='absolute';
    host.style.inset='0';
    layer.appendChild(host);
  }
  return {layer,host};
}

function rectOf(el){
  if(el && el.getBoundingClientRect){
    var r = el.getBoundingClientRect();
    if(r.width>0 && r.height>0) return r;
  }
  return {left:0,top:0,width:innerWidth||800,height:innerHeight||600};
}

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

export function create(ctx){
  var state={running:false,items:[]};
  var play = ensurePlayfield();
  var host = play.host;

  function spawn(){
    var playRect = rectOf(play.layer);
    var metaGood = Math.random()<0.6;
    var emoji = metaGood? pick(GOOD): pick(JUNK);
    var b = document.createElement('button');
    b.textContent=emoji;
    b.className='spawn-emoji';
    b.style.left=Math.floor(Math.random()*playRect.width)+'px';
    b.style.top=Math.floor(Math.random()*playRect.height)+'px';
    host.appendChild(b);
    var born=performance.now();
    var life=2000+Math.random()*1000;
    var meta={good:metaGood,born:born,life:life,el:b};
    state.items.push(meta);

    b.addEventListener('click',function(e){
      e.stopPropagation();
      if(!state.running)return;
      if(meta.good){
        if(ctx && ctx.engine && ctx.engine.sfx) ctx.engine.sfx.play && ctx.engine.sfx.play('sfx-good');
      }else{
        document.body.classList.add('flash-danger');
        setTimeout(function(){document.body.classList.remove('flash-danger');},150);
        if(ctx && ctx.engine && ctx.engine.sfx) ctx.engine.sfx.play && ctx.engine.sfx.play('sfx-bad');
      }
      try{ b.remove(); }catch(_){}
    });
  }

  function start(){
    state.running=true;
    var timer=setInterval(function(){
      if(!state.running){clearInterval(timer);return;}
      spawn();
    },700);
  }

  function stop(){
    state.running=false;
    var all=host.querySelectorAll('.spawn-emoji');
    for(var i=0;i<all.length;i++){try{all[i].remove();}catch(_){}} 
  }

  return {start:start,stop:stop,update:function(){},cleanup:stop};
}
