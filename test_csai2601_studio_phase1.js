const fs = require('fs');
const vm = require('vm');

const file = process.argv[2] || 'sgnal-hunt/js/uxq-studio-practice-canonical-v1.js';
const source = fs.readFileSync(file, 'utf8');
const context = { window:{} };
vm.createContext(context);
vm.runInContext(source, context, { filename:file });

const pack = context.window.CSAI2601_UXQ_STUDIO_PRACTICE_V1;
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function keysFor(item) {
  return item.fields.map(field => field.key);
}
function evidenceKeys(value) {
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

assert(pack, 'Studio pack not exported');
assert(pack.phase === 'W1-W3+B1', 'Unexpected phase');
assert(pack.policy.unlockChangedByThisPack === false, 'Phase 1 must not change official unlock');
assert(JSON.stringify(pack.items.map(item => item.id)) === JSON.stringify(['W1','W2','W3','B1']), 'Node scope mismatch');

const expectedArtifacts = {
  W1:'UX First Impression Audit',
  W2:'UX Process Map / HCD Sprint Brief',
  W3:'Cognitive Load Repair Note',
  B1:'Foundation UX Defense Sheet'
};

for (const item of pack.items) {
  assert(item.canonicalArtifact === expectedArtifacts[item.id], `${item.id}: canonical artifact mismatch`);
  assert(item.fields.length === 8, `${item.id}: receiver-safe field count must remain 8`);
  const keys = keysFor(item);
  assert(new Set(keys).size === keys.length, `${item.id}: duplicate field key`);
  ['projectId','figmaUrl','reflection'].forEach(key => assert(keys.includes(key), `${item.id}: missing ${key}`));
  item.fields.forEach(field => {
    assert(field.required === true, `${item.id}/${field.key}: all Phase 1 fields must be required`);
    assert(field.key === 'figmaUrl' || Number(field.minLength || 0) > 0, `${item.id}/${field.key}: missing minimum evidence length`);
  });
  Object.values(item.evidenceMap).flatMap(evidenceKeys).forEach(key => assert(keys.includes(key), `${item.id}: evidence map references missing ${key}`));
  assert(item.selfChecks.length === 5, `${item.id}: expected 5 self-checks`);
}

const w2Keys = keysFor(pack.byId('W2'));
assert(!w2Keys.some(key => /persona|hmw/i.test(key)), 'W2 must not collect Persona or HMW');
const w3Keys = keysFor(pack.byId('W3'));
assert(w3Keys.includes('psychologyDiagnosis') && w3Keys.includes('beforeAfterDecision'), 'W3 must include psychology diagnosis and Before–After');
const b1 = pack.byId('B1');
assert(/W1/.test(b1.practiceFlow.join(' ')) && /W2/.test(b1.practiceFlow.join(' ')) && /W3/.test(b1.practiceFlow.join(' ')), 'B1 must synthesize W1-W3');

console.log(`PASS ${pack.version}: ${pack.items.length} nodes, ${pack.items.reduce((sum,item) => sum + item.fields.length, 0)} structured fields`);
