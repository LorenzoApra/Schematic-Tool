import { useState } from 'react'
import type { DeviceDefinition, PortDefinition, PortRef } from '../types/schematic'

type PortViewMode = 'all' | 'input' | 'output' | 'bidirectional'

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

const portViewModes: PortViewMode[] = ['all', 'input', 'output', 'bidirectional']
const portViewLabels: Record<PortViewMode, string> = {
  all: 'All',
  input: 'Only In',
  output: 'Only Out',
  bidirectional: 'Only Bi',
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
  const [portViewMode, setPortViewMode] = useState<PortViewMode>('all')

  const inputPorts = device.inputs.filter((port) => port.kind === 'input')
  const outputPorts = device.outputs.filter((port) => port.kind === 'output')
  const biPorts = [...device.inputs, ...device.outputs].filter(
    (port) => port.kind === 'bidirectional',
  )
  const availablePortViewModes =
    biPorts.length > 0
      ? portViewModes
      : portViewModes.filter((mode) => mode !== 'bidirectional')
  const effectivePortViewMode = availablePortViewModes.includes(portViewMode)
    ? portViewMode
    : 'all'
  const showInputs = effectivePortViewMode === 'all' || effectivePortViewMode === 'input'
  const showOutputs = effectivePortViewMode === 'all' || effectivePortViewMode === 'output'
  const showBidirectional =
    effectivePortViewMode === 'all' || effectivePortViewMode === 'bidirectional'

  const visibleColumns = [
    showInputs ? { key: 'input', title: 'Inputs', ports: inputPorts } : null,
    showOutputs ? { key: 'output', title: 'Outputs', ports: outputPorts } : null,
  ].filter((column): column is { key: string; title: string; ports: PortDefinition[] } =>
    Boolean(column && column.ports.length > 0),
  )
  const visibleBiPorts = showBidirectional ? biPorts : []
  const hasVisiblePorts = visibleColumns.length > 0 || visibleBiPorts.length > 0
  const nextPortViewMode = () => {
    const currentIndex = availablePortViewModes.indexOf(effectivePortViewMode)
    const safeIndex = currentIndex >= 0 ? currentIndex : 0
    return availablePortViewModes[(safeIndex + 1) % availablePortViewModes.length]
  }
  const cyclePortViewMode = () => {
    setPortViewMode(nextPortViewMode())
  }
  const nextPortViewLabel = portViewLabels[nextPortViewMode()]

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
          className="filter-ports-button node-action-button"
          onClick={cyclePortViewMode}
          title={`Switch to ${nextPortViewLabel}`}
        >
          {portViewLabels[effectivePortViewMode]}
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
        <div className="ports-layout">
          {!hasVisiblePorts ? (
            <div className="ports-col">
              <small>
                {effectivePortViewMode === 'all'
                  ? 'No ports configured'
                  : 'No ports in this view'}
              </small>
            </div>
          ) : (
            <>
              <div className="ports-row">
                {visibleColumns.map((column) => (
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
                ))}
              </div>
              {visibleBiPorts.length > 0 ? (
                <div className="ports-col bidirectional-ports">
                  <strong>Bidirectional</strong>
                  {visibleBiPorts.map((port) => (
                    <PortButton
                      key={port.id}
                      nodeId={id}
                      port={port}
                      activePort={activePort}
                      onPortClick={onPortClick}
                    />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </article>
  )
}
