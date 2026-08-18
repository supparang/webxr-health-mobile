/* HeroHealth Pending Game Queue Sanitizer R1
 * Prevents a rejected out-of-order direct/deep-link completion from remaining
 * in local retry storage and auto-completing later when that game eventually
 * becomes the expected mission.
 *
 * Valid offline retry is preserved only for the game currently opened by the
 * canonical Passport shell for the same student.
 */
(()=>{
'use strict';
const RELEASE='20260818-PENDING-GAME-QUEUE-SANITIZER-R1';
const KEY='HH_FIREBASE_PENDING_GAME_EVENTS_R76';
const q=new URLSearchParams(location.search);
const clean=v=>String(v||'').trim().toLowerCase().replace(/[_\s]+/g,'-');
const canonical=v=>{
 const k=clean(v).replace(/-/g,'');
 if(['handwash'].includes(k))return'handwash';
 if(['toothbrush','brush'].includes(k))return'toothbrush';
 if(['groups','foodgroups'].includes(k))return'groups';
 if(['goodjunk'].includes(k))return'goodjunk';
 if(['jumpduck'].includes(k))return'jumpduck';
 if(['balance','balancehold'].includes(k))return'balance';
 return clean(v);
};
const ids=[...new Set(['studentId','sid','pid'].map(k=>String(q.get(k)||'').trim()).filter(Boolean))];
if(ids.length!==1)return;
const sid=ids[0],current=canonical(q.get('gameId')||q.get('game')||q.get('mission')||'');
if(!current)return;
try{
 const queue=JSON.parse(localStorage.getItem(KEY)||'{}');
 if(!queue||typeof queue!=='object')return;
 let changed=false,removed=[];
 for(const [id,entry] of Object.entries(queue)){
  if(String(entry?.studentId||'')!==sid)continue;
  const game=canonical(entry?.game?.key||entry?.result?.gameId||entry?.result?.gameKey||'');
  if(game&&game!==current){delete queue[id];removed.push({attemptId:id,game});changed=true;}
 }
 if(changed)localStorage.setItem(KEY,JSON.stringify(queue));
 console.info('[HeroHealth Pending Queue Sanitizer]',RELEASE,{sid,current,removed});
}catch(error){console.warn('[HeroHealth Pending Queue Sanitizer] skipped',error)}
})();
