# Provider AI per Correzione tavole

## Audit del ramo main

Sorgente esaminata il 27 novembre 2026. [Commit di riferimento](https://github.com/lucaippoliti74/disegno-tecnico/tree/ab14cfee4d9c74955eac4ccae2b1923dc1f3077f)

| Area | Accoppiamento rilevato |
| --- | --- |
| Dipendenze | Il backend attivo usava `fetch` nativo e nessun SDK. L'HTML storico alla radice contiene `window.claude` per capability, disponibilità delle immagini, streaming, cache e stato hot reload. Il workflow GitHub Pages pubblica il sito costruito da `site/`. |
| Configurazione | URL Responses fisso, token Bearer, due modelli predefiniti e tre variabili `OPENAI_*` nel backend. `max_output_tokens`, `store` e `detail` erano parte della chiamata HTTP. |
| Richiesta e risposta | Il backend costruiva i blocchi `input_text` e `input_image`, leggeva `output`, `output_text`, `refusal` e `status`. Il browser usa il contratto HTTP interno `/api/valuta` con tier `default` e `complex`. |
| Errori e timeout | Il backend interpretava HTTP 429 e il rifiuto OpenAI. Il timeout era nel controller. Il flusso attivo usa risposte complete e non effettua retry automatici. |
| Prompt e formato | La direttiva di sistema era nel payload Responses. Le istruzioni di correzione e controprova erano in due moduli browser. Il formato richiesto è un oggetto JSON di dominio, mentre `text.format` è specifico di Responses. |
| Test | L'emulatore Playwright costruiva una risposta Responses e verificava URL, header e campi OpenAI dalla fixture usata per verificare il sito. |

## Contratti

Il caso d'uso `evaluate` dipende da `AIProvider.generateStructured`. La porta accetta prompt di sistema, testo, JPEG e tier. Restituisce un oggetto JSON e, se esposti dal servizio, contatori token normalizzati. La valutazione e la controprova continuano a richiedere rispettivamente `criteri` e `misure` nel client. Prezzi e fatturazione dipendono dal servizio e non vengono stimati. La factory è il punto di composizione. Il timeout e la decodifica JSON sono condivisi. Ciascun invio al provider corrisponde a una richiesta applicativa, evitando invii automatici aggiuntivi per la stessa valutazione.

## Passare a un altro provider o modello

1. Copiare `.env.example` e conservare le impostazioni di origine, accesso e quote. Per Responses usare `AI_PROVIDER=openai`. Per un'API Chat Completions usare `AI_PROVIDER=openai-compatible`.
2. Impostare `AI_MODEL` e, se desiderato, `AI_COMPLEX_MODEL`. Omesso il secondo valore, si usa lo stesso modello per entrambi i tier quando si fornisce `AI_MODEL`. Impostare `AI_API_KEY` se richiesta dal servizio. Solo con `openai` restano disponibili come fallback `OPENAI_API_KEY`, `OPENAI_FAST_MODEL` e `OPENAI_ACCURATE_MODEL`.
3. Con un servizio compatibile impostare `AI_BASE_URL` alla radice versionata, per esempio `http://127.0.0.1:11434/v1` per Ollama sullo stesso host. La factory accetta HTTPS e HTTP su loopback. L’adattatore aggiunge `/chat/completions`. La chiave è facoltativa per i server locali che non la richiedono. Impostare `AI_CHAT_JSON_MODE=false` se il servizio rifiuta `response_format`. Per servizi che richiedono un nome di campo diverso per il limite di token, impostare `AI_CHAT_TOKEN_FIELD=max_completion_tokens`.
4. Riavviare il backend. Verificare con una tavola sintetica che il modello accetti più JPEG, segua le istruzioni in italiano e restituisca JSON, anche nella controprova geometrica. `npm run test:unit` verifica il contratto con fixture offline.

Per un protocollo nuovo, copiare lo scheletro di un adattatore in `backend/ai/adapters/`, implementare `generate(request, signal)` e registrare il costruttore nella factory con la relativa configurazione. Aggiungere una fixture per payload, risposta, rifiuto e rate limit. Una volta registrato, si seleziona il provider via ambiente senza modificare il caso d'uso. Il tempo per implementare e collaudare un protocollo nativo dipende dall'API.

Riferimenti consultati il 27 novembre 2026, senza data di pubblicazione indicata. [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create) · [Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) · [Compatibilità OpenAI in Ollama](https://docs.ollama.com/api/openai-compatibility)
