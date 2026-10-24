import type {Database} from '../../database/index.js';

// Historical reads never contact Bachs or grant credits. Paid subscription
// checkouts are excluded: their verified invoice grants represent the charge.
export async function billingHistory(db:Database,userId:string,environment:string,limit:number,offset:number){
 const result=await db.query(`SELECT * FROM (
 SELECT 'checkout:'||c.billing_checkout_id::text AS id,'checkout' AS kind,
 COALESCE(c.paid_at,c.updated_at) AS at,c.offer_snapshot->>'display_name' AS description,
 c.offer_snapshot->>'amount' AS amount,c.offer_snapshot->>'currency' AS currency,c.status,
 (c.offer_snapshot->>'investigation_units')::integer AS credits,
 c.provider_checkout_id AS reference
 FROM billing_checkouts c WHERE c.users_id=$1 AND c.environment=$2
 AND c.status IN ('paid','failed','refunded')
 AND (c.offer_snapshot->>'billing_mode'='one_time' OR c.status='failed')
 UNION ALL
 SELECT 'invoice:'||g.billing_grant_id::text AS id,'invoice' AS kind,g.created_at AS at,
 o.display_name AS description,o.amount::text AS amount,o.currency::text AS currency,'paid' AS status,
 g.units_granted AS credits,g.provider_source_id AS reference
 FROM billing_grants g JOIN billing_subscriptions s ON s.billing_subscription_id=g.billing_subscription_id
 AND s.users_id=g.users_id AND s.environment=g.environment
 JOIN billing_offers o ON o.offer_id=s.offer_id AND o.environment=s.environment
 WHERE g.users_id=$1 AND g.environment=$2 AND g.source_type='invoice'
 ) entries ORDER BY at DESC,id DESC LIMIT $3 OFFSET $4`,[userId,environment,limit+1,offset]);
 return {entries:result.rows.slice(0,limit),has_more:result.rows.length>limit};
}
