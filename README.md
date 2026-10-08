# Viagem China 2026 — app (PWA)

Agenda, mala e looks da viagem de trabalho à China (outubro de 2026).
Site estático, sem servidor, publicado no GitHub Pages. Depois de instalado
no celular, funciona **100% offline**.

**Endereço do app:** https://yolandakamia.github.io/planner-viagem-china/

| Aba | O que faz |
|---|---|
| **Hoje** | Relógios da China e do Brasil, dia da viagem pelo horário da China, versão do roteiro, look do dia, eventos com **Agora** e **A seguir** |
| **Calendário** | Dia, Semana (com horários), Mês ou a viagem inteira; eventos 👥 do grupo e 👤 pessoais; criar, editar, duplicar e excluir eventos; conflitos de horário; endereço em chinês em tela cheia |
| **Mala** | Malas com peso e limite, itens com status e foto, lista sugerida para a China, modo volta (compras, amostras, catálogos) |
| **Looks** | Provador com as fotos das roupas, looks por dia, contagem de uso das peças e dias de lavanderia |
| **Ajustes** | Backup, dados da viagem, cidade de cada dia, roteiro da viagem (colar ou importar do `China_Trip_Planner.html`) |

## Instalar no celular

Abra o endereço acima **com internet** e:

- **Android (Chrome):** menu ⋮ → **Instalar app**.
- **iPhone (Safari):** botão **Compartilhar** → **Adicionar à Tela de Início**.

Abra pelo ícone e espere aparecer **"✓ Pronto para usar offline"**.

## ⚠️ Onde ficam os dados

- Tudo fica no **IndexedDB do navegador daquele aparelho**, ligado ao **endereço do site**.
  Use sempre o link publicado. O que for digitado no `localhost` ou em outro endereço fica em outro lugar.
- **Nada é enviado a servidor nenhum**, nem as fotos. Cada pessoa que instala o app tem os próprios dados.
- **Faça backup** (Ajustes → Backup). O app lembra na página Hoje se passar de 7 dias.

## Roteiro do grupo (👥) e eventos pessoais (👤)

Todo evento é **👥 do grupo** ou **👤 pessoal**, e isso aparece em todos os lugares: etiqueta nos cartões,
ícone na Semana e no Mês, e uma faixa no detalhe ("👥 Evento do grupo · do planejador / criado por Ana").
No editor, **"Para quem? 👤 Só eu / 👥 Grupo"** (dá para mudar depois).

O roteiro do grupo vai e vem **por mensagem** (WhatsApp ou WeChat), sem servidor e sem publicar nada:

- **Do computador:** no planejador, **📤 Share itinerary** → WhatsApp / WhatsApp Web / WeChat (copiar).
  Sai o **plano principal ★**, sem os cancelados. O botão mostra **"· changed"** quando há mudança não enviada.
- **Do celular:** **📤 Enviar** (página Hoje ou Ajustes → Roteiro do grupo) → Compartilhar… (WhatsApp,
  WeChat…), WhatsApp ou Copiar. **Os eventos pessoais nunca vão.**
- **Quem recebe:** no Android toca no link; no iPhone copia a mensagem inteira e toca em **📋 Colar**
  (o iOS abre links no Safari, que guarda os dados separado do app da Tela de Início).
  O planejador recebe colando a mensagem em **📤 Share itinerary → "Received an itinerary from the group?"**.
- Antes de aplicar, aparece a lista do que muda: **+ novo**, **✎ atualizado**, **− excluído**.

Regras (`src/lib/grupo.ts`):

- Cada evento do grupo tem um `ref` igual em todos os aparelhos (`planner:<id>` ou `app:<uuid>`) e uma
  versão (`editadoEm`). Receber **junta evento por evento**: entra o que é novo e, quando o mesmo evento
  existe nos dois lados, fica a versão mais recente.
- **Excluir viaja na mensagem:** quem recebe perde o evento também (a não ser que o tenha editado depois).
  Uma mensagem antiga não traz de volta o que foi excluído.
- A mensagem do planejador leva **todos** os eventos dele: um evento do planejador que não está nela foi
  excluído (ou cancelado) lá e sai dos celulares. Eventos criados nos celulares não saem por isso.
- **Só os eventos do grupo mudam.** Eventos pessoais nunca são enviados nem alterados.
- **Alerta:** quem cria, edita ou exclui um evento do grupo vê **"📤 Você mudou o roteiro do grupo. Mande a
  versão atualizada para todos."** (Hoje e Calendário) até enviar.
- O roteiro vai **dentro do link**, depois do `#`, que não é enviado a servidor nenhum.
- O app não sabe sozinho que existe versão nova (não há servidor): quem muda, envia.
- O **⬇ Backup .json** do planejador também pode ser importado (Ajustes), com as mesmas regras.

## Backup

- **Ajustes → 💾 Fazer backup agora** gera um único `.zip` com tudo: viagem, agenda, mala, fotos e looks.
  No celular abre a tela de compartilhar (salvar em Arquivos, Drive, mandar por e-mail…); no computador, baixa.
- **Restaurar de um backup…** mostra o que tem no arquivo e pede confirmação. A restauração **substitui**
  todos os dados do aparelho de uma vez; se der qualquer erro, nada é alterado.
- São recusados: arquivos que não são backup do app, backups com fotos faltando e backups feitos
  por uma versão mais nova do app.

Formato do `.zip`: `manifesto.json` (versão, data, contagens), `dados.json` (todos os registros) e
`fotos/<id>.webp` + `fotos/<id>-mini.webp`.

## Roteiro de testes

1. **Instalar** no Android e no iPhone pelo link do GitHub Pages (veja acima).
2. **Modo avião:** feche o app, ative o modo avião, abra de novo e use todas as abas:
   Hoje, Calendário (criar um evento), Mala (mudar um status, pôr uma foto), Looks (abrir o provador), Ajustes.
3. **Simular um dia da viagem:** nas configurações do celular, desligue data/hora automáticas e
   coloque, por exemplo, **segunda 12/10/2026 às 10h30 no fuso de Xangai**. Confira na página Hoje:
   "Dia 5 de 17 · data da China", o evento em andamento como **Agora** e o próximo como **A seguir**.
   Teste também com o celular no fuso de São Paulo às 23h30 de domingo 11/10: a página Hoje deve
   continuar mostrando segunda 12/10 (o dia na China). Volte para data/hora automáticas no fim.
4. **Atualização:** quando uma nova versão for publicada, abra o app (com internet), toque em
   **"Nova versão disponível – toque para atualizar"** e confira que tudo continua lá.
5. **Backup:** faça um backup, depois **Ajustes → Apagar dados deste aparelho**, restaure o `.zip`
   e confira fotos, looks e o look do dia.

## Rodar no computador

```
npm install
npm run dev        # http://localhost:5173 (e no IP da rede, para testar no celular)
npm run build      # gera dist/
npm run preview    # serve dist/ em http://localhost:4173
```

Os scripts chamam o Vite e o TypeScript direto pelo `node` porque o `&` do nome da pasta do
usuário (`P&D01`) quebra os atalhos `.cmd` do npm no Windows.

## Publicar uma nova versão

1. Altere o código e rode `npm run build` (confere os tipos e gera o app).
2. Suba o número em `package.json` → `"version"`.
3. `git commit` e `git push` na branch `main`.
4. O GitHub Actions (`.github/workflows/deploy.yml`) publica em 1–2 minutos.
   Acompanhe em **Actions** no repositório.
5. No celular, o aviso **"Nova versão disponível"** aparece ao abrir o app com internet.

### Banco de dados: regras para mudanças

`src/db/banco.ts` — esquema versionado (`MIGRACOES`, hoje na **v2**).

- Toda mudança de estrutura é **uma nova migração no fim da lista**, que transforma os dados existentes.
- **Nunca** apagar ou recriar o banco ou uma store.
- Campos novos entram como opcionais; o backup aceita arquivos de versões anteriores.
- Todo registro tem `id` UUID estável. Eventos têm `camada`: `pessoal` (só do aparelho) ou `coletivo`
  (o roteiro do grupo, ligado pelo `ref` `planner:<id>` / `app:<uuid>`). Receber um roteiro só mexe nos `coletivo`.

## Bibliotecas (tudo empacotado no app; nada vem de CDN)

| Biblioteca | Para quê | Licença |
|---|---|---|
| Preact | interface | MIT |
| idb | IndexedDB | ISC |
| Konva | provador de looks (carregado só ao abrir) | MIT |
| fflate | `.zip` do backup | MIT |
| Vite, vite-plugin-pwa / Workbox | build e service worker | MIT |

Fontes do sistema (PingFang no iPhone, Noto Sans CJK no Android) para os caracteres chineses.

## Limitações conhecidas

- **iPhone:** o Safari pode apagar os dados de sites que ficam **semanas sem uso**. Abra o app de vez
  em quando e mantenha o backup em dia. Instalado na Tela de Início, o risco é menor.
- **Na China**, Google e muitas CDNs são bloqueados. O app não usa nenhum recurso externo, mas o
  próprio `github.io` pode ficar lento ou inacessível sem VPN: **instale e abra o app antes de embarcar**.
  Atualizações publicadas durante a viagem podem só chegar com VPN.
- Os dados são de **um aparelho**. Trocar de celular ou de navegador = restaurar o backup.
- Remover o fundo das fotos é feito fora do app (recurso de recorte do iPhone/Android); o app
  aceita PNG já recortado ou foto comum.
- Se o navegador não gerar WebP (Safari antigo), as fotos são salvas em PNG.
- Colar o roteiro exige iOS 16.4+ ou Chrome/Android recente (descompressão nativa do navegador).
