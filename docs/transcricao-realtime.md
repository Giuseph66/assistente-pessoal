# Transcricao Realtime (OpenAI + Gemini)

## Visao geral

Este documento resume a integracao de transcricao em tempo real no app, os providers disponiveis, as metricas instrumentadas e uma heuristica de escolha por cenario. O fluxo usa o mesmo pipeline de STT existente, mantendo o provider local (Vox/Vosk) como fallback.

Providers ativos (registro interno):
- vox (fallback local)
- openai_realtime_transcribe (OpenAI Realtime Transcription)
- gemini_live (Gemini Live)

Modelos sugeridos:
- OpenAI: gpt-4o-transcribe (Realtime Transcription)
- Gemini: gemini-2.5-flash-native-audio-preview-12-2025 (Live)

Referencias:
- OpenAI Speech-to-text (Realtime Transcription): https://platform.openai.com/docs/guides/speech-to-text
- OpenAI Realtime (visao geral): https://platform.openai.com/docs/guides/realtime
- Gemini Live API (WebSocket): https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/get-started-websocket
- Gemini API (Google AI for Developers): https://ai.google.dev/gemini-api/docs/text-generation

## OpenAI Realtime Transcription (detalhes tecnicos)

Importante: para transcricao em tempo real, a conexao deve usar o **intent=transcription** e o modelo deve ser enviado no payload de `transcription_session.update`.

- WebSocket: `wss://api.openai.com/v1/realtime?intent=transcription`
- Evento de configuracao (exemplo):

```json
{
  "type": "transcription_session.update",
  "input_audio_format": "pcm16",
  "input_audio_transcription": {
    "model": "gpt-4o-transcribe"
  },
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500
  }
}
```

Se voce conectar usando `?model=gpt-4o-transcribe` (query string), a API pode retornar erro `invalid_model` dizendo que o modelo nao e suportado em realtime mode.

## Metricas instrumentadas (no app)

Os providers emitem eventos de debug via STT (visiveis na aba de transcricao/debug):
- `openai:first_partial_ms` / `gemini:first_partial_ms`: latencia ate o primeiro parcial.
- `openai:final_ms` / `gemini:final_ms`: latencia aproximada ate o final.
- `audio KB/s` (STTController): taxa de audio por segundo.

Outras metricas recomendadas para acompanhamento manual:
- WER aproximado (amostra curta de 2-3 frases)
- quedas/reconexoes (contagem de falhas/retry)
- CPU (uso do processo main e renderer durante captura + WS)
- custo estimado por hora (consultar referencia de custos do Realtime)

## Como medir

1) Latencia de primeiro parcial:
- Abra o painel de transcricao, habilite debug e observe `first_partial_ms`.

2) Latencia de final:
- Fale uma frase e pare; observe `final_ms`.

3) WER aproximado:
- Compare manualmente um trecho curto (10-20 palavras) e calcule erros.

4) Quedas/reconexao:
- Registre a quantidade de eventos de erro durante 5-10 minutos de uso.

5) CPU:
- Observe o uso do processo durante 1-2 minutos de fala continua.

6) Custo:
- Use a tabela oficial de custos do Realtime para projetar o gasto por hora.

## Cenarios e recomendacoes

1) Microfone ruim + ruido (ambiente)
- Preferencia: OpenAI Realtime Transcribe (gpt-4o-transcribe)
- Motivo: ASR mais robusto e com VAD server-side confiavel.

2) Audio do sistema (meeting/video)
- Preferencia: Gemini Live se ja estiver estavel no seu ambiente
- Fallback: Vox local quando rede estiver instavel

3) Portugues BR com girias + nomes proprios
- Preferencia: OpenAI Realtime Transcribe (melhor consistencia em PT-BR)
- Alternativa: Gemini Live quando houver custo/latencia mais favoravel

4) Maquina fraca / rede instavel
- Preferencia: Vox local (sem dependencia de rede)
- Alternativa: Gemini Live com chunking e retry simples

## Heuristica de escolha

- Default: OpenAI Realtime Transcribe quando a prioridade for ASR puro, robusto e rapido.
- Gemini Live quando a prioridade for pipeline Google (chaves ja ativas, custo/latencia competitivos).
- Fallback sempre: Vox local.

## QA rapido

- Dropdown de Modelo de Transcricao Live nao quebra UI ao trocar provider.
- Ctrl+D inicia e para corretamente.
- Parcial aparece durante fala; final aparece apos pausa.
- Sem vazamento de chave em logs ou UI.
- Vox continua funcionando como antes.
