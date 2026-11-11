export interface Point {
  x: number
  y: number
}
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
const STEP = 24
const key = (x: number, y: number) => `${x},${y}`

// A small binary heap keeps path finding responsive on larger plans.
class Queue {
  items: {
    x: number
    y: number
    cost: number
    score: number
    direction: number
    parent?: Queue['items'][number]
  }[] = []
  push(item: Queue['items'][number]) {
    this.items.push(item)
    let i = this.items.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (this.items[p].score <= item.score) break
      this.items[i] = this.items[p]
      i = p
    }
    this.items[i] = item
  }
  pop() {
    const first = this.items[0],
      last = this.items.pop()!
    if (this.items.length) {
      let i = 0
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1
        if (
          child + 1 < this.items.length &&
          this.items[child + 1].score < this.items[child].score
        )
          child++
        if (last.score <= this.items[child].score) break
        this.items[i] = this.items[child]
        i = child
      }
      this.items[i] = last
    }
    return first
  }
}

export function createRouter(rectangles: Rect[]) {
  const blocked = new Set<string>(),
    used = new Map<string, number>()
  let maxX = 60,
    maxY = 40
  for (const rect of rectangles) {
    maxX = Math.max(maxX, Math.ceil((rect.x + rect.width) / STEP) + 6)
    maxY = Math.max(maxY, Math.ceil((rect.y + rect.height) / STEP) + 6)
    for (
      let x = Math.ceil((rect.x - 10) / STEP);
      x <= Math.floor((rect.x + rect.width + 10) / STEP);
      x++
    ) {
      for (
        let y = Math.ceil((rect.y - 10) / STEP);
        y <= Math.floor((rect.y + rect.height + 10) / STEP);
        y++
      )
        blocked.add(key(x, y))
    }
  }
  return (
    from: Point,
    to: Point,
    fromSide: number,
    toSide: number,
  ): Point[] => {
    const start = {
      x:
        fromSide > 0
          ? Math.ceil((from.x + STEP) / STEP)
          : Math.floor((from.x - STEP) / STEP),
      y: Math.round(from.y / STEP),
    }
    const end = {
      x:
        toSide > 0
          ? Math.ceil((to.x + STEP) / STEP)
          : Math.floor((to.x - STEP) / STEP),
      y: Math.round(to.y / STEP),
    }
    const queue = new Queue(),
      costs = new Map<string, number>()
    queue.push({ ...start, cost: 0, score: 0, direction: -1 })
    let found: Queue['items'][number] | undefined
    let iterations = 0
    while (queue.items.length && iterations++ < 14000) {
      const current = queue.pop()
      if (current.x === end.x && current.y === end.y) {
        found = current
        break
      }
      for (const [direction, [dx, dy]] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ].entries()) {
        const x = current.x + dx,
          y = current.y + dy,
          cell = key(x, y)
        if (
          x < 0 ||
          y < 0 ||
          x > Math.max(maxX, start.x + 6, end.x + 6) ||
          y > Math.max(maxY, start.y + 6, end.y + 6) ||
          (blocked.has(cell) && !(x === end.x && y === end.y))
        )
          continue
        const cost =
          current.cost +
          1 +
          (current.direction !== -1 && current.direction !== direction
            ? 0.65
            : 0) +
          (used.get(cell) || 0) * 1.8
        const state = `${cell},${direction}`
        if ((costs.get(state) ?? Infinity) <= cost) continue
        costs.set(state, cost)
        queue.push({
          x,
          y,
          direction,
          cost,
          score: cost + Math.abs(end.x - x) + Math.abs(end.y - y),
          parent: current,
        })
      }
    }
    const grid: Point[] = []
    for (let current = found; current; current = current.parent) {
      grid.unshift({ x: current.x * STEP, y: current.y * STEP })
      const cell = key(current.x, current.y)
      used.set(cell, (used.get(cell) || 0) + 1)
    }
    const points: Point[] = found
      ? [
          from,
          { x: start.x * STEP, y: from.y },
          ...grid,
          { x: end.x * STEP, y: to.y },
          to,
        ]
      : [
          from,
          { x: start.x * STEP, y: from.y },
          { x: start.x * STEP, y: Math.max(12, Math.min(from.y, to.y) - 48) },
          { x: end.x * STEP, y: Math.max(12, Math.min(from.y, to.y) - 48) },
          { x: end.x * STEP, y: to.y },
          to,
        ]
    return points.filter((p, i) => {
      const prev = points[i - 1],
        next = points[i + 1]
      return (
        !prev ||
        !next ||
        !(
          (p.x === prev.x && p.x === next.x) ||
          (p.y === prev.y && p.y === next.y)
        )
      )
    })
  }
}

export function roundedPath(points: Point[]) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1],
      p = points[i],
      next = points[i + 1]
    const before = Math.hypot(p.x - prev.x, p.y - prev.y),
      after = Math.hypot(next.x - p.x, next.y - p.y)
    const r = Math.min(8, before / 2, after / 2)
    if (!r) continue
    d += ` L ${p.x + ((prev.x - p.x) / before) * r} ${p.y + ((prev.y - p.y) / before) * r} Q ${p.x} ${p.y} ${p.x + ((next.x - p.x) / after) * r} ${p.y + ((next.y - p.y) / after) * r}`
  }
  const last = points[points.length - 1]
  return `${d} L ${last.x} ${last.y}`
}
