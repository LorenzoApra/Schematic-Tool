export type PortKind = 'input' | 'output' | 'bidirectional'

export type ConnectorCategory =
  | 'video'
  | 'audio'
  | 'network'
  | 'lighting'
  | 'power'

export interface PortDefinition {
  id: string
  label: string
  kind: PortKind
  connectorCategory: ConnectorCategory
  connectorType: string
}

export interface DeviceDefinition {
  id: string
  name: string
  category: string
  inputs: PortDefinition[]
  outputs: PortDefinition[]
}

export interface DeviceCategory {
  id: string
  label: string
}

export interface NodeInstance {
  id: string
  deviceId: string
  x: number
  y: number
  customName?: string
  collapsed?: boolean
}

export interface PortRef {
  nodeId: string
  portId: string
  kind: PortKind
}

export interface Connection {
  id: string
  from: PortRef
  to: PortRef
}

export interface ValidationResult {
  valid: boolean
  error?: string
}
