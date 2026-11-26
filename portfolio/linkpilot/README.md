# LinkPilot

**Project creator, owner and maintainer:** [João Victor da Silva (JustJao1)](https://github.com/JustJao1).

An independent personal project conceived and directed by João Victor da Silva, with AI-assisted development. Product requirements, design decisions and release direction are his responsibility.

**Windows desktop application for affiliate offer discovery** · v0.7.1 · Experimental development release

> [!WARNING]
> **Experimental software — testing and active development.** LinkPilot is an unfinished personal project. It may contain bugs, crash, return incorrect or incomplete results, or fail to work on some computers. Individual features and external integrations may not work at all. Updates and fixes are still needed. It is not a stable production release and is provided for evaluation only. Do not rely on it for unattended publishing, financial decisions or commission tracking.

## Purpose

The goal is to automate the affiliate marketing workflow for non-food physical products, from finding offers and generating affiliate links to preparing promotional messages and publishing them to authorized WhatsApp groups. This is the intended scope, not a guarantee of current functionality.

LinkPilot brings marketplace product research, account authorization and AI-assisted offer selection into a single local application. It was designed for modest Windows laptops without a dedicated GPU.

## Implemented features (not fully validated in production)

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

A Windows x64 PE executable was produced (v0.7.1). This attribution-only update adds the creator's name in the sidebar and About section, corrects the displayed version, and preserves the existing functionality. The local Go test suite passed again. Its SHA-256 is `ff5554632d4a3664565fa20ec61224e45a129c0b24cf7dd9394705afdb773ab7`.

## Current limitations

- Windows execution and real marketplace authorization still require validation; the executable may fail to open or run correctly on a given computer.
- Some listed stores only have portal links or require an approved affiliate feed.
- Automatic Mercado Livre affiliate-link generation, authorized WhatsApp group publishing and commission reconciliation are not validated end to end.
- The central application's credentials are session-scoped. A complete unattended workflow is not yet ready for production.
- The Windows binary is not digitally signed or hosted in this repository.

## Status em português

**Software experimental, em fase de testes, correções e atualizações.** O LinkPilot foi idealizado para automatizar a pesquisa de ofertas de produtos físicos não alimentícios, a geração de links de afiliado, a criação de mensagens com IA e o envio a grupos autorizados do WhatsApp. Nem todas essas funções estão concluídas ou validadas. O programa pode apresentar erros, travamentos, resultados incorretos ou simplesmente não funcionar em determinados computadores ou integrações. Não há garantia de funcionamento, estabilidade ou atribuição de comissões. Esta versão destina-se à avaliação e não deve ser utilizada como solução de produção ou para envios sem supervisão.

**Stack:** Go, HTML, CSS, JavaScript, REST APIs, OAuth 2.0, Gemini, Windows cross-compilation.

[Back to the developer portfolio](../../PORTFOLIO.md)
