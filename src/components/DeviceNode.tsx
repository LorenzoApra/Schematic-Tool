import type { DeviceDefinition, PortDefinition, PortRef } from '../types/schematic'

interface DeviceNodeProps {
  id: string
  x: number
  y: number
<<<<<<< Updated upstream
=======
  displayName: string
  collapsed: boolean
>>>>>>> Stashed changes
  device: DeviceDefinition
  activePort: PortRef | null
  onPortClick: (port: PortRef) => void
  onDragStart: (nodeId: string, clientX: number, clientY: number) => void
<<<<<<< Updated upstream
=======
  onDeleteNode: (nodeId: string) => void
  onRenameNode: (nodeId: string, name: string) => void
  onToggleCollapse: (nodeId: string) => void
>>>>>>> Stashed changes
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
      {port.label}
    </button>
  )
}

export function DeviceNode({
  id,
  x,
  y,
<<<<<<< Updated upstream
=======
  displayName,
  collapsed,
>>>>>>> Stashed changes
  device,
  activePort,
  onPortClick,
  onDragStart,
<<<<<<< Updated upstream
=======
  onDeleteNode,
  onRenameNode,
  onToggleCollapse,
>>>>>>> Stashed changes
}: DeviceNodeProps) {
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
<<<<<<< Updated upstream
      <header>{device.name}</header>
      <div className="ports-row">
=======
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
          In {device.inputs.length} / Out {device.outputs.length} / Bi{' '}
          {device.inputs.filter((p) => p.kind === 'bidirectional').length +
            device.outputs.filter((p) => p.kind === 'bidirectional').length}
        </div>
      ) : (
        <div className="ports-row">
>>>>>>> Stashed changes
        <div className="ports-col">
          <strong>Inputs</strong>
          {device.inputs.length === 0 ? (
            <small>None</small>
          ) : (
            device.inputs
              .filter((port) => port.kind === 'input')
              .map((port) => (
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
            device.outputs
              .filter((port) => port.kind === 'output')
              .map((port) => (
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
          <strong>Bidirectional</strong>
          {[...device.inputs, ...device.outputs].filter(
            (port) => port.kind === 'bidirectional',
          ).length === 0 ? (
            <small>None</small>
          ) : (
            [...device.inputs, ...device.outputs]
              .filter((port) => port.kind === 'bidirectional')
              .map((port) => (
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
      )}
    </article>
  )
}
