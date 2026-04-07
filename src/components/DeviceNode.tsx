import { useState } from 'react'
import type { DeviceDefinition, PortDefinition, PortRef } from '../types/schematic'

interface DeviceNodeProps {
  id: string
  x: number
  y: number
  displayName: string
  device: DeviceDefinition
  activePort: PortRef | null
  onPortClick: (port: PortRef) => void
  onDragStart: (nodeId: string, clientX: number, clientY: number) => void
  onDeleteNode: (nodeId: string) => void
  onRenameNode: (nodeId: string, name: string) => void
}

function PortButton({
  nodeId,
  port,
  activePort,
  onPortClick,
}: {
  nodeId: string
  port: PortDefinition
  activePort: PortRef | null
  onPortClick: (port: PortRef) => void
}) {
  const isActive =
    activePort?.nodeId === nodeId &&
    activePort.portId === port.id &&
    activePort.kind === port.kind

  return (
    <button
      type="button"
      className={`port-button ${port.kind} ${isActive ? 'active' : ''}`}
      onClick={() =>
        onPortClick({
          nodeId,
          portId: port.id,
          kind: port.kind,
        })
      }
      title={`${port.label} (${port.kind})`}
    >
      {port.label} [{port.connectorType}]
    </button>
  )
}

export function DeviceNode({
  id,
  x,
  y,
  displayName,
  device,
  activePort,
  onPortClick,
  onDragStart,
  onDeleteNode,
  onRenameNode,
}: DeviceNodeProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nextName, setNextName] = useState(displayName)

  return (
    <article
      className="device-node"
      style={{ left: x, top: y }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('.port-button')) {
          return
        }

        onDragStart(id, event.clientX, event.clientY)
      }}
    >
      <header>
        {isEditingName ? (
          <div className="node-name-editor">
            <input
              value={nextName}
              onChange={(event) => setNextName(event.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                onRenameNode(id, nextName)
                setIsEditingName(false)
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <span>{displayName}</span>
        )}
        <button
          type="button"
          className="rename-node-button"
          onClick={() => {
            setNextName(displayName)
            setIsEditingName((current) => !current)
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className="delete-node-button"
          onClick={() => onDeleteNode(id)}
        >
          Remove
        </button>
      </header>
      <div className="ports-row">
        <div className="ports-col">
          <strong>Inputs</strong>
          {device.inputs.length === 0 ? (
            <small>None</small>
          ) : (
            device.inputs.map((port) => (
              <PortButton
                key={port.id}
                nodeId={id}
                port={port}
                activePort={activePort}
                onPortClick={onPortClick}
              />
            ))
          )}
        </div>
        <div className="ports-col">
          <strong>Outputs</strong>
          {device.outputs.length === 0 ? (
            <small>None</small>
          ) : (
            device.outputs.map((port) => (
              <PortButton
                key={port.id}
                nodeId={id}
                port={port}
                activePort={activePort}
                onPortClick={onPortClick}
              />
            ))
          )}
        </div>
      </div>
    </article>
  )
}
