/* === /herohealth/vr-groups/audio.js ===
GroupsVR Audio — lightweight WebAudio SFX
- hit good/bad
- tick (lock/dwell)
- storm on/off
- powerups, burst, boss, weakspot, teleport
*/

(function(root){
  'use strict';
  const NS = (root.GroupsVR = root.GroupsVR || {});
  let AC = null, master = null;

  function ensure(){
    if (AC && master) return true;
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return false;
    AC = new Ctx();
    master = AC.createGain();
    master.gain.value = 0.55;
    master.connect(AC.destination);

    // resume on first gesture
    const resume = ()=>{
      try{ AC.resume(); }catch{}
      root.removeEventListener('pointerdown', resume);
      root.removeEventListener('touchstart', resume);
      root.removeEventListener('keydown', resume);
    };
    root.addEventListener('pointerdown', resume, { once:true, passive:true });
    root.addEventListener('touchstart', resume, { once:true, passive:true });
    root.addEventListener('keydown', resume, { once:true, passive:true });
    return true;
  }

  function beep(freq=440, dur=0.08, type='sine', gain=0.25){
    if (!ensure()) return;
    const t0 = AC.currentTime;
    const o = AC.createOscillator();
    const g = AC.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+Math.max(0.02,dur));
    o.connect(g); g.connect(master);
    o.start(t0);
    o.stop(t0 + Math.max(0.03, dur) + 0.02);
  }

  function noise(dur=0.12, gain=0.18){
    if (!ensure()) return;
    const t0 = AC.currentTime;
    const bufferSize = Math.max(1, (AC.sampleRate * dur) | 0);
    const buf = AC.createBuffer(1, bufferSize, AC.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);

    const src = AC.createBufferSource();
    src.buffer = buf;

    const g = AC.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);

    src.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.01);
  }

  const SFX = {
    hitGood(){ beep(720,0.05,'triangle',0.22); beep(980,0.04,'sine',0.12); },
    hitBad(){ noise(0.12,0.20); beep(220,0.06,'square',0.10); },
    miss(){ beep(160,0.10,'sawtooth',0.14); },
    tick(rate=1){
      // rate: 1 slow .. 2 fast
      const f = 760 + 220*(rate-1);
      beep(f, 0.025, 'sine', 0.11);
    },
    lock(){ beep(920,0.06,'triangle',0.14); },
    burst(){ beep(520,0.07,'square',0.14); beep(980,0.06,'triangle',0.18); },
    stormOn(){ noise(0.18,0.14); beep(300,0.10,'sawtooth',0.08); },
    stormOff(){ beep(260,0.08,'sine',0.08); },
    powerStar(){ beep(880,0.06,'triangle',0.18); beep(1180,0.08,'sine',0.16); },
    powerIce(){ beep(540,0.05,'sine',0.14); beep(420,0.08,'triangle',0.12); },
    powerShield(){ beep(660,0.06,'triangle',0.16); beep(740,0.08,'sine',0.12); },
    bossSpawn(){ beep(240,0.10,'square',0.12); beep(360,0.10,'square',0.11); },
    weakOn(){ beep(1020,0.06,'triangle',0.12); beep(1240,0.05,'sine',0.12); },
    teleport(){ noise(0.10,0.10); beep(420,0.04,'sine',0.08); }
  };

  // public API
  NS.Audio = {
    setVolume(v){
      if (!ensure()) return;
      master.gain.value = Math.max(0, Math.min(1, Number(v)||0.55));
    },
    play(name, arg){
      if (!SFX[name]) return;
      try{ SFX[name](arg); }catch{}
    }
  };

  // event wiring
  root.addEventListener('hha:judge', (e)=>{
    const d = e.detail||{};
    const k = String(d.kind||'').toLowerCase();
    if (k.includes('miss')) NS.Audio.play('miss');
    else if (k.includes('bad') || k.includes('junk') || k.includes('wrong')) NS.Audio.play('hitBad');
    else NS.Audio.play('hitGood');
  });

  root.addEventListener('groups:tick', (e)=>{
    const d = e.detail||{};
    NS.Audio.play('tick', Number(d.rate||1));
  });

  root.addEventListener('groups:storm', (e)=>{
    const d = e.detail||{};
    if (d.on) NS.Audio.play('stormOn');
    else NS.Audio.play('stormOff');
  });

  root.addEventListener('groups:progress', (e)=>{
    const d = e.detail||{};
    const kind = String(d.kind||'');
    if (kind === 'powerup_star') NS.Audio.play('powerStar');
    else if (kind === 'powerup_ice') NS.Audio.play('powerIce');
    else if (kind === 'powerup_shield') NS.Audio.play('powerShield');
    else if (kind === 'boss_spawn') NS.Audio.play('bossSpawn');
    else if (kind === 'boss_weak_on') NS.Audio.play('weakOn');
    else if (kind === 'boss_teleport') NS.Audio.play('teleport');
    else if (kind === 'burst_on') NS.Audio.play('burst');
  });

})(typeof window !== 'undefined' ? window : globalThis);