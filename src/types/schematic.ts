export type PortKind = 'input' | 'output'

export interface PortDefinition {
  id: string
  label: string
  kind: PortKind
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
