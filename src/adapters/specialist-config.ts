export function specialistConfig(env: NodeJS.ProcessEnv = process.env) {
  const flag = (name: string) => {
    if (env[name] && !['true', 'false'].includes(env[name]!)) throw new Error(`${name} must be true or false`);
    return env[name] === 'true';
  };
  const phoneEnabled = flag('PHONE_LOOKUP_ENABLED');
  const lineType = flag('TWILIO_LOOKUP_LINE_TYPE_ENABLED');
  const businessEnabled = flag('BUSINESS_LOOKUP_ENABLED');
  const propertyEnabled = flag('PROPERTY_LOCATION_ENABLED');
  const provider = env.BUSINESS_LOOKUP_PROVIDER || 'none';
  if (!['none', 'dojah', 'opencorporates'].includes(provider)) throw new Error('Unsupported BUSINESS_LOOKUP_PROVIDER');
  if (phoneEnabled && (!/^AC[a-f0-9]{32}$/i.test(env.TWILIO_ACCOUNT_SID || '') || !env.TWILIO_AUTH_TOKEN)) throw new Error('Phone lookup requires a Twilio account SID and auth token');
  if (businessEnabled && (provider === 'none' || provider === 'dojah' && (!env.DOJAH_APP_ID || !env.DOJAH_SECRET_KEY) || provider === 'opencorporates' && !env.OPENCORPORATES_API_KEY)) throw new Error('Business lookup requires the selected provider credentials');
  if (propertyEnabled && !env.GOOGLE_MAPS_API_KEY) throw new Error('Property location requires GOOGLE_MAPS_API_KEY');
  return { phoneEnabled, lineType, businessEnabled, businessProvider: provider as 'none' | 'dojah' | 'opencorporates', propertyEnabled };
}
