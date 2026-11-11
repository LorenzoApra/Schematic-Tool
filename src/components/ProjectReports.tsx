import { useState } from 'react'
import { downloadFile } from '../lib/download'
import { csvCell } from '../lib/csv'
import type {
  Connection,
  DeviceDefinition,
  NodeInstance,
  PortRef,
} from '../types/schematic'
import { Icon } from './Icon'

export function ProjectReports({
  view,
  nodes,
  connections,
  devicesById,
  getPortLabel,
  getConnector,
  onDeleteConnection,
}: {
  view: 'patch' | 'equipment'
  nodes: NodeInstance[]
  connections: Connection[]
  devicesById: Record<string, DeviceDefinition>
  getPortLabel: (ref: PortRef) => string
  getConnector: (ref: PortRef) => string
  onDeleteConnection: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const nodeLabel = (id: string) => {
    const node = nodes.find((n) => n.id === id)
    return node?.customName || (node && devicesById[node.deviceId]?.name) || id
  }
  const rows = connections
    .map((c, i) => ({
      id: c.id,
      values: [
        `C${String(i + 1).padStart(2, '0')}`,
        getConnector(c.from),
        nodeLabel(c.from.nodeId),
        getPortLabel(c.from),
        nodeLabel(c.to.nodeId),
        getPortLabel(c.to),
      ],
    }))
    .filter((row) =>
      row.values.join(' ').toLowerCase().includes(search.toLowerCase()),
    )
  const deviceCounts = new Map<string, number>()
  nodes.forEach((n) =>
    deviceCounts.set(n.deviceId, (deviceCounts.get(n.deviceId) || 0) + 1),
  )
  const equipment = [...deviceCounts].map(([id, count]) => [
    devicesById[id]?.name || id,
    String(count),
    'Dispositivo',
  ])
  const cableCounts = new Map<string, number>()
  connections.forEach((c) => {
    const type = getConnector(c.from)
    cableCounts.set(type, (cableCounts.get(type) || 0) + 1)
  })
  const materials = [
    ...equipment,
    ...[...cableCounts].map(([type, count]) => [type, String(count), 'Cavo']),
  ].filter((row) => row.join(' ').toLowerCase().includes(search.toLowerCase()))
  const exportCsv = () => {
    const data =
      view === 'patch'
        ? [
            [
              'ID',
              'Connettore',
              'Dispositivo sorgente',
              'Porta sorgente',
              'Dispositivo destinazione',
              'Porta destinazione',
            ],
            ...rows.map((r) => r.values),
          ]
        : [['Materiale', 'Quantità', 'Tipo'], ...materials]
    downloadFile(
      view === 'patch' ? 'patch-list.csv' : 'materiali.csv',
      '\uFEFF' + data.map((row) => row.map(csvCell).join(';')).join('\r\n'),
      'text/csv;charset=utf-8',
    )
  }
  return (
    <section
      className="report-view"
      aria-label={view === 'patch' ? 'Patch list' : 'Materiali'}
    >
      <div className="report-heading">
        <div>
          <span className="eyebrow">DOCUMENTAZIONE OPERATIVA</span>
          <h2>
            {view === 'patch'
              ? 'Ogni segnale, una destinazione.'
              : 'Tutto quello che serve.'}
          </h2>
          <p>
            {view === 'patch'
              ? 'La lista dei collegamenti si aggiorna insieme allo schema.'
              : 'Quantità dei dispositivi e dei cavi ricavate dallo schema.'}
          </p>
        </div>
        <button type="button" onClick={exportCsv}>
          <Icon name="download" />
          Esporta CSV
        </button>
      </div>
      <div className="report-search">
        <Icon name="search" />
        <input
          aria-label="Cerca nella lista"
          placeholder="Cerca un dispositivo, una porta o un connettore…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {(view === 'patch'
                ? ['Cavo', 'Segnale', 'Sorgente', 'Destinazione', '']
                : ['Materiale', 'Quantità', 'Tipo']
              ).map((label, i) => (
                <th key={i}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view === 'patch'
              ? rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code>{row.values[0]}</code>
                    </td>
                    <td>
                      <span className="connector-badge">{row.values[1]}</span>
                    </td>
                    <td>
                      <strong>{row.values[2]}</strong>
                      <small>{row.values[3]}</small>
                    </td>
                    <td>
                      <strong>{row.values[4]}</strong>
                      <small>{row.values[5]}</small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="icon-button danger-quiet"
                        aria-label={`Rimuovi ${row.values[0]}`}
                        onClick={() => onDeleteConnection(row.id)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              : materials.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{row[0]}</strong>
                    </td>
                    <td>
                      <code>{row[1]}</code>
                    </td>
                    <td>{row[2]}</td>
                  </tr>
                ))}
          </tbody>
        </table>
        {(view === 'patch' ? rows.length : materials.length) === 0 && (
          <div className="report-empty">
            <Icon name={view === 'patch' ? 'cable' : 'box'} size={32} />
            <p>
              {search
                ? 'Nessun risultato per questa ricerca.'
                : 'Aggiungi dispositivi e collegamenti allo schema per compilare questa lista.'}
            </p>
          </div>
        )}
      </div>
      {view === 'equipment' && (
        <p className="muted">
          Le quantità dei cavi rappresentano i collegamenti diretti. Lunghezze,
          adattatori e scorte vanno verificati per l’allestimento.
        </p>
      )}
    </section>
  )
}
