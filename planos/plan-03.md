Você é um engenheiro sênior (Electron/Node/TypeScript/Linux). Crie um plano completo e implemente o esqueleto funcional do projeto “Ricky” — um assistente pessoal desktop para Linux, com overlay para notas/captions/tradução, totalmente local-first (offline), acionado sob comando (NÃO fica ouvindo o tempo todo por padrão).

OBJETIVO (MVP real):
1) Overlay sempre disponível (notas + painel de legendas).
2) Hotkeys globais para: mostrar/ocultar overlay; iniciar/parar captions do microfone; capturar screenshot sob comando.
3) Captura de tela (full screen + window quando possível) com preview e histórico local.
4) Transcrição offline em tempo real (microfone) SEM Vosk Server (tentativa anterior falhou). Implementar arquitetura com “múltiplos backends” de STT:
   - Backend A (preferencial): sherpa-onnx (Node) se estiver viável (offline e streaming).
   - Backend B (fallback): whisper.cpp via binário local (stream example) chamado por child_process.
5) Tradução offline EN->PT como módulo opcional (pode ficar em “fase 2”), SEM Docker por padrão:
   - Opção 1: Argos Translate via serviço Python local (spawned pelo app) e chamado via HTTP/WS.
   - Opção 2: manter um adaptador para LibreTranslate, mas documentar como opcional.
6) Tudo rodando em Linux (Wayland e X11), com fallbacks e detecção automática.

IMPORTANTE (ética/uso):
- Não implementar “furtividade” para enganar outras pessoas. O máximo permitido é “modo apresentação”: 1 hotkey que oculta o overlay instantaneamente.
- Implementar avisos/consentimento no app (ex: “Transcrição ativa”) e logs locais.

ARQUITETURA (obrigatória):
- Monorepo pnpm workspace
- apps/desktop (Electron + React + TS)
- packages/shared (tipos, contratos, schema)
- services/engine (Node TS separado) que roda como subprocesso local e expõe WS em 127.0.0.1 para:
   - stt.start / stt.stop / stt.partial / stt.final
   - translate.segment (opcional)
   - health/status
O Electron MAIN process funciona como “orquestrador”: spawna o engine, mantém IPC seguro com o renderer, e faz proxy opcional do WS.

JUSTIFICATIVA:
- Separar engine evita travar o Electron e permite trocar backend de STT sem quebrar UI.

STACK:
- Electron + Vite + React + TypeScript
- Zustand (state)
- better-sqlite3 (ou SQLite via wrapper simples)
- ws (WebSocket)
- sharp (thumbnails screenshots)
- electron-store (config)
- ESLint/Prettier + scripts
- Build: electron-builder (AppImage) ou Electron Forge (escolha 1 e configure)

DETALHES DE IMPLEMENTAÇÃO (faça exatamente assim):
A) Janela Overlay:
- BrowserWindow frameless, alwaysOnTop, skipTaskbar, foco não deve ser roubado.
- Conteúdo transparente (CSS) e opacidade “visual” via CSS (porque opacity nativo pode variar).
- Drag/resize: implementar via UI (handles) ou usar BrowserWindow bounds + mouse events.
- Painéis: Notes | Captions | Screenshots
- Persistir: posição, tamanho, “always on top”, modo apresentação, últimos textos.

B) Hotkeys:
- Usar globalShortcut no MAIN process.
- Atalhos padrão:
  - Ctrl+Alt+O: toggle overlay
  - Ctrl+Alt+C: start/stop captions
  - Ctrl+Alt+S: screenshot
  - Ctrl+Alt+P: presentation mode (hide overlay instantly)
- Permitir editar hotkeys nas configurações.

C) Screenshots:
- Implementar captura via desktopCapturer.
- Detectar Wayland vs X11:
  - Se Wayland, depender de xdg-desktop-portal instalado (documentar) e lidar com permissões.
- Salvar PNG em pasta padrão: ~/.local/share/ricky/screenshots/
- Gerar thumbnail com sharp
- Salvar metadados no SQLite
- UI de histórico (lista + preview + abrir pasta)

D) Engine (services/engine):
- Subprocesso Node TS com WebSocket server em 127.0.0.1:8787
- Implementar “STTProvider interface” com dois providers:
  1) SherpaProvider (se npm sherpa-onnx funcionar):
     - streaming mic -> partial/final
  2) WhisperCppProvider:
     - chama binário whisper.cpp “stream” (ou equivalente) e parseia stdout para gerar eventos
- Captura do microfone:
  - Preferir captura no próprio provider (se biblioteca já captura)
  - Caso precise: usar PortAudio/ALSA via lib Node estável (documentar).
- Implementar VAD/endpointing (simples) para segmentar finais.
- Enviar eventos stt.partial e stt.final com timestamps.

E) Tradução (fase 2):
- Criar TranslateProvider interface:
  - ArgosTranslateProvider: serviço python simples (FastAPI ou aiohttp) rodando local, carregando modelos e traduzindo texto.
  - (Opcional) LibreTranslateAdapter (não-docker por padrão): só deixar pronto.
- UI: mostrar EN e PT lado a lado, com latência tolerável.

F) Banco de Dados:
- SQLite com tables: notes, sessions, segments, screenshots, events
- Implementar migrations simples (version table)
- API interna no MAIN process pra ler/gravar

G) Segurança/Privacidade:
- Não enviar nada pra rede por padrão.
- Config “permitir rede” desativada por default.
- Logs locais rotacionados.

H) Dev UX:
- Scripts: pnpm dev (desktop + engine)
- Scripts: pnpm build (AppImage)
- README: dependências Linux (pipewire/portal), troubleshooting (Wayland permissions, hotkeys, engine health)

ENTREGÁVEIS DO CURSOR:
1) Um documento “PLAN.md” com sprints (0..6), riscos e mitigação.
2) Repositório criado com a estrutura pedida, buildando e rodando:
   - Overlay aparece
   - Notas salvam
   - Hotkey toggle funciona
   - Screenshot salva + aparece no histórico
   - Engine sobe e responde health
   - (Opcional no MVP) Captions funcionando com UM backend, nem que seja WhisperCppProvider
3) Código com tipos compartilhados em packages/shared e contrato WS bem definido.
4) Sem Docker obrigatório. Docker só como opção documentada.

ANTES DE CODAR:
- Mostre a árvore de pastas final.
- Liste as decisões (Forge vs Builder, escolha do provider STT inicial).
- Depois gere os arquivos e implementações.
