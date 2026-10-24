# Phone, business, property and job checks

Provider integration is implemented in the backend and connected to the existing input forms and report cards. Optional legal name/registration, property address, employer website and country fields supply explicit matching inputs. A successful AI research report does not imply these specialist checks passed. Each check has its own provider, status, timestamp, facts and limitations.

As of 24 October 2026, no provider accounts or credentials have been supplied. All provider calls are disabled by default. Live phone/carrier, CAC and Maps acceptance is pending those accounts; tests use explicit provider doubles. Ordinary research continues through UltraSearch and Gemini.

Configure credentials privately in **C:\Users\HP\Desktop\projects\padicheck\.env**. Do not put them in the frontend `.env`, browser code, URLs or chat.

## Phone intelligence and costs

Create an account through [Twilio Console](https://console.twilio.com/). Obtain the Account SID and Auth Token. Start with Basic Lookup, which Twilio documents as free number-format/validity lookup. Paid line-type/carrier intelligence is a separate opt-in. See [Lookup documentation](https://www.twilio.com/docs/lookup/quickstart).

```dotenv
PHONE_LOOKUP_ENABLED=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_LOOKUP_LINE_TYPE_ENABLED=false
```

Once the credentials are configured and Basic Lookup is available for the account, set `PHONE_LOOKUP_ENABLED=true` and restart the worker and API. Leave `TWILIO_LOOKUP_LINE_TYPE_ENABLED=false` for Basic Lookup. Enabling that flag explicitly requests Twilio's paid `line_type_intelligence` package. Coverage and entitlement must be checked for the target countries.

This integration does **not** send OTPs or request a subscriber's identity. It reports number validity and, when explicitly enabled and returned, carrier/line type. Those results do not confirm ownership, current reachability, identity or trustworthiness. Without the service, PadiCheck only accepts international number syntax and performs public-source research; it says network validity is unconfirmed.

Twilio Verify is a different product for confirming possession with OTP. Published pricing starts at **USD 0.05 per successful verification plus applicable channel/destination fees**; Nigerian SMS charges must be checked separately. Trials are limited and are not a production free tier. See [Verify pricing](https://www.twilio.com/en-us/verify/pricing) and [trial restrictions](https://www.twilio.com/docs/usage/trials). An account phone-ownership OTP workflow is not included in this lookup integration and no SMS is sent automatically to numbers entered for research.

## Nigerian business registration

Create a [Dojah business verification](https://dojah.io/business-verification) account, enable access to the CAC product, obtain its App ID and secret key, and confirm the current sandbox/test-record contract with the provider before funding live queries.

```dotenv
BUSINESS_LOOKUP_ENABLED=false
BUSINESS_LOOKUP_PROVIDER=dojah
DOJAH_APP_ID=
DOJAH_SECRET_KEY=
```

The adapter uses the official SDK's documented `GET https://api.dojah.io/api/v1/kyc/cac` with header credentials and supplied RC number/name. [Official SDK contract](https://github.com/dojah-inc/dojah-sdks/blob/main/python/docs/apis/tags/KYBApi.md). Only legal name, returned RC number, address and registration date are retained. Directors, owners, raw payloads and raw provider errors are excluded.

The current route supports Nigerian **RC company numbers**. BN/IT records are explicitly marked as requiring a supported route or manual review; their prefixes are never silently stripped into an RC company lookup. Validate expanded BN/IT support against the provider's current account-specific API before adding it.

After approved test requests pass, enable `BUSINESS_LOOKUP_ENABLED=true`. Name and number must match returned data before the status is `record_matched`. Different numbers produce `record_mismatch`; name-only/fuzzy matches never become registration matches. A record match does not approve a directory verification request or prove control of a website, recruiter account or payment beneficiary. Existing staff business verification remains a separate workflow.

## OpenCorporates alternative

[OpenCorporates](https://api.opencorporates.com/documentation/API-Reference) is available as an alternative provider, not an automatic fallback that doubles paid calls. Confirm the commercial plan/licence and jurisdiction coverage first; no match does not prove a company is unregistered.

```dotenv
BUSINESS_LOOKUP_ENABLED=false
BUSINESS_LOOKUP_PROVIDER=opencorporates
OPENCORPORATES_API_KEY=
```

The API key is sent in the documented `X-API-TOKEN` header. Exact lookup requires registration number and registry jurisdiction; otherwise at most five possible name matches are returned. Countries with state-level registries require the relevant jurisdiction, such as `us_de`, through structured API input. The current consumer form defaults to country-level input; state-specific register selection remains a follow-up UI requirement before offering US exact registration checks.

## Property location

Enable Geocoding API v4 in a Google Cloud project with billing and create a separate server-restricted Maps API key. The Gemini key is not automatically a Maps credential. [Geocoding setup and request contract](https://developers.google.com/maps/documentation/geocoding/geocoding).

```dotenv
PROPERTY_LOCATION_ENABLED=false
GOOGLE_MAPS_API_KEY=
```

After the key is configured and a provider test passes, set `PROPERTY_LOCATION_ENABLED=true`. The adapter requests place IDs only, sends the key in a header and records the user-supplied address and returned place IDs. It does not retain provider-generated coordinates or formatted addresses. Place IDs are exempt from Maps caching restrictions. [Google's place ID policy](https://developers.google.com/maps/documentation/places/web-service/place-id).

Reports identify a returned location or ambiguity and link to Google Maps. They explicitly leave ownership, title, agent authority and listing legitimacy unverified. Official land-title integration and an authorised manual title-review workflow remain separate work; no land-registry access was supplied or assumed.

## Job checks

Job submissions now use the dedicated `job_search` investigation type and preserve a job context. Optional employer legal name, registration number and website guide entity-specific research. The configured business provider can corroborate employer registration, while the job card explicitly requires comparison with an official careers page and independent employer confirmation. A real company or listing does not authenticate the recruiter or offer. No message is sent to an employer automatically.

## Processing, privacy and testing

- Provider checks run in the existing worker before AI interpretation. Safe normalized facts are stored as private `external_api` sources; unconfigured/error notes are not fed to AI as evidence.
- Read endpoints do not trigger paid requests. Persisted check batches are reused on retries with the same configuration. A crash before persistence can still repeat a provider GET; provider charges must not be advertised as exactly-once.
- Cancellation, account access and ownership are checked before requests and before atomic persistence. Existing investigation read permissions govern access to the results.
- Providers use bounded requests, fixed HTTPS hosts, no credential-bearing redirects, response-size limits and allowlisted fields. Keys and raw vendor errors are excluded from returned check data.
- Uploaded contract reviews bypass phone/business/location providers. Their content is not sent to these services.

Backend checks:

```powershell
node --import tsx --test --test-concurrency=1 tests/specialist-adapters.test.ts tests/specialist-collection.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.check.json
```

After enabling a provider, restart the API and worker, submit a fresh relevant check in the UI, confirm its provider facts against the provider dashboard/test record, and verify unavailable/mismatch/ambiguous cases. Until then, treat the provider integration as implemented but awaiting live acceptance.
