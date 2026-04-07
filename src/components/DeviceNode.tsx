import { useState } from 'react'
import type { DeviceDefinition, PortDefinition, PortRef } from '../types/schematic'

interface DeviceNodeProps {
  id: string
  x: number
  y: number
  displayName: string
  collapsed: boolean
  device: DeviceDefinition
  activePort: PortRef | null
  onPortClick: (port: PortRef) => void
  onDragStart: (nodeId: string, clientX: number, clientY: number) => void
  onDeleteNode: (nodeId: string) => void
  onRenameNode: (nodeId: string, name: string) => void
  onToggleCollapse: (nodeId: string) => void
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
      data-node-id={nodeId}
      data-port-id={port.id}
      data-port-kind={port.kind}
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
  collapsed,
  device,
  activePort,
  onPortClick,
  onDragStart,
  onDeleteNode,
  onRenameNode,
  onToggleCollapse,
}: DeviceNodeProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [nextName, setNextName] = useState(displayName)

  const inputPorts = device.inputs.filter((port) => port.kind === 'input')
  const outputPorts = device.outputs.filter((port) => port.kind === 'output')
  const biPorts = [...device.inputs, ...device.outputs].filter(
    (port) => port.kind === 'bidirectional',
  )

  const visibleColumns = [
    { key: 'input', title: 'Inputs', ports: inputPorts },
    { key: 'output', title: 'Outputs', ports: outputPorts },
    { key: 'bidirectional', title: 'Bidirectional', ports: biPorts },
  ].filter((column) => column.ports.length > 0)

  return (
    <article
      className="device-node"
      style={{ left: x, top: y }}
      onPointerDown={(event) => {
        if (
          (event.target as HTMLElement).closest(
            '.port-button, .node-action-button, .node-name-editor',
          )
        ) {
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
              className="node-action-button"
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
          className="rename-node-button node-action-button"
          onClick={() => {
            setNextName(displayName)
            setIsEditingName((current) => !current)
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className="collapse-node-button node-action-button"
          onClick={() => onToggleCollapse(id)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
        <button
          type="button"
          className="delete-node-button node-action-button"
          onClick={() => onDeleteNode(id)}
        >
          Remove
        </button>
      </header>
      {collapsed ? (
        <div className="collapsed-node-meta">
          In {device.inputs.filter((p) => p.kind === 'input').length} / Out{' '}
          {device.outputs.filter((p) => p.kind === 'output').length} / Bi{' '}
          {biPorts.length}
        </div>
      ) : (
        <div className="ports-row">
          {visibleColumns.length === 0 ? (
            <div className="ports-col">
              <small>No ports configured</small>
            </div>
          ) : (
            visibleColumns.map((column) => (
              <div className="ports-col" key={column.key}>
                <strong>{column.title}</strong>
                {column.ports.map((port) => (
                <PortButton
                  key={port.id}
                  nodeId={id}
                  port={port}
                  activePort={activePort}
                  onPortClick={onPortClick}
                />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </article>
  )
}
