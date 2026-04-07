import type { Connection, PortRef, ValidationResult } from '../types/schematic'

interface ValidateConnectionArgs {
  source: PortRef
  target: PortRef
  connections: Connection[]
}

export function validateConnection({
  source,
  target,
  connections,
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

  return { valid: true }
}
