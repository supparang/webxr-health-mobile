(function(){
function apply(){
const p = new URLSearchParams(location.search);
const patch = {};
const keys = ['game','mode','diff','lang'];
keys.forEach(k=>{ const v=p.get(k); if(v) patch[k]=v; });
if (Object.keys(patch).length) APP.setState(patch);
}
document.addEventListener('DOMContentLoaded', apply);
})();
