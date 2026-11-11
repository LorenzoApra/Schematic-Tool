import { useState, type CSSProperties } from 'react'
import {
  connectorTypeColors,
  fallbackConnectionColor,
} from '../data/connectorColors'
import { portKey, samePort } from '../lib/project'
import type {
  DeviceDefinition,
  PortDefinition,
  PortRef,
} from '../types/schematic'
import { Icon } from './Icon'

type PortViewMode = 'all' | 'input' | 'output' | 'bidirectional'
interface Props {
  id: string
  x: number
  y: number
  displayName: string
  collapsed: boolean
  device: DeviceDefinition
  activePort: PortRef | null
  selected: boolean
  dimmed: boolean
  connectedOnly: boolean
  usedPorts: Set<string>
  onPortClick: (port: PortRef) => void
  onSelect: (id: string) => void
  onDragStart: (id: string, clientX: number, clientY: number) => void
  onMove: (id: string, x: number, y: number) => void
  onMoveEnd: () => void
  onDeleteNode: (id: string) => void
  onRenameNode: (id: string, name: string) => void
  onToggleCollapse: (id: string) => void
}
export function DeviceNode({
  id,
  x,
  y,
  displayName,
  collapsed,
  device,
  activePort,
  selected,
  dimmed,
  connectedOnly,
  usedPorts,
  onPortClick,
  onSelect,
  onDragStart,
  onMove,
  onMoveEnd,
  onDeleteNode,
  onRenameNode,
  onToggleCollapse,
}: Props) {
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(displayName),
    [mode, setMode] = useState<PortViewMode>('all')
  const allPorts = [...device.inputs, ...device.outputs]
  const groups = [
    {
      kind: 'input',
      label: 'INGRESSI',
      ports: allPorts.filter((p) => p.kind === 'input'),
    },
    {
      kind: 'output',
      label: 'USCITE',
      ports: allPorts.filter((p) => p.kind === 'output'),
    },
    {
      kind: 'bidirectional',
      label: 'BIDIREZIONALI',
      ports: allPorts.filter((p) => p.kind === 'bidirectional'),
    },
  ]
    .filter((group) => mode === 'all' || mode === group.kind)
    .map((group) => ({
      ...group,
      ports: group.ports.filter(
        (p) =>
          !connectedOnly ||
          usedPorts.has(portKey({ nodeId: id, portId: p.id, kind: p.kind })),
      ),
    }))
    .filter((group) => group.ports.length)
  const saveName = () => {
    if (name.trim()) onRenameNode(id, name)
    setEditing(false)
  }
  const portButton = (port: PortDefinition) => {
    const ref: PortRef = { nodeId: id, portId: port.id, kind: port.kind },
      used = usedPorts.has(portKey(ref)),
      active = activePort && samePort(activePort, ref)
    const color =
      connectorTypeColors[port.connectorType] || fallbackConnectionColor
    return (
      <button
        key={`${port.kind}:${port.id}`}
        type="button"
        className={`port-button ${port.kind} ${used ? 'connected' : ''} ${active ? 'active' : ''}`}
        style={{ '--port-color': color } as CSSProperties}
        data-node-id={id}
        data-port-id={port.id}
        data-port-kind={port.kind}
        aria-pressed={Boolean(active)}
        title={`${displayName} · ${port.label} · ${port.connectorType}${used ? ' · collegata' : ''}`}
        onClick={() => onPortClick(ref)}
      >
        <span className="port-dot" />
        <span className="port-label">{port.label}</span>
        <small>{port.connectorType}</small>
      </button>
    )
  }
  return (
    <article
      className={`device-node ${selected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}`}
      data-node-id={id}
      style={{ left: x, top: y }}
      onClick={() => onSelect(id)}
    >
      <header
        className="node-header"
        tabIndex={0}
        aria-label={`${displayName}. Trascina o usa le frecce per spostare.`}
        onKeyDown={(event) => {
          if ((event.target as HTMLElement).closest('button, input')) return
          const delta = event.shiftKey ? 48 : 24
          const directions: Record<string, [number, number]> = {
            ArrowLeft: [-delta, 0],
            ArrowRight: [delta, 0],
            ArrowUp: [0, -delta],
            ArrowDown: [0, delta],
          }
          if (directions[event.key]) {
            event.preventDefault()
            onSelect(id)
            const [dx, dy] = directions[event.key]
            onMove(id, Math.max(16, x + dx), Math.max(16, y + dy))
            onMoveEnd()
          }
        }}
        onPointerDown={(event) => {
          if (
            event.button !== 0 ||
            (event.target as HTMLElement).closest('button, input, select, form')
          )
            return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          onSelect(id)
          onDragStart(id, event.clientX, event.clientY)
        }}
      >
        <span className="node-category-icon">
          <Icon
            name={
              device.category.includes('rete')
                ? 'grid'
                : device.category.includes('audio')
                  ? 'cable'
                  : 'box'
            }
            size={17}
          />
        </span>
        {editing ? (
          <form
            className="node-name-editor"
            onSubmit={(event) => {
              event.preventDefault()
              saveName()
            }}
          >
            <input
              autoFocus
              aria-label="Nome del dispositivo"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={saveName}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(false)
              }}
            />
            <button
              type="submit"
              className="icon-button"
              aria-label="Salva nome"
            >
              <Icon name="check" size={14} />
            </button>
          </form>
        ) : (
          <div className="node-title">
            <strong title={displayName}>{displayName}</strong>
            <small>{device.name}</small>
          </div>
        )}
        <div className="node-actions" data-export-ignore>
          <button
            type="button"
            className="icon-button"
            aria-label={`Rinomina ${displayName}`}
            title="Rinomina"
            onClick={() => {
              setName(displayName)
              setEditing(true)
            }}
          >
            <Icon name="edit" size={14} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={
              collapsed ? `Espandi ${displayName}` : `Comprimi ${displayName}`
            }
            title={collapsed ? 'Espandi' : 'Comprimi'}
            onClick={() => onToggleCollapse(id)}
          >
            <Icon name={collapsed ? 'plus' : 'minus'} size={14} />
          </button>
          <button
            type="button"
            className="icon-button danger-quiet"
            aria-label={`Rimuovi ${displayName}`}
            title="Rimuovi"
            onClick={(event) => {
              event.stopPropagation()
              onDeleteNode(id)
            }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      </header>
      {collapsed ? (
        <div className="collapsed-node-meta">
          {allPorts.length} porte <span>·</span>{' '}
          {
            allPorts.filter((p) =>
              usedPorts.has(
                portKey({ nodeId: id, portId: p.id, kind: p.kind }),
              ),
            ).length
          }{' '}
          collegate
        </div>
      ) : (
        <div className="ports-layout">
          <div className="ports-row">
            {groups
              .filter((g) => g.kind !== 'bidirectional')
              .map((group) => (
                <div className={`ports-col ${group.kind}`} key={group.kind}>
                  <strong>{group.label}</strong>
                  {group.ports.map(portButton)}
                </div>
              ))}
          </div>
          {groups
            .filter((g) => g.kind === 'bidirectional')
            .map((group) => (
              <div className="ports-col bidirectional-ports" key={group.kind}>
                <strong>{group.label}</strong>
                {group.ports.map(portButton)}
              </div>
            ))}
          {!groups.length && (
            <p className="node-no-ports">
              {connectedOnly
                ? 'Nessuna porta collegata'
                : 'Nessuna porta in questa vista'}
            </p>
          )}
          <div className="node-footer" data-export-ignore>
            <span>{allPorts.length} porte</span>
            <select
              aria-label={`Mostra porte di ${displayName}`}
              value={mode}
              onChange={(event) => setMode(event.target.value as PortViewMode)}
            >
              <option value="all">Tutte le porte</option>
              <option value="input">Solo ingressi</option>
              <option value="output">Solo uscite</option>
              <option value="bidirectional">Solo bidirezionali</option>
            </select>
          </div>
        </div>
      )}
    </article>
  )
}
