import type { ConnectorCategory } from '../types/schematic'

export const connectorCatalog: Record<ConnectorCategory, string[]> = {
  video: [
    'SDI',
    'HDMI',
    'DisplayPort',
    'NDI',
    'Thunderbolt',
    'IP2110',
    'Optical Video',
  ],
  audio: [
    'XLR',
    'Jack TRS',
    'Jack TS',
    'RCA',
    'Dante',
    'AES/EBU',
    'MADI',
    'AES50',
  ],
  network: ['Ethernet', 'Ethernet + PoE', 'SFP', 'MPO'],
  lighting: ['DMX 5p', 'DMX 3p', 'ArtNet', 'sACN'],
  power: [
    'CEE 16 Mono',
    'CEE 32 Mono',
    'CEE 16 Penta',
    'CEE 32 Penta',
    'CEE 63 Penta',
    'CEE 125 Penta',
    'Powerlock 90mmq',
    'Powerlock 120mmq',
    'Socapex',
    'Civile Shuko',
    'Civile Ita',
    'Mazzeri',
  ],
}

export const connectorCategoryLabels: Record<ConnectorCategory, string> = {
  video: 'Video',
  audio: 'Audio',
  network: 'Network',
  lighting: 'Lighting',
  power: 'Power',
}

export const defaultConnectorCategory: ConnectorCategory = 'audio'
export const defaultConnectorType = connectorCatalog[defaultConnectorCategory][0]
