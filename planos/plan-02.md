# Ricky — Assistente Pessoal Desktop (Plano v1.1 Revisado)

## 1) PRD (Product Requirements Document)

### 1.1 Visão do Produto

Ricky é um assistente pessoal desktop **Linux-only** que funciona como **overlay/companion** durante reuniões, estudos e apresentações, com foco em:

* **Notas/teleprompter** discretos
* **Captura de tela sob comando**
* **Transcrição offline sob comando**
* **Tradução offline EN→PT** em tempo real (por segmentos)

Privacidade por padrão: **tudo local**, sem envio para nuvem (LLM fica como módulo futuro opcional).

### 1.2 Personas e Casos de Uso

**Persona 1: Profissional em reunião internacional**

* Precisa entender inglês em tempo real (EN→PT)
* Quer anotar sem trocar de janela
* Quer controlar quando iniciar/parar captura/transcrição

**Persona 2: Apresentador**

* Usa teleprompter discreto (notas em overlay)
* Quer hotkey para ocultar/mostrar instantaneamente
* Quer capturar tela sob comando

**Persona 3: Estudante em aula online**

* Transcreve para revisão posterior
* Traduz trechos em inglês
* Organiza histórico de capturas e sessões

### 1.3 User Stories MVP

**US-001: Overlay de Notas**

* Como usuário, quero um overlay com notas, para manter contexto durante reuniões/apresentações.
* Critérios de aceitação:

  * Movível, redimensionável, opacidade ajustável
  * Texto persiste entre sessões
  * Hotkey global para mostrar/ocultar
  * Não rouba foco ao atualizar

**US-002: Captura de Tela Sob Comando**

* Como usuário, quero capturar tela/janela com hotkey, para documentar momentos importantes.
* Critérios de aceitação:

  * Hotkey global funciona mesmo com app minimizado
  * Preview da captura antes de salvar
  * Histórico com timestamp e metadados básicos
  * Suporta tela inteira e janela (área pode ficar para fase 2)

**US-003: Transcrição Offline em Tempo Real (sob comando)**

* Como usuário, quero transcrever áudio do microfone em tempo real, offline, para acompanhar conversas.
* Critérios de aceitação:

  * Iniciar/parar sob comando (hotkey/botão)
  * Exibição em streaming (partial + final)
  * Funciona offline via **Vosk Server** local (Docker)
  * Idioma EN no MVP; PT como fase 2

**US-004: Tradução Offline EN→PT**

* Como usuário, quero traduzir transcrição do inglês para português em tempo real, offline.
* Critérios de aceitação:

  * Traduz automaticamente segmentos “final”
  * Mostra EN e PT lado a lado
  * Offline via LibreTranslate local (Docker)
  * Segmentação clara (frases/trechos curtos)

**US-005: Modo Apresentação (sem “furtividade”)**

* Como usuário, quero reduzir interferências visuais durante apresentação.
* Critérios de aceitação:

  * Hotkey para ocultar/mostrar overlay instantaneamente
  * “Modo compacto”: colapsar para uma barra mínima / reduzir opacidade
  * Estado persistido (on/off, opacidade, layout)
  * Orientação de uso: preferir **compartilhar apenas uma janela** (boa prática do usuário)

### 1.4 Métricas de Sucesso (MVP)

* **Offline real:** STT e tradução funcionando sem internet
* **Responsividade:** partial atualiza continuamente (ex.: a cada ~200–800ms conforme áudio)
* **Tradução útil:** tradução de cada segmento final em ~1–3s (hardware comum)
* **Config rápida:** primeiro uso configurável em < 2 minutos (wizard simples)
* **Robustez:** se STT/Translate não estiverem rodando, UI exibe erro claro e instruções (sem crash)
* **Privacidade:** sem chamadas externas (exceto módulo futuro opcional)

---

## 2) Arquitetura

### 2.1 Diagrama de Componentes (texto)

* **Electron Main**

  * Janela(s), hotkeys globais, ciclo de vida
  * **Local Gateway WS** (servidor `ws://127.0.0.1:8787`)
  * Cliente WS para Vosk Server (`ws://127.0.0.1:2700` ou similar)
  * Cliente HTTP para LibreTranslate (`http://127.0.0.1:5000`)
  * Persistência SQLite + arquivos (screenshots/logs)

* **Electron Renderer (React)**

  * UI overlay (Notas / Transcrição / Tradução / Histórico)
  * Conecta no Local Gateway via WS (ou IPC; manter WS como contrato público interno)

* **Serviços locais (Docker)**

  * **Vosk Server (STT via WebSocket)**
  * **LibreTranslate (Translate via HTTP)**

### 2.2 Fluxos Principais

**(A) Transcrição**

1. UI → Gateway: `stt.start`
2. App inicia captura de áudio (microfone) e envia chunks ao Vosk Server
3. Vosk → App: partial/final
4. App → UI: `stt.partial`, `stt.final`
5. App salva no SQLite (sessão + segmentos)

**(B) Tradução**

1. Ao receber `stt.final`, App chama LibreTranslate (HTTP)
2. App → UI: `translate.final`
3. App atualiza DB: `translated_text`

**(C) Screenshot**

1. UI → App: `screenshot.capture`
2. App usa `desktopCapturer/getUserMedia` (Wayland via portal) para obter frame
3. App salva arquivo + metadados e notifica UI

### 2.3 Decisões Arquiteturais (revisadas)

**Gateway no Electron Main (MVP)**

* Simplicidade e menor overhead no MVP
* Evolução futura: extrair gateway para processo separado se surgir necessidade (isolamento/performance)

**STT: Docker-first (Vosk Server)**

* Mais previsível no Linux (evita builds nativas/FFI)
* Reduz risco de incompatibilidade com versões de Node

**Captura de tela: desktopCapturer + Portals (Wayland)**

* Assumir limitações do Wayland: permissões/seletores do portal e variações por distro/DE
* Fallback: documentar pré-requisitos, reduzir modos suportados no MVP (tela/janela)

**Sem `@electron/remote`**

* Usar `contextBridge` + IPC seguro no preload

---

## 3) Bibliotecas Recomendadas (revisado)

### Core

* `electron`
* `react`, `react-dom`
* `typescript`

### UI / Estado

* `zustand` (ou `jotai`) para state
* `react-hotkeys-hook` (opcional, só dentro do app; hotkey global é no main)

### Gateway / Tipos

* `ws` (server e client)
* `zod` (validação de payloads WS/IPC)

### Persistência

* `better-sqlite3`
* `electron-store` (config leve: opacidade, layout, hotkeys)

### Imagens

* `sharp` (opcional; se ficar pesado/complexo, salvar raw PNG/JPEG sem pós-processamento no MVP)

### Logs

* `pino` (ou `winston`) + rotação simples em arquivo

### Segurança Electron (config)

* `contextIsolation: true`
* `sandbox: true` (se compatível com teu setup)
* `nodeIntegration: false` no renderer
* `preload` com APIs explícitas

**Removidos do plano v1.0**

* `globalthis` (não se aplica a hotkeys)
* `@electron/remote` (evitar)

---

## 4) Estrutura do Repositório (revisado)

```
ricky/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   │   ├── index.ts
│       │   │   ├── windows/
│       │   │   │   ├── overlayWindow.ts
│       │   │   │   └── settingsWindow.ts
│       │   │   ├── gateway/
│       │   │   │   ├── server.ts
│       │   │   │   ├── handlers/
│       │   │   │   │   ├── overlay.ts
│       │   │   │   │   ├── screenshot.ts
│       │   │   │   │   ├── stt.ts
│       │   │   │   │   ├── translate.ts
│       │   │   │   │   └── db.ts
│       │   │   │   └── protocol.ts
│       │   │   ├── integrations/
│       │   │   │   ├── screenshot.ts
│       │   │   │   ├── audioCapture.ts
│       │   │   │   ├── voskClient.ts
│       │   │   │   └── libreTranslateClient.ts
│       │   │   ├── storage/
│       │   │   │   ├── db.ts
│       │   │   │   └── migrations.ts
│       │   │   └── logging/
│       │   │       └── logger.ts
│       │   ├── renderer/
│       │   │   ├── App.tsx
│       │   │   ├── components/
│       │   │   │   ├── Overlay.tsx
│       │   │   │   ├── NotesPanel.tsx
│       │   │   │   ├── TranscriptionPanel.tsx
│       │   │   │   ├── TranslationPanel.tsx
│       │   │   │   └── ScreenshotPreview.tsx
│       │   │   ├── hooks/
│       │   │   │   ├── useGatewayWS.ts
│       │   │   │   └── useOverlayState.ts
│       │   │   └── store/
│       │   └── preload.ts
│       ├── electron-builder.yml
│       └── package.json
│
├── services/
│   ├── stt/                 # Vosk Server (Docker)
│   │   ├── docker-compose.yml
│   │   └── README.md
│   └── translate/           # LibreTranslate (Docker)
│       ├── docker-compose.yml
│       └── README.md
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── protocol/
│       │   │   ├── events.ts
│       │   │   ├── schemas.ts
│       │   │   └── types.ts
│       │   └── constants.ts
│       └── package.json
│
├── scripts/
│   ├── dev.sh
│   ├── setup-services.sh
│   └── doctor.sh
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
└── README.md
```

---

## 5) Protocolo WebSocket (revisado)

### 5.1 Envelope (padrão)

* Todos os frames JSON usam:

```ts
type Envelope =
  | { id: string; type: string; payload: unknown; timestamp: number }
  | { type: string; payload: unknown; timestamp: number };
```

### 5.2 Eventos essenciais

**Overlay**

* `overlay.toggle` → `overlay.toggle.response`
* `overlay.setOpacity` → `overlay.setOpacity.response`
* `overlay.setMode` (normal|compact|hidden) → response
* Push: `system.state`

**Screenshot**

* `screenshot.capture` (mode: fullscreen|window) → response `{ path, width, height }`
* Push: `screenshot.created`

**STT**

* `stt.start` → response `{ success, state }`
* `stt.stop` → response
* Push: `stt.partial`, `stt.final`, `stt.error`

**Translate**

* Push: `translate.final` (após `stt.final`), `translate.error`

**DB**

* `db.getNotes`, `db.saveNote`
* `db.getSessions`, `db.getSessionSegments`

### 5.3 Estados

* `initializing | idle | transcribing | error`
* Push: `system.state` com `{ state, message? }`

---

## 6) Banco de Dados (SQLite) — Schema v1.1

Mantém seu schema (está bom). Ajuste recomendado:

* Remover `panel_type` de `notes` se não for necessário (nota é nota; transcrição/tradução já tem tabelas próprias). Se quiser manter, ok.

(Seu SQL atual pode ser usado como v1 sem alterações.)

---

## 7) Backlog (revisado)

### Sprint 1 — Fundação (S1)

* Monorepo pnpm + TS base
* Electron (main/renderer/preload) com segurança (contextIsolation etc.)
* Overlay window (move/resize/opacity)
* Local Gateway WS (handlers stub)
* SQLite + migrations + logger básico

**Done S1**

* Overlay abre, opacidade funciona, config persiste
* Gateway WS responde ping + overlay events
* DB inicial criado

### Sprint 2 — Notas + Modo Apresentação (S2)

* Painel Notas com persistência
* Hotkeys globais (Electron `globalShortcut`)
* Modo apresentação: hide/compact toggle via hotkey
* UI básica e estável (sem roubar foco)

**Done S2**

* Notas persistem
* Hotkeys globais funcionam
* Hide/compact funciona instantâneo

### Sprint 3 — Captura de Tela (S3)

* Captura fullscreen/window (desktopCapturer)
* Preview + salvar em pasta + registrar no DB
* Histórico com miniaturas simples
* Doctor/troubleshoot para Wayland portal

**Done S3**

* Captura funciona no teu ambiente (X11/Wayland)
* Histórico OK

### Sprint 4 — STT + Tradução (S4)

* Subir **Vosk Server via Docker** (services/stt)
* Captura de microfone sob comando e stream para Vosk
* UI streaming (partial/final) + salvar sessão/segmentos
* Subir LibreTranslate via Docker e traduzir `stt.final`
* Tratamento de erros (serviço off, porta, modelo ausente)

**Done S4**

* Transcrição offline sob comando funcionando
* Tradução offline EN→PT por segmento funcionando
* Sessões salvas e navegáveis

### Sprint 5 — Polimento e Distribuição Local (S5)

* Logs e “eventos” úteis
* Ajustes de UX (scroll, timestamps, copiar texto)
* Build AppImage (planejar e testar)
* Documentação + troubleshooting

---

## 8) Setup Local (Linux) — Revisado

### 8.1 Dependências

* Node.js (LTS)
* pnpm
* Docker + docker compose plugin
* PipeWire (ou Pulse compat) + xdg-desktop-portal (+ backend do teu DE: gtk/kde/wlr)

### 8.2 Execução (workflow recomendado)

1. `pnpm install`
2. `./scripts/setup-services.sh` (sobe stt + translate)
3. `pnpm dev` (Electron)
4. `./scripts/doctor.sh` (verifica portas, portal, pipewire, docker, etc.)

### 8.3 Troubleshooting (ajustes)

* Wayland capture: checar `systemctl --user status xdg-desktop-portal`
* Portas:

  * Gateway: 8787
  * LibreTranslate: 5000
  * Vosk: porta definida no compose
* Áudio: validar microfone no PipeWire/Pulse e permissões do navegador (getUserMedia)

---

## 9) Próximos Passos Após MVP

* Fase 2: captura de áudio do sistema (PipeWire monitor)
* Fase 3: suporte PT-BR no STT
* Fase 4: biblioteca de “scripts/prompts” (sem LLM obrigatório)
* Fase 5: módulo LLM opcional (local via Ollama ou API)

---
