<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5c93cc7a-06cc-4d3a-851a-e423f4ccdb05

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Evolução SaaS + Estoque

Esta versão inclui a preparação para SaaS, múltiplos usuários por empresa, trial de 7 dias, auditoria, controle de estoque, importação manual de NF-e e cancelamento com revisão de impactos.

Antes de continuar na IA Studio, leia `IMPLEMENTACAO_SAAS_ESTOQUE.md` e aplique as regras descritas em `FIRESTORE_RULES_PARA_COLAR.txt` no momento indicado para a migração.
