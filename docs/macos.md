# App macOS

La versione Mac usa la stessa interfaccia React dell’app web, inclusa in un’app nativa Swift con WKWebView. Le risorse sono nel pacchetto `.app` e vengono servite con l’origine interna `schematic://app`: non viene avviato un server e non servono Internet, Node.js o un browser separato durante l’uso.

Requisiti: **macOS 13.3 o successivo**, Mac Apple Silicon o Intel. Il ZIP è universale, quindi non bisogna scegliere un’architettura.

## Installazione e progetti

Apri `Schematic-macOS-universal.zip` e trascina **Schematic** su **Applicazioni**. Il progetto viene salvato automaticamente e atomicamente in:

```text
~/Library/Application Support/io.github.lorenzoapra.schematic-tool/project.json
```

L’app conserva il salvataggio anche dopo gli aggiornamenti. Le copie aperte nel browser sono indipendenti: usa **Esporta progetto** e **Apri progetto** per passare dal web al Mac e viceversa. JSON, PNG, PDF e CSV usano la finestra nativa di salvataggio. Un’esportazione sostituisce un file esistente solo dopo che il download è terminato. Chiudere la finestra o uscire con ⌘Q salva anche le ultime modifiche in attesa del salvataggio automatico.

Se il file salvato non è leggibile o non contiene un progetto valido, l’app mostra il problema di salvataggio e preserva il file originale. Puoi esportare lo schema corrente, poi spostare il file problematico prima di riaprire l’app.

Se un’altra istanza dell’app o un programma esterno modifica il file durante l’uso, il salvataggio automatico si ferma per evitare di sovrascrivere quelle modifiche. Esporta una copia del lavoro corrente, poi riapri l’app per caricare il file aggiornato.

## Compilazione su Mac

Servono Node.js come per il progetto web e Xcode oppure i Command Line Tools (`xcode-select --install`). Non sono state aggiunte dipendenze npm.

```sh
npm ci
npm run check
npm run test:mac
npm run build:mac
```

Risultati:

- `dist-desktop/`: risorse web offline, separate da `dist/` usato da GitHub Pages.
- `release/Schematic.app`: app universale Apple Silicon + Intel.
- `release/Schematic-macOS-universal.zip`: pacchetto contenente l’app pronta da trascinare in Applicazioni.

La compilazione usa `swiftc`, `lipo`, `codesign` e `ditto`, disponibili su macOS con gli strumenti di sviluppo. Per provare l’app: `open release/Schematic.app`.

Il test nativo carica la build desktop in WKWebView con dati temporanei isolati: verifica avvio offline, salvataggio su disco, ripristino, protezione dei file danneggiati ed esportazioni JSON, PNG e PDF. I test Playwright della versione web verificano anche download disponibile, prima pubblicazione e recupero dagli errori di rete.

## Download dal sito e pubblicazione

**App per Mac** nella barra superiore apre le informazioni di installazione e cerca la release stabile più recente su GitHub. Il download appare soltanto se la release contiene l’asset `Schematic-macOS-universal.zip`. Senza release l’app lo indica; in caso di errore della verifica offre un nuovo tentativo e il collegamento alle release. Nell’app Mac questo pulsante non compare.

Il workflow `.github/workflows/release-macos.yml` compila e collauda il pacchetto su Mac:

- **Run workflow** crea un artifact scaricabile da GitHub Actions, senza pubblicare una release.
- Un tag `v` seguito dalla versione esatta di `package.json` pubblica il ZIP in GitHub Releases e lo rende disponibile al pulsante sul sito.

Esempio per la versione iniziale, dopo aver committato e inviato le modifiche:

```sh
git tag v0.1.0
git push origin v0.1.0
```

La pubblicazione del sito resta affidata al workflow GitHub Pages esistente, con push su `master`. Non serve includere il ZIP nel sito o nel repository.

## Firma e notarizzazione

Senza credenziali Apple la compilazione applica una firma **ad hoc** per il collaudo locale. Non è una firma Developer ID e non evita i controlli Gatekeeper sui download da Internet. Per distribuire normalmente l’app serve un certificato **Developer ID Application**, con notarizzazione Apple.

Per una build locale firmata, imposta `MACOS_SIGN_IDENTITY` sul nome completo dell’identità presente nel Portachiavi. Per notarizzare anche l’app, crea un profilo con `xcrun notarytool store-credentials` e imposta `MACOS_NOTARY_PROFILE` sul suo nome prima di `npm run build:mac`.

Per il workflow GitHub configura questi repository secrets:

| Secret                        | Contenuto                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `MACOS_CERTIFICATE_P12`       | Certificato Developer ID Application esportato come `.p12`, codificato Base64 |
| `MACOS_CERTIFICATE_PASSWORD`  | Password del file `.p12`                                                      |
| `MACOS_SIGN_IDENTITY`         | Nome completo `Developer ID Application: … (TEAMID)`                          |
| `APPLE_ID`                    | Account Apple Developer                                                       |
| `APPLE_TEAM_ID`               | Team ID del certificato                                                       |
| `APPLE_APP_SPECIFIC_PASSWORD` | Password specifica per app per `notarytool`                                   |

Con i tre secret Apple e il certificato configurati, il workflow firma, invia il pacchetto al servizio Apple e allega all’app il ticket di notarizzazione prima di pubblicarlo. Senza notarizzazione le note della release lo dichiarano.
