export class Progression {
  constructor(){this.k='hha_profile';this.data=this._load();}
  _load(){try{return JSON.parse(localStorage.getItem(this.k)||'{}');}catch{return{};}}
  _save(){localStorage.setItem(this.k,JSON.stringify(this.data));}
  addXP(amount,reason=''){const d=this.data;d.xp=(d.xp||0)+Math.max(0,amount|0);
    const lv=1+Math.floor((d.xp||0)/600);d.level=lv;this._save();return{xp:d.xp,level:lv,reason};}
  grantBadge(id,xp=100){const d=this.data;d.badges=d.badges||{};
    if(!d.badges[id]){d.badges[id]=true;this.addXP(xp,`badge:${id}`);this._save();return true;}
    return false;}
  getProfile(){const d=this.data||{};return{xp:d.xp||0,level:d.level||1,badges:Object.keys(d.badges||{})};}
}
