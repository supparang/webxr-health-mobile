/* =========================================================
   EAP Progress Seed v151
   Fast one-time seed for test account 50 only.
   Requires EAP_ProgressAuthority_v150.gs in the same project.
========================================================= */

var EAP_PROGRESS_SEED_V151_VERSION = '20260812-EAP-PROGRESS-SEED-V151';

function eapProgressSeedTest50V151_() {
  if (typeof eapProgressUpsertV150_ !== 'function') {
    return {ok:false, version:EAP_PROGRESS_SEED_V151_VERSION, error:'EAP_ProgressAuthority_v150.gs is not installed'};
  }

  var base = {studentId:'50', section:'122', studentName:'KK'};
  var evidence = [
    {routeId:'S1', skill:'Reading',   score:100, passed:true},
    {routeId:'S1', skill:'Speaking',  score:100, passed:true},
    {routeId:'S2', skill:'Reading',   score:100, passed:true},
    {routeId:'S2', skill:'Writing',   score:61,  passed:true},
    {routeId:'S3', skill:'Reading',   score:100, passed:true},
    {routeId:'S3', skill:'Writing',   score:88,  passed:true},
    {routeId:'B1', skill:'Reading',   score:100, passed:true},
    {routeId:'B1', skill:'Listening', score:100, passed:true},
    {routeId:'B1', skill:'Writing',   score:100, passed:true},
    {routeId:'B1', skill:'Speaking',  score:100, passed:true, teacherReviewStatus:'approved'},
    {routeId:'S4', skill:'Reading',   score:100, passed:true},
    {routeId:'S4', skill:'Listening', score:97,  passed:true},
    {routeId:'S5', skill:'Reading',   score:66,  passed:true}
  ];

  var results = [];
  evidence.forEach(function(item, index) {
    var payload = {};
    Object.keys(base).forEach(function(k){ payload[k] = base[k]; });
    Object.keys(item).forEach(function(k){ payload[k] = item[k]; });
    payload.evidenceId = 'seed-v151-50-' + item.routeId + '-' + item.skill.toLowerCase();
    results.push(eapProgressUpsertV150_(payload, {}));
  });

  var resume = eapPlayerResumeV150_({studentId:'50', section:'122'});
  return {
    ok:true,
    service:'eap-progress-seed',
    version:EAP_PROGRESS_SEED_V151_VERSION,
    seeded:results.length,
    currentRoute:resume.currentRoute,
    s5:resume.routeProgress && resume.routeProgress.S5 ? resume.routeProgress.S5 : null,
    results:results
  };
}

function EAP_progressSeedTest50V151(){
  var result = eapProgressSeedTest50V151_();
  Logger.log(JSON.stringify(result));
  return result;
}
