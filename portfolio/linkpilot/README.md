# LinkPilot

**Windows desktop application for affiliate offer discovery** · v0.7.0 · Personal project / development release

LinkPilot brings marketplace product research, account authorization and AI-assisted offer selection into a single local application. It was designed for modest Windows laptops without a dedicated GPU.

## What this release does

- Provides a guided setup for Mercado Livre OAuth, including authorization-code exchange, account verification and token renewal during the session.
- Supports product queries through Mercado Livre and Amazon Creators API, an experimental Shopee connector and authorized Awin product feeds.
- Filters offers by price and excludes food-related products using catalog rules.
- Checks affiliate-link format and attribution parameters where the connector supplies them.
- Uses an external Gemini model to assist offer selection, with application-side validation.
- Provides a local interface, diagnostics, store setup instructions and light/dark themes.

## Engineering

The central application is written in Go, with an embedded HTML/CSS/JavaScript interface served locally. The Windows x64 executable opens the interface in a dedicated Edge or Chrome app-mode window. An earlier marketplace/browser automation agent is bundled separately; it is not a fully unified multi-store automation engine.

The project is intended for an Intel Core i5 laptop with integrated graphics. AI inference runs externally rather than requiring a local GPU.

## Verification

All 16 central application tests passed when rerun on November 26, 2026. They cover catalog parsing, price and availability filters, link checks, non-food filtering, local request guards, marketplace connector responses and OAuth callback validation. External responses were controlled test fixtures, not authenticated production accounts.

A Windows x64 PE executable was produced (v0.7.0). Its SHA-256 is `14115598fb1668a346db1c24385a6d6e4c10272941fe0495e62de75ad5fec346`.

## Current limitations

- Windows execution and real marketplace authorization still require validation.
- Some listed stores only have portal links or require an approved affiliate feed.
- Automatic Mercado Livre affiliate-link generation, authorized WhatsApp group publishing and commission reconciliation are not validated end to end.
- The central application's credentials are session-scoped. A complete unattended workflow is not yet ready for production.
- The Windows binary is not digitally signed or hosted in this repository.

**Stack:** Go, HTML, CSS, JavaScript, REST APIs, OAuth 2.0, Gemini, Windows cross-compilation.

[Back to the developer portfolio](../../PORTFOLIO.md)
