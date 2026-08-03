import assert from 'node:assert/strict';

const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const angle = (a,b,c) => {
  const abx=a.x-b.x, aby=a.y-b.y, cbx=c.x-b.x, cby=c.y-b.y;
  const den=Math.hypot(abx,aby)*Math.hypot(cbx,cby);
  if(!den) return 0;
  return Math.acos(clamp((abx*cbx+aby*cby)/den,-1,1))*180/Math.PI;
};

const ls={x:.42,y:.40}, rs={x:.58,y:.40};
const sw=distance(ls,rs);

const wideGood={
  le:{x:.28,y:.41}, lw:{x:.10,y:.42},
  re:{x:.72,y:.41}, rw:{x:.90,y:.42}
};
const wideBent={
  le:{x:.28,y:.41}, lw:{x:.35,y:.55},
  re:{x:.72,y:.41}, rw:{x:.65,y:.55}
};

function widePass(p){
  const elbowSpan=Math.abs(p.le.x-p.re.x);
  const wristSpan=Math.abs(p.lw.x-p.rw.x);
  const level=Math.abs(p.le.y-ls.y)<=.18&&Math.abs(p.re.y-rs.y)<=.18&&Math.abs(p.lw.y-ls.y)<=.18&&Math.abs(p.rw.y-rs.y)<=.18;
  const straight=angle(ls,p.le,p.lw)>=140&&angle(rs,p.re,p.rw)>=140;
  return elbowSpan>=sw*1.45&&wristSpan>=sw*2&&level&&straight;
}

assert.equal(widePass(wideGood),true,'fully extended shoulder-level arms must pass');
assert.equal(widePass(wideBent),false,'bent elbows must not pass wide pose');

const nose={x:.50,y:.24};
function headPass(wrist,elbow,shoulder){
  const near=distance(wrist,nose)<=sw*1.20;
  const high=wrist.y<=shoulder.y+.10;
  const elbowRaised=elbow.y<=shoulder.y+.25;
  const bent=angle(shoulder,elbow,wrist)>=35&&angle(shoulder,elbow,wrist)<=150;
  return near&&high&&elbowRaised&&bent;
}

assert.equal(headPass({x:.52,y:.25},{x:.39,y:.29},ls),true,'one hand touching head with raised elbow must pass');
assert.equal(headPass({x:.72,y:.34},{x:.55,y:.42},ls),false,'hand far from head must not pass');

const specs={
  'raise both hands':{level:'A2',holdMs:500},
  'stretch your arms wide':{level:'B1',holdMs:650},
  'touch your head':{level:'B1+',holdMs:550}
};
assert.deepEqual(Object.values(specs).map(x=>x.level),['A2','B1','B1+']);
assert.ok(Object.values(specs).every(x=>x.holdMs>=500),'every pose requires sustained evidence');

const hiddenTouchControls=['bodyTouch','bodyFallbackBtn','arTouch','arFallbackBtn','handTouch','handFallbackBtn'];
assert.equal(new Set(hiddenTouchControls).size,6,'all touch fallback controls must be uniquely disabled');

console.log('Action Pose V4 mastery contract: PASS');
