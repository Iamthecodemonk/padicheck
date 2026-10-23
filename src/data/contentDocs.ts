import type { ContentDoc } from '../types/content';

export const initialContentDocs: ContentDoc[] = [
{
  id: 'doc-terms',
  slug: 'terms',
  kind: 'legal',
  title: 'Terms of Service',
  summary: 'The rules for using PadiCheck',
  body: `PadiCheck helps you understand an opportunity before you commit. These terms explain how the service works and what we expect from you.

## Using PadiCheck
- You must be 16 or older to create an account.
- Reports are guidance based on the information available at the time of the check. They are not legal, financial or professional advice.
- You are responsible for the final decision to buy, rent, sign or pay.

## Credits
- Checks use credits. The cost is always shown before you confirm.
- Credits never expire and cannot be exchanged for cash.
- If a check fails on our side, the credits are returned to your balance automatically.

## Acceptable use
Do not use PadiCheck to harass people, scrape data, or upload content you do not have the right to share.

## Changes
We will notify you in the app before any material change to these terms takes effect.`,
  draft: null,
  version: 4,
  updatedAt: '2026-09-12T10:00:00',
  updatedBy: 'Tunde Bakare'
},
{
  id: 'doc-privacy',
  slug: 'privacy',
  kind: 'legal',
  title: 'Privacy Policy',
  summary: 'What we collect and how we protect it',
  body: `We collect only what we need to run your checks and keep your account safe.

## What we collect
- Account details: name, email and sign-in method.
- What you submit for a check: links, text, photos and documents.
- Device information needed for notifications and security.

## How we use it
- To produce your reports and improve their accuracy.
- To prevent fraud and abuse.
- We never sell your personal data.

## Your files
Uploaded files are stored privately, accessed only through signed links, and deleted after 30 days unless you save the report.

## Your rights
You can download or delete your data at any time from Account.`,
  draft: null,
  version: 3,
  updatedAt: '2026-08-30T09:00:00',
  updatedBy: 'Ife Lawal'
},
{
  id: 'doc-refunds',
  slug: 'refunds',
  kind: 'legal',
  title: 'Refund Policy',
  summary: 'When credits and payments are returned',
  body: `## Failed checks
If a check cannot be completed because of a problem on our side, the credits are returned automatically after two failed retries.

## Payments
- Payments that fail or are reversed by your bank will not add credits.
- If you were charged but did not receive credits, contact support within 30 days.`,
  draft: null,
  version: 2,
  updatedAt: '2026-07-18T15:00:00',
  updatedBy: 'Ife Lawal'
},
{
  id: 'doc-acceptable-use',
  slug: 'acceptable-use',
  kind: 'legal',
  title: 'Acceptable Use Policy',
  summary: 'What you can and can’t upload',
  body: `## Not allowed
- Content that is illegal, sexual, or promotes violence.
- Personal documents belonging to someone else without their permission.
- Automated or bulk submissions.

Accounts that break these rules may be suspended.`,
  draft: null,
  version: 1,
  updatedAt: '2026-05-02T12:00:00',
  updatedBy: 'Tunde Bakare'
},
{
  id: 'doc-cookies',
  slug: 'cookies',
  kind: 'legal',
  title: 'Cookie Policy',
  summary: 'How PadiCheck uses cookies and local storage',
  body: `PadiCheck uses a small number of cookies and on-device storage to keep you signed in and remember your settings.

## Essential
- Keeping you signed in and protecting your session.
- Remembering your theme, data saver and language choices.
- Storing saved reports so they open offline.

## Analytics
We measure which features are used — for example "check completed" — without recording what you checked. You can turn analytics off in Account → Security & privacy.

## What we don’t do
We don’t use advertising cookies and we don’t sell data to advertisers.`,
  draft: null,
  version: 1,
  updatedAt: '2026-10-01T10:00:00',
  updatedBy: 'Ife Lawal'
},
{
  id: 'doc-verification-policy',
  slug: 'verification-policy',
  kind: 'legal',
  title: 'Business Verification Policy',
  summary: 'How businesses are verified, renewed and suspended',
  body: `## What “PadiCheck Verified” means
A verified business has shown us valid registration, the identity of an owner or director, and — for Verified Business and above — proof of address. It does not mean we guarantee its products or services.

## What we never claim
We do not confirm property ownership, licences or regulatory approvals unless we checked them with an authorised source, and we say so when we did.

## Renewal
Verification lasts 12 months. We re-check sooner if details change or serious reports are received.

## Suspension
Verification can be suspended while we investigate. The badge, certificate and QR code immediately show the current status.

## Directory listings
A paid directory listing (₦6,000 per year) makes a business visible in Explore Businesses after a moderator approves it. A listing is not the same as verification and is labelled clearly.`,
  draft: null,
  version: 1,
  updatedAt: '2026-10-01T10:00:00',
  updatedBy: 'Ife Lawal'
},
{
  id: 'doc-report-dispute',
  slug: 'report-dispute-policy',
  kind: 'legal',
  title: 'Report & Dispute Policy',
  summary: 'How reports are reviewed and how to challenge them',
  body: `## Submitting a report
Reports must describe a real experience. Include evidence such as receipts, chats or screenshots. False reports may lead to account suspension.

## Review
A person reviews every report before it affects a Trust Score. We may ask for more evidence. AI may suggest an outcome but never decides on its own.

## Disputes
A business or person named in a report can dispute it with evidence. We compare both sides and either uphold, correct or remove the report. Both parties are told the outcome.

## Timeframes
Most reports are reviewed within 3 working days and most disputes within 5.`,
  draft: null,
  version: 1,
  updatedAt: '2026-10-01T10:00:00',
  updatedBy: 'Ife Lawal'
},
{
  id: 'doc-ai-disclaimer',
  slug: 'ai-disclaimer',
  kind: 'legal',
  title: 'AI Disclaimer',
  summary: 'What AI risk signals are, and what they are not',
  body: `PadiCheck uses AI to spot patterns linked to scams — for example copied listing photos or prices far below market.

## AI signals are not facts
Every AI observation is labelled **AI risk signal**. It is a reason to look closer, not proof of wrongdoing.

## Human review
AI cannot suspend accounts, remove businesses, or make legal decisions. A trained person reviews anything that affects someone’s standing.

## Mistakes
If you think an AI signal is wrong, report an issue from the report page and we’ll review it.`,
  draft: null,
  version: 1,
  updatedAt: '2026-10-01T10:00:00',
  updatedBy: 'Ife Lawal'
},
{
  id: 'doc-data-processing',
  slug: 'data-processing',
  kind: 'legal',
  title: 'Data Processing Information',
  summary: 'Legal bases, processors and your rights under the NDPA',
  body: `## Who we are
PadiCheck Technologies Ltd is the data controller for the PadiCheck app and website.

## Legal bases
- **Contract:** running the checks you ask for and managing your account.
- **Legitimate interest:** preventing fraud and keeping reports accurate.
- **Consent:** optional analytics and marketing messages.

## Processors
We use payment providers (Paystack, Flutterwave, Stripe), cloud hosting and AI providers under written data processing agreements.

## Your rights
Under the Nigeria Data Protection Act you can access, correct, export or delete your data. Use Account → Security & privacy, or email privacy@padicheck.com.`,
  draft: null,
  version: 1,
  updatedAt: '2026-10-01T10:00:00',
  updatedBy: 'Ife Lawal'
},
{
  id: 'doc-help-credits',
  slug: 'how-credits-work',
  kind: 'help',
  title: 'How credits work',
  summary: 'Buying, spending and refunds',
  body: `Every check uses a small number of credits depending on how much research it needs.

## Costs
- Links: 1 credit
- Shopping, jobs and freelance: 2 credits
- Property: 3 credits
- Contracts: 4 credits

Job & Talent matching is free.`,
  draft: `Every check uses a small number of credits depending on how much research it needs.

## Costs
- Links: 1 credit
- Shopping, jobs and freelance: 2 credits
- Property: 3 credits
- Contracts: 4 credits

Job & Talent matching is free.`,
  version: 2,
  updatedAt: '2026-10-01T11:00:00',
  updatedBy: 'Ngozi Obi'
},
{
  id: 'doc-help-install',
  slug: 'install-padicheck',
  kind: 'help',
  title: 'Install PadiCheck on your phone',
  summary: 'Android, iPhone and desktop',
  body: `## Android
Open the menu in Chrome and tap Install app.

## iPhone
Tap Share in Safari, then Add to Home Screen.

## Desktop
Click the install icon in the address bar.`,
  draft: null,
  version: 1,
  updatedAt: '2026-09-02T09:00:00',
  updatedBy: 'Ngozi Obi'
},
{
  id: 'doc-home-heading',
  slug: 'home-heading',
  kind: 'copy',
  title: 'Home heading',
  summary: 'Main question on the Home screen',
  body: 'What opportunity are you considering?',
  draft: null,
  version: 2,
  updatedAt: '2026-09-28T10:00:00',
  updatedBy: 'Tunde Bakare'
},
{
  id: 'doc-home-subtext',
  slug: 'home-subtext',
  kind: 'copy',
  title: 'Home supporting text',
  summary: 'Shown under the Home heading',
  body: 'Share a link, upload something, or tell PadiCheck what you’re considering. AI will help you understand it before you commit.',
  draft: null,
  version: 2,
  updatedAt: '2026-09-28T10:00:00',
  updatedBy: 'Tunde Bakare'
}];