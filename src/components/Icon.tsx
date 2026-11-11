import type { CSSProperties } from 'react'

const paths = {
  diagram: 'M4 4h6v6H4z M14 14h6v6h-6z M7 10v7h7 M14 4h6v6h-6z M17 10v4',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M6 18L18 6',
  chevron: 'M9 5l7 7-7 7',
  upload: 'M12 16V3 M7 8l5-5 5 5 M4 16v5h16v-5',
  download: 'M12 3v13 M7 11l5 5 5-5 M4 16v5h16v-5',
  undo: 'M9 5L4 10l5 5 M4 10h10a6 6 0 0 1 6 6v3',
  redo: 'M15 5l5 5-5 5 M20 10H10a6 6 0 0 0-6 6v3',
  grid: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',
  fit: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M8 8h8v8H8z',
  cable:
    'M6 3v4 M10 3v4 M4 7h8v3a4 4 0 0 1-8 0z M8 14v2a4 4 0 0 0 8 0v-2 M14 10h4v4h-4z',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M7 5l10 4',
  settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  edit: 'M4 20l4-1L20 7l-3-3L5 16z M14 7l3 3',
  copy: 'M8 8h12v12H8z M16 8V4H4v12h4',
  minus: 'M5 12h14',
  sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13',
  panel: 'M3 4h18v16H3z M9 4v16',
  check: 'M5 12l4 4L19 6',
  help: 'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4 M12 17h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
} as const

export function Icon({
  name,
  size = 18,
  style,
}: {
  name: keyof typeof paths
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  )
}
