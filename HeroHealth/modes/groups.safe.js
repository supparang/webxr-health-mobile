// === /HeroHealth/modes/groups.safe.js (Full, bias to target groups + power-ups + coach) ===
import { Particles } from '../vr/particles.js';
import { ensureFeverBar, setFever, setFeverActive, setShield } from '../vr/ui-fever.js';
import { createGroupsQuest } from './groups.quest.js';

const GROUPS = {
  1: ['🍚','🍙','🍞','🥐','🥖','🥯'],
  2: ['🥩','🍗','🍖','🥚','🧀'],
  3: ['🥦','🥕','🍅','🥬','🌽','🥗'],
  4: ['🍎','🍌','🍇','🍉','🍊','🍓','🍍'],
  5: ['🥛','🧈','🧀','🍨']
};
const ALL = Object.values(GROUPS).flat();
const STAR='⭐', DIA='💎', SHIELD='🛡️', FIRE='🔥';
const BONUS=[STAR,DIA,SHIELD,FIRE];

const diffCfg = {
  easy:   { spawn:950,  life:2200, targets:18, focus:1 },
  normal: { spawn:820,  life:2000, targets:26, focus:2 },
  hard:   { spawn:680,  life:1800, targets:34, focus:3 }
};

function foodGroup(emo){ for(const [g,arr] of Object.entries(GROUPS)){ if(arr.includes(emo)) return +g; } return 0; }
function