(()=>{'use strict';
if(window.__JUMPDUCK_BG_NEWS_V74__)return;
window.__JUMPDUCK_BG_NEWS_V74__=true;

const items=[
 ['ข่าวสุขภาพ','เลือกน้ำเปล่าแทนน้ำหวาน 💧'],
 ['Mission Tip','เก็บอาหารดีให้ต่อคอมโบ ⭐'],
 ['ข่าวสุขภาพ','ผักผลไม้ช่วยให้ร่างกายแข็งแรง 🥦'],
 ['Mission Tip','เจอของทอดให้กระโดดหรือหลบเลน ⬆️'],
 ['ข่าวสุขภาพ','ขยับร่างกายทุกวัน สุขภาพดีขึ้น 🏃'],
 ['Mission Tip','ย่อตัวหลบเครื่องดื่มหวานและโดนัท ⬇️']
];

function installStyle(){
 if(document.getElementById('jdBgNewsV74Style'))return;
 const s=document.createElement('style');
 s.id='jdBgNewsV74Style';
 s.textContent=`
 .jd-bg-news{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}
 .jd-cloud{position:absolute;width:62px;height:24px;border-radius:999px;background:#ffffff65;box-shadow:24px 9px 0 #ffffff48,50px 1px 0 #ffffff55;animation:jdCloud 18s ease-in-out infinite}
 .jd-cloud.c1{left:8%;top:13%}.jd-cloud.c2{right:17%;top:23%;transform:scale(.78);animation-delay:-7s}
 .jd-skyline{position:absolute;left:0;right:0;top:39%;height:12%;background:#33415520;clip-path:polygon(0 100%,0 60%,8% 60%,8% 38%,14% 38%,14% 67%,21% 67%,21% 25%,28% 25%,28% 58%,35% 58%,35% 34%,43% 34%,43% 70%,51% 70%,51% 28%,60% 28%,60% 60%,68% 60%,68% 20%,76% 20%,76% 64%,85% 64%,85% 37%,92% 37%,92% 57%,100% 57%,100% 100%)}
 .jd-news-board{position:absolute;bottom:104px;width:116px;min-height:78px;padding:9px 8px;border:3px solid #f59e0bb8;border-radius:17px;background:#fffffff0;box-shadow:0 8px 22px #0f172a25;text-align:center}
 .jd-news-board.left{left:6px;transform:rotate(-3deg)}.jd-news-board.right{right:6px;transform:rotate(3deg)}
 .jd-news-board:after{content:'';position:absolute;left:50%;bottom:-17px;width:6px;height:21px;border-radius:6px;background:#47556966;transform:translateX(-50%)}
 .jd-news-head{font:1000 10px/1.1 system-ui;color:#b45309;margin-bottom:4px}.jd-news-body{font:900 11px/1.25 system-ui;color:#0f766e}
 .jd-bg-star{position:absolute;font-size:18px;opacity:.45;animation:jdStar 3.5s ease-in-out infinite}.jd-bg-star.s1{left:11%;top:56%}.jd-bg-star.s2{right:12%;top:62%;animation-delay:-1.4s}
 .jd-news-strip{position:absolute;left:50%;bottom:9px;transform:translateX(-50%);max-width:72vw;padding:6px 11px;border-radius:999px;background:#0f172a35;color:#fff;font:900 11px/1.15 system-ui;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;backdrop-filter:blur(4px)}
 @keyframes jdCloud{0%,100%{translate:0 0}50%{translate:15px 0}}@keyframes jdStar{0%,100%{transform:translateY(0);opacity:.25}50%{transform:translateY(-7px) scale(1.12);opacity:.62}}
 `;
 document.head.appendChild(s);
}

function build(){
 const game=document.getElementById('game');
 if(!game||game.querySelector('.jd-bg-news'))return game?.querySelector('.jd-bg-news');
 const layer=document.createElement('div');
 layer.className='jd-bg-news';
 layer.innerHTML=`
  <div class="jd-cloud c1"></div><div class="jd-cloud c2"></div><div class="jd-skyline"></div>
  <div class="jd-news-board left"><div class="jd-news-head"></div><div class="jd-news-body"></div></div>
  <div class="jd-news-board right"><div class="jd-news-head"></div><div class="jd-news-body"></div></div>
  <div class="jd-bg-star s1">✨</div><div class="jd-bg-star s2">🌟</div><div class="jd-news-strip"></div>`;
 const world=document.getElementById('world');
 world?.insertAdjacentElement('afterend',layer);
 return layer;
}

function rotate(layer){
 if(!layer||layer.__timer)return;
 const boards=[...layer.querySelectorAll('.jd-news-board')],strip=layer.querySelector('.jd-news-strip');
 let i=0;
 const show=()=>{
  boards.forEach((b,n)=>{const x=items[(i+n)%items.length];b.querySelector('.jd-news-head').textContent=x[0];b.querySelector('.jd-news-body').textContent=x[1]});
  const a=items[i%items.length][1],b=items[(i+1)%items.length][1];
  strip.textContent=`HeroHealth News • ${a} • ${b}`;i=(i+2)%items.length;
 };
 show();layer.__timer=setInterval(show,3400);
}

function boot(){installStyle();rotate(build());console.info('[JumpDuck BG News V74] ready')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
