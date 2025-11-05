export class SFX{
  static async init(){ return new SFX(); }
  constructor(){ this.coach = new (await import('./coach.js')).Coach(); }
  async play(name){ await this.coach.sfx(name); }
}
