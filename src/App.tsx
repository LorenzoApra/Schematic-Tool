import { useEffect, useMemo, useRef, useState, type ChangeEventHandler } from 'react'
import './App.css'
import { DeviceLibrary } from './components/DeviceLibrary'
import { SchematicCanvas } from './components/SchematicCanvas'
import {
  defaultConnectorCategory,
  defaultConnectorType,
} from './data/connectors'
import { deviceCategories, devices } from './data/deviceLibrary'
import { validateConnection } from './lib/validation'
import type {
  Connection,
  ConnectorCategory,
  DeviceCategory,
  DeviceDefinition,
  NodeInstance,
  PortKind,
  PortRef,
} from './types/schematic'

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const STORAGE_KEY = 'live-show-schematic-state-v1'

interface PersistedState {
  projectTitle: string
  projectDescription: string
  categories: DeviceCategory[]
  deviceList: DeviceDefinition[]
  nodes: NodeInstance[]
  connections: Connection[]
}

interface ProjectExport {
  format: 'live-show-schematic-project'
  version: 1
  exportedAt: string
  state: PersistedState
}

function normalizeDeviceList(deviceList: DeviceDefinition[]): DeviceDefinition[] {
  return deviceList.map((device) => ({
    ...device,
    inputs: device.inputs.map((port) => ({
      ...port,
      connectorCategory: port.connectorCategory ?? defaultConnectorCategory,
      connectorType: port.connectorType ?? defaultConnectorType,
    })),
    outputs: device.outputs.map((port) => ({
      ...port,
      connectorCategory: port.connectorCategory ?? defaultConnectorCategory,
      connectorType: port.connectorType ?? defaultConnectorType,
    })),
  }))
}

function loadInitialState(): PersistedState {
  if (typeof window === 'undefined') {
    return {
      projectTitle: 'Live Show Signal Routing',
      projectDescription:
        'Build your routing map by placing devices and linking compatible ports.',
      categories: deviceCategories,
      deviceList: normalizeDeviceList(devices),
      nodes: [],
      connections: [],
    }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return {
        projectTitle: 'Live Show Signal Routing',
        projectDescription:
          'Build your routing map by placing devices and linking compatible ports.',
        categories: deviceCategories,
        deviceList: normalizeDeviceList(devices),
        nodes: [],
        connections: [],
      }
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      projectTitle:
        typeof parsed.projectTitle === 'string' && parsed.projectTitle.trim()
          ? parsed.projectTitle.trim()
          : 'Live Show Signal Routing',
      projectDescription:
        typeof parsed.projectDescription === 'string' &&
        parsed.projectDescription.trim()
          ? parsed.projectDescription.trim()
          : 'Build your routing map by placing devices and linking compatible ports.',
      categories:
        Array.isArray(parsed.categories) && parsed.categories.length > 0
          ? parsed.categories
          : deviceCategories,
      deviceList: normalizeDeviceList(
        Array.isArray(parsed.deviceList) ? parsed.deviceList : devices,
      ),
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    }
  } catch {
    return {
      projectTitle: 'Live Show Signal Routing',
      projectDescription:
        'Build your routing map by placing devices and linking compatible ports.',
      categories: deviceCategories,
      deviceList: normalizeDeviceList(devices),
      nodes: [],
      connections: [],
    }
  }
}

function getNodeIdsForDevice(nodes: NodeInstance[], deviceId: string): Set<string> {
  return new Set(
    nodes.filter((node) => node.deviceId === deviceId).map((node) => node.id),
  )
}

function resolveConnectionDirection(
  first: PortRef,
  second: PortRef,
): { source: PortRef; target: PortRef } | null {
  const canStart = (kind: PortKind) => kind === 'output' || kind === 'bidirectional'
  const canEnd = (kind: PortKind) => kind === 'input' || kind === 'bidirectional'

  if (canStart(first.kind) && canEnd(second.kind)) return { source: first, target: second }
  if (canStart(second.kind) && canEnd(first.kind)) return { source: second, target: first }
  return null
}

function App() {
  const [initialState] = useState<PersistedState>(() => loadInitialState())
  const [projectTitle, setProjectTitle] = useState(initialState.projectTitle)
  const [projectDescription, setProjectDescription] = useState(
    initialState.projectDescription,
  )
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false)
  const [categories, setCategories] = useState<DeviceCategory[]>(initialState.categories)
  const [deviceList, setDeviceList] = useState<DeviceDefinition[]>(
    initialState.deviceList,
  )
  const [nodes, setNodes] = useState<NodeInstance[]>(initialState.nodes)
  const [connections, setConnections] = useState<Connection[]>(
    initialState.connections,
  )
  const [activePort, setActivePort] = useState<PortRef | null>(null)
  const [message, setMessage] = useState<string>('')
  const [isClearCanvasArmed, setIsClearCanvasArmed] = useState(false)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const state: PersistedState = {
      projectTitle,
      projectDescription,
      categories,
      deviceList,
      nodes,
      connections,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [projectTitle, projectDescription, categories, deviceList, nodes, connections])

  const devicesById = useMemo(
    () => Object.fromEntries(deviceList.map((device) => [device.id, device])),
    [deviceList],
  )

  const handleAddDevice = (deviceId: string) => {
    const index = nodes.length
    const id = `${deviceId}-${Date.now()}-${index}`
    setNodes((current) => [
      ...current,
      { id, deviceId, x: 24 + (index % 3) * 320, y: 24 + Math.floor(index / 3) * 180 },
    ])
  }

  const resolvePort = (ref: PortRef) => {
    const node = nodes.find((entry) => entry.id === ref.nodeId)
    if (!node) return null
    const device = devicesById[node.deviceId]
    if (!device) return null
    const portList =
      ref.kind === 'input'
        ? device.inputs
        : ref.kind === 'output'
          ? device.outputs
          : [...device.inputs, ...device.outputs]
    return portList.find((entry) => entry.id === ref.portId) ?? null
  }

  const handlePortClick = (port: PortRef) => {
    if (!activePort) {
      setActivePort(port)
      setMessage('')
      return
    }

    const resolved = resolveConnectionDirection(activePort, port)
    if (!resolved) {
      setMessage('Invalid direction. Use output/bidirectional to input/bidirectional.')
      setActivePort(null)
      return
    }

    const { source, target } = resolved
    const validation = validateConnection({ source, target, connections, resolvePort })
    if (!validation.valid) {
      setMessage(validation.error ?? 'Invalid connection.')
      setActivePort(null)
      return
    }

    const id = `conn-${Date.now()}-${connections.length}`
    setConnections((current) => [...current, { id, from: source, to: target }])
    setMessage('Connection added.')
    setActivePort(null)
  }

  const handleNodeMove = (nodeId: string, x: number, y: number) => {
    setNodes((current) =>
      current.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
    )
  }

  const handleDeleteNode = (nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId))
    setConnections((current) =>
      current.filter(
        (connection) =>
          connection.from.nodeId !== nodeId && connection.to.nodeId !== nodeId,
      ),
    )
    if (activePort?.nodeId === nodeId) setActivePort(null)
    setMessage('Device removed from canvas.')
  }

  const handleRenameNode = (nodeId: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) {
      setMessage('Device name on canvas cannot be empty.')
      return
    }
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, customName: trimmed } : node,
      ),
    )
    setMessage('Device on canvas renamed.')
  }

  const handleToggleNodeCollapse = (nodeId: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, collapsed: !node.collapsed } : node,
      ),
    )
  }

  const handleDeleteConnection = (connectionId: string) => {
    setConnections((current) =>
      current.filter((connection) => connection.id !== connectionId),
    )
    setMessage('Connection removed.')
  }

  const handleCreateCategory = (label: string): boolean => {
    const trimmed = label.trim()
    const id = toSlug(trimmed)
    if (!trimmed || !id) {
      setMessage('Category name is required.')
      return false
    }
    if (categories.some((category) => category.id === id)) {
      setMessage('Category already exists.')
      return false
    }
    setCategories((current) => [...current, { id, label: trimmed }])
    setMessage(`Category "${trimmed}" created.`)
    return true
  }

  const handleCreateDevice = (name: string, categoryId: string): boolean => {
    const trimmed = name.trim()
    if (!trimmed) {
      setMessage('Device name is required.')
      return false
    }
    if (!categoryId) {
      setMessage('Select a category for the new device.')
      return false
    }
    const baseId = toSlug(trimmed)
    if (!baseId) {
      setMessage('Device name must include letters or numbers.')
      return false
    }
    let finalId = baseId
    let index = 1
    while (deviceList.some((device) => device.id === finalId)) {
      index += 1
      finalId = `${baseId}-${index}`
    }
    setDeviceList((current) => [
      ...current,
      { id: finalId, name: trimmed, category: categoryId, inputs: [], outputs: [] },
    ])
    setMessage(`Device "${trimmed}" created.`)
    return true
  }

  const handleAddPort = (
    deviceId: string,
    kind: PortKind,
    label: string,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ): boolean => {
    const trimmed = label.trim()
    if (!deviceId || !trimmed) {
      setMessage('Select a device and enter a port label.')
      return false
    }
    const portId = toSlug(trimmed)
    if (!portId) return false
    const targetDevice = deviceList.find((device) => device.id === deviceId)
    if (!targetDevice) return false
    const existingPorts = [...targetDevice.inputs, ...targetDevice.outputs]
    if (existingPorts.some((port) => port.id === portId)) {
      setMessage('This device already has a port with the same name.')
      return false
    }

    setDeviceList((current) =>
      current.map((device) => {
        if (device.id !== deviceId) return device
        const nextPort = { id: portId, label: trimmed, kind, connectorCategory, connectorType }
        if (kind === 'input') return { ...device, inputs: [...device.inputs, nextPort] }
        return { ...device, outputs: [...device.outputs, nextPort] }
      }),
    )
    setMessage(`Added ${kind} port "${trimmed}" to ${targetDevice.name}.`)
    return true
  }

  const handleBulkAddPorts = (
    deviceId: string,
    kind: PortKind,
    labelPrefix: string,
    count: number,
    startIndex: number,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ): boolean => {
    const prefix = labelPrefix.trim()
    if (!deviceId || !prefix || !Number.isFinite(count) || count <= 0) return false
    const device = deviceList.find((entry) => entry.id === deviceId)
    if (!device) return false

    const existingIds = new Set([...device.inputs, ...device.outputs].map((p) => p.id))
    const newPorts = Array.from({ length: count }, (_, i) => {
      const label = `${prefix} ${startIndex + i}`.trim()
      const baseId = toSlug(label) || `port-${Date.now()}-${i}`
      let id = baseId
      let suffix = 2
      while (existingIds.has(id)) {
        id = `${baseId}-${suffix}`
        suffix += 1
      }
      existingIds.add(id)
      return { id, label, kind, connectorCategory, connectorType }
    })

    setDeviceList((current) =>
      current.map((entry) => {
        if (entry.id !== deviceId) return entry
        if (kind === 'input') return { ...entry, inputs: [...entry.inputs, ...newPorts] }
        return { ...entry, outputs: [...entry.outputs, ...newPorts] }
      }),
    )
    setMessage(`Added ${newPorts.length} ${kind} ports.`)
    return true
  }

  const handleBulkRemovePorts = (
    deviceId: string,
    kind: PortKind,
    labelPrefix: string,
    count: number,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ): boolean => {
    if (!deviceId || !Number.isFinite(count) || count <= 0) return false
    const prefix = labelPrefix.trim().toLowerCase()
    const device = deviceList.find((entry) => entry.id === deviceId)
    if (!device) return false
    const sourcePorts = kind === 'input' ? device.inputs : device.outputs
    const matches = sourcePorts.filter((port) => {
      const prefixOk = prefix ? port.label.toLowerCase().startsWith(prefix) : true
      return (
        prefixOk &&
        port.connectorCategory === connectorCategory &&
        port.connectorType === connectorType
      )
    })
    const removedPorts = matches.slice(0, count)
    if (removedPorts.length === 0) return false
    const removedIds = new Set(removedPorts.map((port) => port.id))

    setDeviceList((current) =>
      current.map((entry) => {
        if (entry.id !== deviceId) return entry
        if (kind === 'input') {
          return { ...entry, inputs: entry.inputs.filter((p) => !removedIds.has(p.id)) }
        }
        return { ...entry, outputs: entry.outputs.filter((p) => !removedIds.has(p.id)) }
      }),
    )

    const affectedNodeIds = getNodeIdsForDevice(nodes, deviceId)
    setConnections((current) =>
      current.filter((connection) => {
        const fromMatch =
          affectedNodeIds.has(connection.from.nodeId) && removedIds.has(connection.from.portId)
        const toMatch =
          affectedNodeIds.has(connection.to.nodeId) && removedIds.has(connection.to.portId)
        return !(fromMatch || toMatch)
      }),
    )
    setMessage(`Removed ${removedPorts.length} ${kind} ports.`)
    return true
  }

  const handleUpdateCategory = (categoryId: string, nextLabel: string): boolean => {
    const trimmed = nextLabel.trim()
    if (!trimmed) return false
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, label: trimmed } : category,
      ),
    )
    setMessage(`Category renamed to "${trimmed}".`)
    return true
  }

  const handleDeleteCategory = (categoryId: string): boolean => {
    if (deviceList.some((device) => device.category === categoryId)) {
      setMessage('Cannot delete category: move or delete its devices first.')
      return false
    }
    setCategories((current) => current.filter((category) => category.id !== categoryId))
    setMessage('Category deleted.')
    return true
  }

  const handleUpdateDevice = (
    deviceId: string,
    nextName: string,
    nextCategoryId: string,
  ): boolean => {
    const trimmed = nextName.trim()
    if (!trimmed || !categories.some((c) => c.id === nextCategoryId)) return false
    setDeviceList((current) =>
      current.map((device) =>
        device.id === deviceId
          ? { ...device, name: trimmed, category: nextCategoryId }
          : device,
      ),
    )
    return true
  }

  const handleMoveDevice = (deviceId: string, nextCategoryId: string): boolean => {
    return handleUpdateDevice(
      deviceId,
      deviceList.find((d) => d.id === deviceId)?.name ?? '',
      nextCategoryId,
    )
  }

  const handleDeleteDevice = (deviceId: string): boolean => {
    const removedNodeIds = getNodeIdsForDevice(nodes, deviceId)
    setDeviceList((current) => current.filter((device) => device.id !== deviceId))
    setNodes((current) => current.filter((node) => node.deviceId !== deviceId))
    setConnections((current) =>
      current.filter(
        (connection) =>
          !removedNodeIds.has(connection.from.nodeId) &&
          !removedNodeIds.has(connection.to.nodeId),
      ),
    )
    if (activePort && removedNodeIds.has(activePort.nodeId)) setActivePort(null)
    return true
  }

  const handleUpdatePort = (
    deviceId: string,
    portId: string,
    portKind: PortKind,
    nextLabel: string,
    nextKind: PortKind,
    nextConnectorCategory: ConnectorCategory,
    nextConnectorType: string,
  ): boolean => {
    const trimmed = nextLabel.trim()
    if (!trimmed) return false
    const nextPortId = toSlug(trimmed)
    if (!nextPortId) return false
    const targetDevice = deviceList.find((device) => device.id === deviceId)
    if (!targetDevice) return false

    const existingPorts = [...targetDevice.inputs, ...targetDevice.outputs].filter(
      (port) => !(port.id === portId && port.kind === portKind),
    )
    if (existingPorts.some((port) => port.id === nextPortId)) return false

    setDeviceList((current) =>
      current.map((device) => {
        if (device.id !== deviceId) return device
        const remainingInputs = device.inputs.filter((port) => port.id !== portId)
        const remainingOutputs = device.outputs.filter((port) => port.id !== portId)
        const nextPort = {
          id: nextPortId,
          label: trimmed,
          kind: nextKind,
          connectorCategory: nextConnectorCategory,
          connectorType: nextConnectorType,
        }
        if (nextKind === 'input') {
          return { ...device, inputs: [...remainingInputs, nextPort], outputs: remainingOutputs }
        }
        return { ...device, inputs: remainingInputs, outputs: [...remainingOutputs, nextPort] }
      }),
    )
    return true
  }

  const handleDeletePort = (
    deviceId: string,
    portId: string,
    portKind: PortKind,
  ): boolean => {
    setDeviceList((current) =>
      current.map((device) => {
        if (device.id !== deviceId) return device
        if (portKind === 'input') {
          return { ...device, inputs: device.inputs.filter((port) => port.id !== portId) }
        }
        return { ...device, outputs: device.outputs.filter((port) => port.id !== portId) }
      }),
    )
    return true
  }

  const handleExpandAllNodesForExport = () => {
    const previousCollapsedByNodeId = Object.fromEntries(
      nodes.map((node) => [node.id, Boolean(node.collapsed)]),
    )
    setNodes((current) => current.map((node) => ({ ...node, collapsed: false })))
    return previousCollapsedByNodeId
  }

  const handleRestoreCollapsedNodes = (
    collapsedByNodeId: Record<string, boolean>,
  ) => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        collapsed: collapsedByNodeId[node.id] ?? false,
      })),
    )
  }

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const handleExportProject = () => {
    const payload: ProjectExport = {
      format: 'live-show-schematic-project',
      version: 1,
      exportedAt: new Date().toISOString(),
      state: {
        projectTitle,
        projectDescription,
        categories,
        deviceList,
        nodes,
        connections,
      },
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeTitle =
      toSlug(projectTitle) || 'schematic-project'
    downloadFile(`${safeTitle}-${stamp}.json`, JSON.stringify(payload, null, 2))
    setMessage('Project exported.')
  }

  const parseImportedState = (parsed: unknown): PersistedState | null => {
    if (!parsed || typeof parsed !== 'object') return null

    const maybePayload = parsed as Partial<ProjectExport>
    const maybeState =
      maybePayload.format === 'live-show-schematic-project'
        ? maybePayload.state
        : (parsed as Partial<PersistedState>)

    if (!maybeState || typeof maybeState !== 'object') return null

    const categoriesValue = (maybeState as Partial<PersistedState>).categories
    const devicesValue = (maybeState as Partial<PersistedState>).deviceList
    const nodesValue = (maybeState as Partial<PersistedState>).nodes
    const connectionsValue = (maybeState as Partial<PersistedState>).connections

    if (
      !Array.isArray(categoriesValue) ||
      !Array.isArray(devicesValue) ||
      !Array.isArray(nodesValue) ||
      !Array.isArray(connectionsValue)
    ) {
      return null
    }

    return {
      projectTitle:
        typeof maybeState.projectTitle === 'string' && maybeState.projectTitle.trim()
          ? maybeState.projectTitle.trim()
          : 'Live Show Signal Routing',
      projectDescription:
        typeof maybeState.projectDescription === 'string' &&
        maybeState.projectDescription.trim()
          ? maybeState.projectDescription.trim()
          : 'Build your routing map by placing devices and linking compatible ports.',
      categories: categoriesValue as DeviceCategory[],
      deviceList: normalizeDeviceList(devicesValue as DeviceDefinition[]),
      nodes: nodesValue as NodeInstance[],
      connections: connectionsValue as Connection[],
    }
  }

  const handleImportProject: ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as unknown
      const nextState = parseImportedState(parsed)

      if (!nextState) {
        setMessage('Invalid project file.')
        return
      }

      setCategories(nextState.categories)
      setDeviceList(nextState.deviceList)
      setNodes(nextState.nodes)
      setConnections(nextState.connections)
      setProjectTitle(nextState.projectTitle)
      setProjectDescription(nextState.projectDescription)
      setActivePort(null)
      setMessage('Project imported.')
    } catch {
      setMessage('Failed to import project file.')
    } finally {
      event.target.value = ''
    }
  }

  const handleClearCanvas = () => {
    if (nodes.length === 0 && connections.length === 0) {
      setMessage('Canvas is already empty.')
      setIsClearCanvasArmed(false)
      return
    }

    if (!isClearCanvasArmed) {
      setIsClearCanvasArmed(true)
      setMessage(
        'Press "Confirm Clear Canvas" to remove all nodes and connections. Library stays.',
      )
      return
    }

    setNodes([])
    setConnections([])
    setActivePort(null)
    setIsClearCanvasArmed(false)
    setMessage('Canvas cleared.')
  }

  return (
    <div className={`app-layout ${isLibraryCollapsed ? 'sidebar-collapsed' : ''}`}>
      {isLibraryCollapsed ? null : (
        <DeviceLibrary
          categories={categories}
          devices={deviceList}
          onAddDevice={handleAddDevice}
          onCreateCategory={handleCreateCategory}
          onCreateDevice={handleCreateDevice}
          onAddPort={handleAddPort}
          onBulkAddPorts={handleBulkAddPorts}
          onBulkRemovePorts={handleBulkRemovePorts}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          onUpdateDevice={handleUpdateDevice}
          onMoveDevice={handleMoveDevice}
          onDeleteDevice={handleDeleteDevice}
          onUpdatePort={handleUpdatePort}
          onDeletePort={handleDeletePort}
        />
      )}

      <section className="workspace">
        <header className="workspace-header">
          <input
            className="project-title-input"
            value={projectTitle}
            onChange={(event) => setProjectTitle(event.target.value)}
            placeholder="Project title"
          />
          <textarea
            className="project-description-input"
            value={projectDescription}
            onChange={(event) => setProjectDescription(event.target.value)}
            placeholder="Project description"
            rows={2}
          />
          <div className="workspace-actions">
            <button
              type="button"
              onClick={() => setIsLibraryCollapsed((current) => !current)}
            >
              {isLibraryCollapsed ? 'Show Library' : 'Hide Library'}
            </button>
            <button type="button" onClick={handleExportProject}>
              Export Project
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
            >
              Import Project
            </button>
            {isClearCanvasArmed ? (
              <>
                <button type="button" className="danger" onClick={handleClearCanvas}>
                  Confirm Clear Canvas
                </button>
                <button
                  type="button"
                  className="neutral"
                  onClick={() => {
                    setIsClearCanvasArmed(false)
                    setMessage('Clear canvas cancelled.')
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="danger" onClick={handleClearCanvas}>
                Clear Canvas
              </button>
            )}
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportProject}
              style={{ display: 'none' }}
            />
          </div>
        </header>

        {message ? <p className="status-message">{message}</p> : null}

        <SchematicCanvas
          nodes={nodes}
          devicesById={devicesById}
          connections={connections}
          activePort={activePort}
          onPortClick={handlePortClick}
          onNodeMove={handleNodeMove}
          onDeleteNode={handleDeleteNode}
          onRenameNode={handleRenameNode}
          onToggleNodeCollapse={handleToggleNodeCollapse}
          onDeleteConnection={handleDeleteConnection}
          onExpandAllNodesForExport={handleExpandAllNodesForExport}
          onRestoreCollapsedNodes={handleRestoreCollapsedNodes}
        />
      </section>
    </div>
  )
}

export default App
