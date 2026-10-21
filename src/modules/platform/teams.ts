import type { FastifyInstance } from 'fastify';
import type { Database, SqlExecutor } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { body, pagination, params, text, uuid, type Page, audit } from '../trust/shared.js';
const memberRole={type:'string',enum:['manager','editor','viewer']};
export async function teamRoutes(app:FastifyInstance,db:Database,access:Authorization,enabled:boolean){
  const auth=async(request:Parameters<typeof access.authenticate>[0])=>{
    if(!enabled)throw new ApiError(503,'platform_unavailable','Platform extension is not enabled');await access.authenticate(request);
    if(!request.principal!.email_verified_at)throw new ApiError(403,'verified_email_required','Verify your email before using business teams');
  };
  app.addHook('onSend',async(request,reply,payload)=>{if(request.url.startsWith('/v1/businesses/')||request.url.startsWith('/v1/me/business-invitations'))reply.header('Cache-Control','no-store');return payload;});
  async function owner(client:SqlExecutor,id:string,userId:string){
    const row=(await client.query('SELECT claimed_by_user_id FROM business_profiles WHERE business_profile_id=$1 FOR UPDATE',[id])).rows[0];
    if(!row||row.claimed_by_user_id!==userId)throw new ApiError(404,'business_not_found','Owned business was not found');
  }
  app.get<{Params:{id:string}}>('/v1/businesses/:id/team',{onRequest:auth,schema:{params:params('id')}},async request=>db.transaction(async client=>{
    await owner(client,request.params.id,request.principal!.users_id);
    return {owner_user_id:request.principal!.users_id,members:(await client.query(`SELECT m.users_id,u.display_name,m.member_role,m.joined_at FROM business_memberships m
      JOIN users u ON u.users_id=m.users_id WHERE m.business_profile_id=$1 ORDER BY m.joined_at,m.users_id`,[request.params.id])).rows,
      invitations:(await client.query(`SELECT invitation_id,email,member_role,expires_at,accepted_at,revoked_at FROM business_invitations
        WHERE business_profile_id=$1 ORDER BY created_at DESC LIMIT 100`,[request.params.id])).rows};
  }));
  app.post<{Params:{id:string};Body:{email:string;member_role:string}}>('/v1/businesses/:id/invitations',{onRequest:auth,
    config:{rateLimit:{max:10,timeWindow:'1 minute'}},schema:{params:params('id'),body:body({email:{type:'string',format:'email',maxLength:254},member_role:memberRole},['email','member_role'])}},async(request,reply)=>{
    const invitation=await db.transaction(async client=>{
      const userId=request.principal!.users_id;await owner(client,request.params.id,userId);const email=request.body.email.trim().toLowerCase();
      if(email===request.principal!.email.toLowerCase())throw new ApiError(409,'already_owner','Owner already has business access');
      const count=await client.query(`SELECT count(*)::integer AS count FROM business_invitations WHERE business_profile_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now()`,[request.params.id]);
      if(count.rows[0]!.count>=100)throw new ApiError(409,'invitation_limit','Too many outstanding invitations');
      await client.query(`UPDATE business_invitations SET revoked_at=now() WHERE business_profile_id=$1 AND email=$2 AND accepted_at IS NULL AND revoked_at IS NULL`,[request.params.id,email]);
      const row=(await client.query(`INSERT INTO business_invitations(business_profile_id,invited_by_user_id,email,member_role) VALUES ($1,$2,$3,$4)
        RETURNING invitation_id,email,member_role,expires_at`,[request.params.id,userId,email,request.body.member_role])).rows[0]!;
      await client.query(`INSERT INTO user_notifications(users_id,notification_type,event_key,related_id)
        SELECT u.users_id,'business.invitation',$2,$3 FROM users u WHERE lower(u.email)=$1 AND u.account_status='active'
        AND COALESCE((SELECT enabled FROM notification_preferences WHERE users_id=u.users_id AND notification_type='business.invitation'),true)
        ON CONFLICT DO NOTHING`,[email,`business.invitation:${row.invitation_id}`,row.invitation_id]);
      await audit(client,request,'business.invitation.create','business_profile',request.params.id,null,{invitation_id:row.invitation_id,member_role:row.member_role});return row;
    });return reply.code(201).send({invitation,delivery:'in_app'});
  });
  app.get<{Querystring:Page}>('/v1/me/business-invitations',{onRequest:auth,schema:{querystring:pagination}},async request=>({
    invitations:(await db.query(`SELECT i.invitation_id,i.business_profile_id,i.member_role,i.expires_at FROM business_invitations i
      JOIN business_profiles b ON b.business_profile_id=i.business_profile_id WHERE i.email=lower($1) AND i.accepted_at IS NULL
      AND i.revoked_at IS NULL AND i.expires_at>now() AND b.claimed_by_user_id=i.invited_by_user_id
      ORDER BY i.created_at DESC,i.invitation_id LIMIT $2 OFFSET $3`,[request.principal!.email,request.query.limit??20,request.query.offset??0])).rows,
  }));
  app.post<{Params:{id:string}}>('/v1/me/business-invitations/:id/accept',{onRequest:auth,schema:{params:params('id')}},async request=>{
    const accepted=await db.transaction(async client=>{
      // Stable lock order: profile first, then invitation, matching owner operations.
      const initial=(await client.query('SELECT business_profile_id FROM business_invitations WHERE invitation_id=$1 AND email=lower($2)',[request.params.id,request.principal!.email])).rows[0];
      if(!initial)return false;
      const profile=(await client.query('SELECT claimed_by_user_id FROM business_profiles WHERE business_profile_id=$1 FOR UPDATE',[initial.business_profile_id])).rows[0];
      const invitation=(await client.query(`SELECT * FROM business_invitations WHERE invitation_id=$1 AND email=lower($2) AND revoked_at IS NULL
        AND expires_at>now() FOR UPDATE`,[request.params.id,request.principal!.email])).rows[0];
      if(!invitation||profile?.claimed_by_user_id!==invitation.invited_by_user_id)return false;
      if(invitation.accepted_at)return true;
      await client.query(`INSERT INTO business_memberships(business_profile_id,users_id,member_role) VALUES ($1,$2,$3)
        ON CONFLICT(business_profile_id,users_id) DO NOTHING`,[initial.business_profile_id,request.principal!.users_id,invitation.member_role]);
      await client.query('UPDATE business_invitations SET accepted_at=now() WHERE invitation_id=$1',[request.params.id]);
      await audit(client,request,'business.invitation.accept','business_profile',initial.business_profile_id,null,{member_role:invitation.member_role});return true;
    });if(!accepted)throw new ApiError(404,'invitation_not_found','Invitation was not found or is unavailable');return {accepted:true};
  });
  app.delete<{Params:{id:string;invitation_id:string}}>('/v1/businesses/:id/invitations/:invitation_id',{onRequest:auth,
    schema:{params:{...params('id'),required:['id','invitation_id'],properties:{id:uuid,invitation_id:uuid}}}},async(request,reply)=>{
    await db.transaction(async client=>{await owner(client,request.params.id,request.principal!.users_id);
      const row=await client.query('UPDATE business_invitations SET revoked_at=COALESCE(revoked_at,now()) WHERE business_profile_id=$1 AND invitation_id=$2 RETURNING invitation_id',[request.params.id,request.params.invitation_id]);
      if(!row.rowCount)throw new ApiError(404,'invitation_not_found','Invitation was not found');
      await audit(client,request,'business.invitation.revoke','business_profile',request.params.id,null,{invitation_id:request.params.invitation_id});});return reply.code(204).send();
  });
  for(const method of ['PATCH','DELETE'] as const)app.route<{Params:{id:string;users_id:string};Body:{member_role:string}}>({method,url:'/v1/businesses/:id/team/:users_id',onRequest:auth,
    schema:{params:{type:'object',additionalProperties:false,required:['id','users_id'],properties:{id:uuid,users_id:uuid}},...(method==='PATCH'?{body:body({member_role:memberRole},['member_role'])}:{})},
    handler:async(request,reply)=>{
      await db.transaction(async client=>{await owner(client,request.params.id,request.principal!.users_id);
        const result=method==='PATCH'?await client.query('UPDATE business_memberships SET member_role=$3 WHERE business_profile_id=$1 AND users_id=$2 RETURNING users_id',[request.params.id,request.params.users_id,request.body.member_role]):
          await client.query('DELETE FROM business_memberships WHERE business_profile_id=$1 AND users_id=$2 RETURNING users_id',[request.params.id,request.params.users_id]);
        if(!result.rowCount)throw new ApiError(404,'member_not_found','Member was not found');
        await audit(client,request,`business.member.${method==='PATCH'?'update':'remove'}`,'business_profile',request.params.id,null,{users_id:request.params.users_id,...(method==='PATCH'?{member_role:request.body.member_role}:{})});
      });return method==='DELETE'?reply.code(204).send():{updated:true};
    }});
  app.patch<{Params:{id:string};Body:{profile_description?:string|null;business_category?:string}}>('/v1/businesses/:id/profile',{onRequest:auth,
    schema:{params:params('id'),body:{...body({profile_description:{anyOf:[text(5000),{type:'null'}]},business_category:text(100)}),minProperties:1}}},async request=>db.transaction(async client=>{
      const before=(await client.query('SELECT * FROM business_profiles WHERE business_profile_id=$1 FOR UPDATE',[request.params.id])).rows[0];
      if(!before)throw new ApiError(404,'business_not_found','Business was not found');
      if(before.claimed_by_user_id!==request.principal!.users_id){
        const member=await client.query("SELECT 1 FROM business_memberships WHERE business_profile_id=$1 AND users_id=$2 AND member_role IN ('manager','editor') FOR SHARE",[request.params.id,request.principal!.users_id]);
        if(!member.rowCount)throw new ApiError(404,'business_not_found','Business was not found');
      }
      const row=(await client.query(`UPDATE business_profiles SET profile_description=$2,business_category=$3 WHERE business_profile_id=$1
        RETURNING business_profile_id,profile_description,business_category`,[request.params.id,request.body.profile_description===undefined?before.profile_description:request.body.profile_description,request.body.business_category??before.business_category])).rows[0]!;
      await audit(client,request,'business.profile.edit','business_profile',request.params.id,{profile_description:before.profile_description,business_category:before.business_category},row);return {business:row};
    }));
}
