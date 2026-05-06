// === /herohealth/zone-return.js ===
// PATCH v20260506-ZONE-RETURN-SAFE-EXPORTS
// ✅ export buildHubRoot
// ✅ export buildReturnUrl / withCommonParams / preserveParams
// ✅ safe URL decode
// ✅ preserve HeroHealth common params
// ✅ ใช้ได้กับ group-v1.html และหน้า launcher อื่น ๆ

'use strict';

const DEFAULT_HUB = './hub-v2.html';
const DEFAULT_ZONE = './nutrition-zone.html';

const PASS_KEYS = [
  'pid',
  'name',
  'nick',
  'nickName',
  'studentKey',
  'schoolCode',
  'classRoom',
  'studentNo',

  'diff',
  'time',
  'view',
  'run',
  'seed',

  'hub',
  'hubRoot',
  'returnHub',
  'zone',
  'cat',
  'game',
  'gameId',
  'mode',
  'entry',
  'recommendedMode',

  'studyId',
  'phase',
  'conditionGroup',
  'section',
  'session_code',
  'sessionCode',
  'sessionNo',
  'weekNo',
  'teacher',
  'grade',

  'api',
  'log',
  'debug'
];

export function safeDecodeUrl(raw, fallback = ''){
  try{
    let s = String(raw || '').trim();
    if(!s) return fallback;

    for(let i = 0; i < 2; i++){
      try{
        const d = decodeURIComponent(s);
        if(d === s) break;
        s = d;
      }catch(_){
        break;
      }
    }

    return new URL(s, window.location.href).toString();
  }catch(_){
    return fallback;
  }
}

export function getSearchParams(){
  try{
    return new URLSearchParams(window.location.search || '');
  }catch(_){
    return new URLSearchParams('');
  }
}

export function buildHubRoot(fallback = DEFAULT_HUB){
  try{
    const p = getSearchParams();

    const explicit =
      p.get('hubRoot') ||
      p.get('hub') ||
      p.get('returnHub') ||
      '';

    const decoded = safeDecodeUrl(explicit, '');
    if(decoded) return decoded;

    return new URL(fallback || DEFAULT_HUB, window.location.href).toString();
  }catch(_){
    return fallback || DEFAULT_HUB;
  }
}

export function buildReturnUrl(path = DEFAULT_ZONE, extra = {}){
  try{
    const u = new URL(path || DEFAULT_ZONE, window.location.href);
    const p = getSearchParams();

    PASS_KEYS.forEach(k => {
      const v = p.get(k);
      if(v !== null && v !== '') u.searchParams.set(k, v);
    });

    if(extra && typeof extra === 'object'){
      Object.keys(extra).forEach(k => {
        const v = extra[k];
        if(v !== undefined && v !== null && v !== '') {
          u.searchParams.set(k, String(v));
        }
      });
    }

    if(!u.searchParams.get('pid')) u.searchParams.set('pid', p.get('pid') || 'anon');
    if(!u.searchParams.get('name')) u.searchParams.set('name', p.get('name') || p.get('nick') || 'Hero');
    if(!u.searchParams.get('diff')) u.searchParams.set('diff', p.get('diff') || 'normal');
    if(!u.searchParams.get('view')) u.searchParams.set('view', p.get('view') || 'mobile');

    return u.toString();
  }catch(_){
    return String(path || DEFAULT_ZONE);
  }
}

export function withCommonParams(path = DEFAULT_ZONE, extra = {}){
  return buildReturnUrl(path, extra);
}

export function preserveParams(path = DEFAULT_ZONE, extra = {}){
  return buildReturnUrl(path, extra);
}

export function goTo(path = DEFAULT_ZONE, extra = {}){
  window.location.href = buildReturnUrl(path, extra);
}

export function getParam(name, fallback = ''){
  try{
    const p = getSearchParams();
    const v = p.get(name);
    return v === null || v === '' ? fallback : v;
  }catch(_){
    return fallback;
  }
}

export default {
  safeDecodeUrl,
  getSearchParams,
  buildHubRoot,
  buildReturnUrl,
  withCommonParams,
  preserveParams,
  goTo,
  getParam
};
