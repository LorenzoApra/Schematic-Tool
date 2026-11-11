import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
} from 'react'
import { devices } from '../data/deviceLibrary'
import { connectorCatalog } from '../data/connectors'
import { useProject } from './useProject'
import {
  cleanConnections,
  createDefaultProject,
  createId,
  estimateNodeHeight,
  parseProject,
  projectFile,
  resolvePort,
  samePort,
  toSlug,
} from '../lib/project'
import { downloadFile } from '../lib/download'
import { validateConnection } from '../lib/validation'
import type {
  ConnectorCategory,
  PortDefinition,
  PortKind,
  PortRef,
} from '../types/schematic'

export function useProjectEditor() {
  const { state, update, undo, redo, endGroup, canUndo, canRedo, saveStatus } =
    useProject()
  const {
    projectTitle,
    projectDescription,
    categories,
    deviceList,
    nodes,
    connections,
  } = state
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(
    () => window.matchMedia('(max-width: 760px)').matches,
  )
  const [activePort, setActivePort] = useState<PortRef | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showClear, setShowClear] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [projectSession, setProjectSession] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const devicesById = useMemo(
    () => Object.fromEntries(deviceList.map((device) => [device.id, device])),
    [deviceList],
  )

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(''), 5500)
    return () => window.clearTimeout(timer)
  }, [message])

  const notify = (text: string) => {
    setMessage(text)
    return false
  }
  const handleNewProject = () => {
    const blank = createDefaultProject()
    update((current) => ({
      ...blank,
      categories: current.categories,
      deviceList: current.deviceList,
    }))
    setActivePort(null)
    setSelectedNode(null)
    setShowNewProject(false)
    setProjectSession((current) => current + 1)
    setMessage(
      'Nuovo progetto creato. Puoi annullare per recuperare il precedente.',
    )
  }
  const handleDeleteNode = (id: string) => {
    update((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== id),
      connections: current.connections.filter(
        (c) => c.from.nodeId !== id && c.to.nodeId !== id,
      ),
    }))
    if (activePort?.nodeId === id) setActivePort(null)
    setSelectedNode(null)
    setMessage('Dispositivo rimosso. Puoi annullare la modifica.')
  }
  const duplicateNode = () => {
    const node = nodes.find((node) => node.id === selectedNode)
    if (!node) return
    const id = createId('device')
    update((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          ...node,
          id,
          x: node.x + 48,
          y: node.y + 48,
          customName: `${node.customName || devicesById[node.deviceId].name} · copia`,
        },
      ],
    }))
    setSelectedNode(id)
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], dialog',
        )
      )
        return
      const modifier = event.metaKey || event.ctrlKey
      if (event.key === 'Escape') {
        setActivePort(null)
        setSelectedNode(null)
      }
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        setActivePort(null)
      }
      if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        setActivePort(null)
      }
      if (modifier && event.key.toLowerCase() === 'd' && selectedNode) {
        event.preventDefault()
        duplicateNode()
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedNode
      ) {
        event.preventDefault()
        handleDeleteNode(selectedNode)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  })

  const handleAddDevice = (
    deviceId: string,
    point?: { x: number; y: number },
  ) => {
    const device = devicesById[deviceId]
    if (!device) return
    if (window.matchMedia('(max-width: 760px)').matches)
      setIsLibraryCollapsed(true)
    const id = createId('device')
    let position = point
    if (!position) {
      const column = nodes.length % 2
      const x = 48 + column * 400
      const bottom = nodes
        .filter((node) => Math.abs(node.x - x) < 350)
        .reduce(
          (max, node) =>
            Math.max(
              max,
              node.y +
                estimateNodeHeight(devicesById[node.deviceId], node.collapsed),
            ),
          0,
        )
      position = { x, y: bottom ? bottom + 48 : 64 }
    }
    update((current) => ({
      ...current,
      nodes: [
        ...current.nodes,
        {
          id,
          deviceId,
          x: Math.max(16, position!.x),
          y: Math.max(16, position!.y),
        },
      ],
    }))
    setSelectedNode(id)
  }

  const handlePortClick = (port: PortRef) => {
    if (!activePort) {
      setActivePort(port)
      return
    }
    if (samePort(activePort, port)) {
      setActivePort(null)
      return
    }
    const canStart = (ref: PortRef) => ref.kind !== 'input'
    const canEnd = (ref: PortRef) => ref.kind !== 'output'
    const pair =
      canStart(activePort) && canEnd(port)
        ? { source: activePort, target: port }
        : canStart(port) && canEnd(activePort)
          ? { source: port, target: activePort }
          : null
    if (!pair) {
      notify(
        'Seleziona un’uscita e un ingresso, oppure due porte bidirezionali.',
      )
      return
    }
    const result = validateConnection({
      ...pair,
      connections,
      resolvePort: (ref) => resolvePort(state, ref),
    })
    if (!result.valid) {
      notify(result.error || 'Collegamento non valido.')
      return
    }
    update((current) => ({
      ...current,
      connections: [
        ...current.connections,
        { id: createId('cable'), from: pair.source, to: pair.target },
      ],
    }))
    setActivePort(null)
    setMessage('Collegamento creato.')
  }

  const handleCreateCategory = (label: string) => {
    const trimmed = label.trim(),
      id = toSlug(trimmed)
    if (!id) return notify('Inserisci un nome per la categoria.')
    if (categories.some((c) => c.id === id))
      return notify('Questa categoria esiste già.')
    update((current) => ({
      ...current,
      categories: [...current.categories, { id, label: trimmed }],
    }))
    return true
  }
  const handleCreateDevice = (name: string, category: string) => {
    if (!name.trim() || !categories.some((c) => c.id === category))
      return notify('Inserisci il nome e scegli una categoria.')
    update((current) => ({
      ...current,
      deviceList: [
        ...current.deviceList,
        {
          id: createId(toSlug(name) || 'device'),
          name: name.trim(),
          category,
          inputs: [],
          outputs: [],
        },
      ],
    }))
    setMessage('Dispositivo creato. Aggiungi le sue porte nella libreria.')
    return true
  }
  const addPorts = (
    deviceId: string,
    kind: PortKind,
    prefix: string,
    count: number,
    start: number,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ) => {
    const device = devicesById[deviceId]
    if (
      !device ||
      !prefix.trim() ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 256 ||
      !Number.isInteger(start) ||
      start < 0 ||
      start > 10000
    )
      return notify(
        'Scegli un dispositivo, un nome e una quantità intera da 1 a 256.',
      )
    if (!connectorCatalog[connectorCategory].includes(connectorType))
      return false
    const newPorts: PortDefinition[] = Array.from(
      { length: count },
      (_, i) => ({
        id: createId('port'),
        label:
          count === 1 && start === -1
            ? prefix.trim()
            : `${prefix.trim()} ${start + i}`,
        kind,
        connectorCategory,
        connectorType,
      }),
    )
    update((current) => ({
      ...current,
      deviceList: current.deviceList.map((d) =>
        d.id !== deviceId
          ? d
          : {
              ...d,
              [kind === 'input' ? 'inputs' : 'outputs']: [
                ...(kind === 'input' ? d.inputs : d.outputs),
                ...newPorts,
              ],
            },
      ),
    }))
    setMessage(`${count} ${count === 1 ? 'porta aggiunta' : 'porte aggiunte'}.`)
    return true
  }
  const handleAddPort = (
    deviceId: string,
    kind: PortKind,
    label: string,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ) => {
    if (!label.trim() || !devicesById[deviceId])
      return notify('Scegli il dispositivo e inserisci il nome della porta.')
    const port: PortDefinition = {
      id: createId('port'),
      label: label.trim(),
      kind,
      connectorCategory,
      connectorType,
    }
    update((current) => ({
      ...current,
      deviceList: current.deviceList.map((d) =>
        d.id !== deviceId
          ? d
          : {
              ...d,
              [kind === 'input' ? 'inputs' : 'outputs']: [
                ...(kind === 'input' ? d.inputs : d.outputs),
                port,
              ],
            },
      ),
    }))
    return true
  }
  const handleBulkRemove = (
    deviceId: string,
    kind: PortKind,
    prefix: string,
    count: number,
    category: ConnectorCategory,
    type: string,
  ) => {
    const device = devicesById[deviceId]
    if (!device || !Number.isInteger(count) || count < 1 || count > 256)
      return notify('Scegli il dispositivo e una quantità da 1 a 256.')
    const removed = new Set(
      [...device.inputs, ...device.outputs]
        .filter(
          (p) =>
            p.kind === kind &&
            p.label.toLowerCase().startsWith(prefix.trim().toLowerCase()) &&
            p.connectorCategory === category &&
            p.connectorType === type,
        )
        .slice(0, count)
        .map((p) => p.id),
    )
    if (!removed.size) return notify('Nessuna porta corrisponde ai filtri.')
    update((current) => {
      const next = {
        ...current,
        deviceList: current.deviceList.map((d) =>
          d.id !== deviceId
            ? d
            : {
                ...d,
                inputs: d.inputs.filter(
                  (p) => !(p.kind === kind && removed.has(p.id)),
                ),
                outputs: d.outputs.filter(
                  (p) => !(p.kind === kind && removed.has(p.id)),
                ),
              },
        ),
      }
      return { ...next, connections: cleanConnections(next) }
    })
    setActivePort(null)
    return true
  }
  const updateDevice = (id: string, name: string, category: string) => {
    if (!name.trim() || !categories.some((c) => c.id === category)) return false
    update((current) => ({
      ...current,
      deviceList: current.deviceList.map((d) =>
        d.id === id ? { ...d, name: name.trim(), category } : d,
      ),
    }))
    return true
  }
  const handleUpdatePort = (
    deviceId: string,
    portId: string,
    kind: PortKind,
    label: string,
    nextKind: PortKind,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ) => {
    if (!label.trim()) return notify('Il nome della porta è obbligatorio.')
    const existing = devicesById[deviceId]
    if (
      !existing ||
      [...existing.inputs, ...existing.outputs].some(
        (p) => p.id === portId && p.kind === nextKind && p.kind !== kind,
      )
    )
      return notify('Esiste già una porta con questa identità e direzione.')
    update((current) => {
      const deviceList = current.deviceList.map((d) => {
        if (d.id !== deviceId) return d
        const original = [...d.inputs, ...d.outputs].find(
          (p) => p.id === portId && p.kind === kind,
        )
        if (!original) return d
        const port = {
          ...original,
          label: label.trim(),
          kind: nextKind,
          connectorCategory,
          connectorType,
        }
        const inputs = d.inputs.filter(
          (p) => !(p.id === portId && p.kind === kind),
        )
        const outputs = d.outputs.filter(
          (p) => !(p.id === portId && p.kind === kind),
        )
        return {
          ...d,
          inputs: nextKind === 'input' ? [...inputs, port] : inputs,
          outputs: nextKind !== 'input' ? [...outputs, port] : outputs,
        }
      })
      const next = { ...current, deviceList }
      return { ...next, connections: cleanConnections(next) }
    })
    setActivePort(null)
    return true
  }
  const handleDeletePort = (
    deviceId: string,
    portId: string,
    kind: PortKind,
  ) => {
    update((current) => {
      const next = {
        ...current,
        deviceList: current.deviceList.map((d) =>
          d.id !== deviceId
            ? d
            : {
                ...d,
                inputs: d.inputs.filter(
                  (p) => !(p.id === portId && p.kind === kind),
                ),
                outputs: d.outputs.filter(
                  (p) => !(p.id === portId && p.kind === kind),
                ),
              },
        ),
      }
      return { ...next, connections: cleanConnections(next) }
    })
    setActivePort(null)
    return true
  }
  const handleExportProject = () => {
    downloadFile(
      `${toSlug(projectTitle) || 'schema'}.json`,
      JSON.stringify(projectFile(state), null, 2),
    )
    setMessage(
      'Progetto esportato. Conserva il file per riaprirlo o trasferirlo.',
    )
  }
  const handleImportProject: ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const input = event.currentTarget,
      file = input.files?.[0]
    if (!file) return
    try {
      if (file.size > 20 * 1024 * 1024) {
        notify('Il file supera il limite di 20 MB.')
        return
      }
      const next = parseProject(JSON.parse(await file.text()))
      if (!next) {
        notify('File non valido o versione del progetto non supportata.')
        return
      }
      update(() => next)
      setActivePort(null)
      setSelectedNode(null)
      setMessage(
        'Progetto importato. Puoi annullare per tornare al precedente.',
      )
    } catch {
      notify('Impossibile leggere il file. Seleziona un progetto JSON valido.')
    } finally {
      input.value = ''
    }
  }
  const loadDemo = () => {
    const ids = ['panasonic-Aw-UE80', 'sdi-hdmi-converter', 'monitor-55']
    const demoDevices = ids.map((id) => {
      const builtin = devices.find((d) => d.id === id)!
      const existing = devicesById[id]
      return existing &&
        JSON.stringify([...existing.inputs, ...existing.outputs]) ===
          JSON.stringify([...builtin.inputs, ...builtin.outputs])
        ? existing
        : { ...builtin, id: existing ? `example-${id}` : id }
    })
    const demoNodes = demoDevices.map((d, i) => ({
      id: createId('demo'),
      deviceId: d.id,
      x: 48 + i * 400,
      y: 96,
      customName: ['Camera 01', 'Conversione SDI → HDMI', 'Monitor regia'][i],
    }))
    update((current) => ({
      ...current,
      projectTitle: 'Regia video · esempio',
      projectDescription:
        'Un flusso semplice: camera → conversione → monitor. Modifica lo schema per iniziare.',
      deviceList: [
        ...current.deviceList.filter(
          (d) => !demoDevices.some((example) => example.id === d.id),
        ),
        ...demoDevices,
      ],
      nodes: demoNodes,
      connections: [
        {
          id: createId('cable'),
          from: { nodeId: demoNodes[0].id, portId: 'sdi-out', kind: 'output' },
          to: { nodeId: demoNodes[1].id, portId: 'sdi-in', kind: 'input' },
        },
        {
          id: createId('cable'),
          from: { nodeId: demoNodes[1].id, portId: 'hdmi-out', kind: 'output' },
          to: { nodeId: demoNodes[2].id, portId: 'hdmi-in', kind: 'input' },
        },
      ],
    }))
  }

  return {
    state,
    update,
    undo,
    redo,
    endGroup,
    canUndo,
    canRedo,
    saveStatus,
    projectTitle,
    projectDescription,
    categories,
    deviceList,
    nodes,
    connections,
    isLibraryCollapsed,
    setIsLibraryCollapsed,
    activePort,
    setActivePort,
    selectedNode,
    setSelectedNode,
    message,
    setMessage,
    showClear,
    setShowClear,
    showNewProject,
    setShowNewProject,
    projectSession,
    handleNewProject,
    showHelp,
    setShowHelp,
    importInputRef,
    devicesById,
    notify,
    handleDeleteNode,
    duplicateNode,
    handleAddDevice,
    handlePortClick,
    handleCreateCategory,
    handleCreateDevice,
    addPorts,
    handleAddPort,
    handleBulkRemove,
    updateDevice,
    handleUpdatePort,
    handleDeletePort,
    handleExportProject,
    handleImportProject,
    loadDemo,
  }
}
