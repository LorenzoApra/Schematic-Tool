import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import {
  connectorTypeColors,
  fallbackConnectionColor,
} from '../data/connectorColors'
import type {
  Connection,
  DeviceDefinition,
  NodeInstance,
  PortRef,
} from '../types/schematic'
import { DeviceNode } from './DeviceNode'

interface SchematicCanvasProps {
  nodes: NodeInstance[]
  devicesById: Record<string, DeviceDefinition>
  connections: Connection[]
  activePort: PortRef | null
  onPortClick: (port: PortRef) => void
  onNodeMove: (nodeId: string, x: number, y: number) => void
  onDeleteNode: (nodeId: string) => void
  onRenameNode: (nodeId: string, name: string) => void
  onToggleNodeCollapse: (nodeId: string) => void
  onDeleteConnection: (connectionId: string) => void
  onExpandAllNodesForExport: () => Record<string, boolean>
  onRestoreCollapsedNodes: (collapsedByNodeId: Record<string, boolean>) => void
}

export function SchematicCanvas({
  nodes,
  devicesById,
  connections,
  activePort,
  onPortClick,
  onNodeMove,
  onDeleteNode,
  onRenameNode,
  onToggleNodeCollapse,
  onDeleteConnection,
  onExpandAllNodesForExport,
  onRestoreCollapsedNodes,
}: SchematicCanvasProps) {
  const [dragState, setDragState] = useState<{
    nodeId: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [isExportingGraphic, setIsExportingGraphic] = useState(false)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [isConnectionsCollapsed, setIsConnectionsCollapsed] = useState(false)
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const canvasContentRef = useRef<HTMLDivElement | null>(null)
  const [contentSize, setContentSize] = useState({ width: 1200, height: 800 })
  const clampZoom = (value: number) => Math.min(2, Math.max(0.4, value))

  const getPortPosition = (port: PortRef) => {
    const stage = canvasRef.current
    if (!stage) return null

    const selector = `.port-button[data-node-id="${port.nodeId}"][data-port-id="${port.portId}"][data-port-kind="${port.kind}"]`
    const button = stage.querySelector(selector) as HTMLElement | null
    if (!button) return null

    const stageRect = stage.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()

    return {
      x:
        (buttonRect.left -
          stageRect.left +
          stage.scrollLeft +
          buttonRect.width / 2) /
        zoom,
      y:
        (buttonRect.top -
          stageRect.top +
          stage.scrollTop +
          buttonRect.height / 2) /
        zoom,
    }
  }

  const getPortDefinition = (port: PortRef) => {
    const node = nodes.find((entry) => entry.id === port.nodeId)
    if (!node) return null
    const device = devicesById[node.deviceId]
    if (!device) return null

    const portList =
      port.kind === 'input'
        ? device.inputs
        : port.kind === 'output'
          ? device.outputs
          : [...device.inputs, ...device.outputs]

    return portList.find((entry) => entry.id === port.portId) ?? null
  }

  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find((entry) => entry.id === nodeId)
    if (!node) return nodeId
    const device = devicesById[node.deviceId]
    return node.customName?.trim() || device?.name || nodeId
  }

  const getConnectionColor = (connection: Connection) => {
    const fromPort = getPortDefinition(connection.from)
    if (!fromPort) return fallbackConnectionColor
    return connectorTypeColors[fromPort.connectorType] ?? fallbackConnectionColor
  }

  const usedConnectorLegend = Array.from(
    new Map(
      connections
        .map((connection) => {
          const fromPort = getPortDefinition(connection.from)
          if (!fromPort) return null
          return [fromPort.connectorType, getConnectionColor(connection)] as const
        })
        .filter((entry): entry is readonly [string, string] => entry !== null),
    ).entries(),
  )

  const estimatedWidth = Math.max(
    1200,
    ...nodes.map((node) => node.x + 360),
  )
  const estimatedHeight = Math.max(
    800,
    ...nodes.map((node) => node.y + 260),
  )

  const contentWidth = Math.max(estimatedWidth, contentSize.width)
  const contentHeight = Math.max(estimatedHeight, contentSize.height)

  useLayoutEffect(() => {
    const stage = canvasRef.current
    if (!stage) return

    const updateSize = () => {
      setContentSize({
        width: Math.max(1200, stage.scrollWidth),
        height: Math.max(800, stage.scrollHeight),
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(stage)

    const nodesInStage = stage.querySelectorAll('.device-node')
    nodesInStage.forEach((nodeEl) => observer.observe(nodeEl))

    window.addEventListener('resize', updateSize)

    return () => {
      window.removeEventListener('resize', updateSize)
      observer.disconnect()
    }
  }, [nodes])

  useEffect(() => {
    if (!dragState) return

    const onPointerMove = (event: PointerEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      const canvas = canvasRef.current
      if (!canvasRect || !canvas) return

      const nextX =
        (event.clientX - canvasRect.left + canvas.scrollLeft) / zoom -
        dragState.offsetX
      const nextY =
        (event.clientY - canvasRect.top + canvas.scrollTop) / zoom -
        dragState.offsetY
      onNodeMove(dragState.nodeId, Math.max(8, nextX), Math.max(8, nextY))
    }

    const onPointerUp = () => setDragState(null)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, onNodeMove, zoom])

  const handleExportConnectionsPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 36
    let y = margin

    doc.setFontSize(16)
    doc.text('Connections Report', margin, y)
    y += 18

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y)
    y += 16
    doc.text(`Total connections: ${connections.length}`, margin, y)
    y += 18

    if (connections.length === 0) {
      doc.text('No connections configured.', margin, y)
      doc.save('connections-report.pdf')
      return
    }

    connections.forEach((connection, index) => {
      const sourcePort = getPortDefinition(connection.from)
      const line =
        `${index + 1}. ${getNodeLabel(connection.from.nodeId)}:${connection.from.portId} -> ` +
        `${getNodeLabel(connection.to.nodeId)}:${connection.to.portId}` +
        ` [${sourcePort?.connectorType ?? 'Unknown'}]`

      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2)
      if (y + wrapped.length * 12 > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(wrapped, margin, y)
      y += wrapped.length * 12 + 4
    })

    doc.save('connections-report.pdf')
  }

  const handleExportGraphic = async () => {
    if (!canvasContentRef.current || isExportingGraphic) return
    setIsExportingGraphic(true)
    const previousCollapsedState = onExpandAllNodesForExport()
    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })

      const usedPortKeys = new Set(
        connections.flatMap((connection) => [
          `${connection.from.nodeId}:${connection.from.kind}:${connection.from.portId}`,
          `${connection.to.nodeId}:${connection.to.kind}:${connection.to.portId}`,
        ]),
      )

      const { default: html2canvas } = await import('html2canvas')
      const snapshot = await html2canvas(canvasContentRef.current, {
        backgroundColor: '#11141b',
        scale: 2,
        logging: false,
        useCORS: true,
        onclone: (documentClone) => {
          const content = documentClone.querySelector('.canvas-content') as HTMLElement | null
          if (content) {
            content.style.transform = 'none'
            content.style.transformOrigin = 'top left'
          }

          const allPortButtons = Array.from(
            documentClone.querySelectorAll('.port-button'),
          ) as HTMLElement[]

          allPortButtons.forEach((button) => {
            const nodeId = button.dataset.nodeId
            const portKind = button.dataset.portKind
            const portId = button.dataset.portId
            const key = `${nodeId}:${portKind}:${portId}`
            if (!usedPortKeys.has(key)) {
              button.style.display = 'none'
            }
          })

          const allPortColumns = Array.from(
            documentClone.querySelectorAll('.ports-col'),
          ) as HTMLElement[]

          allPortColumns.forEach((column) => {
            const visibleButtons = column.querySelectorAll(
              '.port-button:not([style*="display: none"])',
            )
            if (visibleButtons.length === 0) {
              column.style.display = 'none'
            }
          })
        },
      })
      const link = document.createElement('a')
      link.href = snapshot.toDataURL('image/png')
      link.download = `schematic-graphic-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      link.click()
    } finally {
      onRestoreCollapsedNodes(previousCollapsedState)
      setIsExportingGraphic(false)
    }
  }

  return (
    <main className="canvas-wrapper">
      <div className="canvas-toolbar">
        <span>Nodes: {nodes.length}</span>
        <span>Connections: {connections.length}</span>
        <div className="zoom-controls">
          <button type="button" onClick={() => setZoom((current) => clampZoom(current - 0.1))}>
            -
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((current) => clampZoom(current + 0.1))}>
            +
          </button>
          <button type="button" onClick={() => setZoom(1)}>
            Reset
          </button>
        </div>
        {activePort ? (
          <span className="active-connection">Selected: {activePort.portId}</span>
        ) : (
          <span>Select ports to connect (supports bidirectional)</span>
        )}
      </div>

      <div ref={canvasRef} className="canvas-stage">
        <div
          className="canvas-zoom-surface"
          style={{ width: contentWidth * zoom, height: contentHeight * zoom }}
        >
          <div
            className="canvas-content"
            ref={canvasContentRef}
            style={{
              width: contentWidth,
              height: contentHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            <svg
              className="connection-layer"
              aria-hidden="true"
              width={contentWidth}
              height={contentHeight}
              viewBox={`0 0 ${contentWidth} ${contentHeight}`}
            >
              {connections.map((connection) => {
                const from = getPortPosition(connection.from)
                const to = getPortPosition(connection.to)
                if (!from || !to) return null

                const controlOffset = Math.max(36, Math.abs(to.x - from.x) * 0.35)
                const path = `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`
                const color = getConnectionColor(connection)

                return (
                  <path
                    key={connection.id}
                    d={path}
                    className="connection-line"
                    style={{ stroke: color }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      onDeleteConnection(connection.id)
                    }}
                  />
                )
              })}
            </svg>

            {nodes.map((node) => {
              const device = devicesById[node.deviceId]
              if (!device) return null

              return (
                <DeviceNode
                  key={node.id}
                  id={node.id}
                  x={node.x}
                  y={node.y}
                  displayName={node.customName?.trim() || device.name}
                  collapsed={Boolean(node.collapsed)}
                  device={device}
                  activePort={activePort}
                  onPortClick={onPortClick}
                  onDeleteNode={onDeleteNode}
                  onRenameNode={onRenameNode}
                  onToggleCollapse={onToggleNodeCollapse}
                  onDragStart={(nodeId, clientX, clientY) => {
                    const rect = canvasRef.current?.getBoundingClientRect()
                    const canvas = canvasRef.current
                    if (!rect || !canvas) return

                    setDragState({
                      nodeId,
                      offsetX:
                        (clientX - rect.left + canvas.scrollLeft) / zoom - node.x,
                      offsetY:
                        (clientY - rect.top + canvas.scrollTop) / zoom - node.y,
                    })
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
      <section className="connection-panel">
        <div className="connection-panel-header">
          <h3>Connections & Legend</h3>
          <div className="connection-panel-actions">
            <button type="button" onClick={handleExportGraphic} disabled={isExportingGraphic}>
              {isExportingGraphic ? 'Exporting...' : 'Export Graphic'}
            </button>
            <button type="button" onClick={handleExportConnectionsPdf}>
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => setIsPanelCollapsed((current) => !current)}
            >
              {isPanelCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>
        </div>

        {isPanelCollapsed ? null : (
          <>
            <div className="panel-subsection">
              <div className="panel-subsection-header">
                <strong>Connections</strong>
                <button
                  type="button"
                  onClick={() =>
                    setIsConnectionsCollapsed((current) => !current)
                  }
                >
                  {isConnectionsCollapsed ? 'Show' : 'Hide'}
                </button>
              </div>
              {isConnectionsCollapsed ? null : connections.length === 0 ? (
                <p>No routes yet.</p>
              ) : (
                <ul className="connections-list-items">
                  {connections.map((connection) => (
                    <li key={connection.id}>
                      {getNodeLabel(connection.from.nodeId)}:{connection.from.portId} {'->'}{' '}
                      {getNodeLabel(connection.to.nodeId)}:{connection.to.portId}
                      <button
                        type="button"
                        className="connection-remove-button"
                        onClick={() => onDeleteConnection(connection.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <hr />

            <div className="panel-subsection">
              <div className="panel-subsection-header">
                <strong>Legend</strong>
                <button
                  type="button"
                  onClick={() => setIsLegendCollapsed((current) => !current)}
                >
                  {isLegendCollapsed ? 'Show' : 'Hide'}
                </button>
              </div>
              {isLegendCollapsed ? null : usedConnectorLegend.length === 0 ? (
                <p>No active connectors.</p>
              ) : (
                <ul className="legend-items">
                  {usedConnectorLegend.map(([connectorType, color]) => (
                    <li key={connectorType}>
                      <span
                        className="legend-swatch"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      {connectorType}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}
