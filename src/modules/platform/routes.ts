import type { FastifyInstance } from 'fastify';
import type { Database } from '../../database/index.js';
import type { Authorization } from '../authorization/index.js';
import { ApiError } from '../../errors.js';
import { body, pagination, params, type Page } from '../trust/shared.js';

export const notificationTypes = ['investigation.completed','investigation.failed','business.invitation'];
export async function platformRoutes(app: FastifyInstance, db: Database, access: Authorization, enabled: boolean) {
  const auth = async (request: Parameters<typeof access.authenticate>[0]) => {
    if (!enabled) throw new ApiError(503, 'platform_unavailable', 'Platform extension is not enabled');
    await access.authenticate(request);
  };
  app.addHook('onSend', async (request, reply, payload) => { if (request.url.startsWith('/v1/me/') || request.url.includes('/bookmark')) reply.header('Cache-Control','no-store'); return payload; });
  app.get<{ Querystring: Page }>('/v1/me/bookmarks', { onRequest: auth, schema: { querystring: pagination } }, async request => {
    if (!access.can(request.principal!, 'investigations.read_own') && !access.can(request.principal!, 'investigations.read_all')) throw new ApiError(403,'forbidden','Investigation read permission required');
    return { bookmarks: (await db.query(`SELECT b.investigation_id,b.created_at AS bookmarked_at,i.title,i.status,i.investigation_type
      FROM investigation_bookmarks b JOIN investigations i ON i.investigation_id=b.investigation_id
      WHERE b.users_id=$1 AND i.user_id=$1 ORDER BY b.created_at DESC,b.investigation_id LIMIT $2 OFFSET $3`,
    [request.principal!.users_id,request.query.limit??20,request.query.offset??0])).rows };
  });
  for (const method of ['POST','DELETE'] as const) app.route<{ Params: { id: string } }>({ method, url: '/v1/investigations/:id/bookmark',
    onRequest: auth, schema: { params: params('id') }, handler: async (request, reply) => {
      const id=request.principal!.users_id;
      if (!access.can(request.principal!,'investigations.read_own') && !access.can(request.principal!,'investigations.read_all')) throw new ApiError(403,'forbidden','Investigation read permission required');
      const own=await db.query('SELECT 1 FROM investigations WHERE investigation_id=$1 AND user_id=$2',[request.params.id,id]);
      if(!own.rowCount)throw new ApiError(404,'investigation_not_found','Investigation was not found');
      if(method==='POST') { await db.query('INSERT INTO investigation_bookmarks(users_id,investigation_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[id,request.params.id]);return {bookmarked:true}; }
      await db.query('DELETE FROM investigation_bookmarks WHERE users_id=$1 AND investigation_id=$2',[id,request.params.id]);return reply.code(204).send();
    } });
  app.get<{ Querystring: Page & { unread_only?: boolean } }>('/v1/me/notifications', { onRequest: auth,
    schema: { querystring: { ...pagination, properties: { ...pagination.properties, unread_only: { type:'boolean',default:false } } } } }, async request => ({
    notifications: (await db.query(`SELECT notification_id,notification_type,related_id,read_at,created_at FROM user_notifications WHERE users_id=$1
      AND (NOT $2::boolean OR read_at IS NULL) ORDER BY created_at DESC,notification_id LIMIT $3 OFFSET $4`,
    [request.principal!.users_id,request.query.unread_only??false,request.query.limit??20,request.query.offset??0])).rows,
  }));
  app.post<{ Params:{id:string} }>('/v1/me/notifications/:id/read', { onRequest:auth,schema:{params:params('id')} },async request=>{
    const row=(await db.query('UPDATE user_notifications SET read_at=COALESCE(read_at,now()) WHERE notification_id=$1 AND users_id=$2 RETURNING notification_id,read_at',[request.params.id,request.principal!.users_id])).rows[0];
    if(!row)throw new ApiError(404,'notification_not_found','Notification was not found');return {notification:row};
  });
  app.get('/v1/me/notification-preferences',{onRequest:auth},async request=>{
    const rows=await db.query<{notification_type:string;enabled:boolean}>('SELECT notification_type,enabled FROM notification_preferences WHERE users_id=$1',[request.principal!.users_id]);
    return {preferences:notificationTypes.map(notification_type=>({notification_type,enabled:rows.rows.find(row=>row.notification_type===notification_type)?.enabled??true}))};
  });
  app.patch<{Body:{notification_type:string;enabled:boolean}}>('/v1/me/notification-preferences',{onRequest:auth,
    schema:{body:body({notification_type:{type:'string',enum:notificationTypes},enabled:{type:'boolean'}},['notification_type','enabled'])}},async request=>{
    await db.query(`INSERT INTO notification_preferences(users_id,notification_type,enabled) VALUES ($1,$2,$3)
      ON CONFLICT(users_id,notification_type) DO UPDATE SET enabled=EXCLUDED.enabled`,[request.principal!.users_id,request.body.notification_type,request.body.enabled]);
    return {preference:request.body};
  });
}
