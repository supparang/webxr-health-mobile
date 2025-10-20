(function(){
const evt = (name, detail) => document.dispatchEvent(new CustomEvent(name, {detail}));
const defaultState = { scene:'hub', game:'cardio', mode:'timed', diff:'normal', lang:'en' };
window.APP = window.APP || {};
APP.state = {...defaultState};
APP.setState = function(partial){ APP.state = {...APP.state, ...partial}; evt('app:state-change', {state:APP.state}); };
})();
