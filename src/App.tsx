import { useEffect, useMemo, useState } from 'react'
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
  categories: DeviceCategory[]
  deviceList: DeviceDefinition[]
  nodes: NodeInstance[]
  connections: Connection[]
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
        categories: deviceCategories,
        deviceList: normalizeDeviceList(devices),
        nodes: [],
        connections: [],
      }
    }

    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
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

function App() {
  const [initialState] = useState<PersistedState>(() => loadInitialState())
  const [categories, setCategories] = useState<DeviceCategory[]>(
    initialState.categories,
  )
  const [deviceList, setDeviceList] = useState<DeviceDefinition[]>(
    initialState.deviceList,
  )
  const [nodes, setNodes] = useState<NodeInstance[]>(initialState.nodes)
  const [connections, setConnections] = useState<Connection[]>(
    initialState.connections,
  )
  const [activePort, setActivePort] = useState<PortRef | null>(null)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    const state: PersistedState = {
      categories,
      deviceList,
      nodes,
      connections,
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [categories, deviceList, nodes, connections])

  const devicesById = useMemo(
    () => Object.fromEntries(deviceList.map((device) => [device.id, device])),
    [deviceList],
  )

  const handleAddDevice = (deviceId: string) => {
    const index = nodes.length
    const id = `${deviceId}-${Date.now()}-${index}`

    setNodes((current) => [
      ...current,
      {
        id,
        deviceId,
        x: 24 + (index % 3) * 230,
        y: 24 + Math.floor(index / 3) * 180,
      },
    ])
  }

  const handlePortClick = (port: PortRef) => {
    if (!activePort) {
      setActivePort(port)
      setMessage('')
      return
    }

    const source = activePort.kind === 'output' ? activePort : port
    const target = activePort.kind === 'output' ? port : activePort

    const validation = validateConnection({
      source,
      target,
      connections,
      resolvePort: (ref) => {
        const node = nodes.find((entry) => entry.id === ref.nodeId)
        if (!node) {
          return null
        }
        const device = devicesById[node.deviceId]
        if (!device) {
          return null
        }

        const portList = ref.kind === 'input' ? device.inputs : device.outputs
        return portList.find((entry) => entry.id === ref.portId) ?? null
      },
    })

    if (!validation.valid) {
      setMessage(validation.error ?? 'Invalid connection.')
      setActivePort(null)
      return
    }

    const id = `conn-${Date.now()}-${connections.length}`
    setConnections((current) => [
      ...current,
      {
        id,
        from: source,
        to: target,
      },
    ])

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
    if (activePort?.nodeId === nodeId) {
      setActivePort(null)
    }
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

  const handleDeleteConnection = (connectionId: string) => {
    setConnections((current) =>
      current.filter((connection) => connection.id !== connectionId),
    )
    setMessage('Connection removed.')
  }

  const handleCreateCategory = (label: string): boolean => {
    const trimmed = label.trim()
    if (!trimmed) {
      setMessage('Category name is required.')
      return false
    }

    const id = toSlug(trimmed)
    if (!id) {
      setMessage('Category name must include letters or numbers.')
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
      {
        id: finalId,
        name: trimmed,
        category: categoryId,
        inputs: [],
        outputs: [],
      },
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
    if (!deviceId) {
      setMessage('Select a device before adding a port.')
      return false
    }
    if (!trimmed) {
      setMessage('Port label is required.')
      return false
    }

    const portId = toSlug(trimmed)
    if (!portId) {
      setMessage('Port label must include letters or numbers.')
      return false
    }

    const targetDevice = deviceList.find((device) => device.id === deviceId)
    if (!targetDevice) {
      setMessage('Device not found.')
      return false
    }

    const existingPorts = [...targetDevice.inputs, ...targetDevice.outputs]
    if (existingPorts.some((port) => port.id === portId)) {
      setMessage('This device already has a port with the same name.')
      return false
    }

    setDeviceList((current) =>
      current.map((device) => {
        if (device.id !== deviceId) {
          return device
        }

        const nextPort = { id: portId, label: trimmed, kind }
        const portWithConnector = {
          ...nextPort,
          connectorCategory,
          connectorType,
        }
        if (kind === 'input') {
          return { ...device, inputs: [...device.inputs, portWithConnector] }
        }
        return { ...device, outputs: [...device.outputs, portWithConnector] }
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
    if (!deviceId) {
      setMessage('Select a device before bulk adding ports.')
      return false
    }
    if (!prefix) {
      setMessage('Port label prefix is required.')
      return false
    }
    if (!Number.isFinite(count) || count <= 0) {
      setMessage('Bulk count must be greater than 0.')
      return false
    }

    const safeStartIndex = Number.isFinite(startIndex) ? startIndex : 1
    const device = deviceList.find((entry) => entry.id === deviceId)
    if (!device) {
      setMessage('Device not found.')
      return false
    }

    const existingIds = new Set(
      [...device.inputs, ...device.outputs].map((port) => port.id),
    )
    const newPorts = Array.from({ length: count }, (_, index) => {
      const label = `${prefix} ${safeStartIndex + index}`.trim()
      const baseId = toSlug(label) || `port-${Date.now()}-${index}`
      let portId = baseId
      let suffix = 2
      while (existingIds.has(portId)) {
        portId = `${baseId}-${suffix}`
        suffix += 1
      }
      existingIds.add(portId)

      return {
        id: portId,
        label,
        kind,
        connectorCategory,
        connectorType,
      }
    })

    setDeviceList((current) =>
      current.map((entry) => {
        if (entry.id !== deviceId) {
          return entry
        }
        if (kind === 'input') {
          return { ...entry, inputs: [...entry.inputs, ...newPorts] }
        }
        return { ...entry, outputs: [...entry.outputs, ...newPorts] }
      }),
    )
    setMessage(`Added ${newPorts.length} ${kind} ports to ${device.name}.`)
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
    if (!deviceId) {
      setMessage('Select a device before bulk removing ports.')
      return false
    }
    if (!Number.isFinite(count) || count <= 0) {
      setMessage('Bulk remove count must be greater than 0.')
      return false
    }
    const prefix = labelPrefix.trim().toLowerCase()
    const device = deviceList.find((entry) => entry.id === deviceId)
    if (!device) {
      setMessage('Device not found.')
      return false
    }

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
    if (removedPorts.length === 0) {
      setMessage('No matching ports found for bulk remove.')
      return false
    }
    const removedIds = new Set(removedPorts.map((port) => port.id))

    setDeviceList((current) =>
      current.map((entry) => {
        if (entry.id !== deviceId) {
          return entry
        }
        if (kind === 'input') {
          return {
            ...entry,
            inputs: entry.inputs.filter((port) => !removedIds.has(port.id)),
          }
        }
        return {
          ...entry,
          outputs: entry.outputs.filter((port) => !removedIds.has(port.id)),
        }
      }),
    )

    const affectedNodeIds = getNodeIdsForDevice(nodes, deviceId)
    setConnections((current) =>
      current.filter((connection) => {
        const fromMatch =
          affectedNodeIds.has(connection.from.nodeId) &&
          removedIds.has(connection.from.portId)
        const toMatch =
          affectedNodeIds.has(connection.to.nodeId) &&
          removedIds.has(connection.to.portId)
        return !(fromMatch || toMatch)
      }),
    )
    setMessage(`Removed ${removedPorts.length} ${kind} ports from ${device.name}.`)
    return true
  }

  const handleUpdateCategory = (categoryId: string, nextLabel: string): boolean => {
    const trimmed = nextLabel.trim()
    if (!trimmed) {
      setMessage('Category name is required.')
      return false
    }

    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, label: trimmed } : category,
      ),
    )
    setMessage(`Category renamed to "${trimmed}".`)
    return true
  }

  const handleDeleteCategory = (categoryId: string): boolean => {
    const devicesInCategory = deviceList.filter(
      (device) => device.category === categoryId,
    )

    if (devicesInCategory.length > 0) {
      setMessage('Cannot delete category: move or delete its devices first.')
      return false
    }

    setCategories((current) =>
      current.filter((category) => category.id !== categoryId),
    )
    setMessage('Category deleted.')
    return true
  }

  const handleUpdateDevice = (
    deviceId: string,
    nextName: string,
    nextCategoryId: string,
  ): boolean => {
    const trimmedName = nextName.trim()
    if (!trimmedName) {
      setMessage('Device name is required.')
      return false
    }
    if (!categories.some((category) => category.id === nextCategoryId)) {
      setMessage('Selected category does not exist.')
      return false
    }

    setDeviceList((current) =>
      current.map((device) =>
        device.id === deviceId
          ? { ...device, name: trimmedName, category: nextCategoryId }
          : device,
      ),
    )
    setMessage(`Device updated to "${trimmedName}".`)
    return true
  }

  const handleDeleteDevice = (deviceId: string): boolean => {
    const removedNodeIds = getNodeIdsForDevice(nodes, deviceId)
    const removedCount = removedNodeIds.size

    setDeviceList((current) => current.filter((device) => device.id !== deviceId))
    setNodes((current) => current.filter((node) => node.deviceId !== deviceId))
    setConnections((current) =>
      current.filter(
        (connection) =>
          !removedNodeIds.has(connection.from.nodeId) &&
          !removedNodeIds.has(connection.to.nodeId),
      ),
    )

    if (activePort && removedNodeIds.has(activePort.nodeId)) {
      setActivePort(null)
    }

    setMessage(
      removedCount > 0
        ? `Device deleted. Removed ${removedCount} placed node(s).`
        : 'Device deleted.',
    )
    return true
  }

  const handleMoveDevice = (deviceId: string, nextCategoryId: string): boolean => {
    if (!categories.some((category) => category.id === nextCategoryId)) {
      setMessage('Selected category does not exist.')
      return false
    }

    const target = deviceList.find((device) => device.id === deviceId)
    if (!target) {
      setMessage('Device not found.')
      return false
    }

    setDeviceList((current) =>
      current.map((device) =>
        device.id === deviceId ? { ...device, category: nextCategoryId } : device,
      ),
    )
    setMessage(`Moved "${target.name}" to a new category.`)
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
    if (!trimmed) {
      setMessage('Port label is required.')
      return false
    }

    const nextPortId = toSlug(trimmed)
    if (!nextPortId) {
      setMessage('Port label must include letters or numbers.')
      return false
    }

    const targetDevice = deviceList.find((device) => device.id === deviceId)
    if (!targetDevice) {
      setMessage('Device not found.')
      return false
    }

    const existingPorts = [...targetDevice.inputs, ...targetDevice.outputs].filter(
      (port) => !(port.id === portId && port.kind === portKind),
    )
    if (existingPorts.some((port) => port.id === nextPortId)) {
      setMessage('This device already has a port with that name.')
      return false
    }

    setDeviceList((current) =>
      current.map((device) => {
        if (device.id !== deviceId) {
          return device
        }

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

    const affectedNodeIds = getNodeIdsForDevice(nodes, deviceId)
    setConnections((current) =>
      current.filter((connection) => {
        const fromMatch =
          affectedNodeIds.has(connection.from.nodeId) &&
          connection.from.portId === portId
        const toMatch =
          affectedNodeIds.has(connection.to.nodeId) && connection.to.portId === portId
        return !(fromMatch || toMatch)
      }),
    )

    if (activePort && activePort.portId === portId) {
      setActivePort(null)
    }

    setMessage('Port updated. Related connections were removed.')
    return true
  }

  const handleDeletePort = (
    deviceId: string,
    portId: string,
    portKind: PortKind,
  ): boolean => {
    setDeviceList((current) =>
      current.map((device) => {
        if (device.id !== deviceId) {
          return device
        }

        if (portKind === 'input') {
          return {
            ...device,
            inputs: device.inputs.filter((port) => port.id !== portId),
          }
        }

        return {
          ...device,
          outputs: device.outputs.filter((port) => port.id !== portId),
        }
      }),
    )

    const affectedNodeIds = getNodeIdsForDevice(nodes, deviceId)
    setConnections((current) =>
      current.filter((connection) => {
        const fromMatch =
          affectedNodeIds.has(connection.from.nodeId) &&
          connection.from.portId === portId
        const toMatch =
          affectedNodeIds.has(connection.to.nodeId) && connection.to.portId === portId
        return !(fromMatch || toMatch)
      }),
    )

    if (activePort && activePort.portId === portId) {
      setActivePort(null)
    }

    setMessage('Port deleted. Related connections were removed.')
    return true
  }

  return (
    <div className="app-layout">
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

      <section className="workspace">
        <header className="workspace-header">
          <h1>Live Show Signal Routing</h1>
          <p>Build your routing map by placing devices and linking output ports to input ports.</p>
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
          onDeleteConnection={handleDeleteConnection}
        />
      </section>
    </div>
  )
}

export default App
