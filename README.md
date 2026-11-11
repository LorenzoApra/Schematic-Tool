# Schematic

Uno spazio di lavoro per progettare i flussi audio, video, rete e luci delle regie per eventi live. Ispirato al flusso di lavoro di [H2R Gear](https://h2rgear.com), con una propria interfaccia e una libreria locale modificabile.

[Apri l’app su GitHub Pages](https://lorenzoapra.github.io/Schematic-Tool/)

## Lavorare su uno schema

1. Cerca un dispositivo nella libreria. Fai clic per aggiungerlo oppure trascinalo nella posizione desiderata.
2. Seleziona un’uscita e un ingresso dello stesso connettore. Puoi iniziare anche dall’ingresso; sono supportate le porte bidirezionali. Ogni porta accetta un solo cavo fisico.
3. Usa **Ordina per flusso** per disporre i dispositivi da sorgenti a destinazioni e ridurre gli incroci. Le retroazioni sono gestite come gruppi.
4. Per schemi affollati, attiva **Solo porte collegate**, filtra i segnali e seleziona un dispositivo o un cavo per evidenziarne le tratte. I percorsi ortogonali cercano di evitare gli ingombri dei dispositivi e separare i cavi.
5. Consulta **Patch list** e **Materiali**, oppure esporta JSON, PNG, matrice PDF e liste CSV.

**I dati vengono salvati automaticamente su questo browser.** Non sono sincronizzati tra browser o computer. Esporta il progetto JSON per conservarne una copia o trasferirlo. Le importazioni e le modifiche alla libreria sono annullabili. I progetti precedenti con formato `live-show-schematic-project`, versione 1, sono compatibili; i collegamenti a porte mancanti o incompatibili vengono rimossi durante il caricamento.

Il tema chiaro/scuro si seleziona dalla barra superiore. La guida nell’app riepiloga i comandi. La libreria personalizzata resta nel progetto ed è inclusa nel file JSON.

### Scorciatoie

| Azione | Tasti |
| --- | --- |
| Annulla / ripristina | ⌘ o Ctrl + Z / Shift + Z |
| Duplica il dispositivo selezionato | ⌘ o Ctrl + D |
| Elimina il dispositivo o cavo selezionato | Delete / Backspace |
| Annulla collegamento e selezione | Esc |
| Sposta dispositivo dall’intestazione focalizzata | Frecce; Shift per passi più grandi |

## Avvio locale

Richiede **Node.js 20.19+ oppure 22.12+** e npm. Consigliato Node 22 LTS o successivo.

```sh
npm ci
npm run dev
```

Apri [http://127.0.0.1:4173/](http://127.0.0.1:4173/).

Per un avvio in background, su macOS e Windows:

```sh
npm run start:all
npm run stop:all
```

Sono disponibili anche `scripts/starter-macos.command` e `scripts/stopper-macos.command`, e le controparti Windows `.cmd`. Il gestore controlla che il processo appartenga a questa repository prima di arrestarlo. Non arresta altri programmi in ascolto sulla stessa porta. Per un’altra porta imposta `SCHEMATIC_PORT` (ed eventualmente `SCHEMATIC_HOST`). I log locali sono in `.dev-server.log`.

## Verifiche

```sh
npm run check       # lint, test della logica e compilazione
npx playwright install chromium firefox webkit
npm run test:e2e    # test sul sito compilato, inclusi i percorsi GitHub Pages
```

Per usare Chrome già installato: `PLAYWRIGHT_CHROME_CHANNEL=chrome npm run test:e2e`. Per salvare i browser di test in una cartella specifica, usa `PLAYWRIGHT_BROWSERS_PATH` sia nell’installazione sia nei test. I test coprono collegamenti, geometria, importazioni, annullamento, navigazione da tastiera, layout mobile, esportazioni e uno schema da 40 dispositivi. WebKit verifica il motore usato da Safari, senza sostituire un collaudo sulle singole versioni di Safari e iOS.

```sh
npm run build
npm run preview
```

L’anteprima compilata è su [http://127.0.0.1:4173/Schematic-Tool/](http://127.0.0.1:4173/Schematic-Tool/). Il percorso `/Schematic-Tool/` serve per GitHub Pages; lo sviluppo usa `/`.

## Struttura

- `src/components`: interfaccia, schema, gestione libreria e documentazione operativa.
- `src/hooks`: cronologia, salvataggio e operazioni sul progetto.
- `src/lib/project.ts`: formato progetto, validazione dei file e migrazioni precedenti.
- `src/lib/layout.ts` e `routing.ts`: disposizione per flusso e ricerca dei percorsi dei cavi.
- `src/lib/export.ts`: esportazioni caricate solo quando richieste.
- `src/data`: catalogo dispositivi, connettori e colori.
- `tests`: verifiche della logica e prove su Chromium, Firefox e WebKit.

### Limiti pratici

Il percorso dei cavi viene ricalcolato quando cambia la geometria. Dispositivi sovrapposti manualmente o schemi molto densi possono richiedere **Ordina per flusso** e qualche spostamento manuale. Per mantenere reattivo l’editor, la ricerca dei percorsi ha un limite di esplorazione e usa un percorso semplificato quando non trova una soluzione. La PNG rappresenta la vista corrente delle porte; il PDF contiene la matrice dei collegamenti. L’esportazione PNG adatta la risoluzione sui diagrammi grandi per rispettare i limiti dei canvas dei browser.

[Requisiti e compatibilità](docs/system-requirements.md)

Il pacchetto di sviluppo `@typescript-eslint/typescript-estree` usa una risoluzione esplicita di `minimatch` 11.0.1+ per includere la correzione dei pattern patologici. L’override può essere rimosso quando la dipendenza a monte adotta una versione corretta.
