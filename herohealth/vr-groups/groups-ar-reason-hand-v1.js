(()=>{'use strict';
const reason=document.getElementById('reason'),answers=document.getElementById('answers'),hand=document.getElementById('hand'),feedback=document.getElementById('feedback');
if(!reason||!answers||!hand)return;
const STYLE_ID='groups-ar-reason-hand-v1-style';
if(!document.getElementById(STYLE_ID)){
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  .reasonCard{position:relative}.reasonHandGuide{margin:0 0 10px;padding:8px 10px;border-radius:14px;background:#eef9f6;color:#2e675c;font-size:.72rem;font-weight:1000;text-align:center}
  .answer.hand-hover{outline:4px solid #65c9ff;transform:scale(1.025);background:#eefaff;box-shadow:0 0 0 8px rgba(101,201,255,.18)}
  .answer.hand-confirm{outline:4px solid #43cf7b;background:#eaffef;transform:scale(.985)}
  .answer{transition:transform .12s,outline-color .12s,background .12s,box-shadow .12s}
  `;document.head.appendChild(s);
}
const guide=document.createElement('div');guide.className='reasonHandGuide';guide.textContent='✋ ชี้คำตอบให้เกิดกรอบสีฟ้า แล้ว 🤏 หนีบนิ้วเพื่อยืนยัน • แตะหรือคลิกได้เสมอ';
const card=reason.querySelector('.reasonCard');if(card&&!card.querySelector('.reasonHandGuide'))card.insertBefore(guide,card.querySelector('h3'));
let hover=null,lastPinch=false,locked=false,lastConfirm=0;
function isOpen(){return reason.classList.contains('show')}
function handCenter(){const hr=hand.getBoundingClientRect();return{x:hr.left+hr.width/2,y:hr.top+hr.height/2,visible:hand.classList.contains('show')}}
function answerAt(x,y){const list=[...answers.querySelectorAll('.answer')];let best=null,bestD=Infinity;for(const b of list){const r=b.getBoundingClientRect();const inside=x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;if(inside)return b;const cx=(r.left+r.right)/2,cy=(r.top+r.bottom)/2,d=Math.hypot(x-cx,y-cy);if(d<bestD&&d<Math.max(90,r.width*.38)){best=b;bestD=d}}return best}
function setHover(b){if(hover===b)return;if(hover)hover.classList.remove('hand-hover');hover=b;if(hover)hover.classList.add('hand-hover')}
function clear(){setHover(null);locked=false;lastPinch=false}
function confirm(b){if(!b||locked)return;const now=performance.now();if(now-lastConfirm<850)return;lastConfirm=now;locked=true;b.classList.remove('hand-hover');b.classList.add('hand-confirm');if(feedback)feedback.textContent='✅ ยืนยันคำตอบแล้ว';setTimeout(()=>{if(document.body.contains(b))b.click();locked=false},260)}
function loop(){if(!isOpen()){clear();requestAnimationFrame(loop);return}const p=handCenter();if(!p.visible){setHover(null);lastPinch=false;requestAnimationFrame(loop);return}const b=answerAt(p.x,p.y);setHover(b);const pinch=hand.classList.contains('pinch');if(pinch&&!lastPinch&&b)confirm(b);lastPinch=pinch;requestAnimationFrame(loop)}
const mo=new MutationObserver(()=>{if(!isOpen())clear()});mo.observe(reason,{attributes:true,attributeFilter:['class']});
requestAnimationFrame(loop);
})();