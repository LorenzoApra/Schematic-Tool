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
  if (!['output', 'bidirectional'].includes(source.kind)) {
    return {
      valid: false,
      error: 'Parti da un’uscita o da una porta bidirezionale.',
    }
  }

  if (!['input', 'bidirectional'].includes(target.kind)) {
    return {
      valid: false,
      error:
        'Il collegamento deve terminare in un ingresso o una porta bidirezionale.',
    }
  }

  if (
    source.nodeId === target.nodeId &&
    source.portId === target.portId &&
    source.kind === target.kind
  ) {
    return { valid: false, error: 'Non puoi collegare una porta a se stessa.' }
  }

  const isPortAlreadyUsed = (port: PortRef) =>
    connections.some(
      (connection) =>
        (connection.from.nodeId === port.nodeId &&
          connection.from.portId === port.portId &&
          connection.from.kind === port.kind) ||
        (connection.to.nodeId === port.nodeId &&
          connection.to.portId === port.portId &&
          connection.to.kind === port.kind),
    )

  if (isPortAlreadyUsed(source)) {
    return {
      valid: false,
      error:
        'La porta sorgente è già collegata. Rimuovi prima il cavo esistente.',
    }
  }

  if (isPortAlreadyUsed(target)) {
    return {
      valid: false,
      error:
        'La porta di destinazione è già collegata. Rimuovi prima il cavo esistente.',
    }
  }

  const sourcePort = resolvePort(source)
  const targetPort = resolvePort(target)
  if (
    !sourcePort ||
    !targetPort ||
    sourcePort.kind !== source.kind ||
    targetPort.kind !== target.kind
  ) {
    return { valid: false, error: 'Una delle porte non è più disponibile.' }
  }

  if (
    sourcePort.connectorCategory !== targetPort.connectorCategory ||
    sourcePort.connectorType !== targetPort.connectorType
  ) {
    return {
      valid: false,
      error: `Connettori diversi: ${sourcePort.connectorType} e ${targetPort.connectorType}. Usa un convertitore compatibile.`,
    }
  }

  return { valid: true }
}
