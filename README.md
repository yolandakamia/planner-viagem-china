# Viagem China 2026 — app (PWA)

Agenda, mala e looks da viagem. Site estático, sem servidor, publicado no
GitHub Pages. Depois de instalado no celular, funciona 100% offline.

> README completo na Fase 6. Por enquanto: rodar, publicar e instalar.

## Rodar no computador

```
npm install
npm run dev        # abre em http://localhost:5173 (e no IP da rede, para testar no celular)
```

`npm run build` gera a pasta `dist/`; `npm run preview` serve essa versão.

Os scripts chamam o Vite e o TypeScript direto pelo `node` porque o `&` do
nome da pasta do usuário (`P&D01`) quebra os atalhos `.cmd` do npm no Windows.

## Publicar

Cada `git push` na branch `main` publica sozinho (GitHub Actions →
`.github/workflows/deploy.yml`). Em 1–2 minutos o celular mostra
"Nova versão disponível – toque para atualizar". Os dados não são afetados.

## ⚠️ Os dados ficam no aparelho

Tudo fica no IndexedDB do navegador **daquele aparelho**, ligado ao
**endereço do site**. Use sempre o link publicado
(`https://<usuario>.github.io/<repo>/`). O que for digitado no `localhost` ou
em outro endereço fica guardado em outro lugar.

## Banco de dados

`src/db/banco.ts`: esquema versionado. Toda mudança de estrutura é uma nova
migração no fim de `MIGRACOES` que transforma os dados existentes. Nunca apagar
nem recriar o banco ou uma store.
