const fs = require('fs');
const files = {
  workflow:'sgnal-hunt/apps-script/UXQuestStudioWorkflow-v1.gs',
  router:'sgnal-hunt/apps-script/UXQuestStudioRouterPatch-v1.gs',
  dashboard:'sgnal-hunt/apps-script/UXQuestStudioDashboard-v1.html',
  portfolio:'sgnal-hunt/apps-script/UXQuestPortfolioBuilder-v1.html',
  status:'sgnal-hunt/js/uxq-studio-status-v1.js'
};
function assert(ok,msg){if(!ok)throw new Error(msg)}
const src={};Object.entries(files).forEach(([k,p])=>{src[k]=fs.readFileSync(p,'utf8');assert(src[k].length>20,`${k} empty`)});
assert(!/function\s+doGet\s*\(/.test(src.workflow+src.router),'Studio files must not declare doGet');
assert(!/function\s+doPost\s*\(/.test(src.workflow+src.router),'Studio files must not declare doPost');
['UXQ_getStudentStudioProgress_','UXQ_teacherStudioOverview','UXQ_teacherReviewStudio','UXQ_teacherPortfolioData','UXQ_setupStudioWorkflow'].forEach(n=>assert(src.workflow.includes(`function ${n}`),`missing ${n}`));
['UXQuest_Studio_Reviews','UXQuest_Studio_Audit','need_revision','approved'].forEach(v=>assert(src.workflow.includes(v),`missing workflow token ${v}`));
assert(src.router.includes('uxq_student_studio_progress'),'missing student route');
assert(src.router.includes("view === 'studio'")&&src.router.includes("view === 'portfolio'"),'missing teacher routes');
assert(src.dashboard.includes('UXQ_teacherReviewStudio'),'dashboard review call missing');
assert(src.portfolio.includes('UXQ_teacherPortfolioData'),'portfolio data call missing');
assert(src.status.includes('uxq_student_studio_progress'),'mission control status route missing');
console.log('PASS CSAI2601 Studio workflow static contract');
