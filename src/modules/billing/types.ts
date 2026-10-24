export type Json = Record<string, any>;
export interface BillingProvider {
  createProduct?(input:Json,requestKey:string):Promise<Json>;
  product?(id:string):Promise<Json>;
  createCheckout(input: Json, requestKey: string): Promise<Json>;
  checkout(id: string): Promise<Json>;
  subscription(id: string): Promise<Json>;
  portal(customerId: string): Promise<Json>;
}
export type Offer = {offer_id:string;environment:string;offer_key:string;display_name:string;billing_mode:'one_time'|'subscription';
  provider_product_id:string;currency:string;amount:string;investigation_units:number;is_enabled:boolean;plan_id?:string|null;validity_days?:number|null};
export type Checkout = {billing_checkout_id:string;users_id:string;environment:string;offer_id:string;request_key:string;
  offer_snapshot:Offer;provider_checkout_id:string|null;checkout_url:string|null;status:string;provider_customer_id:string|null;expires_at:Date|null;paid_at:Date|null;created_at:Date};
