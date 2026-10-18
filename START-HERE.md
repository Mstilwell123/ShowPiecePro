# ShowPiece.Pro - Complete Source Code

Exported October 18, 2026. This package contains the source of published version 19.
The saved Sites version and this checkout both identify commit c991ba0850dea0145f5a83624bbaaab8dde85554.

## What is included

- app/page.tsx and app/globals.css: landing page and site styling.
- app/studio/: signed-in studio shell and download controls.
- public/editor/: photo/clip editor, media ordering, narration, thumbnail titles,
  canvas rendering, export, local storage and project backups.
- public/save-video.js: folder/name selection and browser download fallback.
- app/api/: accounts, branding, export allowance, video storage and Stripe routes.
- lib/: server helpers, quota checks, billing webhook logic and shared helpers.
- db/ and drizzle/: database schema and SQL migrations.
- components/, hooks/, build/, scripts/, vendor/ and examples/: application UI,
  framework/runtime support and retained starter files, with existing licenses.
- tests/: regression tests, browser stress harness and synthetic clip fixture.
- package.json and package-lock.json: dependency declarations and locked versions.
- .openai/hosting.json: existing hosting identifiers and storage binding names.
- SOURCE-MANIFEST.json: SHA-256 hashes of every original source file in this ZIP.

## Hosting status

This is the existing OpenAI Sites / Cloudflare application source. A Vercel
migration was requested but has NOT been completed. This package is not a
verified Vercel deployment. Its backend uses Cloudflare D1/R2 bindings and
Sites-managed authenticated headers; these must be adapted before deploying
the complete SaaS to Vercel. Never trust user-supplied identity headers on a
different host. Publishing on a new domain also requires moving browser-local
projects via project backups; they do not automatically follow a new address.

## Developer setup

Use Node.js >=22.13.0. From the extracted ShowPiece-Pro folder:

    npm ci
    npm run dev

The existing README.md documents the current framework and local runtime.
The portable development configuration simulates sign-in for loopback requests;
it is not production authentication. Server routes also require initialized
database/storage bindings. Install commands download declared dependencies.
The existing build command is npm run build and targets the current Sites stack.

To run the included Node regression tests after installing dependencies:

    node --test tests/backup.test.mjs tests/billing.test.mjs tests/narration.test.mjs tests/save-video.test.mjs tests/stress.test.mjs tests/timeline.test.mjs

These tests are included as source. Packaging verifies file contents; it does
not constitute a new end-to-end app or payment test.

## Private data and configuration

No API keys, session credentials, environment files, account database contents,
private videos, customer media, browser-local projects or narration recordings
are included. Installed dependencies, Git history and generated build output
are excluded. The small tests/fixtures/stress-clip.mp4 is a synthetic test asset.

Server configuration referenced by the app includes ADMIN_EMAIL,
MONTHLY_EXPORT_LIMIT, BILLING_ENABLED, STRIPE_SECRET_KEY and
STRIPE_WEBHOOK_SECRET, as well as the DB/BUCKET bindings. Configure real values
only in the chosen host's secure settings. Paid subscriptions remain disabled
until their credentials and webhook are configured and verified.
