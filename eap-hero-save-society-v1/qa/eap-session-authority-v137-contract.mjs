import fs from 'node:fs';
import vm from 'node:vm';

const authorityPath = new URL('../apps-script/EAP_SessionAuthority_v137.gs', import.meta.url);
const routerPath = new URL('../../herohealth/eap-word-quest/apps-script/SharedWebAppRouter.gs', import.meta.url);
const source = fs.readFileSync(authorityPath, 'utf8');
const router = fs.readFileSync(routerPath, 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(source, context, { filename:'EAP_SessionAuthority_v137.gs' });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expectedOrder = [
  'S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3',
  'S10','S11','S12','B4','S13','S14','S15','B5'
];
const expectedNormal = {
  S1:['Reading','Speaking'], S2:['Reading','Writing'], S3:['Reading','Writing'],
  S4:['Reading','Listening'], S5:['Reading','Writing'], S6:['Writing','Reading'],
  S7:['Writing','Speaking'], S8:['Reading','Writing'], S9:['Writing','Speaking'],
  S10:['Writing','Reading'], S11:['Writing','Speaking'], S12:['Reading','Writing'],
  S13:['Listening','Writing'], S14:['Speaking','Writing'], S15:['Writing','Speaking']
};

assert(context.EAP_SESSION_AUTHORITY_V137.includes('V137'), 'authority version is not V137');
assert(JSON.stringify(context.EAP_SESSION_ROUTE_ORDER_V137) === JSON.stringify(expectedOrder), 'route order mismatch');
Object.entries(expectedNormal).forEach(([route, skills]) => {
  const actual = context.EAP_SESSION_REQUIRED_SKILLS_V137[route];
  assert(JSON.stringify(actual) === JSON.stringify(skills), `${route} Core/Support mismatch: ${JSON.stringify(actual)}`);
  assert(actual.length === 2, `${route} must require exactly Core + Support`);
});
['B1','B2','B3','B4','B5'].forEach(route => {
  const actual = context.EAP_SESSION_REQUIRED_SKILLS_V137[route];
  assert(JSON.stringify(actual) === JSON.stringify(['Reading','Listening','Writing','Speaking']), `${route} must require four skills`);
});
assert(router.includes('eapPlayerResumeV137_'), 'router does not use eapPlayerResumeV137_');
assert(router.includes('eapSubmitEvidenceV137_'), 'router does not use eapSubmitEvidenceV137_');

const pass = (sessionId, skill, extra={}) => ({
  routeId:sessionId, sessionId, skill, score:90, bestScore:90,
  passed:true, updatedAt:new Date().toISOString(), ...extra
});
const requiredRecordsThrough = endRoute => {
  const records=[];
  for (const route of expectedOrder) {
    if (route === endRoute) break;
    for (const skill of context.EAP_SESSION_REQUIRED_SKILLS_V137[route]) records.push(pass(route, skill));
  }
  return records;
};

const s1Pass = [pass('S1','Reading'), pass('S1','Speaking')];
const s1Progress = context.eapSessionBuildProgressV137_(s1Pass);
assert(s1Progress.currentRoute === 'S2', `S1 Core + Support should unlock S2, got ${s1Progress.currentRoute}`);
assert(s1Progress.passedRoutes.includes('S1'), 'S1 missing from passed routes');

const s1Fail = [pass('S1','Reading'), {...pass('S1','Speaking'), passed:false, score:45, bestScore:45}];
assert(context.eapSessionBuildProgressV137_(s1Fail).currentRoute === 'S1', 'failed S1 Support must remain at S1');

const beforeB1 = requiredRecordsThrough('B1');
const pendingBoss = beforeB1.concat([
  pass('B1','Reading'), pass('B1','Listening'), pass('B1','Writing'),
  {...pass('B1','Speaking'), passed:false, teacherReviewRequired:true, teacherReviewStatus:'pending_teacher_review'}
]);
assert(context.eapSessionBuildProgressV137_(pendingBoss).currentRoute === 'B1', 'pending Boss Speaking must block B1');

const reviewedBoss = beforeB1.concat([
  pass('B1','Reading'), pass('B1','Listening'), pass('B1','Writing'),
  pass('B1','Speaking',{teacherReviewRequired:true, teacherReviewStatus:'reviewed'})
]);
assert(context.eapSessionBuildProgressV137_(reviewedBoss).currentRoute === 'S4', 'reviewed B1 should unlock S4');

const deduped = context.eapSessionDeduplicateV137_([
  {...pass('B1','Speaking'), passed:false, teacherReviewRequired:true, teacherReviewStatus:'pending_teacher_review', updatedAt:'2026-07-31T10:00:00Z'},
  pass('B1','Speaking',{teacherReviewRequired:true, teacherReviewStatus:'reviewed', updatedAt:'2026-07-31T09:00:00Z'})
]);
assert(deduped.length === 1 && deduped[0].teacherReviewStatus === 'reviewed', 'reviewed Boss evidence must outrank pending evidence');

console.log(JSON.stringify({
  ok:true,
  version:context.EAP_SESSION_AUTHORITY_V137,
  routes:expectedOrder.length,
  normalCoreSupport:Object.keys(expectedNormal).length,
  bossFourSkills:5,
  s1CurrentRoute:s1Progress.currentRoute,
  pendingBossRoute:context.eapSessionBuildProgressV137_(pendingBoss).currentRoute,
  reviewedBossRoute:context.eapSessionBuildProgressV137_(reviewedBoss).currentRoute
}, null, 2));
