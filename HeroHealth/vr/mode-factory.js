// === vr/mode-factory.js — safe no-optional-chaining (2025-11-07) ===
import { Difficulty }   from './difficulty.js';
import { Emoji }        from './emoji-sprite.js';
import { Fever }        from './fever.js';
import { MiniQuest }    from './miniquest.js';
import { MissionDeck }  from './mission.js';
import * as FX          from './particles.js';
import { SFX }          from './sfx.js';

var Particles = (FX && FX.Particles) ? FX.Particles : FX;

function $(s){ return document.querySelector(s); }
function sample(a){ return a[Math.floor(Math.random()*a.length)]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function now(){ return performance.now ? performance.now() : Date.now(); }

var MIN_DIST_DEFAULT         = 0.36;
var SLOT_COOLDOWN_MS_DEFAULT = 520;
var MAX_ACTIVE_BY_DIFF_DEF   = { easy:1, normal:2, hard:2 };
var BUDGET_BY_DIFF_DEF       = { easy:1, normal:2, hard:2 };
var TIME_BY_DIFF_DEF         = { easy:45, normal:60, hard:75 };

function makeEmojiNode(char, opts){
  var scale = (opts && opts.scale) ? opts.scale : 0.58;
  // ใช้ a-text เพื่อความเสถียร
  var el = document.createElement('a-text');
  el.setAttribute('value', char);
  el.setAttribute('align', 'center');
  el.setAttribute('color', '#fff');
  el.setAttribute('scale', (2*scale)+' '+(2*scale)+' '+(2*scale));
  return el;
}

function buildSlots(yBase){
  var y0 = (typeof yBase==='number')? yBase : 0.42;
  var xs=[-0.95, 0.00, 0.95], ys=[ y0, y0+0.34 ];
  var slots=[], id=0, ci, ri;
  for(ci=0; ci<xs.length; ci++){
    for(ri=0; ri<ys.length; ri++){
      slots.push({ id:id++, col:ci