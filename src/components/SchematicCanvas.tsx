import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  connectorTypeColors,
  fallbackConnectionColor,
} from '../data/connectorColors'
import { connectorCategoryLabels } from '../data/connectors'
import { portKey, toSlug } from '../lib/project'
import {
  createRouter,
  roundedPath,
  type Point,
  type Rect,
} from '../lib/routing'
import { exportGraphic, exportMatrix } from '../lib/export'
import type {
  Connection,
  DeviceDefinition,
  NodeInstance,
  PortRef,
} from '../types/schematic'
import { DeviceNode } from './DeviceNode'
import { ProjectReports } from './ProjectReports'
import { Icon } from './Icon'

interface Props {
  nodes: NodeInstance[]
  devicesById: Record<string, DeviceDefinition>
  connections: Connection[]
  activePort: PortRef | null
  selectedNode: string | null
  projectTitle: string
  isLibraryCollapsed: boolean
  onToggleLibrary: () => void
  onSelectNode: (id: string | null) => void
  onPortClick: (port: PortRef) => void
  onCancelConnection: () => void
  onAddDevice: (id: string, point?: Point) => void
  onNodeMove: (id: string, x: number, y: number) => void
  onMoveEnd: () => void
  onDeleteNode: (id: string) => void
  onDuplicateNode: () => void
  onRenameNode: (id: string, name: string) => void
  onToggleNodeCollapse: (id: string) => void
  onDeleteConnection: (id: string) => void
  onArrange: (heights: Record<string, number>) => void
  onLoadDemo: () => void
  onClear: () => void
  onNotify: (message: string) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}
interface Measurements {
  rects: Record<string, Rect>
  ports: Record<string, Point>
}
const clampZoom = (zoom: number) => Math.min(2, Math.max(0.1, zoom))

export function SchematicCanvas(props: Props) {
  const {
    nodes,
    devicesById,
    connections,
    activePort,
    selectedNode,
    onNodeMove,
    onMoveEnd,
  } = props
  const [view, setView] = useState<'diagram' | 'patch' | 'equipment'>('diagram')
  const [zoom, setZoom] = useState(1),
    [snap, setSnap] = useState(true),
    [connectedOnly, setConnectedOnly] = useState(false)
  const [signalFilter, setSignalFilter] = useState('all'),
    [selectedCable, setSelectedCable] = useState<string | null>(null)
  const [hoveredCable, setHoveredCable] = useState<string | null>(null),
    [exporting, setExporting] = useState(false)
  const [dragging, setDragging] = useState(false),
    [dropActive, setDropActive] = useState(false)
  const [measurements, setMeasurements] = useState<Measurements>({
    rects: {},
    ports: {},
  })
  const stageRef = useRef<HTMLDivElement>(null),
    contentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const previousNodeIds = useRef(new Set(nodes.map((n) => n.id)))
  const moveCallback = useRef(onNodeMove),
    endCallback = useRef(onMoveEnd)
  useLayoutEffect(() => {
    moveCallback.current = onNodeMove
    endCallback.current = onMoveEnd
  })
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const getPortDefinition = (ref: PortRef) => {
    const node = nodeMap.get(ref.nodeId),
      device = node && devicesById[node.deviceId]
    return device
      ? ([...device.inputs, ...device.outputs].find(
          (p) => p.id === ref.portId && p.kind === ref.kind,
        ) ?? null)
      : null
  }
  const nodeLabel = (id: string) => {
    const node = nodeMap.get(id)
    return node?.customName || (node && devicesById[node.deviceId]?.name) || id
  }
  const portLabel = (ref: PortRef) =>
    getPortDefinition(ref)?.label || ref.portId
  const connector = (ref: PortRef) =>
    getPortDefinition(ref)?.connectorType || 'Sconosciuto'
  const usedPorts = useMemo(
    () => new Set(connections.flatMap((c) => [portKey(c.from), portKey(c.to)])),
    [connections],
  )
  const legend = [...new Set(connections.map((c) => connector(c.from)))].sort()
  const focusCable =
    hoveredCable ||
    (connections.some((c) => c.id === selectedCable) ? selectedCable : null)
  const focusNode = nodes.some((n) => n.id === selectedNode)
    ? selectedNode
    : null

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content || view !== 'diagram') return
    const measure = () => {
      const bounds = content.getBoundingClientRect()
      const rects: Measurements['rects'] = {},
        ports: Measurements['ports'] = {}
      content.querySelectorAll<HTMLElement>('.device-node').forEach((el) => {
        rects[el.dataset.nodeId!] = {
          x: el.offsetLeft,
          y: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
        }
      })
      content.querySelectorAll<HTMLElement>('.port-button').forEach((el) => {
        const rect = el.getBoundingClientRect()
        ports[
          portKey({
            nodeId: el.dataset.nodeId!,
            portId: el.dataset.portId!,
            kind: el.dataset.portKind as PortRef['kind'],
          })
        ] = {
          x: (rect.left - bounds.left + rect.width / 2) / zoom,
          y: (rect.top - bounds.top + rect.height / 2) / zoom,
        }
      })
      const next = { rects, ports }
      setMeasurements((current) =>
        JSON.stringify(current) === JSON.stringify(next) ? current : next,
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    content
      .querySelectorAll('.device-node')
      .forEach((el) => observer.observe(el))
    const mutation = new MutationObserver(measure)
    mutation.observe(content, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mutation.disconnect()
    }
  }, [nodes, devicesById, zoom, view, connectedOnly])

  const extent = Object.values(measurements.rects).reduce(
    (size, rect) => ({
      width: Math.max(size.width, rect.x + rect.width + 96),
      height: Math.max(size.height, rect.y + rect.height + 96),
    }),
    { width: 960, height: 640 },
  )
  const fit = () => {
    const stage = stageRef.current
    if (!stage) return
    const rects = Object.values(measurements.rects)
    const width = Math.max(400, ...rects.map((r) => r.x + r.width + 64)),
      height = Math.max(280, ...rects.map((r) => r.y + r.height + 64))
    setZoom(
      clampZoom(
        Math.min(stage.clientWidth / width, stage.clientHeight / height, 1),
      ),
    )
    stage.scrollTo({ left: 0, top: 0 })
  }
  const fitRequested = useRef(false)
  useLayoutEffect(() => {
    if (
      fitRequested.current &&
      nodes.every(
        (n) =>
          measurements.rects[n.id]?.x === n.x &&
          measurements.rects[n.id]?.y === n.y,
      )
    ) {
      fitRequested.current = false
      fit()
    }
  })
  useEffect(() => {
    const added = nodes.find((n) => !previousNodeIds.current.has(n.id))
    previousNodeIds.current = new Set(nodes.map((n) => n.id))
    if (added && stageRef.current && view === 'diagram')
      stageRef.current.scrollTo({
        left: Math.max(0, added.x * zoom - 48),
        top: Math.max(0, added.y * zoom - 64),
        behavior: 'smooth',
      })
  }, [nodes, zoom, view])

  useEffect(() => {
    let pending: Point | null = null,
      frame = 0
    const flush = () => {
      frame = 0
      const drag = dragRef.current
      if (!pending || !drag) return
      const align = (value: number) =>
        Math.max(16, snap ? Math.round(value / 24) * 24 : Math.round(value))
      moveCallback.current(drag.id, align(pending.x), align(pending.y))
      pending = null
    }
    const move = (event: PointerEvent) => {
      const drag = dragRef.current,
        stage = stageRef.current
      if (!drag || !stage) return
      const rect = stage.getBoundingClientRect()
      pending = {
        x: (event.clientX - rect.left + stage.scrollLeft) / zoom - drag.x,
        y: (event.clientY - rect.top + stage.scrollTop) / zoom - drag.y,
      }
      if (!frame) frame = requestAnimationFrame(flush)
    }
    const end = () => {
      if (!dragRef.current) return
      if (frame) cancelAnimationFrame(frame)
      flush()
      dragRef.current = null
      setDragging(false)
      endCallback.current()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    window.addEventListener('blur', end)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      window.removeEventListener('blur', end)
    }
  }, [zoom, snap])

  const layouts = useMemo(() => {
    const router = createRouter(Object.values(measurements.rects))
    return connections.flatMap((connection, i) => {
      const fromRect = measurements.rects[connection.from.nodeId],
        toRect = measurements.rects[connection.to.nodeId]
      if (!fromRect || !toRect) return []
      const anchor = (
        ref: PortRef,
        rect: Rect,
        opposite: Rect,
        source: boolean,
      ) => {
        const side =
          ref.kind === 'input'
            ? -1
            : ref.kind === 'output'
              ? 1
              : opposite.x >= rect.x
                ? 1
                : -1
        const visible = measurements.ports[portKey(ref)]
        const hiddenRefs = connections
          .flatMap((c) => [c.from, c.to])
          .filter(
            (r) => r.nodeId === ref.nodeId && !measurements.ports[portKey(r)],
          )
        const hiddenIndex = hiddenRefs.findIndex(
          (r) => portKey(r) === portKey(ref),
        )
        return {
          point: {
            x: side > 0 ? rect.x + rect.width : rect.x,
            y:
              visible?.y ??
              rect.y +
                72 +
                ((hiddenIndex + 1) / (hiddenRefs.length + 1)) *
                  Math.max(8, rect.height - 80),
          },
          side,
          source,
        }
      }
      const from = anchor(connection.from, fromRect, toRect, true),
        to = anchor(connection.to, toRect, fromRect, false)
      const points = router(from.point, to.point, from.side, to.side)
      const node = nodeMap.get(connection.from.nodeId),
        device = node && devicesById[node.deviceId]
      const port =
        device &&
        [...device.inputs, ...device.outputs].find(
          (p) =>
            p.id === connection.from.portId && p.kind === connection.from.kind,
        )
      return [
        {
          connection,
          from: from.point,
          to: to.point,
          d: roundedPath(points),
          label: `C${String(i + 1).padStart(2, '0')}`,
          category: port?.connectorCategory,
          type: port?.connectorType || '',
          color:
            connectorTypeColors[port?.connectorType || ''] ||
            fallbackConnectionColor,
        },
      ]
    })
  }, [measurements, connections, nodeMap, devicesById])

  const exportAction = async (type: 'png' | 'pdf') => {
    if (exporting) return
    setExporting(true)
    try {
      if (type === 'png' && contentRef.current)
        await exportGraphic(contentRef.current, toSlug(props.projectTitle))
      else await exportMatrix(connections, getPortDefinition, nodeLabel)
      props.onNotify('Esportazione completata.')
    } catch {
      props.onNotify(
        'Esportazione non riuscita. Prova con uno schema più piccolo oppure esporta il progetto JSON.',
      )
    } finally {
      setExporting(false)
    }
  }
  const inspect = connections.find(
    (c) => c.id === (focusCable || selectedCable),
  )
  const selectedId = inspect ? connections.indexOf(inspect) + 1 : 0
  const connectedNodeIds = focusCable
    ? new Set(
        connections
          .filter((c) => c.id === focusCable)
          .flatMap((c) => [c.from.nodeId, c.to.nodeId]),
      )
    : focusNode
      ? new Set([
          focusNode,
          ...connections
            .filter(
              (c) => c.from.nodeId === focusNode || c.to.nodeId === focusNode,
            )
            .flatMap((c) => [c.from.nodeId, c.to.nodeId]),
        ])
      : null

  return (
    <main className="canvas-wrapper">
      <div className="workspace-toolbar">
        <button
          type="button"
          className={`icon-button ${!props.isLibraryCollapsed ? 'active' : ''}`}
          aria-label={
            props.isLibraryCollapsed ? 'Mostra libreria' : 'Nascondi libreria'
          }
          aria-pressed={!props.isLibraryCollapsed}
          onClick={props.onToggleLibrary}
        >
          <Icon name="panel" />
        </button>
        <span className="action-divider" />
        <nav className="view-tabs" aria-label="Viste del progetto">
          {(
            [
              { id: 'diagram', label: 'Schema', icon: 'diagram' },
              { id: 'patch', label: 'Patch list', icon: 'cable' },
              { id: 'equipment', label: 'Materiali', icon: 'box' },
            ] as const
          ).map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={view === tab.id ? 'active' : ''}
              aria-current={view === tab.id ? 'page' : undefined}
              onClick={() => setView(tab.id)}
            >
              <Icon name={tab.icon} size={17} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="toolbar-right">
          <button
            type="button"
            className="icon-button"
            disabled={!props.canUndo}
            aria-label="Annulla"
            title="Annulla · ⌘/Ctrl Z"
            onClick={props.onUndo}
          >
            <Icon name="undo" />
          </button>
          <button
            type="button"
            className="icon-button"
            disabled={!props.canRedo}
            aria-label="Ripristina"
            title="Ripristina · ⌘/Ctrl ⇧ Z"
            onClick={props.onRedo}
          >
            <Icon name="redo" />
          </button>
          <span className="action-divider" />
          <button
            type="button"
            onClick={() => exportAction('png')}
            disabled={exporting || !nodes.length || view !== 'diagram'}
          >
            <Icon name="download" size={16} />
            {exporting ? 'Esporto…' : 'PNG'}
          </button>
          <button
            type="button"
            onClick={() => exportAction('pdf')}
            disabled={exporting || !connections.length}
          >
            PDF
          </button>
        </div>
      </div>
      <div className={`diagram-tools ${view !== 'diagram' ? 'hidden' : ''}`}>
        <button
          type="button"
          disabled={!nodes.length}
          onClick={() => {
            fitRequested.current = true
            props.onArrange(
              Object.fromEntries(
                Object.entries(measurements.rects).map(([id, rect]) => [
                  id,
                  rect.height,
                ]),
              ),
            )
          }}
          title="Disponi da sorgenti a destinazioni, riducendo gli incroci"
        >
          <Icon name="grid" size={16} />
          Ordina per flusso
        </button>
        <label className="check-control">
          <input
            type="checkbox"
            checked={snap}
            onChange={(event) => setSnap(event.target.checked)}
          />
          Griglia
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={connectedOnly}
            onChange={(event) => setConnectedOnly(event.target.checked)}
          />
          Solo porte collegate
        </label>
        <label className="signal-filter">
          <span>Segnali</span>
          <select
            aria-label="Filtra i segnali"
            value={signalFilter}
            onChange={(event) => setSignalFilter(event.target.value)}
          >
            <option value="all">Tutti</option>
            {Object.entries(connectorCategoryLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {focusNode && (
          <>
            <button
              type="button"
              className="icon-button"
              aria-label="Duplica dispositivo selezionato"
              title="Duplica selezionato"
              onClick={props.onDuplicateNode}
            >
              <Icon name="copy" size={16} />
            </button>
            <button
              type="button"
              className="icon-button danger-quiet"
              aria-label="Elimina dispositivo selezionato"
              onClick={() => props.onDeleteNode(focusNode)}
            >
              <Icon name="trash" size={16} />
            </button>
          </>
        )}
        <button
          type="button"
          className="icon-button danger-quiet clear-button"
          disabled={!nodes.length}
          aria-label="Svuota schema"
          title="Svuota schema"
          onClick={props.onClear}
        >
          <Icon name="trash" size={16} />
        </button>
      </div>
      <div className={`diagram-view ${view !== 'diagram' ? 'hidden' : ''}`}>
        <div
          ref={stageRef}
          className={`canvas-stage ${dragging ? 'dragging' : ''} ${dropActive ? 'drop-active' : ''}`}
          aria-label="Area dello schema"
          onClick={(event) => {
            if (
              !(event.target as HTMLElement).closest(
                '.device-node, .connection-hit, .cable-label',
              )
            ) {
              props.onSelectNode(null)
              setSelectedCable(null)
              props.onCancelConnection()
            }
          }}
          onDragOver={(event) => {
            if (
              event.dataTransfer.types.includes(
                'application/x-schematic-device',
              ) ||
              event.dataTransfer.types.includes('text/plain')
            ) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              setDropActive(true)
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setDropActive(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDropActive(false)
            const id =
                event.dataTransfer.getData('application/x-schematic-device') ||
                event.dataTransfer.getData('text/plain'),
              stage = stageRef.current!
            if (!Object.hasOwn(devicesById, id)) return
            const rect = stage.getBoundingClientRect()
            props.onAddDevice(id, {
              x: (event.clientX - rect.left + stage.scrollLeft) / zoom,
              y: (event.clientY - rect.top + stage.scrollTop) / zoom,
            })
          }}
        >
          <div
            className="canvas-zoom-surface"
            style={{ width: extent.width * zoom, height: extent.height * zoom }}
          >
            <div
              ref={contentRef}
              className="canvas-content"
              style={{
                width: extent.width,
                height: extent.height,
                transform: `scale(${zoom})`,
              }}
            >
              <svg
                className="connection-layer"
                width={extent.width}
                height={extent.height}
                viewBox={`0 0 ${extent.width} ${extent.height}`}
                aria-label="Collegamenti dello schema"
              >
                {layouts.map((layout) => {
                  const { connection: c } = layout
                  const dimmed =
                    (signalFilter !== 'all' &&
                      layout.category !== signalFilter) ||
                    Boolean(
                      focusCable
                        ? c.id !== focusCable
                        : focusNode &&
                            c.from.nodeId !== focusNode &&
                            c.to.nodeId !== focusNode,
                    )
                  const active = c.id === focusCable || c.id === selectedCable
                  return (
                    <g
                      key={c.id}
                      className={`cable-group ${dimmed ? 'dimmed' : ''} ${active ? 'selected' : ''}`}
                      onMouseEnter={() => setHoveredCable(c.id)}
                      onMouseLeave={() => setHoveredCable(null)}
                    >
                      <title>{`${layout.label} · ${layout.type}: ${nodeLabel(c.from.nodeId)} / ${portLabel(c.from)} → ${nodeLabel(c.to.nodeId)} / ${portLabel(c.to)}`}</title>
                      <path d={layout.d} className="connection-outline" />
                      <path
                        d={layout.d}
                        className="connection-line"
                        style={{ stroke: layout.color }}
                      />
                      <path
                        d={layout.d}
                        className="connection-hit"
                        role="button"
                        tabIndex={0}
                        aria-label={`Seleziona ${layout.label}: ${nodeLabel(c.from.nodeId)} verso ${nodeLabel(c.to.nodeId)}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          props.onSelectNode(null)
                          setSelectedCable(c.id)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            props.onSelectNode(null)
                            setSelectedCable(c.id)
                          }
                          if (
                            event.key === 'Delete' ||
                            event.key === 'Backspace'
                          ) {
                            event.preventDefault()
                            props.onDeleteConnection(c.id)
                          }
                        }}
                      />
                      <circle
                        cx={layout.from.x}
                        cy={layout.from.y}
                        r={4}
                        fill={layout.color}
                      />
                      <circle
                        cx={layout.to.x}
                        cy={layout.to.y}
                        r={4}
                        fill={layout.color}
                      />
                      {active && (
                        <g
                          className="cable-label"
                          transform={`translate(${layout.from.x + 34}, ${layout.from.y - 18})`}
                        >
                          <rect width={72} height={22} rx={5} />
                          <text x={8} y={15}>
                            {layout.label} · {layout.type.slice(0, 6)}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </svg>
              {nodes.map(
                (node) =>
                  devicesById[node.deviceId] && (
                    <DeviceNode
                      key={node.id}
                      id={node.id}
                      x={node.x}
                      y={node.y}
                      displayName={
                        node.customName || devicesById[node.deviceId].name
                      }
                      collapsed={Boolean(node.collapsed)}
                      device={devicesById[node.deviceId]}
                      activePort={activePort}
                      selected={selectedNode === node.id}
                      dimmed={Boolean(
                        connectedNodeIds && !connectedNodeIds.has(node.id),
                      )}
                      connectedOnly={connectedOnly}
                      usedPorts={usedPorts}
                      onSelect={props.onSelectNode}
                      onPortClick={props.onPortClick}
                      onMove={props.onNodeMove}
                      onMoveEnd={props.onMoveEnd}
                      onDeleteNode={props.onDeleteNode}
                      onRenameNode={props.onRenameNode}
                      onToggleCollapse={props.onToggleNodeCollapse}
                      onDragStart={(id, clientX, clientY) => {
                        const stage = stageRef.current!,
                          rect = stage.getBoundingClientRect()
                        dragRef.current = {
                          id,
                          x:
                            (clientX - rect.left + stage.scrollLeft) / zoom -
                            node.x,
                          y:
                            (clientY - rect.top + stage.scrollTop) / zoom -
                            node.y,
                        }
                        setDragging(true)
                      }}
                    />
                  ),
              )}
            </div>
          </div>
        </div>
        {!nodes.length && (
          <div className="canvas-empty">
            <span className="empty-diagram">
              <Icon name="diagram" size={38} />
            </span>
            <span className="eyebrow">DAI FORMA ALLA TUA REGIA</span>
            <h2>
              Ogni grande show
              <br />
              inizia da uno schema.
            </h2>
            <p>
              Aggiungi i dispositivi dalla libreria,
              <br />
              poi collega le porte per tracciare i segnali.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                fitRequested.current = true
                props.onLoadDemo()
              }}
            >
              Esplora uno schema di esempio
              <Icon name="arrow" size={17} />
            </button>
            <small>Oppure cerca il primo dispositivo nella libreria.</small>
          </div>
        )}
        {activePort && (
          <div className="connection-prompt" role="status">
            <span className="pulse-dot" />
            <span>
              <strong>
                {nodeLabel(activePort.nodeId)} · {portLabel(activePort)}
              </strong>
              Seleziona una porta compatibile per collegare.
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={props.onCancelConnection}
              aria-label="Annulla collegamento"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {inspect && !activePort && (
          <div className="cable-inspector">
            <code>C{String(selectedId).padStart(2, '0')}</code>
            <div>
              <strong>
                {nodeLabel(inspect.from.nodeId)} <span>→</span>{' '}
                {nodeLabel(inspect.to.nodeId)}
              </strong>
              <small>
                {portLabel(inspect.from)} → {portLabel(inspect.to)} ·{' '}
                {connector(inspect.from)}
              </small>
            </div>
            <button
              type="button"
              className="icon-button danger-quiet"
              aria-label="Rimuovi collegamento selezionato"
              onClick={() => {
                props.onDeleteConnection(inspect.id)
                setSelectedCable(null)
              }}
            >
              <Icon name="trash" size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Chiudi dettaglio collegamento"
              onClick={() => {
                setSelectedCable(null)
                setHoveredCable(null)
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        <div className="canvas-bottom-controls">
          <div className="zoom-controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Riduci zoom"
              disabled={zoom <= 0.1}
              onClick={() => setZoom((value) => clampZoom(value - 0.1))}
            >
              <Icon name="minus" size={16} />
            </button>
            <button
              type="button"
              className="zoom-value"
              onClick={() => setZoom(1)}
              title="Ripristina zoom 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Aumenta zoom"
              disabled={zoom >= 2}
              onClick={() => setZoom((value) => clampZoom(value + 0.1))}
            >
              <Icon name="plus" size={16} />
            </button>
            <span className="action-divider" />
            <button
              type="button"
              className="icon-button"
              aria-label="Adatta lo schema allo schermo"
              title="Adatta allo schermo"
              onClick={fit}
            >
              <Icon name="fit" size={18} />
            </button>
          </div>
          <span className="canvas-tip">
            {focusNode
              ? 'Collegamenti del dispositivo evidenziati · Esc per deselezionare'
              : 'Seleziona un dispositivo o un cavo per seguirne il percorso'}
          </span>
        </div>
      </div>
      {view !== 'diagram' && (
        <ProjectReports
          view={view}
          nodes={nodes}
          connections={connections}
          devicesById={devicesById}
          getPortLabel={portLabel}
          getConnector={connector}
          onDeleteConnection={props.onDeleteConnection}
        />
      )}
      <footer className="workspace-footer">
        <span className="footer-status">
          <span className="save-dot" />
          {nodes.length
            ? 'Schema di regia'
            : 'Pronto per il tuo prossimo evento'}
        </span>
        <div className="legend-items">
          {legend.length ? (
            legend.map((type) => (
              <span key={type}>
                <i
                  style={{
                    backgroundColor:
                      connectorTypeColors[type] || fallbackConnectionColor,
                  }}
                />
                {type}
              </span>
            ))
          ) : (
            <span>
              VIDEO <i className="legend-video" /> AUDIO{' '}
              <i className="legend-audio" /> RETE{' '}
              <i className="legend-network" />
            </span>
          )}
        </div>
        <span className="footer-count">
          {nodes.length} dispositivi · {connections.length} cavi
        </span>
      </footer>
    </main>
  )
}
