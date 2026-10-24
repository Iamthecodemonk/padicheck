# Browser session restoration

The frontend previously held its access token only in memory. A full-page refresh or leaving for hosted checkout discarded that state, so protected routes redirected to sign-in before any restoration was possible.

The original layouts now wait for browser-session restoration. A successful verified email, password, Google or completed MFA login sets an HttpOnly cookie scoped to `/v1/auth/session`. The browser accepts it with same-origin requests; tokens are not stored in localStorage/sessionStorage. The cookie is Secure on HTTPS, including the ngrok forwarded HTTPS origin, and uses SameSite=Lax.

With platform sessions enabled, the cookie contains a random opaque value; PostgreSQL stores only its SHA-256 hash. It can restore short-lived bearer access for up to **seven days from login**. Renewal preserves the original `authenticated_at` and absolute browser expiry, so it cannot extend the window for sensitive security changes. Revocation, logout-all, password reset, MFA security changes and suspension still prevent restoration. Renewing sessions remain visible in the session-management screen even after their previous access token expires.

The frontend restores through `POST /v1/auth/session`, then requests `/v1/auth/me` for current account/permissions. Ordinary APIs continue to require bearer authentication. The restoration/deletion endpoints require `X-PadiCheck-Session: 1` and reject cross-site fetch requests; cross-origin CORS is not enabled. `DELETE /v1/auth/session` revokes the cookie-backed session and clears the cookie. No session cookie is issued for a pending MFA challenge.

Without the platform extension, the browser can restore only the existing short-lived access cookie; no seven-day renewal is promised in that mode. This deployment uses the platform extension. Apply backend migration `007_browser_sessions.sql` with `node --import tsx scripts/migrate-browser-sessions.ts` before restarting the API. The runner is repeatable.

Existing logins from before this change need **one fresh sign-in** to establish the cookie. Use the same origin for browsing and Bachs return URLs: this deployment uses `https://jean-unprospering-numerically.ngrok-free.dev`. Cookies are not shared with localhost or a different ngrok hostname.

After signing in, refresh `/credits`, open a protected URL in a new tab, leave for checkout and return, and verify that the account stays signed in. Then sign out and confirm a refresh does not restore it. Network failures during restoration show retry controls rather than being treated as confirmed logout. Background renewal keeps existing pages mounted so it does not discard forms.

## Payment verification before this fix

The sandbox Demo payment completed. The backend processed `checkout.completed` and `collection.succeeded`, and created exactly one 10-credit checkout grant with zero usage. The subsequent sign-in redirect did not lose those credits; it exposed the missing browser session restoration.

The user subsequently confirmed that, after one fresh sign-in, refreshing `/credits` and opening `/account` in a new tab both preserve sign-in and show the 10-credit balance. The backend auth/security regression run passed 41 checks and the frontend suite passed 47 checks.
