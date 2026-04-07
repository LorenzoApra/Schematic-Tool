import type {
  Connection,
  PortDefinition,
  PortRef,
  ValidationResult,
} from '../types/schematic'

interface ValidateConnectionArgs {
  source: PortRef
  target: PortRef
  connections: Connection[]
  resolvePort: (port: PortRef) => PortDefinition | null
}

export function validateConnection({
  source,
  target,
  connections,
  resolvePort,
}: ValidateConnectionArgs): ValidationResult {
  if (source.kind !== 'output') {
    return { valid: false, error: 'Connections must start from an output port.' }
  }

  if (target.kind !== 'input') {
    return { valid: false, error: 'Connections must end at an input port.' }
  }

  if (source.nodeId === target.nodeId && source.portId === target.portId) {
    return { valid: false, error: 'Cannot connect a port to itself.' }
  }

  const inputAlreadyUsed = connections.some(
    (connection) =>
      connection.to.nodeId === target.nodeId && connection.to.portId === target.portId,
  )

  if (inputAlreadyUsed) {
    return { valid: false, error: 'This input port already has a connection.' }
  }

  const sourcePort = resolvePort(source)
  const targetPort = resolvePort(target)
  if (!sourcePort || !targetPort) {
    return { valid: false, error: 'Could not resolve one of the ports.' }
  }

  if (
    sourcePort.connectorCategory !== targetPort.connectorCategory ||
    sourcePort.connectorType !== targetPort.connectorType
  ) {
    return {
      valid: false,
      error: `Connector mismatch: ${sourcePort.connectorType} cannot connect to ${targetPort.connectorType}.`,
    }
  }

  return { valid: true }
}
