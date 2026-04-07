import type { DeviceCategory, DeviceDefinition } from '../types/schematic'

export const deviceCategories: DeviceCategory[] = [
  { id: 'audio-sources', label: 'Audio Sources' },
  { id: 'mixers', label: 'Mixers' },
  { id: 'fx', label: 'FX' },
  { id: 'playback', label: 'Playback' },
  { id: 'outputs', label: 'Outputs' },
]

export const devices: DeviceDefinition[] = [
  {
    id: 'wireless-mic-rx',
    name: 'Wireless Mic Rx',
    category: 'audio-sources',
    inputs: [],
    outputs: [
      { id: 'out-l', label: 'Out L', kind: 'output' },
      { id: 'out-r', label: 'Out R', kind: 'output' },
    ],
  },
  {
    id: 'digital-mixer',
    name: 'Digital Mixer',
    category: 'mixers',
    inputs: [
      { id: 'ch-1', label: 'Ch 1', kind: 'input' },
      { id: 'ch-2', label: 'Ch 2', kind: 'input' },
    ],
    outputs: [
      { id: 'main-l', label: 'Main L', kind: 'output' },
      { id: 'main-r', label: 'Main R', kind: 'output' },
      { id: 'aux-1', label: 'Aux 1', kind: 'output' },
    ],
  },
  {
    id: 'reverb-unit',
    name: 'Reverb Unit',
    category: 'fx',
    inputs: [{ id: 'in', label: 'In', kind: 'input' }],
    outputs: [{ id: 'out', label: 'Out', kind: 'output' }],
  },
  {
    id: 'playback-rig',
    name: 'Playback Rig',
    category: 'playback',
    inputs: [],
    outputs: [
      { id: 'track-l', label: 'Track L', kind: 'output' },
      { id: 'track-r', label: 'Track R', kind: 'output' },
      { id: 'click', label: 'Click', kind: 'output' },
    ],
  },
  {
    id: 'pa-system',
    name: 'PA System',
    category: 'outputs',
    inputs: [
      { id: 'in-l', label: 'In L', kind: 'input' },
      { id: 'in-r', label: 'In R', kind: 'input' },
    ],
    outputs: [],
  },
]
