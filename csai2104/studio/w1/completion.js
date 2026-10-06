export class ProgressStore {
  constructor(){ this.records = new Map(); }
  async save(userId, missionId){
    const key = userId + ":" + missionId;
    this.records.set(key,{userId,missionId,status:"COMPLETE"});
    return this.records.get(key);
  }
  read(userId, missionId){ return this.records.get(userId + ":" + missionId) || null; }
}

export async function completeMission({ui,api,userId,missionId}){
  // W1 STARTER BUG:
  // The client promotes COMPLETE before the authoritative save is acknowledged.
  ui.state = "COMPLETE";
  const response = await api.postComplete({userId,missionId});
  return response;
}
