# Requisiti e compatibilità

## Uso dell’app

Il sito è statico: per usarlo da GitHub Pages non serve installare Node.js. Richiede un browser con JavaScript e memoria locale disponibili.

Target dichiarati della compilazione:

- Chrome / Chromium 111 o successivo.
- Firefox 114 o successivo.
- Safari 16.4 o successivo, incluso iPadOS/iOS 16.4+.
- Edge recente, basato su Chromium.

Per l’uso operativo sono consigliate le versioni aggiornate dei browser. La suite automatica esegue i flussi su Chromium, Firefox e WebKit. WebKit è il motore di Safari: questo non equivale a verificare ogni versione distribuita da Apple. L’interfaccia si adatta a desktop, tablet e schermi stretti. Per regie complesse è consigliato uno schermo da almeno 1366×768 e un mouse o trackpad.

Se la memoria locale è bloccata o piena, l’app continua a funzionare e mostra un avviso di salvataggio. In questo caso esporta il progetto JSON prima di chiudere la pagina. I dati sono locali all’origine e al browser utilizzati.

## Sviluppo locale

- Node.js **20.19+ nella serie 20, oppure 22.12+**. Consigliato Node 22 LTS o successivo.
- npm incluso con Node.js.
- macOS o Windows compatibile con la versione Node scelta; le versioni Linux supportate da Node funzionano con gli stessi comandi npm.
- Internet necessario per installare le dipendenze e i browser di test. L’app non richiede servizi remoti durante l’uso.

```sh
npm ci
npm run dev
```

L’editor è su `http://127.0.0.1:4173/`. La porta è fissa: se occupata, il server segnala l’errore. Con `npm run dev -- --port 4174` puoi sceglierne un’altra.

## Compilazione e distribuzione

```sh
npm run check
npm run build
npm run preview
```

La build è configurata per il percorso GitHub Pages `/Schematic-Tool/`. L’anteprima usa lo stesso percorso: `http://127.0.0.1:4173/Schematic-Tool/`.

La pipeline esegue lint e test della logica prima di compilare e distribuire. I test browser sono in un workflow dedicato e possono essere eseguiti localmente con `npm run test:e2e` dopo `npx playwright install chromium firefox webkit`.
