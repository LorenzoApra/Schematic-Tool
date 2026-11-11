import { estimateNodeHeight } from './project'
import type {
  Connection,
  DeviceDefinition,
  NodeInstance,
} from '../types/schematic'

// Collapse feedback loops into components, then lay out the remaining signal DAG.
export function arrangeBySignal(
  nodes: NodeInstance[],
  connections: Connection[],
  devices: Record<string, DeviceDefinition>,
  measuredHeights: Record<string, number> = {},
): NodeInstance[] {
  const adjacency = new Map(nodes.map((n) => [n.id, [] as string[]]))
  connections.forEach((c) => adjacency.get(c.from.nodeId)?.push(c.to.nodeId))
  let index = 0
  const indices = new Map<string, number>(),
    low = new Map<string, number>(),
    stack: string[] = [],
    onStack = new Set<string>(),
    components: string[][] = []
  const visit = (id: string) => {
    indices.set(id, index)
    low.set(id, index++)
    stack.push(id)
    onStack.add(id)
    for (const next of adjacency.get(id) || []) {
      if (!indices.has(next)) {
        visit(next)
        low.set(id, Math.min(low.get(id)!, low.get(next)!))
      } else if (onStack.has(next))
        low.set(id, Math.min(low.get(id)!, indices.get(next)!))
    }
    if (low.get(id) === indices.get(id)) {
      const component: string[] = []
      let next: string
      do {
        next = stack.pop()!
        onStack.delete(next)
        component.push(next)
      } while (next !== id)
      components.push(component)
    }
  }
  nodes.forEach((n) => {
    if (!indices.has(n.id)) visit(n.id)
  })
  const componentByNode = new Map(
    components.flatMap((ids, i) => ids.map((id) => [id, i] as const)),
  )
  const outgoing = components.map(() => new Set<number>()),
    indegree = components.map(() => 0),
    ranks = components.map(() => 0)
  connections.forEach((c) => {
    const from = componentByNode.get(c.from.nodeId)!,
      to = componentByNode.get(c.to.nodeId)!
    if (from !== to && !outgoing[from].has(to)) {
      outgoing[from].add(to)
      indegree[to]++
    }
  })
  const queue = indegree.flatMap((degree, i) => (degree === 0 ? [i] : []))
  for (let i = 0; i < queue.length; i++)
    for (const next of outgoing[queue[i]]) {
      ranks[next] = Math.max(ranks[next], ranks[queue[i]] + 1)
      if (--indegree[next] === 0) queue.push(next)
    }
  const layers: NodeInstance[][] = []
  nodes.forEach((node) => {
    const rank = ranks[componentByNode.get(node.id)!]
    ;(layers[rank] ??= []).push(node)
  })
  const order = new Map(nodes.map((n, i) => [n.id, i]))
  for (let pass = 0; pass < 4; pass++) {
    const sequence = pass % 2 ? [...layers].reverse() : layers
    sequence.forEach((layer) => {
      const barycenter = (id: string) => {
        const linked = connections.flatMap((c) =>
          pass % 2
            ? c.from.nodeId === id
              ? [c.to.nodeId]
              : []
            : c.to.nodeId === id
              ? [c.from.nodeId]
              : [],
        )
        return linked.length
          ? linked.reduce((sum, n) => sum + (order.get(n) || 0), 0) /
              linked.length
          : order.get(id) || 0
      }
      layer.sort((a, b) => barycenter(a.id) - barycenter(b.id))
      layer.forEach((node, i) => order.set(node.id, i))
    })
  }
  const heights = layers.map((layer) =>
    layer.reduce(
      (sum, n) =>
        sum +
        (measuredHeights[n.id] ??
          estimateNodeHeight(devices[n.deviceId], n.collapsed)) +
        72,
      0,
    ),
  )
  const maxHeight = Math.max(0, ...heights)
  return layers.flatMap((layer, i) => {
    let y = 64 + (maxHeight - heights[i]) / 2
    return layer.map((n) => {
      const node = { ...n, x: 64 + i * 480, y }
      y +=
        (measuredHeights[n.id] ??
          estimateNodeHeight(devices[n.deviceId], n.collapsed)) + 72
      return node
    })
  })
}
