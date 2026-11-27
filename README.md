# Correzione tavole

Web app in italiano per la correzione delle tavole di disegno tecnico. Il file storico, originariamente `Correzione tavole.html`, resta disponibile come `index.html` nella radice del repository. La nuova versione parte da `site/index.html`.

## Funzioni e migrazione

- Acquisizione da fotocamera, galleria, file, incolla e trascina. Ritaglio prospettico a quattro punti, rotazione, contrasto e scelta della pagina PDF. PDF.js e font sono serviti dal sito.
- Griglie per le classi prime e seconde, pesi modificabili, voto ponderato e tetto a 5,5 dove previsto. PDP, PEI ordinario e personalizzato con misure e pesi per la singola tavola. Il PEI differenziato continua a non proporre un voto.
- Riferimento immagine/PDF, reticoli, rapporti tra gli assi, aggancio alle linee e controprova con allineamento manuale. Queste verifiche dipendono dalla qualità delle coordinate stimate dal modello. Il docente controlla le misure e conferma il voto.
- Registro locale con ricerca, recupero delle schede, modifica, cancellazione, copia per Excel e download CSV. I record locali esistenti (`ct.reg`), le impostazioni (`ct.set`) e il riferimento (`ct.ref`) sono compatibili nella stessa origine del browser. Passando dall’ambiente precedente a GitHub Pages cambia l’origine. Prima del passaggio, esportare il registro dal vecchio ambiente per consultarlo in un foglio elettronico. I dati sincronizzati dal vecchio host e le sessioni in corso non vengono trasferiti. Il CSV è un archivio consultabile in Excel o Fogli.
- Il sito si apre anche senza backend per consultare l’esempio, le impostazioni e il registro locale. Il backend abilita le valutazioni automatiche. I livelli Rapida e Accurata inviano la stessa struttura a due modelli configurabili. L’interruzione tenta di annullare la richiesta corrente. Una chiamata già ricevuta dal fornitore può contare ai fini della quota o dei costi.

## Avvio locale

Occorrono Node.js 24 e npm. Dalla radice del repository:

```sh
npm ci
npm run build
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Aprire `http://127.0.0.1:4173`. Il server Python serve solo i file statici ed è facoltativo se si dispone già di un server locale.

### Configurare l’analisi

Generare **un codice casuale distinto per docente** con il comando seguente. Consegnare il codice al solo titolare tramite un canale riservato. Usare l’hash corrispondente nella configurazione del backend.

```sh
node -e "const c=require('node:crypto'),t=c.randomBytes(32).toString('base64url'); console.log('Codice',t); console.log('Hash',c.createHash('sha256').update(t).digest('hex'))"
```

Copiare `.env.example` in `.env` nella radice e compilare i valori. Per passare a un altro modello o servizio consultare la [guida ai provider AI](docs/provider-ai.md).

Separare gli hash con virgole. Avviare `npm run backend` in un terminale separato. Impostare `ANALYSIS_ENDPOINT=http://127.0.0.1:8787/api/valuta` nell’ambiente di build e rilanciare `npm run build`. In PowerShell si imposta con `$env:ANALYSIS_ENDPOINT='http://127.0.0.1:8787/api/valuta'`. Ricaricare la pagina, aprire *Accesso docente alla valutazione* e inserire il codice personale.

## Pubblicazione

1. Eseguire il backend su un host Node.js 24 con una sola istanza, HTTPS davanti al processo e un disco persistente per SQLite. Configurare le variabili nella gestione segreti dell’host. Usare `FRONTEND_ORIGIN=https://lucaippoliti74.github.io` per l’indirizzo standard di Pages. Se si usa un dominio personalizzato, impostare l’origine esatta. Configurare il proxy con limite di 12 MiB e timeout di almeno 105 secondi per la singola valutazione. Disattivare la registrazione di richieste, corpi, intestazioni di autorizzazione e risposte sull’endpoint.
2. In **Settings → Secrets and variables → Actions → Variables**, impostare `ANALYSIS_ENDPOINT` all’URL HTTPS pubblico del backend, incluso il percorso `/api/valuta`. L’URL è pubblico. La chiave del provider AI e gli hash vanno configurati soltanto presso l’host del backend.
3. In **Settings → Pages**, impostare **GitHub Actions** come origine. Dopo la revisione e l’unione della pull request, il workflow pubblica soltanto `dist/`. È eseguibile anche da **Actions** sul ramo `main`. Il workflow non pubblica la versione storica o il backend. [Configurazione ufficiale GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
4. Usare una tavola sintetica per verificare la pubblicazione e una chiamata ai modelli configurati. Revisione e collaudo con l’istituto precedono l’impiego di dati scolastici.

## Protezioni e dati

- Il codice docente è separato dalla chiave del provider AI. Resta nel campo della pagina e viene inviato al backend via HTTPS. Per revocarlo, rimuovere l’hash e riavviare il servizio. Il backend limita l’origine browser, autentica ogni chiamata e usa l’endpoint impostato all’avvio lato server. La validazione richiede da 1 a 8 JPEG, ciascuno di massimo 1 MiB, e limita la dimensione del testo e della richiesta.
- Quote persistenti UTC: 5 valutazioni al minuto e 30 al giorno per docente, 120 al giorno per l’istanza. Il passaggio preliminare geometrico conta come una richiesta. Una valutazione in corso per docente e tre complessive. Il file SQLite contiene soli contatori con hash dei codici. Usare un progetto API dedicato e controllarne la spesa.
- Tavola e riferimento vengono elaborati nel browser. Le copie JPEG inviate sono ricodificate dal canvas, quindi il file originale, il nome e i metadati EXIF non fanno parte del corpo inviato. Il docente controlla il ritaglio e l’assenza di nomi, cartigli identificativi e informazioni sanitarie nelle immagini e nei campi liberi. Le etichette PDP/PEI, il codice elaborato e il registro restano locali. Consegna, note tecniche e indicazioni operative selezionate sono inviate con le immagini. Non incollare piani, diagnosi, nomi o elenchi di studenti.
- Impostazioni, riferimento e registro sono memorizzati nel profilo del browser. Usare un profilo scolastico protetto e codici pseudonimi. Il CSV contiene i dati visualizzati nel registro, comprese le etichette PDP/PEI, e va protetto di conseguenza. La cancellazione dei dati del sito nel browser rimuove il registro locale.
- Il backend non persiste immagini, prompt o risposte. L’adattatore OpenAI invia `store: false` alla Responses API. Verificare le impostazioni di conservazione del servizio selezionato. Verificare la politica adottata dall’istituto prima dell’uso. [Controlli dei dati OpenAI](https://developers.openai.com/api/docs/guides/your-data)

## Test

```sh
npm ci
npx playwright install chromium
npm test
```

Playwright avvia il sito e il backend su due porte locali. Il backend usa un adattatore mock con risposte deterministiche e senza rete verso servizi AI. I progetti coprono desktop Chromium e Pixel 7 emulato con Chromium. Le immagini e il PDF delle prove sono sintetici. Impostare `SCREENSHOT_DIR` a una directory per ottenere le schermate della scheda e della controprova per ogni progetto. Per usare Chrome già installato, impostare `CHROMIUM_PATH` al percorso dell’eseguibile.
