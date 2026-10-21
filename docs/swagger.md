# API documentation

Start the backend with `npm.cmd run dev`, then open
[Swagger UI](http://127.0.0.1:3000/docs/). The server defaults to port 3000;
use your configured host and port if different. `/docs` redirects to the UI.
The OpenAPI 3.0.3 specification is available as `/docs/json` and `/docs/yaml`.
Documentation is available in development and production and requires no JWT.
The UI and its static assets are served by the backend.

All application endpoints are included: health, authentication, administration,
AI registry, media, investigations, directory, verification, reports, disputes,
sharing, and billing. Internal Swagger asset routes and automatic HEAD routes are excluded
from the spec. Request schemas come from the existing route validation schemas.
Documentation transformations add summaries, tags, security, response envelopes,
and upload controls without changing request validation or response serialization.
Record-valued response properties allow additional fields to reflect the existing
database-backed DTOs; they are not exhaustive column definitions.

## Authentication

1. Execute `POST /v1/auth/register` with your display name, email and password.
   Configure Redis and SMTP first; Swagger does not bypass provider setup.
2. Copy the returned `challenge_id`, then execute `POST /v1/auth/register/verify`
   with that ID, your email and the actual six-digit code received by email.
   Examples are placeholders and must be replaced. Codes expire in 10 minutes.
3. Copy the returned `access_token`, click **Authorize**, and paste the token
   without the `Bearer` prefix. The UI supplies the prefix on protected requests.
4. For subsequent sessions use `POST /v1/auth/login` with email and password.
   Tokens expire after 15 minutes. Logout revokes the token; clear it using
   **Authorize → Logout** as well. Authorization is not persisted across reloads.

The padlock identifies routes requiring JWT authentication. Public routes do not
need it. Google challenge creation supports both public login and authenticated
linking; use a Bearer token for `action=link`. Ownership, permissions and account
state remain enforced when calling APIs through Swagger.

Google sign-in uses the existing Google Identity Services ID-token flow.
Request a nonce at `/v1/auth/google/challenge`, pass it to Google Identity
Services with the configured Web client ID, then submit the resulting ID token
to `/v1/auth/google`. Linking uses `action=link` and `/v1/auth/google/link`.
Swagger does not launch a Google sign-in popup or fabricate a Google token.
See [Authentication setup](authentication.md) for provider configuration.

## Media and workflows

For `POST /v1/media`, authorize, choose **Try it out**, and select a file in the
`file` field. Send exactly one file and no other fields. The endpoint description
shows the configured byte limit and supported formats. Cloudinary credentials
are configured only on the backend. Uploads return metadata, and the delivery
endpoint issues a short-lived signed URL.

Investigation creation and retry return 202; poll the detail endpoint for status.
Worker and research-provider configuration are still required for processing.
Share tokens are submitted in the JSON body to the public resolve endpoint.
Role assignment requires superadmin access. The endpoint descriptions explain
other permission requirements and important state restrictions.

Swagger **Execute** sends real requests to this backend, including uploads,
emails, role grants and moderation decisions. No credentials are embedded in the
specification. Example email addresses, passwords, codes and tokens are fixtures.

## Validation

`node --import tsx --test tests/documentation.test.ts` compares the generated
specification with the routes registered by Fastify, including loop-generated
registry routes. It also checks UI assets, request definitions, success status
codes, JWT security, multipart uploads and unchanged validation/authentication.
The test uses no database or external service connections.

Swagger integration uses the official
[@fastify/swagger](https://github.com/fastify/fastify-swagger) and
[@fastify/swagger-ui](https://github.com/fastify/fastify-swagger-ui) plugins.
