import crypto from "node:crypto";
import { empiricalGuestConsentGate } from "./empirical-gate.js";

// Accountless participation: no User rows, names, emails or employee IDs.
// Public routes must be mounted BEFORE attachActor; ADMIN routes AFTER it.
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const isUniqueViolation = (error) => error?.code === "P2002";
function studyHash(code) {
  const salt=String(process.env.RESEARCH_HASH_SALT||"");
  if (salt.length < 16) throw new Error("RESEARCH_HASH_SALT_REQUIRED_FOR_GUEST_ENROLLMENT");
  return crypto.createHmac("sha256",salt).update("ACTIVA_GUEST_STUDY_V1|"+code).digest("hex");
}
function credential(req) {
  const match=String(req.get("authorization")||"").match(/^GuestPass\s+([A-Za-z0-9_-]{32,128})$/);
  return match?.[1] || "";
}
async function resolveGuest(req, prisma) {
  const raw=credential(req);
  if(!raw)return {status:401,error:"GUEST_PASS_REQUIRED"};
  const guest=await prisma.guestParticipant.findUnique({
    where:{passTokenHash:hash(raw)},
    include:{activity:{include:{policy:true}},attendance:true},
  });
  if(!guest)return {status:401,error:"GUEST_PASS_INVALID"};
  if(guest.withdrawnAt || guest.revokedAt)return {status:410,error:"GUEST_PASS_REVOKED"};
  if(guest.expiresAt<=new Date())return {status:410,error:"GUEST_PASS_EXPIRED"};
  return {guest};
}
function publicAudit(tx,action,entityId,metadata={}) {
  return tx.auditLog.create({
    data:{actorId:null,action,entityType:"GuestParticipant",entityId,metadata},
  });
}
async function verifiedDynamicQR(prisma, verifyEventToken, token, guest, purpose) {
  const parsed=verifyEventToken(token);
  if(!parsed.ok)return {error:parsed.reason,status:400};
  if(parsed.payload.purpose!==purpose)return {error:"QR_PURPOSE_MISMATCH",status:409};
  if(parsed.payload.eventId!==guest.activityId)return {error:"QR_ACTIVITY_MISMATCH",status:409};
  const stored=await prisma.qrToken.findUnique({
    where:{tokenHash:hash(token)},
    select:{activityId:true,nonce:true,expiresAt:true,revokedAt:true},
  });
  if(!stored || stored.revokedAt || stored.expiresAt<=new Date() ||
     stored.activityId!==guest.activityId || stored.nonce!==parsed.payload.nonce){
    return {error:"EVENT_QR_NOT_ACTIVE",status:409};
  }
  return {ok:true};
}

export function registerGuestPublicRoutes(app,{prisma,verifyEventToken,checkinWindowState,checkoutWindowState}) {
  app.get("/api/public/guest/session",async(req,res,next)=>{
    try{
      const found=await resolveGuest(req,prisma);
      if(found.error)return res.status(found.status).json({ok:false,error:found.error});
      const g=found.guest;
      res.json({
        ok:true,accountRequired:false,containsDirectPII:false,
        guestRef:g.id.slice(-8),activity:{
          id:g.activity.id,title:g.activity.title,category:g.activity.category,
          startAt:g.activity.startAt,endAt:g.activity.endAt,
          checkinOpenAt:g.activity.checkinOpenAt,checkinCloseAt:g.activity.checkinCloseAt,
          checkoutOpenAt:g.activity.checkoutOpenAt,checkoutCloseAt:g.activity.checkoutCloseAt,
          dataClassification:g.activity.dataClassification,
        },
        consent:{version:g.consentVersion,text:g.consentText,accepted:Boolean(g.consentAt)},
        attendance:g.attendance?{
          id:g.attendance.id,checkinAt:g.attendance.checkinAt,
          checkoutAt:g.attendance.checkoutAt,identityVerified:g.attendance.identityVerified,
          staffVerified:false,
          isVoided:g.attendance.isVoided,
        }:null,
        expiresAt:g.expiresAt,
      });
    }catch(e){next(e);}
  });

  app.post("/api/public/guest/consent",async(req,res,next)=>{
    try{
      const found=await resolveGuest(req,prisma);
      if(found.error)return res.status(found.status).json({ok:false,error:found.error});
      const g=found.guest;
      if(g.activity.pilotClosedAt)return res.status(423).json({ok:false,error:"ACTIVITY_CLOSED"});
      const researchConsent=empiricalGuestConsentGate(g.activity.dataClassification,g.consentVersion,g.consentText);
      if(!researchConsent.ok)return res.status(409).json({ok:false,error:researchConsent.error});
      if(req.body?.accepted!==true || req.body?.version!==g.consentVersion)
        return res.status(400).json({ok:false,error:"EXPLICIT_CONSENT_AND_VERSION_REQUIRED"});
      if(g.consentAt)return res.json({ok:true,accepted:true,idempotent:true});
      const updated=await prisma.$transaction(async(tx)=>{
        const result=await tx.guestParticipant.updateMany({
          where:{id:g.id,consentAt:null,revokedAt:null,withdrawnAt:null,expiresAt:{gt:new Date()}},
          data:{consentAt:new Date()},
        });
        if(!result.count)return false;
        await publicAudit(tx,"GUEST_CONSENT_ACCEPTED",g.id,{version:g.consentVersion,activityId:g.activityId});
        return true;
      });
      if(!updated)return res.status(409).json({ok:false,error:"GUEST_CONSENT_SESSION_CHANGED"});
      res.json({ok:true,accepted:true});
    }catch(e){next(e);}
  });

  app.post("/api/public/guest/checkin",async(req,res,next)=>{
    try{
      const found=await resolveGuest(req,prisma);
      if(found.error)return res.status(found.status).json({ok:false,error:found.error});
      const g=found.guest;
      if(g.activity.pilotClosedAt)return res.status(423).json({ok:false,error:"ACTIVITY_CLOSED"});
      const researchCheckin=empiricalGuestConsentGate(g.activity.dataClassification,g.consentVersion,g.consentText);
      if(!researchCheckin.ok)return res.status(409).json({ok:false,error:researchCheckin.error});
      if(!g.consentAt)return res.status(409).json({ok:false,error:"GUEST_CONSENT_REQUIRED"});
      if(g.attendance)return res.status(409).json({ok:false,error:g.attendance.checkoutAt?"ACTIVITY_ALREADY_COMPLETED":"ALREADY_CHECKED_IN"});
      const window=checkinWindowState(g.activity);
      if(!window.ok)return res.status(409).json({ok:false,error:window.code});
      const qr=await verifiedDynamicQR(prisma,verifyEventToken,String(req.body?.eventToken||""),g,"CHECKIN");
      if(qr.error)return res.status(qr.status).json({ok:false,error:qr.error});

      const attendance=await prisma.$transaction(async(tx)=>{
        // The UNIQUE guestParticipantId constraint rejects concurrent double scans.
        const row=await tx.attendanceRecord.create({
          data:{
            activityId:g.activityId,
            guestParticipantId:g.id,
            userId:null,
            checkinAt:new Date(),
            attendanceStatus:"CHECKED_IN",
            qrValid:true,
            identityVerified:false, // A bearer pass is NOT identity evidence.
            scanAttempts:1,
          },
        });
        await publicAudit(tx,"GUEST_CHECKIN",g.id,{activityId:g.activityId,attendanceId:row.id,identityVerified:false});
        return row;
      });
      res.status(201).json({
        ok:true,attendanceId:attendance.id,checkinAt:attendance.checkinAt,
        identityVerified:false,identityCheckRequired:true,
        note:"Pass possession is not identity verification. An authorized reviewer must witness the guest in person.",
      });
    }catch(e){
      if(isUniqueViolation(e))return res.status(409).json({ok:false,error:"ALREADY_CHECKED_IN"});
      next(e);
    }
  });

  app.post("/api/public/guest/checkout",async(req,res,next)=>{
    try{
      const found=await resolveGuest(req,prisma);
      if(found.error)return res.status(found.status).json({ok:false,error:found.error});
      const g=found.guest;
      if(g.activity.pilotClosedAt)return res.status(423).json({ok:false,error:"ACTIVITY_CLOSED"});
      const a=g.attendance;
      if(!a?.checkinAt)return res.status(409).json({ok:false,error:"CHECKIN_REQUIRED"});
      if(a.isVoided)return res.status(409).json({ok:false,error:"ATTENDANCE_VOIDED"});
      if(a.checkoutAt)return res.status(409).json({ok:false,error:"ALREADY_CHECKED_OUT"});
      const window=checkoutWindowState(g.activity);
      if(!window.ok)return res.status(409).json({ok:false,error:window.code});
      const qr=await verifiedDynamicQR(prisma,verifyEventToken,String(req.body?.eventToken||""),g,"CHECKOUT");
      if(qr.error)return res.status(qr.status).json({ok:false,error:qr.error});

      const checkoutAt=new Date();
      const minutes=Math.max(0,Math.round((checkoutAt.getTime()-a.checkinAt.getTime())/60000));
      const scheduled=Math.max(1,Math.round((g.activity.endAt.getTime()-g.activity.startAt.getTime())/60000));
      const updated=await prisma.$transaction(async(tx)=>{
        const change=await tx.attendanceRecord.updateMany({
          where:{id:a.id,guestParticipantId:g.id,checkoutAt:null,isVoided:false},
          data:{
            checkoutAt,checkoutQrValid:true,checkoutMethod:"DYNAMIC_QR",
            checkoutExceptionReason:null,durationMinutes:minutes,
            attendancePercentage:Math.min(100,minutes/scheduled*100),
            attendanceStatus:"CHECKED_OUT",finalEvidenceStatus:null,
          },
        });
        if(!change.count)return false;
        await tx.consistencyResult.deleteMany({where:{attendanceId:a.id}});
        await publicAudit(tx,"GUEST_CHECKOUT",g.id,{activityId:g.activityId,attendanceId:a.id,checkoutQrValid:true});
        return true;
      });
      if(!updated)return res.status(409).json({ok:false,error:"ALREADY_CHECKED_OUT"});
      res.json({ok:true,attendanceId:a.id,checkoutAt,durationMinutes:minutes});
    }catch(e){next(e);}
  });

  app.post("/api/public/guest/withdraw",async(req,res,next)=>{
    try{
      const found=await resolveGuest(req,prisma);
      if(found.error)return res.status(found.status).json({ok:false,error:found.error});
      if(req.body?.confirmWithdrawal!==true)return res.status(400).json({ok:false,error:"WITHDRAWAL_CONFIRMATION_REQUIRED"});
      const g=found.guest;
      const changed=await prisma.$transaction(async(tx)=>{
        const result=await tx.guestParticipant.updateMany({
          where:{id:g.id,withdrawnAt:null},
          data:{withdrawnAt:new Date(),revokedAt:new Date()},
        });
        if(!result.count)return false;
        await publicAudit(tx,"GUEST_CONSENT_WITHDRAWN",g.id,{activityId:g.activityId,researchUseExcluded:true});
        return true;
      });
      res.json({ok:true,withdrawn:changed||Boolean(g.withdrawnAt),researchUseExcluded:true});
    }catch(e){next(e);}
  });
}

export function registerGuestAdminRoutes(app,{prisma,requireRoles,audit}) {
  app.get("/api/activities/:activityId/guest-passes",requireRoles("ADMIN"),async(req,res,next)=>{
    try{
      const rows=await prisma.guestParticipant.findMany({
        where:{activityId:req.params.activityId},
        include:{attendance:{select:{id:true,checkinAt:true,checkoutAt:true,identityVerified:true,isVoided:true}}},
        orderBy:{createdAt:"desc"},
      });
      res.json({ok:true,containsDirectPII:false,credentialsIncluded:false,guests:rows.map(g=>({
        id:g.id,guestRef:g.id.slice(-8),createdAt:g.createdAt,
        consentVersion:g.consentVersion,consentAccepted:Boolean(g.consentAt),
        expired:g.expiresAt<=new Date(),revoked:Boolean(g.revokedAt),withdrawn:Boolean(g.withdrawnAt),
        attendance:g.attendance,
      }))});
    }catch(e){next(e);}
  });

  app.post("/api/activities/:activityId/guest-passes",requireRoles("ADMIN"),async(req,res,next)=>{
    try{
      const activity=await prisma.activity.findUnique({where:{id:req.params.activityId}});
      if(!activity)return res.status(404).json({ok:false,error:"ACTIVITY_NOT_FOUND"});
      if(activity.pilotClosedAt)return res.status(423).json({ok:false,error:"ACTIVITY_CLOSED"});
      if(!["QA_TEST","EMPIRICAL"].includes(activity.dataClassification))
        return res.status(409).json({ok:false,error:"ACTIVITY_RESEARCH_CLASSIFICATION_REQUIRED"});
      if(activity.participationMode!=="OPEN")return res.status(409).json({ok:false,error:"GUEST_PASS_REQUIRES_OPEN_PARTICIPATION"});
      const windowEnd=activity.checkoutCloseAt || new Date(activity.endAt.getTime()+30*60000);
      if(windowEnd.getTime()<=Date.now())return res.status(409).json({ok:false,error:"GUEST_REGISTRATION_CLOSED"});
      const code=String(req.body?.studyCode||"").trim().toUpperCase();
      const version=String(req.body?.consentVersion||"").trim();
      const statement=String(req.body?.consentText||"").trim();
      if(!/^SUBJ-[A-Z0-9_-]{6,64}$/.test(code))
        return res.status(400).json({ok:false,error:"PSEUDONYMOUS_STUDY_CODE_REQUIRED"});
      if(!/^[A-Za-z0-9._-]{3,60}$/.test(version) || statement.length<30 || statement.length>4000)
        return res.status(400).json({ok:false,error:"APPROVED_CONSENT_TEXT_AND_VERSION_REQUIRED"});
      const researchIssue=empiricalGuestConsentGate(activity.dataClassification,version,statement);
      if(!researchIssue.ok)return res.status(409).json({ok:false,error:researchIssue.error});
      if(req.body?.adminAttestation!==true)
        return res.status(400).json({ok:false,error:"ADMIN_GUEST_ENROLLMENT_ATTESTATION_REQUIRED"});
      const raw=crypto.randomBytes(32).toString("base64url");
      const stable=studyHash(code);
      const expiry=new Date(windowEnd.getTime()+60*60000);
      const g=await prisma.guestParticipant.create({data:{
        activityId:activity.id,studyHash:stable,passTokenHash:hash(raw),
        consentVersion:version,consentText:statement,expiresAt:expiry,issuedById:req.activaUser.id,
      }});
      await audit(req,"GUEST_PASS_ISSUED","GuestParticipant",g.id,{
        activityId:activity.id,classification:activity.dataClassification,
        consentVersion:version,rawTokenPersisted:false,
      });
      res.status(201).json({
        ok:true,guestId:g.id,guestRef:g.id.slice(-8),
        path:"/guest#token="+encodeURIComponent(raw),
        expiresAt:expiry,tokenReturnedOnce:true,rawTokenPersisted:false,
        containsDirectPII:false,identityVerified:false,consentAccepted:false,
        note:"Deliver this link privately to the actual guest. The study code must be held separately from identity information.",
      });
    }catch(e){
      if(isUniqueViolation(e))return res.status(409).json({ok:false,error:"GUEST_ALREADY_REGISTERED_FOR_ACTIVITY"});
      next(e);
    }
  });

  // Reissue only an unused, revoked pass; old credential stays permanently invalid.
  app.post("/api/activities/:activityId/guest-passes/:guestId/reissue",requireRoles("ADMIN"),async(req,res,next)=>{
    try{
      const reason=String(req.body?.reason||"").trim();
      if(reason.length<10)return res.status(400).json({ok:false,error:"REISSUE_REASON_REQUIRED"});
      const g=await prisma.guestParticipant.findFirst({
        where:{id:req.params.guestId,activityId:req.params.activityId},
        include:{attendance:true,activity:true},
      });
      if(!g)return res.status(404).json({ok:false,error:"GUEST_NOT_FOUND"});
      const researchReissue=empiricalGuestConsentGate(g.activity.dataClassification,g.consentVersion,g.consentText);
      if(!researchReissue.ok)return res.status(409).json({ok:false,error:researchReissue.error});
      if(g.withdrawnAt)return res.status(410).json({ok:false,error:"GUEST_WITHDRAWAL_FINAL"});
      if(!g.revokedAt)return res.status(409).json({ok:false,error:"REVOKE_OLD_PASS_FIRST"});
      if(g.attendance)return res.status(409).json({ok:false,error:"ATTENDANCE_ALREADY_EXISTS_CANNOT_REISSUE"});
      if(g.activity.pilotClosedAt || g.expiresAt<=new Date())return res.status(409).json({ok:false,error:"GUEST_REGISTRATION_CLOSED"});
      const raw=crypto.randomBytes(32).toString("base64url");
      await prisma.guestParticipant.update({
        where:{id:g.id},
        data:{passTokenHash:hash(raw),revokedAt:null,consentAt:null},
      });
      await audit(req,"GUEST_PASS_REISSUED","GuestParticipant",g.id,{activityId:g.activityId,reason,consentMustBeRenewed:true});
      res.status(201).json({ok:true,path:"/guest#token="+encodeURIComponent(raw),guestRef:g.id.slice(-8),
        tokenReturnedOnce:true,rawTokenPersisted:false,consentAccepted:false});
    }catch(e){next(e);}
  });

  // Supports withdrawal when a participant has lost the original pass.
  app.post("/api/activities/:activityId/guest-passes/:guestId/withdraw",requireRoles("ADMIN"),async(req,res,next)=>{
    try{
      const reason=String(req.body?.reason||"").trim();
      if(reason.length<10 || req.body?.participantRequestConfirmed!==true)
        return res.status(400).json({ok:false,error:"DOCUMENTED_PARTICIPANT_WITHDRAWAL_REQUIRED"});
      const g=await prisma.guestParticipant.findFirst({
        where:{id:req.params.guestId,activityId:req.params.activityId},
      });
      if(!g)return res.status(404).json({ok:false,error:"GUEST_NOT_FOUND"});
      if(g.withdrawnAt)return res.json({ok:true,withdrawn:true,idempotent:true});
      await prisma.$transaction(async(tx)=>{
        await tx.guestParticipant.update({where:{id:g.id},data:{withdrawnAt:new Date(),revokedAt:new Date()}});
        await tx.auditLog.create({data:{
          actorId:req.activaUser.id,action:"GUEST_CONSENT_WITHDRAWN_BY_ADMIN",
          entityType:"GuestParticipant",entityId:g.id,
          metadata:{activityId:g.activityId,reason,participantRequestConfirmed:true,researchUseExcluded:true},
        }});
      });
      res.json({ok:true,withdrawn:true,researchUseExcluded:true});
    }catch(e){next(e);}
  });

  app.post("/api/activities/:activityId/guest-passes/:guestId/revoke",requireRoles("ADMIN"),async(req,res,next)=>{
    try{
      const reason=String(req.body?.reason||"").trim();
      if(reason.length<10)return res.status(400).json({ok:false,error:"REVOCATION_REASON_REQUIRED"});
      const guest=await prisma.guestParticipant.findFirst({
        where:{id:req.params.guestId,activityId:req.params.activityId},
      });
      if(!guest)return res.status(404).json({ok:false,error:"GUEST_NOT_FOUND"});
      if(guest.revokedAt)return res.json({ok:true,revoked:true,idempotent:true});
      await prisma.guestParticipant.update({where:{id:guest.id},data:{revokedAt:new Date()}});
      await audit(req,"GUEST_PASS_REVOKED","GuestParticipant",guest.id,{
        activityId:guest.activityId,reason,researchUseExcluded:true,
      });
      res.json({ok:true,revoked:true,researchUseExcluded:true});
    }catch(e){next(e);}
  });
}
