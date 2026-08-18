import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

/** HeroHealth P5 Production Rules R11 — roster-driven strict learner access. */
const HERE=path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ID='herohealth-learning';
const DEFAULT_SA=path.join(HERE,'service-account.json');
const MARKER='HEROHEALTH_P5_PRODUCTION_STRICT_R11';
function arg(name,fallback=''){const p=`--${name}=`;const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback;}
function fail(m){console.error(`\n❌ ${m}\n`);process.exit(1);}
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
function matchingBrace(source,openIndex){let depth=0,state='normal';for(let i=openIndex;i<source.length;i+=1){const c=source[i],n=source[i+1];if(state==='line'){if(c==='\n')state='normal';continue}if(state==='block'){if(c==='*'&&n==='/'){state='normal';i+=1}continue}if(state==='single'){if(c==='\\'){i+=1;continue}if(c==="'")state='normal';continue}if(state==='double'){if(c==='\\'){i+=1;continue}if(c==='"')state='normal';continue}if(c==='/'&&n==='/'){state='line';i+=1;continue}if(c==='/'&&n==='*'){state='block';i+=1;continue}if(c==="'"){state='single';continue}if(c==='"'){state='double';continue}if(c==='{')depth+=1;if(c==='}'&&--depth===0)return i}return-1}
function databaseBlock(source){const start=source.indexOf('match /databases/');if(start<0)throw Error('ไม่พบ match /databases/{database}/documents');const docs=source.indexOf('/documents',start);if(docs<0)throw Error('ไม่พบ /documents');const open=source.indexOf('{',docs+'/documents'.length);if(open<0)throw Error('ไม่พบ database block opening brace');const close=matchingBrace(source,open);if(close<0)throw Error('หา database block closing brace ไม่สำเร็จ');return{open,close}}
function removeAllExactMatchBlocks(source,signature){let out=source;while(true){const at=out.indexOf(signature);if(at<0)break;const open=out.indexOf('{',at+signature.length);if(open<0)throw Error(`match block ไม่สมบูรณ์: ${signature}`);const close=matchingBrace(out,open);if(close<0)throw Error(`หา closing brace ไม่พบ: ${signature}`);let end=close+1;while(end<out.length&&/[ \t]/.test(out[end]))end+=1;if(out[end]==='\r')end+=1;if(out[end]==='\n')end+=1;out=out.slice(0,at)+out.slice(end)}return out}
function strictBlock(){return `

    // ${MARKER}_BEGIN
    function hhP5TeacherR11() {
      return request.auth != null && request.auth.token.heroHealthTeacher == true;
    }
    function hhStudentIdFormatR11(value) {
      return value is string && value.matches('^[0-9A-Za-z_-]{3,40}$');
    }
    function hhRosterActiveR11(studentId) {
      return hhStudentIdFormatR11(studentId)
        && exists(/databases/$(database)/documents/students/$(studentId))
        && get(/databases/$(database)/documents/students/$(studentId)).data.active == true;
    }
    function hhHasBindingR11() {
      return request.auth != null
        && exists(/databases/$(database)/documents/studentBindings/$(request.auth.uid));
    }
    function hhBoundIdR11() {
      return get(/databases/$(database)/documents/studentBindings/$(request.auth.uid)).data.studentId;
    }
    function hhBoundR11(studentId) {
      return hhHasBindingR11()
        && hhBoundIdR11() == studentId
        && hhRosterActiveR11(studentId);
    }
    function hhOwnAssessmentDocR11(documentId) {
      return hhHasBindingR11()
        && hhRosterActiveR11(hhBoundIdR11())
        && documentId.matches('^' + hhBoundIdR11() + '_.*$');
    }
    function hhProgressKeysR11() {
      return [
        'studentId',
        'pretestCompleted','posttestCompleted','assessments','assessmentAuthorityRelease',
        'gameCompleted','gameResults','attemptHistory','analyticsSummary','dailyAnalytics',
        'currentZone','lastGame','lastGameScore','lastAttemptId',
        'firebaseReceiptToken','firebaseSavedByUid','analyticsSchemaVersion','strictProgressionRelease',
        'postExperienceCompleted','postExperience','postExperienceReceiptToken',
        'reflectionCompleted','reflection','reflectionReceiptToken',
        'researchImmediateCompleted','researchImmediate','researchFlowRelease','completed',
        'certificateIssued','certificate','certificateReceiptToken',
        'followupCompleted','followup','followupReceiptToken',
        'updatedByUid','updatedAt','build'
      ];
    }

    match /studentBindings/{uid} {
      allow get: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null
        && request.auth.uid == uid
        && request.resource.data.uid == request.auth.uid
        && hhRosterActiveR11(request.resource.data.studentId);
      allow list, delete: if false;
    }

    match /studentProgress/{studentId} {
      allow get: if hhP5TeacherR11() || hhBoundR11(studentId);
      allow list: if hhP5TeacherR11();
      allow create: if hhBoundR11(studentId)
        && request.resource.data.studentId == studentId
        && request.resource.data.keys().hasOnly(hhProgressKeysR11());
      allow update: if hhBoundR11(studentId)
        && request.resource.data.studentId == studentId
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(hhProgressKeysR11());
      allow delete: if false;
    }

    match /studentAssessments/{documentId} {
      allow get: if hhP5TeacherR11() || hhOwnAssessmentDocR11(documentId);
      allow list: if hhP5TeacherR11();
      allow create, update: if request.resource.data.studentId is string
        && hhBoundR11(request.resource.data.studentId)
        && documentId.matches('^' + request.resource.data.studentId + '_.*$')
        && request.resource.data.completed == true
        && request.resource.data.firebaseSavedByUid == request.auth.uid
        && request.resource.data.assessmentType in [
          'pretest','posttest','post_experience','reflection','certificate','followup'
        ];
      allow delete: if false;
    }
    // ${MARKER}_END
`;}
function patch(source){let out=source.replace(/\n\s*\/\/ HEROHEALTH_P5_PRODUCTION_STRICT_R11_BEGIN[\s\S]*?\/\/ HEROHEALTH_P5_PRODUCTION_STRICT_R11_END\n?/g,'\n');for(const sig of['match /studentBindings/{uid}','match /studentProgress/{studentId}','match /studentAssessments/{documentId}'])out=removeAllExactMatchBlocks(out,sig);const db=databaseBlock(out);return`${out.slice(0,db.close)}${strictBlock()}${out.slice(db.close)}`}
async function compile(rules,source){return rules.createRuleset(rules.createRulesFileFromSource('firestore.rules',source));}
const saPath=path.resolve(arg('service-account',DEFAULT_SA)),publish=/^(1|true|yes)$/i.test(arg('publish','0'));if(!fs.existsSync(saPath))fail(`ไม่พบ Service Account: ${saPath}`);let sa;try{sa=JSON.parse(fs.readFileSync(saPath,'utf8'))}catch(e){fail(`อ่าน Service Account ไม่สำเร็จ: ${e.message}`)}if(sa.project_id!==PROJECT_ID)fail(`Service Account ต้องเป็น project ${PROJECT_ID}`);
const app=getApps().length?getApps()[0]:initializeApp({credential:cert(sa),projectId:PROJECT_ID}),rules=getSecurityRules(app);console.log('🔎 อ่าน live Firestore Rules...');const live=await rules.getFirestoreRuleset(),sourceFile=(live.source||[]).find(f=>String(f.content||'').includes('service cloud.firestore'));if(!sourceFile)fail('ไม่พบ Firestore rules source');const source=String(sourceFile.content||''),backup=path.join(os.tmpdir(),`herohealth-before-p5-strict-r11-${stamp()}.rules`);fs.writeFileSync(backup,source,'utf8');console.log(`✅ Backup: ${backup}`);console.log(`   Live ruleset: ${live.name}`);
let candidateSource;try{candidateSource=patch(source)}catch(e){fail(`สร้าง R11 patch ไม่สำเร็จ: ${e.message}`)}const staged=path.join(HERE,'p5-production-strict-r11-staged.rules');fs.writeFileSync(staged,candidateSource,'utf8');console.log(`📝 Staged: ${staged}`);let candidate;try{candidate=await compile(rules,candidateSource);console.log(`✅ R11 compile ผ่าน: ${candidate.name}`)}catch(e){fail(`R11 compile ไม่ผ่าน; live rules ยังไม่เปลี่ยน: ${e?.details||e?.message||e}`)}
if(!publish){console.log('\n🧪 DRY RUN สำเร็จ — ยังไม่ได้เปลี่ยน live rules');console.log('ตรวจ staged rules แล้วรันใหม่ด้วย --publish=1 เมื่อต้องการ release');process.exit(0)}console.log('🚀 Publish P5 Production Strict R11...');try{await rules.releaseFirestoreRuleset(candidate)}catch(e){fail(`Publish ไม่สำเร็จ; live rules เดิมยังอยู่: ${e.message}`)}console.log('\n✅ P5 Production Strict R11 published');console.log(`   Previous: ${live.name}`);console.log(`   Current:  ${candidate.name}`);console.log(`   Backup:   ${backup}`);console.log(`   Staged:   ${staged}`);console.log('   Policy: roster-active + UID-bound progress/assessment, allowlisted mutations, no learner delete');
