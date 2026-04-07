import { useMemo, useState } from 'react'
import './App.css'
import { DeviceLibrary } from './components/DeviceLibrary'
import { SchematicCanvas } from './components/SchematicCanvas'
import { deviceCategories, devices } from './data/deviceLibrary'
import { validateConnection } from './lib/validation'
import type {
  Connection,
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

function getNodeIdsForDevice(nodes: NodeInstance[], deviceId: string): Set<string> {
  return new Set(
    nodes.filter((node) => node.deviceId === deviceId).map((node) => node.id),
  )
}

function App() {
  const [categories, setCategories] = useState<DeviceCategory[]>(deviceCategories)
  const [deviceList, setDeviceList] = useState<DeviceDefinition[]>(devices)
  const [nodes, setNodes] = useState<NodeInstance[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [activePort, setActivePort] = useState<PortRef | null>(null)
  const [message, setMessage] = useState<string>('')

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

    const validation = validateConnection({
      source: activePort,
      target: port,
      connections,
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
        from: activePort,
        to: port,
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
        if (kind === 'input') {
          return { ...device, inputs: [...device.inputs, nextPort] }
        }
        return { ...device, outputs: [...device.outputs, nextPort] }
      }),
    )
    setMessage(`Added ${kind} port "${trimmed}" to ${targetDevice.name}.`)
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
    if (deviceList.some((device) => device.category === categoryId)) {
      setMessage('Cannot delete a category that still has devices.')
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

  const handleUpdatePort = (
    deviceId: string,
    portId: string,
    portKind: PortKind,
    nextLabel: string,
    nextKind: PortKind,
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
        const nextPort = { id: nextPortId, label: trimmed, kind: nextKind }

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
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onUpdateDevice={handleUpdateDevice}
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
        />
      </section>
    </div>
  )
}

export default App
