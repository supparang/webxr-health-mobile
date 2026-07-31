(()=>{'use strict';
if(window.__JUMPDUCK_CONSUMED_OBJECT_HIDE_V61__)return;
window.__JUMPDUCK_CONSUMED_OBJECT_HIDE_V61__=true;

const world=document.getElementById('world');
if(!world||!window.CanvasRenderingContext2D)return;
const worldCtx=world.getContext('2d');
if(!worldCtx)return;

const previousFillText=CanvasRenderingContext2D.prototype.fillText;
if(previousFillText.__jumpduckConsumedObjectV61Patched)return;

const GAME_OBJECTS=new Set(['🍎','🥦','💧','🍌','🍟','🥤','🍩','🔥']);

function patchedFillText(text,x,y,maxWidth){
 const isResolvedGameObject=(
  this===worldCtx&&
  GAME_OBJECTS.has(String(text))&&
  Number(this.globalAlpha)<=0.30
 );

 // The core renderer sets resolved objects to alpha 0.25 while their
 // gameplay record finishes travelling off-screen. Suppress only that
 // resolved draw call so a collected or hit item disappears immediately.
 // Existing burst particles remain visible as the collection feedback.
 if(isResolvedGameObject)return;

 return arguments.length>=4
  ?previousFillText.call(this,text,x,y,maxWidth)
  :previousFillText.call(this,text,x,y);
}
patchedFillText.__jumpduckConsumedObjectV61Patched=true;
CanvasRenderingContext2D.prototype.fillText=patchedFillText;

try{
 const nativeSetItem=Storage.prototype.setItem;
 if(!nativeSetItem.__jumpduckConsumedObjectV61StoragePatched){
  function resultSetItem(key,value){
   if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
    try{
     const payload=JSON.parse(String(value||'{}'));
     payload.gameVersion='jumpduck-production-v6.1-consumed-object-hide';
     payload.objectResolveVisualPolicy='resolved-object-hidden-immediately-alpha-guard-v61';
     value=JSON.stringify(payload);
    }catch(_){ }
   }
   return nativeSetItem.call(this,key,value);
  }
  resultSetItem.__jumpduckConsumedObjectV61StoragePatched=true;
  Storage.prototype.setItem=resultSetItem;
 }
}catch(_){ }
})();
