import { useEffect, useRef, useState } from 'react'
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
  onDeleteConnection: (connectionId: string) => void
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
  onDeleteConnection,
}: SchematicCanvasProps) {
  const [dragState, setDragState] = useState<{
    nodeId: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const getPortPosition = (port: PortRef) => {
    const node = nodes.find((entry) => entry.id === port.nodeId)
    if (!node) {
      return null
    }

    const device = devicesById[node.deviceId]
    if (!device) {
      return null
    }

    const portList = port.kind === 'input' ? device.inputs : device.outputs
    const portIndex = portList.findIndex((entry) => entry.id === port.portId)
    if (portIndex < 0) {
      return null
    }

    const headerHeight = 36
    const rowPaddingTop = 12
    const titleHeight = 16
    const portBlockHeight = 27
    const y = node.y + headerHeight + rowPaddingTop + titleHeight + portIndex * portBlockHeight + 10
    const x = port.kind === 'output' ? node.x + 214 : node.x + 6

    return { x, y }
  }

  const getPortDefinition = (port: PortRef) => {
    const node = nodes.find((entry) => entry.id === port.nodeId)
    if (!node) {
      return null
    }

    const device = devicesById[node.deviceId]
    if (!device) {
      return null
    }

    const portList = port.kind === 'input' ? device.inputs : device.outputs
    return portList.find((entry) => entry.id === port.portId) ?? null
  }

  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find((entry) => entry.id === nodeId)
    if (!node) {
      return nodeId
    }

    const device = devicesById[node.deviceId]
    if (!device) {
      return node.customName?.trim() || nodeId
    }

    return node.customName?.trim() || device.name
  }

  const getConnectionColor = (connection: Connection) => {
    const fromPort = getPortDefinition(connection.from)
    if (!fromPort) {
      return fallbackConnectionColor
    }

    return connectorTypeColors[fromPort.connectorType] ?? fallbackConnectionColor
  }

  const usedConnectorLegend = Array.from(
    new Map(
      connections
        .map((connection) => {
          const fromPort = getPortDefinition(connection.from)
          if (!fromPort) {
            return null
          }
          return [fromPort.connectorType, getConnectionColor(connection)] as const
        })
        .filter((entry): entry is readonly [string, string] => entry !== null),
    ).entries(),
  )

  useEffect(() => {
    if (!dragState) {
      return
    }

    const onPointerMove = (event: PointerEvent) => {
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (!canvasRect) {
        return
      }

      const nextX = event.clientX - canvasRect.left - dragState.offsetX
      const nextY = event.clientY - canvasRect.top - dragState.offsetY
      onNodeMove(dragState.nodeId, Math.max(8, nextX), Math.max(8, nextY))
    }

    const onPointerUp = () => setDragState(null)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, onNodeMove])

  return (
    <main className="canvas-wrapper">
      <div className="canvas-toolbar">
        <span>Nodes: {nodes.length}</span>
        <span>Connections: {connections.length}</span>
        {activePort ? (
          <span className="active-connection">Selected: {activePort.portId}</span>
        ) : (
          <span>Select an input or output, then the matching opposite port</span>
        )}
      </div>

      <div ref={canvasRef} className="canvas-stage">
        <svg className="connection-layer" aria-hidden="true">
          {connections.map((connection) => {
            const from = getPortPosition(connection.from)
            const to = getPortPosition(connection.to)
            if (!from || !to) {
              return null
            }

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
          if (!device) {
            return null
          }

          return (
            <DeviceNode
              key={node.id}
              id={node.id}
              x={node.x}
              y={node.y}
              displayName={node.customName?.trim() || device.name}
              device={device}
              activePort={activePort}
              onPortClick={onPortClick}
              onDeleteNode={onDeleteNode}
              onRenameNode={onRenameNode}
              onDragStart={(nodeId, clientX, clientY) => {
                const rect = canvasRef.current?.getBoundingClientRect()
                if (!rect) {
                  return
                }

                setDragState({
                  nodeId,
                  offsetX: clientX - rect.left - node.x,
                  offsetY: clientY - rect.top - node.y,
                })
              }}
            />
          )
        })}

        <section className="connection-legend">
          <h3>Legend</h3>
          {usedConnectorLegend.length === 0 ? (
            <p>No active connectors.</p>
          ) : (
            <ul>
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
        </section>

        <section className="connections-list">
          <h3>Connections</h3>
          {connections.length === 0 ? (
            <p>No routes yet.</p>
          ) : (
            <ul>
              {connections.map((connection) => (
                <li key={connection.id}>
                  {getNodeLabel(connection.from.nodeId)}:{connection.from.portId}{' '}
                  {'->'} {getNodeLabel(connection.to.nodeId)}:{connection.to.portId}
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
        </section>
      </div>
    </main>
  )
}
