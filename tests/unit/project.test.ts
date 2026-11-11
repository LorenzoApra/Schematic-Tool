import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDefaultProject,
  parseProject,
  projectFile,
  cleanConnections,
  resolvePort,
} from '../../src/lib/project'
import { validateConnection } from '../../src/lib/validation'
import { arrangeBySignal } from '../../src/lib/layout'
import { createRouter } from '../../src/lib/routing'
import { csvCell } from '../../src/lib/csv'

function fixture() {
  const state = createDefaultProject()
  state.nodes = [
    { id: 'camera', deviceId: 'panasonic-Aw-UE80', x: 24, y: 24 },
    { id: 'converter', deviceId: 'sdi-hdmi-converter', x: 480, y: 24 },
  ]
  state.connections = [
    {
      id: 'one',
      from: { nodeId: 'camera', portId: 'sdi-out', kind: 'output' },
      to: { nodeId: 'converter', portId: 'sdi-in', kind: 'input' },
    },
  ]
  return state
}
test('project files round-trip and legacy raw state remains supported', () => {
  const state = fixture()
  assert.deepEqual(parseProject(projectFile(state)), state)
  assert.deepEqual(parseProject(state), state)
})
test('malformed files, future versions, duplicate IDs and invalid positions are rejected without throwing', () => {
  const state = fixture()
  for (const value of [
    null,
    [],
    {},
    { ...state, deviceList: [null] },
    { ...state, nodes: [{ ...state.nodes[0], x: -1 }] },
    { ...state, nodes: [state.nodes[0], state.nodes[0]] },
    { ...projectFile(state), version: 2 },
    { ...state, connections: [{ id: 'bad', from: null }] },
  ])
    assert.equal(parseProject(value), null)
})
test('deleting a port removes dangling routes; renaming its label preserves them', () => {
  const state = fixture()
  const device = state.deviceList.find((d) => d.id === state.nodes[0].deviceId)!
  device.outputs = device.outputs.map((p) => ({
    ...p,
    label: 'Camera custom label',
  }))
  assert.equal(cleanConnections(state).length, 1)
  device.outputs = []
  assert.equal(cleanConnections(state).length, 0)
})
test('forged directions, occupied ports and connector mismatches are refused', () => {
  const state = fixture(),
    connection = state.connections[0]
  const check = (
    source = connection.from,
    target = connection.to,
    connections = state.connections,
  ) =>
    validateConnection({
      source,
      target,
      connections,
      resolvePort: (p) => resolvePort(state, p),
    }).valid
  assert.equal(check(), false)
  assert.equal(check(connection.from, connection.to, []), true)
  assert.equal(
    check({ ...connection.from, kind: 'input' }, connection.to, []),
    false,
  )
  assert.equal(
    check({ ...connection.from, portId: 'hdmi-out' }, connection.to, []),
    false,
  )
})
test('routing detours around obstacles and consists of orthogonal segments', () => {
  const obstacle = { x: 240, y: 48, width: 200, height: 240 }
  const route = createRouter([obstacle])(
    { x: 100, y: 150 },
    { x: 600, y: 150 },
    1,
    -1,
  )
  assert.ok(route.length > 4)
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i]
    assert.ok(a.x === b.x || a.y === b.y)
    const intersects =
      a.x === b.x
        ? a.x > obstacle.x &&
          a.x < obstacle.x + obstacle.width &&
          Math.max(a.y, b.y) > obstacle.y &&
          Math.min(a.y, b.y) < obstacle.y + obstacle.height
        : a.y > obstacle.y &&
          a.y < obstacle.y + obstacle.height &&
          Math.max(a.x, b.x) > obstacle.x &&
          Math.min(a.x, b.x) < obstacle.x + obstacle.width
    assert.equal(intersects, false)
  }
})
test('auto-layout follows signal direction and remains finite for feedback loops', () => {
  const state = fixture(),
    devices = Object.fromEntries(state.deviceList.map((d) => [d.id, d]))
  const layout = arrangeBySignal(state.nodes, state.connections, devices)
  assert.ok(
    layout.find((n) => n.id === 'camera')!.x <
      layout.find((n) => n.id === 'converter')!.x,
  )
  const feedback = {
    id: 'two',
    from: state.connections[0].to,
    to: state.connections[0].from,
  }
  const cyclic = arrangeBySignal(
    state.nodes,
    [...state.connections, feedback],
    devices,
  )
  assert.equal(cyclic.length, 2)
  assert.ok(cyclic.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)))
  assert.notEqual(cyclic[0].y, cyclic[1].y)
})
test('CSV escapes quotes and neutralizes formulas in user labels', () => {
  assert.equal(csvCell('Camera "A"'), '"Camera ""A"""')
  assert.equal(csvCell('=1+1'), '"\'=1+1"')
})

test('legacy network aliases and Constellation references migrate to compatible ports', () => {
  const state = createDefaultProject()
  state.nodes = [
    { id: 'camera', deviceId: 'panasonic-Aw-UE80', x: 24, y: 24 },
    { id: 'switch', deviceId: 'tebe-constellation-2me', x: 480, y: 24 },
  ]
  state.connections = [
    {
      id: 'legacy',
      from: { nodeId: 'camera', portId: 'sdi-out', kind: 'output' },
      to: { nodeId: 'switch', portId: 'bd-in-1', kind: 'input' },
    },
  ]
  const migrated = parseProject(state)!
  assert.equal(migrated.connections[0].to.portId, 'bd-in-sdi-1')
  const camera = state.deviceList.find((d) => d.id === 'panasonic-Aw-UE80')!
  camera.outputs = camera.outputs.map((p) =>
    p.id === 'lan'
      ? { ...p, connectorType: 'ethernet', connectorCategory: 'video' }
      : p,
  )
  const network = parseProject(state)!
    .deviceList.find((d) => d.id === camera.id)!
    .outputs.find((p) => p.id === 'lan')!
  assert.equal(network.connectorType, 'Ethernet')
  assert.equal(network.connectorCategory, 'network')
})
