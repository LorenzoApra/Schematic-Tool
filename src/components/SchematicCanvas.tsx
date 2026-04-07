import { useEffect, useRef, useState } from 'react'
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
}

export function SchematicCanvas({
  nodes,
  devicesById,
  connections,
  activePort,
  onPortClick,
  onNodeMove,
}: SchematicCanvasProps) {
  const [dragState, setDragState] = useState<{
    nodeId: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

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
          <span>Select an output then an input to connect</span>
        )}
      </div>

      <div ref={canvasRef} className="canvas-stage">
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
              device={device}
              activePort={activePort}
              onPortClick={onPortClick}
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

        <section className="connections-list">
          <h3>Connections</h3>
          {connections.length === 0 ? (
            <p>No routes yet.</p>
          ) : (
            <ul>
              {connections.map((connection) => (
                <li key={connection.id}>
                  {connection.from.nodeId}:{connection.from.portId} {'->'}{' '}
                  {connection.to.nodeId}:{connection.to.portId}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
