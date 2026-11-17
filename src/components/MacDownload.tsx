import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { Modal } from './Modal'

const releasesURL = 'https://github.com/LorenzoApra/Schematic-Tool/releases'
const latestReleaseAPI =
  'https://api.github.com/repos/LorenzoApra/Schematic-Tool/releases/latest'

type DownloadState =
  | { status: 'loading' | 'unpublished' | 'error' }
  | { status: 'ready'; url: string; version: string; size: number }

export function MacDownload({ onClose }: { onClose: () => void }) {
  const [download, setDownload] = useState<DownloadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    let active = true
    async function checkRelease() {
      try {
        const response = await fetch(latestReleaseAPI, {
          signal: controller.signal,
          headers: { Accept: 'application/vnd.github+json' },
        })
        if (!active) return
        if (response.status === 404) {
          setDownload({ status: 'unpublished' })
          return
        }
        if (!response.ok) throw new Error('Release non disponibile')
        const release = await response.json()
        const asset = Array.isArray(release.assets)
          ? release.assets.find(
              (asset: { name?: string }) =>
                asset.name === 'Schematic-macOS-universal.zip',
            )
          : undefined
        if (!active) return
        if (!asset) {
          setDownload({ status: 'unpublished' })
          return
        }
        if (
          typeof asset.browser_download_url !== 'string' ||
          !asset.browser_download_url.startsWith(`${releasesURL}/download/`)
        )
          throw new Error('Indirizzo di download non valido')
        setDownload({
          status: 'ready',
          url: asset.browser_download_url,
          version: typeof release.tag_name === 'string' ? release.tag_name : '',
          size: typeof asset.size === 'number' ? asset.size : 0,
        })
      } catch {
        if (active) setDownload({ status: 'error' })
      } finally {
        window.clearTimeout(timeout)
      }
    }
    void checkRelease()
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [attempt])

  return (
    <Modal title="Schematic per Mac" onClose={onClose}>
      <div className="mac-download">
        <p>
          Lo stesso spazio di lavoro, in un’app sul tuo Mac. Funziona anche
          senza Internet e salva automaticamente il progetto sul computer.
        </p>
        <p>
          <strong>macOS 13.3 o successivo · Apple Silicon e Intel</strong>
          <br />
          Apri il file ZIP e trascina Schematic nella cartella Applicazioni.
        </p>
        <div className="download-status" role="status">
          {download.status === 'loading' && 'Verifica del download…'}
          {download.status === 'unpublished' &&
            'Il download sarà disponibile dopo la prima pubblicazione dell’app per Mac.'}
          {download.status === 'error' &&
            'Non è stato possibile verificare il download. Riprova o consulta le versioni pubblicate.'}
          {download.status === 'ready' && (
            <>
              <a className="download-link" href={download.url}>
                <Icon name="download" />
                Scarica per Mac {download.version}
                {download.size > 0 &&
                  ` · ${(download.size / 1_048_576).toFixed(1)} MB`}
              </a>
              <span className="muted">
                Un unico pacchetto per entrambi i tipi di Mac.
              </span>
            </>
          )}
        </div>
        {download.status === 'error' && (
          <button
            type="button"
            onClick={() => {
              setDownload({ status: 'loading' })
              setAttempt((value) => value + 1)
            }}
          >
            Riprova
          </button>
        )}
        <p className="muted">
          I progetti web e Mac sono indipendenti. Per trasferirli usa “Esporta
          progetto” e poi “Apri progetto”.
        </p>
        <a href={releasesURL} target="_blank" rel="noopener noreferrer">
          Tutte le versioni e note di rilascio
        </a>
      </div>
    </Modal>
  )
}
