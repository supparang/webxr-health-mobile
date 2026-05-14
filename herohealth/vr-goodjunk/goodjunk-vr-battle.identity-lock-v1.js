/* HeroHealth • GoodJunk Battle Identity Lock v1
   FILE: /herohealth/vr-goodjunk/goodjunk-vr-battle.identity-lock-v1.js
   PATCH: v20260514t
*/
(() => {
  'use strict';

  const PATCH_ID = 'v20260514t-identity-lock-v1';

  if (window.__GJ_BATTLE_IDENTITY_LOCK_V1__) return;
  window.__GJ_BATTLE_IDENTITY_LOCK_V1__ = PATCH_ID;

  const qs = new URLSearchParams(location.search);

  function clean(v){
    return String(v ?? '').trim();
  }

  function cleanRoom(v){
    let s = clean(v).toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');

    if (!s) return '';

    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s
        .replace(/^GJ-BT/i,'')
        .replace(/^GJBT/i,'')
        .replace(/^BT/i,'')
        .replace(/^-/, '');
    }

    return s.slice(0,16);
  }

  function readSaved(){
    try{
      const a = sessionStorage.getItem('HHA_GJ_BATTLE_LOCAL_IDENTITY');
      const b = localStorage.getItem('HHA_GJ_BATTLE_LOCAL_IDENTITY');
      return JSON.parse(a || b || 'null');
    }catch(_){
      return null;
    }
  }

  function sameRoom(savedRoom, urlRoom){
    return cleanRoom(savedRoom) && cleanRoom(savedRoom) === cleanRoom(urlRoom);
  }

  function rewriteUrlIdentity(saved){
    if (!saved) return;

    const urlRoom = qs.get('roomId') || qs.get('room') || '';
    if (!sameRoom(saved.roomId, urlRoom)) return;

    const savedPid = clean(saved.pid);
    const savedName = clean(saved.name || saved.nick);
    const savedNick = clean(saved.nick || saved.name);
    const savedRole = saved.role === 'host' ? 'host' : 'guest';

    if (!savedPid || !savedName) return;

    const currentPid = clean(qs.get('pid'));
    const currentName = clean(qs.get('name') || qs.get('nick'));
    const currentRole = clean(qs.get('role'));

    const needsRewrite =
      currentPid !== savedPid ||
      currentName !== savedName ||
      currentRole !== savedRole;

    window.HHA_GJ_BATTLE_IDENTITY_LOCK = {
      patch: PATCH_ID,
      roomId: cleanRoom(saved.roomId),
      pid: savedPid,
      name: savedName,
      nick: savedNick,
      role: savedRole,
      host: savedRole === 'host' ? '1' : '0',
      lockedAt: Date.now()
    };

    if (!needsRewrite) return;

    const u = new URL(location.href);

    u.searchParams.set('pid', savedPid);
    u.searchParams.set('name', savedName);
    u.searchParams.set('nick', savedNick);
    u.searchParams.set('role', savedRole);
    u.searchParams.set('host', savedRole === 'host' ? '1' : '0');

    u.searchParams.set('room', cleanRoom(saved.roomId));
    u.searchParams.set('roomId', cleanRoom(saved.roomId));

    u.searchParams.set('mode','battle');
    u.searchParams.set('entry','battle');
    u.searchParams.set('recommendedMode','battle');
    u.searchParams.set('multiplayer','1');

    history.replaceState(null, '', u.toString());

    console.warn('[GJ Battle Identity Lock] rewritten URL identity', {
      from:{ pid:currentPid, name:currentName, role:currentRole },
      to:{ pid:savedPid, name:savedName, role:savedRole }
    });
  }

  rewriteUrlIdentity(readSaved());
})();
