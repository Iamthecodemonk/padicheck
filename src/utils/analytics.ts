/** Product analytics. Events are buffered locally and would be flushed to the analytics endpoint in production. */
export type ProductEvent =
'signup' |
'login' |
'check_started' |
'check_completed' |
'report_submitted' |
'business_verification_started' |
'business_verification_completed' |
'score_viewed' |
'report_shared' |
'report_downloaded' |
'subscription_started' |
'subscription_cancelled' |
'payment_completed' |
'dispute_opened' |
'dispute_resolved' |
'api_request' |
'directory_listing_started' |
'directory_listing_paid' |
'directory_listing_approved' |
'directory_viewed';

const KEY = 'pc-events';

export function track(event: ProductEvent, props: Record<string, string | number | boolean> = {}) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    list.push({ event, props, at: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-300)));
  } catch {

    /* storage unavailable — analytics must never break the app */}
}

export function eventCounts(): Record<string, number> {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as {event: string;}[];
    return list.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.event]: (acc[e.event] ?? 0) + 1 }), {});
  } catch {
    return {};
  }
}