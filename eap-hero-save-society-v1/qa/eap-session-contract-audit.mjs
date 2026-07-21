import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.cwd(), 'eap-hero-save-society-v1');
const enginePath = path.join(root, 'eap-session-ultimate-engine-v20260711.js');
const receiverPath = path.join(root, 'EAP_HeroSkillContract.gs');

const expected = {
  S1: ['Reading', 'Speaking'],
  S2: ['Reading', 'Writing'],
  S3: ['Reading', 'Writing'],
  S4: ['Reading', 'Listening'],
  S5: ['Reading', 'Speaking'],
  S6: ['Reading', 'Writing'],
  S7: ['Writing', 'Speaking'],
  S8: ['Reading', 'Writing'],
  S9: ['Writing', 'Speaking'],
  S10: ['Reading', 'Writing'],
  S11: ['Writing', 'Speaking'],
  S12: ['Reading', 'Writing'],
  S13: ['Listening', 'Writing'],
  S14: ['Writing', 'Speaking'],
  S15: ['Writing', 'Speaking']
};

function normalize(list) {
  return [...list].map(String).sort();
}

function parsePairs(source) {
  const out = {};
  const re = /S(1[0-5]|[1-9])\s*:\s*\[\s*['"](Reading|Listening|Writing|Speaking)['"]\s*,\s*['"](Reading|Listening|Writing|Speaking)['"]\s*\]/g;
  let match;
  while ((match = re.exec(source))) {
    out[`S${Number(match[1])}`] = [match[2], match[3]];
  }
  return out;
}

function compare(label, actual, errors) {
  for (const [sid, wanted] of Object.entries(expected)) {
    const got = actual[sid];
    if (!got) {
      errors.push(`${label}: missing ${sid}`);
      continue;
    }
    if (JSON.stringify(normalize(got)) !== JSON.stringify(normalize(wanted))) {
      errors.push(`${label}: ${sid} expected ${wanted.join(' + ')} but found ${got.join(' + ')}`);
    }
  }
}

const engine = fs.readFileSync(enginePath, 'utf8');
const receiver = fs.readFileSync(receiverPath, 'utf8');
const enginePairs = parsePairs(engine);
const receiverPairs = parsePairs(receiver);
const errors = [];

compare('Browser engine', enginePairs, errors);
compare('Sheet receiver', receiverPairs, errors);

for (const sid of Object.keys(expected)) {
  if (JSON.stringify(normalize(enginePairs[sid] || [])) !== JSON.stringify(normalize(receiverPairs[sid] || []))) {
    errors.push(`Cross-layer mismatch: ${sid}`);
  }
}

if (!/first:\{[^}]*tasks:8/.test(engine)) errors.push('First Mission must contain 8 tasks.');
if (!/replay:\{[^}]*tasks:11/.test(engine)) errors.push('Replay Remix must contain 11 tasks.');
if (!/elite:\{[^}]*tasks:13/.test(engine)) errors.push('Elite Remix must contain 13 tasks.');
if (!/add\(['"]Reflection['"],\s*['"]Reflection['"],\s*['"]reflection['"]/.test(engine)) errors.push('Reflection stage is missing from the session plan.');
if (!/add\(['"]Mini Rescue['"],\s*exposureSkill\(skills\),\s*['"]exposure['"]/.test(engine)) errors.push('Exposure/Mini Rescue stage is missing from the session plan.');

const result = {
  ok: errors.length === 0,
  sessionsChecked: Object.keys(expected).length,
  layersChecked: ['browser-engine', 'sheet-receiver'],
  errors
};

console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
