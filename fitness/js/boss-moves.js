// === /fitness/js/boss-moves.js ===
// BossMoves: signature moves per boss/phase + short "overdrive windows"
// - provides spawn directives (forced target kinds + zones)
// - provides temporary multipliers (spawn/ttl/size) on top of DifficultyDirector
// - logs moveName for research/event csv

'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export class BossMoves{
  constructor(){
    this.reset();
  }

  reset(){
    this.activeMove = null;     // {name, endsAt, meta}
    this.cooldownUntil = 0;
    this.queue = [];            // spawn directives: {kind, zoneId, ttlMul, sizeMul, tag}
    this.over = { spawnMul:1, ttlMul:1, sizeMul:1 }; // temporary overlay multipliers
    this.lastMoveName = '';
  }

  // call when boss or phase changes
  onBossPhase(bossIndex, bossPhase, now){
    // small "phase bump" feel
    const bump = bossPhase === 3 ? 0.92 : bossPhase === 2 ? 0.96 : 1.00;
    this.over = { spawnMul:bump, ttlMul:bump, sizeMul:bump };
    this.activeMove = null;
    this.queue.length = 0;
    this.cooldownUntil = Math.max(this.cooldownUntil, now + 800); // avoid immediate spam
  }

  getOverlay(){
    return {
      ...this.over,
      moveName: this.lastMoveName || (this.activeMove ? this.activeMove.name : '')
    };
  }

  // engine calls periodically in gameLoop
  update(now, state, patterns){
    if (!state || !state.running) return;

    // expire active move
    if (this.activeMove && now >= this.activeMove.endsAt){
      this.activeMove = null;
      this.lastMoveName = '';
      this.over = { spawnMul:1, ttlMul:1, sizeMul:1 };
      this.cooldownUntil = now + 1400;
    }

    // if queue has enough directives, no need to start move now
    if (this.queue.length >= 4) return;

    // trigger move conditions:
    // - phase3 more often
    // - low boss hp region: dramatic storm
    const phase = state.bossPhase || 1;
    const boss = state.bossIndex || 0;

    const want =
      (phase === 3 && Math.random() < 0.020) ||
      (phase === 2 && Math.random() < 0.012) ||
      (phase === 1 && Math.random() < 0.008);

    if (!want) return;
    if (now < this.cooldownUntil) return;
    if (this.activeMove) return;

    // start a signature move
    const move = this.pickMove(boss, phase);
    this.startMove(move, boss, phase, now, patterns);
  }

  pickMove(bossIndex, bossPhase){
    // signature mapping (keep it readable)
    if (bossIndex === 0) return bossPhase >= 2 ? 'BUBBLE_SWEEP' : 'BUBBLE_RALLY';
    if (bossIndex === 1) return bossPhase >= 2 ? 'SPARK_BURST' : 'SPARK_FEINT';
    if (bossIndex === 2) return bossPhase >= 2 ? 'SHADOW_TRICK' : 'SHADOW_TUNNEL';
    return bossPhase >= 2 ? 'GALAXY_STORM' : 'GALAXY_SPIRAL';
  }

  startMove(name, bossIndex, bossPhase, now, patterns){
    const dur =
      name === 'GALAXY_STORM' ? 5200 :
      name === 'SPARK_BURST'  ? 4200 :
      3600;

    this.activeMove = { name, endsAt: now + dur, meta: { bossIndex, bossPhase } };
    this.lastMoveName = name;

    // overlay multipliers during move
    const tight = bossPhase === 3;
    if (name === 'GALAXY_STORM'){
      this.over = { spawnMul: tight ? 0.72 : 0.82, ttlMul: tight ? 0.78 : 0.86, sizeMul: tight ? 0.86 : 0.92 };
    } else if (name === 'SPARK_BURST'){
      this.over = { spawnMul: tight ? 0.78 : 0.86, ttlMul: tight ? 0.86 : 0.92, sizeMul: 0.95 };
    } else if (name.startsWith('SHADOW')){
      this.over = { spawnMul: 0.90, ttlMul: tight ? 0.82 : 0.88, sizeMul: tight ? 0.88 : 0.94 };
    } else {
      this.over = { spawnMul: 0.92, ttlMul: 0.92, sizeMul: 0.96 };
    }

    // build queue directives per move
    this.queue.length = 0;

    const push = (kind, zoneId, tag) => this.queue.push({ kind, zoneId, tag });

    // zones 0..5. Use patterns to keep "boss identity"
    const z = ()=>patterns.next(bossIndex, bossPhase);

    if (name === 'BUBBLE_RALLY'){
      // friendly: normals + one reward
      push('normal', z(), 'rally');
      push('normal', z(), 'rally');
      push('cleanse', z(), 'reward'); // risk-reward target
      push('normal', z(), 'rally');
    }

    if (name === 'BUBBLE_SWEEP'){
      // sweep + a heal
      push('normal', z(), 'sweep');
      push('normal', z(), 'sweep');
      push('heal', z(), 'heal');
      push('normal', z(), 'sweep');
      push('decoy', z(), 'feint');
    }

    if (name === 'SPARK_FEINT'){
      // decoy cluster then real
      push('decoy', z(), 'feint');
      push('decoy', z(), 'feint');
      push('normal', z(), 'strike');
      push('shield', z(), 'shield');
    }

    if (name === 'SPARK_BURST'){
      // fast burst with bombs sprinkled + reward focus
      push('normal', z(), 'burst');
      push('bomb',  z(), 'burst');
      push('normal', z(), 'burst');
      push('bomb',  z(), 'burst');
      push('focus', z(), 'reward'); // slows spawn for short
      push('normal', z(), 'burst');
    }

    if (name === 'SHADOW_TUNNEL'){
      // tunnel: repeated zone -> forces attention
      const kz = z();
      push('decoy', kz, 'tunnel');
      push('normal', kz, 'tunnel');
      push('decoy', kz, 'tunnel');
      push('normal', kz, 'tunnel');
      push('cleanse', z(), 'reward');
    }

    if (name === 'SHADOW_TRICK'){
      // trick: decoys + bomb + then 2 normals
      push('decoy', z(), 'trick');
      push('bomb',  z(), 'trick');
      push('normal', z(), 'strike');
      push('normal', z(), 'strike');
      push('shield', z(), 'shield');
    }

    if (name === 'GALAXY_SPIRAL'){
      // spiral: steady hardening
      push('normal', z(), 'spiral');
      push('normal', z(), 'spiral');
      push('decoy', z(), 'spiral');
      push('heal', z(), 'heal');
      push('normal', z(), 'spiral');
    }

    if (name === 'GALAXY_STORM'){
      // storm: rapid mixed, includes one big reward
      push('normal', z(), 'storm');
      push('bomb',  z(), 'storm');
      push('decoy', z(), 'storm');
      push('normal', z(), 'storm');
      push('cleanse', z(), 'reward');
      push('normal', z(), 'storm');
      push('bomb',  z(), 'storm');
    }
  }

  // engine calls before choosing random kind
  popDirective(){
    return this.queue.length ? this.queue.shift() : null;
  }
}