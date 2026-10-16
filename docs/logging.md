# Project logger

Use the shared Pino logger in `src/logger.ts`. API, worker, database, migrations,
bootstrap and operational scripts use structured logs; no runtime `console.log`,
`console.info` or `console.error` calls remain in `src/` or `scripts/`.

```ts
import { logger } from './logger.js';

const log = logger.child({ component: 'research' });
log.info({ investigation_id: id }, 'Investigation started');
log.error({ err: error, operation: 'collect_sources' }, 'Collection failed');
```

Within HTTP handlers prefer `request.log` so Fastify includes the request ID.
`app.log` is the same configured logger for API lifecycle events. Log messages
should describe the operation using static text, with useful nonsecret identifiers
in structured fields.

`LOG_LEVEL` controls `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`.
Production logs are JSON with a UTC ISO timestamp, service, component, severity
and message. The shared default stream is synchronous **stderr**, so failure logs
are not lost when a command exits immediately. Machine-readable command reports
such as integration-check JSON continue on **stdout** via `process.stdout.write`.
No log files, transport service or new environment secrets are required. A host
can collect stderr into its normal log aggregation/rotation system.

Request serialization keeps method, path, hostname and client address, omitting
query strings/fragments, headers and bodies. Common credential fields (passwords,
OTP codes, tokens, nonces, API secrets and connection strings) are redacted at
documented root/nested paths. Error serialization omits raw message, stack and
cause; selected driver/SQL failure codes appear as `err.failure_code`. This avoids
provider/database error text exposing credentials or user content.

Field redaction is a backstop, not a general text sanitizer. Never interpolate
secrets into a message or log complete users, config objects, prompts, provider
responses, documents, arbitrary payloads or signed URLs. Use the `err` property
for exception objects so the safe serializer applies. Unknown fields and deeper
arbitrary objects are not automatically safe to log.

Tests cover level filtering, child component context, request/secret redaction
and sanitized exception output. The dependency is declared directly rather than
depending on Fastify's transitive installation.
