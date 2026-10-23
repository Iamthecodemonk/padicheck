import type { FastifyInstance } from 'fastify';
import type { Database, SqlExecutor } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { audit, body, pagination, params, text, type Page } from '../trust/shared.js';

const fields='b.*,e.canonical_name,e.city,e.country_code';
type Create={canonical_name:string;business_category:string;profile_description:string;city?:string;country_code?:string;phone?:string;email?:string;website?:string;social?:string;registration_number?:string;opening_hours?:string};
export async function businessOwnerRoutes(app:FastifyInstance,db:Database,access:Authorization,enabled:boolean){
  const auth=async(request:Parameters<typeof access.authenticate>[0])=>{if(!enabled)throw new ApiError(503,'platform_unavailable','Business management requires the platform extension');await access.authenticate(request);};
  async function member(client:SqlExecutor,businessId:string,userId:string){
    const row=(await client.query(`SELECT ${fields} FROM business_profiles b JOIN entities e ON e.entity_id=b.entity_id WHERE b.business_profile_id=$1
      AND (b.claimed_by_user_id=$2 OR EXISTS(SELECT 1 FROM business_memberships m WHERE m.business_profile_id=b.business_profile_id AND m.users_id=$2))`,[businessId,userId])).rows[0];
    if(!row)throw new ApiError(404,'business_not_found','Managed business was not found');return row;
  }
  app.get<{Querystring:Page}>('/v1/me/businesses',{onRequest:auth,schema:{querystring:pagination}},async request=>({businesses:(await db.query(`SELECT ${fields},
    CASE WHEN b.claimed_by_user_id=$1 THEN 'owner' ELSE m.member_role END AS member_role
    FROM business_profiles b JOIN entities e ON e.entity_id=b.entity_id LEFT JOIN business_memberships m ON m.business_profile_id=b.business_profile_id AND m.users_id=$1
    WHERE b.claimed_by_user_id=$1 OR m.users_id=$1 ORDER BY b.created_at DESC,b.business_profile_id LIMIT $2 OFFSET $3`,[request.principal!.users_id,request.query.limit??20,request.query.offset??0])).rows}));
  app.get<{Params:{id:string}}>('/v1/businesses/:id',{onRequest:auth,schema:{params:params('id')}},async request=>{
    const business=await member(db,request.params.id,request.principal!.users_id);
    const identifiers=(await db.query("SELECT identifier_type,value FROM identifiers WHERE entity_id=$1 AND visibility='public' ORDER BY identifier_type,identifier_id",[business.entity_id])).rows;
    const verification_review=(await db.query("SELECT status,reviewed_at FROM business_verification_requests WHERE business_profile_id=$1 AND (reviewed_at IS NULL OR reviewed_at>=COALESCE((SELECT (to_jsonb(bp)->'profile_details'->>'verification_invalidated_at')::timestamptz FROM business_profiles bp WHERE business_profile_id=$1),'-infinity'::timestamptz)) ORDER BY submitted_at DESC,verification_request_id DESC LIMIT 1",[request.params.id])).rows[0]??null;
    return {business,identifiers,verification_review,limitations:['Business ownership and verification are separate. Draft profiles are not publicly listed.']};
  });
  app.post<{Body:Create}>('/v1/businesses',{onRequest:auth,bodyLimit:16384,config:{rateLimit:{max:5,timeWindow:'1 minute'}},schema:{body:body({
    canonical_name:text(200),business_category:text(100),profile_description:text(5000,30),city:text(150),country_code:{type:'string',pattern:'^[A-Z]{2}$'},
    phone:{type:'string',pattern:'^\\+?[0-9 ()-]{7,25}$'},email:{type:'string',format:'email',maxLength:254},website:{type:'string',format:'uri',maxLength:2048},social:text(2048),registration_number:text(100),opening_hours:text(500),
  },['canonical_name','business_category','profile_description'])}},async(request,reply)=>{
    if(!request.principal!.email_verified_at)throw new ApiError(403,'verified_email_required','Verify your email before registering a business');
    const input=request.body;if(input.website&&!/^https?:\/\//i.test(input.website))throw new ApiError(400,'invalid_website','Use an HTTP or HTTPS website URL');
    const business=await db.transaction(async client=>{
      // Serialize per creator, enforce a bounded draft count and prevent duplicate submits.
      await client.query('SELECT users_id FROM users WHERE users_id=$1 FOR UPDATE',[request.principal!.users_id]);
      const existing=await client.query(`SELECT 1 FROM business_profiles b JOIN entities e ON e.entity_id=b.entity_id
        WHERE b.claimed_by_user_id=$1 AND lower(e.canonical_name)=lower($2) AND COALESCE(e.city,'')=COALESCE($3,'')`,[request.principal!.users_id,input.canonical_name.trim(),input.city??null]);
      if(existing.rowCount)throw new ApiError(409,'business_exists','You already manage a business with these details');
      const count=(await client.query('SELECT count(*)::integer AS count FROM business_profiles WHERE claimed_by_user_id=$1',[request.principal!.users_id])).rows[0]!;
      if(Number(count.count)>=25)throw new ApiError(409,'business_limit','Contact support before adding more businesses');
      const entity=(await client.query("INSERT INTO entities(entity_type,canonical_name,city,country_code,description) VALUES ('business',$1,$2,$3,$4) RETURNING entity_id",[input.canonical_name.trim(),input.city??null,input.country_code??null,input.profile_description.trim()])).rows[0]!;
      const row=(await client.query(`INSERT INTO business_profiles(entity_id,business_category,profile_description,claimed_by_user_id,profile_details)
        VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,[entity.entity_id,input.business_category,input.profile_description.trim(),request.principal!.users_id,JSON.stringify({opening_hours:input.opening_hours??null})])).rows[0]!;
      for(const [kind,value] of [['phone',input.phone],['email',input.email],['url',input.website],['social_profile',input.social],['registration_number',input.registration_number]]){
        if(value)await client.query("INSERT INTO identifiers(entity_id,identifier_type,value,normalized_value,visibility) VALUES ($1,$2,$3,$4,'public')",[entity.entity_id,kind,value,value.toLowerCase().trim()]);
      }
      await audit(client,request,'businesses.register','business_profile',row.business_profile_id,null,{profile_status:'draft'});
      return {...row,canonical_name:input.canonical_name.trim(),city:input.city??null,country_code:input.country_code??null};
    });
    return reply.code(201).send({business});
  });
  app.get<{Params:{id:string};Querystring:Page}>('/v1/businesses/:id/reports',{onRequest:auth,schema:{params:params('id'),querystring:pagination}},async request=>{
    const business=await member(db,request.params.id,request.principal!.users_id);
    return {reports:(await db.query(`SELECT user_report_id,entity_id,title,description,report_category,submitted_at,status FROM user_reports
      WHERE entity_id=$1 AND status='published' ORDER BY submitted_at DESC,user_report_id DESC LIMIT $2 OFFSET $3`,[business.entity_id,request.query.limit??20,request.query.offset??0])).rows,
      limitations:['Published reports remain moderated user allegations.']};
  });
  app.patch<{Params:{id:string};Body:Partial<Create>}>('/v1/businesses/:id/details',{onRequest:auth,bodyLimit:16384,schema:{params:params('id'),body:{...body({canonical_name:text(200),business_category:text(100),profile_description:text(5000),city:text(150),phone:{type:'string',maxLength:25,pattern:'^[+0-9 ()-]*$'},email:{type:'string',format:'email',maxLength:254},website:{type:'string',maxLength:2048},social:{type:'string',maxLength:2048},registration_number:{type:'string',maxLength:100},opening_hours:{type:'string',maxLength:500}},[]),minProperties:1}}},async request=>db.transaction(async client=>{
    const id=request.params.id;const input=request.body;const userId=request.principal!.users_id;
    await client.query('SELECT business_profile_id FROM business_profiles WHERE business_profile_id=$1 FOR UPDATE',[id]);
    const before=await member(client,id,userId);
    if(before.claimed_by_user_id!==userId&&!(await client.query("SELECT 1 FROM business_memberships WHERE business_profile_id=$1 AND users_id=$2 AND member_role IN ('manager','editor')",[id,userId])).rowCount)throw new ApiError(404,'business_not_found','Editable business was not found');
    if(input.website&&!/^https?:\/\//i.test(input.website))throw new ApiError(400,'invalid_website','Use an HTTP or HTTPS website URL');
    const oldReg=(await client.query("SELECT value FROM identifiers WHERE entity_id=$1 AND identifier_type='registration_number' AND visibility='public'",[before.entity_id])).rows[0]?.value;
    const identityChanged=input.canonical_name!==undefined&&input.canonical_name.trim()!==before.canonical_name||input.registration_number!==undefined&&input.registration_number.trim()!==(oldReg||'');
    if(identityChanged&&before.claimed_by_user_id!==userId)throw new ApiError(403,'owner_required','Only the owner can change business identity');
    const details={...(before.profile_details as Record<string,unknown>||{}),...(input.opening_hours!==undefined?{opening_hours:input.opening_hours}:{}),...(identityChanged?{verification_invalidated_at:new Date().toISOString()}:{})};
    await client.query('UPDATE entities SET canonical_name=COALESCE($2,canonical_name),city=COALESCE($3,city),updated_at=now() WHERE entity_id=$1',[before.entity_id,input.canonical_name?.trim()??null,input.city??null]);
    const updated=(await client.query('UPDATE business_profiles SET business_category=COALESCE($2,business_category),profile_description=COALESCE($3,profile_description),profile_details=$4::jsonb,updated_at=now() WHERE business_profile_id=$1 RETURNING *',[id,input.business_category??null,input.profile_description??null,JSON.stringify(details)])).rows[0]!;
    for(const [kind,value] of [['phone',input.phone],['email',input.email],['url',input.website],['social_profile',input.social],['registration_number',input.registration_number]])if(value!==undefined){await client.query("DELETE FROM identifiers WHERE entity_id=$1 AND identifier_type=$2 AND visibility='public'",[before.entity_id,kind]);if(value)await client.query("INSERT INTO identifiers(entity_id,identifier_type,value,normalized_value,visibility) VALUES ($1,$2,$3,$4,'public')",[before.entity_id,kind,value,value.toLowerCase().trim()]);}
    await audit(client,request,'businesses.profile.update','business_profile',id,{canonical_name:before.canonical_name},{canonical_name:input.canonical_name??before.canonical_name,identity_changed:identityChanged});
    return {business:updated,reverification_required:identityChanged};
  }));

}
