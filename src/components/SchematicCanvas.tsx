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

interface CanvasPoint {
  x: number
  y: number
}

interface MatrixPort {
  key: string
  nodeLabel: string
  portLabel: string
  connectorType: string
}

function getConnectionPath(from: CanvasPoint, to: CanvasPoint) {
  const horizontalDistance = Math.abs(to.x - from.x)
  const direction = to.x === from.x ? 0 : to.x > from.x ? 1 : -1
  const controlOffset =
    horizontalDistance === 0
      ? 0
      : Math.min(Math.max(18, horizontalDistance * 0.35), horizontalDistance / 2)

  const firstControl = {
    x: from.x + controlOffset * direction,
    y: from.y,
  }
  const secondControl = {
    x: to.x - controlOffset * direction,
    y: to.y,
  }

  return {
    d: `M ${from.x} ${from.y} C ${firstControl.x} ${firstControl.y}, ${secondControl.x} ${secondControl.y}, ${to.x} ${to.y}`,
    bounds: {
      maxX: Math.max(from.x, firstControl.x, secondControl.x, to.x),
      maxY: Math.max(from.y, firstControl.y, secondControl.y, to.y),
    },
  }
}

function drawCheckMark(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
) {
  doc.setDrawColor(16, 80, 34)
  doc.setLineWidth(1.4)
  doc.line(x + size * 0.24, y + size * 0.54, x + size * 0.43, y + size * 0.72)
  doc.line(x + size * 0.43, y + size * 0.72, x + size * 0.78, y + size * 0.28)
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

  const connectionLayouts = connections
    .map((connection) => {
      const from = getPortPosition(connection.from)
      const to = getPortPosition(connection.to)
      if (!from || !to) return null

      return {
        connection,
        from,
        to,
        path: getConnectionPath(from, to),
        color: getConnectionColor(connection),
      }
    })
    .filter((layout): layout is NonNullable<typeof layout> => layout !== null)

  const diagramWidth = Math.max(
    1200,
    ...nodes.map((node) => node.x + 360),
    ...connectionLayouts.map(({ path }) => path.bounds.maxX + 80),
  )
  const diagramHeight = Math.max(
    800,
    ...nodes.map((node) => node.y + 260),
    ...connectionLayouts.map(({ path }) => path.bounds.maxY + 80),
  )
  const exportLegendHeight =
    isExportingGraphic && usedConnectorLegend.length > 0
      ? 44 + usedConnectorLegend.length * 24
      : 0
  const exportLegendTop = diagramHeight + 24
  const estimatedWidth = Math.max(
    diagramWidth,
    isExportingGraphic && usedConnectorLegend.length > 0 ? 380 : 0,
  )
  const estimatedHeight =
    exportLegendHeight > 0
      ? exportLegendTop + exportLegendHeight + 24
      : diagramHeight

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
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 24
    const titleHeight = 44
    const rowHeaderWidth = 178
    const headerHeight = 132
    const cellSize = 18
    const rowHeight = 18
    const tableTop = margin + titleHeight + headerHeight
    const tableLeft = margin + rowHeaderWidth
    const maxColumnsPerPage = Math.max(
      1,
      Math.floor((pageWidth - margin - tableLeft) / cellSize),
    )
    const maxRowsPerPage = Math.max(
      1,
      Math.floor((pageHeight - tableTop - margin) / rowHeight),
    )

    const getPortKey = (port: PortRef) =>
      `${port.nodeId}:${port.kind}:${port.portId}`

    if (connections.length === 0) {
      doc.setFontSize(16)
      doc.text('Connections Matrix', margin, margin)
      doc.setFontSize(10)
      doc.text('No connections configured.', margin, margin + 22)
      doc.save('connections-report.pdf')
      return
    }

    const sourcesByKey = new Map<string, MatrixPort>()
    const receiversByKey = new Map<string, MatrixPort>()
    const connectedCells = new Set<string>()

    const addMatrixPort = (
      collection: Map<string, MatrixPort>,
      port: PortRef,
    ) => {
      const key = getPortKey(port)
      if (collection.has(key)) return
      const definition = getPortDefinition(port)
      collection.set(key, {
        key,
        nodeLabel: getNodeLabel(port.nodeId),
        portLabel: definition?.label ?? port.portId,
        connectorType: definition?.connectorType ?? 'Unknown',
      })
    }

    connections.forEach((connection) => {
      addMatrixPort(sourcesByKey, connection.from)
      addMatrixPort(receiversByKey, connection.to)
      connectedCells.add(`${getPortKey(connection.to)}>${getPortKey(connection.from)}`)
    })

    const sources = Array.from(sourcesByKey.values())
    const receivers = Array.from(receiversByKey.values())

    if (sources.length === 0 || receivers.length === 0) {
      doc.setFontSize(16)
      doc.text('Connections Matrix', margin, margin)
      doc.setFontSize(10)
      doc.text('No source/receiver ports available on the canvas.', margin, margin + 22)
      doc.save('connections-report.pdf')
      return
    }

    let pageNumber = 0

    for (let rowStart = 0; rowStart < receivers.length; rowStart += maxRowsPerPage) {
      for (
        let columnStart = 0;
        columnStart < sources.length;
        columnStart += maxColumnsPerPage
      ) {
        if (pageNumber > 0) doc.addPage()
        pageNumber += 1

        const pageSources = sources.slice(
          columnStart,
          columnStart + maxColumnsPerPage,
        )
        const pageReceivers = receivers.slice(rowStart, rowStart + maxRowsPerPage)
        const tableWidth = rowHeaderWidth + pageSources.length * cellSize
        const tableHeight = headerHeight + pageReceivers.length * rowHeight

        doc.setFillColor(17, 20, 27)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')

        doc.setTextColor(232, 235, 240)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(15)
        doc.text('Connections Matrix', margin, margin + 4)

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(179, 194, 218)
        doc.text(
          `Generated: ${new Date().toLocaleString()}  |  Connections: ${connections.length}  |  Page: ${pageNumber}`,
          margin,
          margin + 21,
        )
        doc.text(
          `Sources ${columnStart + 1}-${columnStart + pageSources.length} of ${sources.length} / Receivers ${rowStart + 1}-${rowStart + pageReceivers.length} of ${receivers.length}`,
          margin,
          margin + 34,
        )

        doc.setFillColor(27, 39, 56)
        doc.setDrawColor(58, 78, 106)
        doc.rect(margin, margin + titleHeight, tableWidth, tableHeight, 'FD')

        doc.setFillColor(25, 34, 51)
        doc.rect(margin, margin + titleHeight, rowHeaderWidth, headerHeight, 'F')
        doc.setTextColor(159, 180, 214)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text('RECEIVERS', margin + 8, tableTop - 10)
        doc.text('SOURCES', tableLeft + 6, margin + titleHeight + 12)

        pageSources.forEach((source, sourceIndex) => {
          const x = tableLeft + sourceIndex * cellSize
          const isAlternating = sourceIndex % 2 === 0
          doc.setFillColor(isAlternating ? 36 : 42, isAlternating ? 47 : 54, isAlternating ? 62 : 70)
          doc.rect(x, margin + titleHeight, cellSize, headerHeight, 'F')
          doc.setDrawColor(42, 51, 66)
          doc.rect(x, margin + titleHeight, cellSize, headerHeight, 'S')

          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7)
          doc.setTextColor(232, 235, 240)
          const sourceLabel = `${source.nodeLabel} / ${source.portLabel}`
          doc.text(sourceLabel.slice(0, 56), x + 4, tableTop - 8, {
            angle: 90,
            baseline: 'middle',
          })
        })

        pageReceivers.forEach((receiver, receiverIndex) => {
          const y = tableTop + receiverIndex * rowHeight
          const isAlternating = receiverIndex % 2 === 0
          doc.setFillColor(isAlternating ? 29 : 34, isAlternating ? 38 : 44, isAlternating ? 51 : 58)
          doc.rect(margin, y, rowHeaderWidth, rowHeight, 'F')
          doc.setDrawColor(42, 51, 66)
          doc.rect(margin, y, rowHeaderWidth, rowHeight, 'S')

          doc.setTextColor(232, 235, 240)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(7.5)
          doc.text(receiver.nodeLabel.slice(0, 28), margin + 6, y + 7)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(179, 194, 218)
          doc.text(
            `${receiver.portLabel} [${receiver.connectorType}]`.slice(0, 34),
            margin + 6,
            y + 15,
          )

          pageSources.forEach((source, sourceIndex) => {
            const x = tableLeft + sourceIndex * cellSize
            doc.setFillColor(isAlternating ? 24 : 28, isAlternating ? 31 : 36, isAlternating ? 40 : 47)
            doc.rect(x, y, cellSize, rowHeight, 'F')
            doc.setDrawColor(42, 51, 66)
            doc.rect(x, y, cellSize, rowHeight, 'S')

            if (connectedCells.has(`${receiver.key}>${source.key}`)) {
              doc.setFillColor(61, 220, 65)
              doc.rect(x + 2, y + 2, cellSize - 4, rowHeight - 4, 'F')
              drawCheckMark(doc, x + 2, y + 2, cellSize - 4)
            }
          })
        })
      }
    }

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
              button.dataset.exportHidden = 'true'
              button.style.visibility = 'hidden'
              button.style.opacity = '0'
              button.style.pointerEvents = 'none'
            }
          })

          const allPortColumns = Array.from(
            documentClone.querySelectorAll('.ports-col'),
          ) as HTMLElement[]

          allPortColumns.forEach((column) => {
            const visibleButtons = column.querySelectorAll(
              '.port-button:not([data-export-hidden="true"])',
            )
            if (visibleButtons.length === 0) {
              column.style.visibility = 'hidden'
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
              {connectionLayouts.map(({ connection, from, to, path, color }) => {
                return (
                  <g key={connection.id}>
                    <path
                      d={path.d}
                      className="connection-line"
                      style={{ stroke: color }}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        onDeleteConnection(connection.id)
                      }}
                    />
                    <circle
                      className="connection-endpoint"
                      cx={from.x}
                      cy={from.y}
                      r="4.5"
                      style={{ fill: color }}
                    />
                    <circle
                      className="connection-endpoint"
                      cx={to.x}
                      cy={to.y}
                      r="4.5"
                      style={{ fill: color }}
                    />
                  </g>
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

            {isExportingGraphic && usedConnectorLegend.length > 0 ? (
              <aside
                className="export-color-legend"
                style={{ left: 24, top: exportLegendTop }}
              >
                <strong>Color legend</strong>
                <ul>
                  {usedConnectorLegend.map(([connectorType, color]) => (
                    <li key={connectorType}>
                      <span
                        className="export-color-swatch"
                        style={{ backgroundColor: color }}
                      />
                      <span>{connectorType}</span>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
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
