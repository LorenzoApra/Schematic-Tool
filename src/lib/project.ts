import {
  defaultConnectorCategory,
  defaultConnectorType,
  connectorCatalog,
} from '../data/connectors'
import { deviceCategories, devices } from '../data/deviceLibrary'
import { validateConnection } from './validation'
import type {
  Connection,
  DeviceCategory,
  DeviceDefinition,
  NodeInstance,
  PortDefinition,
  PortRef,
} from '../types/schematic'

export const STORAGE_KEY = 'live-show-schematic-state-v1'
const CONSTELLATION_DEVICE_ID = 'tebe-constellation-2me'
export interface ProjectState {
  projectTitle: string
  projectDescription: string
  categories: DeviceCategory[]
  deviceList: DeviceDefinition[]
  nodes: NodeInstance[]
  connections: Connection[]
}
export interface ProjectExport {
  format: 'live-show-schematic-project'
  version: 1
  exportedAt: string
  state: ProjectState
}
export const toSlug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
export const createId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`
export const portKey = (port: PortRef) =>
  JSON.stringify([port.nodeId, port.kind, port.portId])
export const samePort = (a: PortRef, b: PortRef) => portKey(a) === portKey(b)

export function resolvePort(
  state: Pick<ProjectState, 'nodes' | 'deviceList'>,
  ref: PortRef,
): PortDefinition | null {
  const node = state.nodes.find((node) => node.id === ref.nodeId)
  const device = state.deviceList.find((device) => device.id === node?.deviceId)
  return device
    ? ([...device.inputs, ...device.outputs].find(
        (port) => port.id === ref.portId && port.kind === ref.kind,
      ) ?? null)
    : null
}

export function cleanConnections(state: ProjectState): Connection[] {
  const valid: Connection[] = [],
    used = new Set<string>()
  const devicePorts = new Map(
    state.deviceList.map((device) => [
      device.id,
      new Map(
        [...device.inputs, ...device.outputs].map((port) => [
          JSON.stringify([port.kind, port.id]),
          port,
        ]),
      ),
    ]),
  )
  const nodeDevices = new Map(
    state.nodes.map((node) => [node.id, node.deviceId]),
  )
  const resolve = (ref: PortRef) =>
    devicePorts
      .get(nodeDevices.get(ref.nodeId) || '')
      ?.get(JSON.stringify([ref.kind, ref.portId])) ?? null
  for (const connection of state.connections) {
    const from = portKey(connection.from),
      to = portKey(connection.to)
    if (used.has(from) || used.has(to)) continue
    if (
      validateConnection({
        source: connection.from,
        target: connection.to,
        connections: [],
        resolvePort: resolve,
      }).valid
    ) {
      valid.push(connection)
      used.add(from)
      used.add(to)
    }
  }
  return valid
}

function normalizeDeviceList(
  deviceList: DeviceDefinition[],
): DeviceDefinition[] {
  return deviceList.map((device) => ({
    ...device,
    inputs: normalizeConstellationPorts(
      device,
      device.inputs.map((port) => ({
        ...port,
        connectorCategory: port.connectorCategory ?? defaultConnectorCategory,
        connectorType: port.connectorType ?? defaultConnectorType,
      })),
    ),
    outputs: normalizeConstellationPorts(
      device,
      device.outputs.map((port) => ({
        ...port,
        connectorCategory: port.connectorCategory ?? defaultConnectorCategory,
        connectorType: port.connectorType ?? defaultConnectorType,
      })),
    ),
  }))
}

function normalizeConstellationPorts(
  device: DeviceDefinition,
  ports: DeviceDefinition['inputs'],
) {
  if (device.id !== CONSTELLATION_DEVICE_ID) return ports

  return ports.map((port) => {
    const legacyMatch = port.id.match(/^(bd-in|bd-out)-([1-4])$/)
    if (!legacyMatch) return port

    const [, baseId, number] = legacyMatch
    const connectorSuffix = port.connectorType.toLowerCase()

    return {
      ...port,
      id: `${baseId}-${connectorSuffix}-${number}`,
    }
  })
}

function getPortConnectorType(
  port: PortRef,
  nodes: NodeInstance[],
  deviceList: DeviceDefinition[],
) {
  const node = nodes.find((entry) => entry.id === port.nodeId)
  if (!node) return null
  const device = deviceList.find((entry) => entry.id === node.deviceId)
  if (!device) return null
  const ports =
    port.kind === 'input'
      ? device.inputs
      : port.kind === 'output'
        ? device.outputs
        : [...device.inputs, ...device.outputs]
  return ports.find((entry) => entry.id === port.portId)?.connectorType ?? null
}

function normalizeConstellationConnectionRef(
  port: PortRef,
  oppositePort: PortRef,
  nodes: NodeInstance[],
  deviceList: DeviceDefinition[],
): PortRef {
  const node = nodes.find((entry) => entry.id === port.nodeId)
  if (node?.deviceId !== CONSTELLATION_DEVICE_ID) return port

  const legacyMatch = port.portId.match(/^(bd-in|bd-out)-([1-4])$/)
  if (!legacyMatch) return port

  const [, baseId, number] = legacyMatch
  const oppositeConnector = getPortConnectorType(
    oppositePort,
    nodes,
    deviceList,
  )
  const connectorSuffix = oppositeConnector === 'HDMI' ? 'hdmi' : 'sdi'
  const candidatePortId = `${baseId}-${connectorSuffix}-${number}`
  const device = deviceList.find((entry) => entry.id === node.deviceId)
  const ports =
    port.kind === 'input'
      ? device?.inputs
      : port.kind === 'output'
        ? device?.outputs
        : [...(device?.inputs ?? []), ...(device?.outputs ?? [])]

  if (ports?.some((entry) => entry.id === candidatePortId)) {
    return { ...port, portId: candidatePortId }
  }

  const fallbackPort = ports?.find(
    (entry) =>
      entry.id.startsWith(`${baseId}-`) && entry.id.endsWith(`-${number}`),
  )
  return fallbackPort ? { ...port, portId: fallbackPort.id } : port
}

function normalizeConnections(
  connections: Connection[],
  nodes: NodeInstance[],
  deviceList: DeviceDefinition[],
) {
  return connections.map((connection) => ({
    ...connection,
    from: normalizeConstellationConnectionRef(
      connection.from,
      connection.to,
      nodes,
      deviceList,
    ),
    to: normalizeConstellationConnectionRef(
      connection.to,
      connection.from,
      nodes,
      deviceList,
    ),
  }))
}

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 1000
const validKind = (value: unknown) =>
  value === 'input' || value === 'output' || value === 'bidirectional'
const isRef = (value: unknown): value is PortRef =>
  record(value) &&
  nonEmpty(value.nodeId) &&
  nonEmpty(value.portId) &&
  validKind(value.kind)
const unique = (values: string[]) => new Set(values).size === values.length
const normalizeConnector = (value: string) => {
  const alias: Record<string, string> = {
    dmx5p: 'DMX 5p',
    dmx3p: 'DMX 3p',
    ethernet: 'Ethernet',
  }
  return (
    alias[value.toLowerCase()] ??
    Object.values(connectorCatalog)
      .flat()
      .find((type) => type.toLowerCase() === value.toLowerCase()) ??
    value
  )
}

export function parseProject(value: unknown): ProjectState | null {
  if (!record(value)) return null
  if (
    'format' in value &&
    (value.format !== 'live-show-schematic-project' || value.version !== 1)
  )
    return null
  const state = 'format' in value ? value.state : value
  if (
    !record(state) ||
    !Array.isArray(state.categories) ||
    !Array.isArray(state.deviceList) ||
    !Array.isArray(state.nodes) ||
    !Array.isArray(state.connections)
  )
    return null
  if (
    state.deviceList.length > 3000 ||
    state.nodes.length > 3000 ||
    state.connections.length > 30000 ||
    state.categories.length > 1000
  )
    return null
  if (
    !state.categories.every(
      (c) => record(c) && nonEmpty(c.id) && nonEmpty(c.label),
    )
  )
    return null
  const categories = state.categories as DeviceCategory[]
  if (!unique(categories.map((c) => c.id))) return null
  const validPort = (p: unknown) =>
    record(p) &&
    nonEmpty(p.id) &&
    nonEmpty(p.label) &&
    validKind(p.kind) &&
    (p.connectorCategory === undefined ||
      (typeof p.connectorCategory === 'string' &&
        Object.hasOwn(connectorCatalog, p.connectorCategory))) &&
    (p.connectorType === undefined || nonEmpty(p.connectorType))
  if (
    !state.deviceList.every(
      (d) =>
        record(d) &&
        nonEmpty(d.id) &&
        nonEmpty(d.name) &&
        nonEmpty(d.category) &&
        Array.isArray(d.inputs) &&
        Array.isArray(d.outputs) &&
        d.inputs.length + d.outputs.length <= 2000 &&
        d.inputs.every(
          (p) =>
            validPort(p) && (p.kind === 'input' || p.kind === 'bidirectional'),
        ) &&
        d.outputs.every(
          (p) =>
            validPort(p) && (p.kind === 'output' || p.kind === 'bidirectional'),
        ),
    )
  )
    return null
  const deviceList = normalizeDeviceList(
    state.deviceList as DeviceDefinition[],
  ).map((d) => ({
    ...d,
    inputs: d.inputs.map((p) => ({
      ...p,
      connectorType: normalizeConnector(p.connectorType),
      connectorCategory: (Object.entries(connectorCatalog).find(([, types]) =>
        types.includes(normalizeConnector(p.connectorType)),
      )?.[0] ?? p.connectorCategory) as PortDefinition['connectorCategory'],
    })),
    outputs: d.outputs.map((p) => ({
      ...p,
      connectorType: normalizeConnector(p.connectorType),
      connectorCategory: (Object.entries(connectorCatalog).find(([, types]) =>
        types.includes(normalizeConnector(p.connectorType)),
      )?.[0] ?? p.connectorCategory) as PortDefinition['connectorCategory'],
    })),
  }))
  if (
    !unique(deviceList.map((d) => d.id)) ||
    deviceList.some(
      (d) =>
        !unique([...d.inputs, ...d.outputs].map((p) => `${p.kind}:${p.id}`)),
    )
  )
    return null
  if (
    !state.nodes.every(
      (n) =>
        record(n) &&
        nonEmpty(n.id) &&
        deviceList.some((d) => d.id === n.deviceId) &&
        typeof n.x === 'number' &&
        Number.isFinite(n.x) &&
        n.x >= 0 &&
        n.x <= 100000 &&
        typeof n.y === 'number' &&
        Number.isFinite(n.y) &&
        n.y >= 0 &&
        n.y <= 100000 &&
        (n.customName === undefined || nonEmpty(n.customName)) &&
        (n.collapsed === undefined || typeof n.collapsed === 'boolean'),
    )
  )
    return null
  const nodes = state.nodes as NodeInstance[]
  if (!unique(nodes.map((n) => n.id))) return null
  if (
    !state.connections.every(
      (c) => record(c) && nonEmpty(c.id) && isRef(c.from) && isRef(c.to),
    )
  )
    return null
  if (!unique(state.connections.map((c) => c.id as string))) return null
  const project: ProjectState = {
    projectTitle:
      typeof state.projectTitle === 'string'
        ? state.projectTitle.slice(0, 200)
        : 'Progetto senza titolo',
    projectDescription:
      typeof state.projectDescription === 'string'
        ? state.projectDescription.slice(0, 5000)
        : '',
    categories,
    deviceList,
    nodes,
    connections: normalizeConnections(
      state.connections as Connection[],
      nodes,
      deviceList,
    ),
  }
  // Keep legacy files usable while removing routes to missing or incompatible ports.
  return { ...project, connections: cleanConnections(project) }
}

export function createDefaultProject(): ProjectState {
  return {
    projectTitle: 'Progetto senza titolo',
    projectDescription: '',
    categories: deviceCategories,
    deviceList: normalizeDeviceList(devices),
    nodes: [],
    connections: [],
  }
}
export function loadProject(): ProjectState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw
      ? (parseProject(JSON.parse(raw)) ?? createDefaultProject())
      : createDefaultProject()
  } catch {
    return createDefaultProject()
  }
}
export function projectFile(state: ProjectState): ProjectExport {
  return {
    format: 'live-show-schematic-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  }
}
export function estimateNodeHeight(
  device: DeviceDefinition,
  collapsed = false,
) {
  if (collapsed) return 96
  const all = [...device.inputs, ...device.outputs]
  const count = (kind: string) => all.filter((p) => p.kind === kind).length
  return (
    120 +
    Math.max(count('input'), count('output')) * 35 +
    (count('bidirectional') ? 32 + count('bidirectional') * 35 : 0)
  )
}
