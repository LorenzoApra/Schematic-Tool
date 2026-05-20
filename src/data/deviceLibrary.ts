import type {
  ConnectorCategory,
  DeviceCategory,
  DeviceDefinition,
  PortDefinition,
  PortKind,
} from '../types/schematic'

function port(
  id: string,
  label: string,
  kind: PortKind,
  connectorCategory: ConnectorCategory,
  connectorType: string,
): PortDefinition {
  return { id, label, kind, connectorCategory, connectorType }
}

function numberedPorts(
  prefix: string,
  count: number,
  kind: PortKind,
  connectorCategory: ConnectorCategory,
  connectorType: string,
): PortDefinition[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1
    const idPrefix = prefix.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    return port(
      `${idPrefix}-${number}`,
      `${prefix} ${number}`,
      kind,
      connectorCategory,
      connectorType,
    )
  })
}

export const deviceCategories: DeviceCategory[] = [
  { id: 'telecamere', label: 'Telecamere' },
  { id: 'switch-camere', label: 'Switch Camere' },
  { id: 'convertitori-video', label: 'Convertitori Video' },
  { id: 'media-server', label: 'Media Server' },
  { id: 'pc-portatili', label: 'PC Portatili' },
  { id: 'monitor-video', label: 'Monitor Video' },
  { id: 'mixer-grafici', label: 'Mixer Grafici' },
  { id: 'mixer-audio', label: 'Mixer Audio' },
  { id: 'mixer-luci', label: 'Mixer Luci' },
  { id: 'switch-rete', label: 'Switch Rete' },
  { id: 'controller-ptz', label: 'Controller PTZ' },
  { id: 'sending-card', label: 'Sending Card' },
  { id: 'pa', label: 'PA' },
  { id: 'dsp', label: 'DSP' },
  { id: 'stage-box', label: 'Stage Box' },

]
export const devices: DeviceDefinition[] = [
  {
    id: 'panasonic-Aw-UE80',
    name: 'Panasonic AW-UE80',
    category: 'telecamere',
    inputs: [],
    outputs: [
      port('sdi-out', 'SDI Out', 'output', 'video', 'SDI'),
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
      port('lan', 'LAN + PoE', 'bidirectional', 'network', 'Ethernet + PoE'),
    ],
  },
    {
    id: 'panasonic-Aw-UE40',
    name: 'Panasonic AW-UE40',
    category: 'telecamere',
    inputs: [],
    outputs: [
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
      port('lan', 'LAN + PoE', 'bidirectional', 'network', 'Ethernet + PoE'),
    ],
  },
  {
    id: 'tebe-constellation-2me',
    name: 'Tebe - Constellation 2ME',
    category: 'switch-camere',
    inputs: [
      ...numberedPorts('SDI In', 16, 'input', 'video', 'SDI'),
      ...numberedPorts('BD In', 4, 'input', 'video', 'SDI'),
      ...numberedPorts('BD In', 3, 'input', 'video', 'HDMI'),
      ...numberedPorts('Opt In', 4, 'input', 'video', 'SDI'),
      
    ],
    outputs: [
      ...numberedPorts('SDI Out', 12, 'output', 'video', 'SDI'),
      ...numberedPorts('Monitor Out', 2, 'output', 'video', 'HDMI'),
      ...numberedPorts('BD Out', 3, 'output', 'video', 'SDI'),
      ...numberedPorts('BD Out', 4, 'output', 'video', 'HDMI'),
      ...numberedPorts('Opt Out', 4, 'output', 'video', 'SDI'),
      ...numberedPorts('Optical', 4, 'bidirectional', 'video', 'Optical Video'),
      port('controllo', 'LAN Control', 'bidirectional', 'network', 'Ethernet'),
      port('network', 'Network', 'bidirectional', 'network', 'Ethernet'),
    ],
  },
  {
    id: 'bmd-optical-converter',
    name: 'BMD Optical Converter',
    category: 'convertitori-video',
    inputs: [
      port('optical', 'Optical', 'bidirectional', 'video', 'Optical Video'),
      port('sdi-in', 'SDI In', 'input', 'video', 'SDI'),
    ],
    outputs: [
      port('sdi-out', 'SDI Out', 'output', 'video', 'SDI'),
    ],
  },
  {
    id: 'hdmi-sdi-converter',
    name: 'HDMI --> SDI Converter',
    category: 'convertitori-video',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),
    ],
    outputs: [
      ...numberedPorts('sdi-out', 2, 'output', 'video', 'SDI'),
    ],
  },

{
    id: 'sdi-hdmi-converter',
    name: 'SDI --> HDMI Converter',
    category: 'convertitori-video',
    inputs: [
      port('sdi-in', 'SDI In', 'input', 'video', 'SDI'),
    ],
    outputs: [
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
      port('sdi-loop', 'SDI Loop', 'output', 'video', 'SDI'),

    ],
  },

  {
    id: 'bmd-bidirectional',
    name: 'BMD Bidirectional',
    category: 'convertitori-video',
    inputs: [
      port('sdi-in', 'SDI In', 'input', 'video', 'SDI'),
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),
    ],
    outputs: [
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
      port('sdi-out', 'SDI Out', 'output', 'video', 'SDI'),
    ],
  },


  {
    id: 'usb-c-hdmi-converter',
    name: 'USB-C --> HDMI Converter',
    category: 'convertitori-video',
    inputs: [
      port('usb-c', 'USB-C', 'input', 'video', 'Thunderbolt'),
    ],
    outputs: [
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
    ],
  },
{
    id: 'displayport-hdmi-converter',
    name: 'DisplayPort --> HDMI Converter',
    category: 'convertitori-video',
    inputs: [
      port('displayport', 'DisplayPort', 'input', 'video', 'DisplayPort'),
    ],
    outputs: [
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
    ],
  },

  {
    id: 'media-server-msi',
    name: 'MSI Media Server',
    category: 'media-server',
    inputs: [
      ...numberedPorts('SDI in', 4, 'input', 'video', 'SDI'),
    ],
    outputs: [
      ...numberedPorts('DisplayPort Out', 4, 'output', 'video', 'DisplayPort'),    ],
  },

  {
    id: 'media-server-lenovo',
    name: 'Lenovo Media Server',
    category: 'media-server',
    inputs: [
      ...numberedPorts('SDI in', 4, 'input', 'video', 'SDI'),
    ],
    outputs: [
      ...numberedPorts('DisplayPort Out', 3, 'output', 'video', 'DisplayPort'),
      port('usb-c', 'USB-C', 'output', 'video', 'Thunderbolt'),
    ],
  },

  {
    id: 'pc-initia',
    name: 'PC Initia',
    category: 'pc-portatili',
    inputs: [
      port('lan', 'LAN', 'bidirectional', 'network', 'Ethernet'),
    ],
    outputs: [
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
      port('usb-c', 'USB-C', 'output', 'video', 'Thunderbolt'),
    ],
  },

   {
    id: 'pc-hp-255-g8',
    name: 'PC HP 255 G8',
    category: 'pc-portatili',
    inputs: [],
    outputs: [
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
    ],
  },

  {
    id: 'pc-hp-zbook-fury-16',
    name: 'PC HP ZBook Fury 16',
    category: 'pc-portatili',
    inputs: [],
    outputs: [
      port('hdmi-out', 'HDMI Out', 'output', 'video', 'HDMI'),
      port('mini-dp', 'mini DisplayPort', 'output', 'video', 'Thunderbolt'),
    ],
  },

    {
    id: 'monitor-19',
    name: 'monitor 19"',
    category: 'monitor-video',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),    ],
    outputs: [],
  },

  {
    id: 'monitor-24',
    name: 'monitor 24"',
    category: 'monitor-video',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),    ],
    outputs: [],
  },
{
    id: 'monitor-32',
    name: 'monitor 32"',
    category: 'monitor-video',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),    ],
    outputs: [],
  },
  {
    id: 'monitor-55',
    name: 'monitor 55"',
    category: 'monitor-video',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),    ],
    outputs: [],
  },
  {
    id: 'monitor-65',
    name: 'monitor 65"',
    category: 'monitor-video',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),    ],
    outputs: [],
  },
  {
    id: 'monitor-75',
    name: 'monitor 75"',
    category: 'monitor-video',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),    ],
    outputs: [],
  },

  {
    id: 'BMD-Smartwiew-4K',
    name: 'Multiview Monitor',
    category: 'monitor-video',
    inputs: [
      ...numberedPorts('SDI in', 2, 'input', 'video', 'SDI'),
      port('opt-in', 'OPT In', 'input', 'video', 'Optical Video'),
    ],
    outputs: [
      port('loop-out', 'SDI Loop Out', 'output', 'video', 'SDI'),
    ],
  },
  {
    id: 'MCTRL-4K',
    name: 'MCTRL 4K',
    category: 'sending-card',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),
      port('dp-in', 'DisplayPort In', 'input', 'video', 'DisplayPort'),
      port('lan-control', 'LAN Control', 'bidirectional', 'network', 'Ethernet'),
    ],
    outputs: [],
    },

      {
    id: 'MCTRL-660Pro',
    name: 'MCTRL 660 Pro',
    category: 'sending-card',
    inputs: [
      port('hdmi-in', 'HDMI In', 'input', 'video', 'HDMI'),
      port('sdi-in', 'SDI In', 'input', 'video', 'SDI'),
      port('lan-control', 'LAN Control', 'bidirectional', 'network', 'Ethernet'),
    ],
    outputs: [],
  },

  {
    id: 'coex-mx-30',
    name: 'Coex Mx 30',
    category: 'sending-card',
    inputs: [
      ...numberedPorts('HDMI in', 2, 'input', 'video', 'HDMI'),
      ...numberedPorts('SDI in', 2, 'input', 'video', 'SDI'),
      port('dp-in', 'DisplayPort In', 'input', 'video', 'DisplayPort'),

      port('lan-control', 'LAN Control', 'bidirectional', 'network', 'Ethernet'),
    ],
    outputs: [
      ...numberedPorts('HDMI Loop', 2, 'output', 'video', 'HDMI'), 
      ...numberedPorts('SDI Loop', 2, 'output', 'video', 'SDI'),
    ],
  },  

  
  
  {
    id: 'mikrotik-24p-poe',
    name: 'Mikrotik 24p PoE',
    category: 'switch-rete',
    inputs: [],
    outputs: [
      ...numberedPorts('LAN', 24, 'bidirectional', 'network', 'Ethernet + PoE'),
      ...numberedPorts('SFP', 4, 'bidirectional', 'network', 'SFP'),
    ],
  },

   {
    id: 'mikrotik-8p-poe',
    name: 'Mikrotik 8p PoE',
    category: 'switch-rete',
    inputs: [],
    outputs: [
      ...numberedPorts('LAN', 8, 'bidirectional', 'network', 'Ethernet + PoE'),
      ...numberedPorts('SFP', 4, 'bidirectional', 'network', 'SFP'),
    ],
  },

    {
    id: 'switch-greengo-5p',
    name: 'Switch Greengo 5p',
    category: 'switch-rete',
    inputs: [],
    outputs: [
      ...numberedPorts('LAN', 4, 'bidirectional', 'network', 'Ethernet + PoE'),
      port('Lan5', 'Lan 5', 'bidirectional', 'network', 'Ethernet'),
    ],
  },
  {
    id: 'Panasonic AW-RP60',
    name: 'Panasonic AW-RP60',
    category: 'controller-ptz',
    inputs: [
      port('lan', 'LAN Control', 'bidirectional', 'network', 'Ethernet + PoE'),],
    outputs: [],
  },

{
    id: 'pixelhue-p80',
    name: 'PixelHue P80',
    category: 'mixer-grafici',
    inputs: [
      ...numberedPorts('SDI In', 4, 'input', 'video', 'SDI'),
      ...numberedPorts('Hdmi In', 12, 'input', 'video', 'HDMI'),
      ...numberedPorts('DisplayPort In', 6, 'input', 'video', 'DisplayPort'),      
    ],
    outputs: [
      ...numberedPorts('Main Out', 8, 'output', 'video', 'HDMI'),
      ...numberedPorts('Flex Out', 4, 'output', 'video', 'HDMI'),
      ...numberedPorts('SDI Out', 4, 'output', 'video', 'SDI'),
      ...numberedPorts('MVR', 2, 'output', 'video', 'HDMI'),
      ...numberedPorts('Controllo', 2, 'bidirectional', 'video', 'Ethernet'),
      port('dante-primary', 'Dante Primary', 'bidirectional', 'network', 'Ethernet'),
      port('dante-secondary', 'Dante Secondary', 'bidirectional', 'network', 'Ethernet'),    ],
  },

  {
    id: 'Yamaha-CL5',
    name: 'Yamaha CL5',
    category: 'mixer-audio',
    inputs: [
      ...numberedPorts('OMNI In', 8, 'input', 'audio', 'XLR'),
      port('dante-primary', 'Dante Primary', 'bidirectional', 'network', 'Ethernet'),
      port('dante-secondary', 'Dante Secondary', 'bidirectional', 'network', 'Ethernet'),
    ],
    outputs: [
      ...numberedPorts('OMNI Out', 8, 'output', 'audio', 'XLR'),
    ],
  },
  {
    id: 'rio1608-d2',
    name: 'RIO 1608-D2',
    category: 'stage-box',
    inputs: [
      ...numberedPorts('XLR In', 16, 'input', 'audio', 'XLR'),
    ],
    outputs: [
      ...numberedPorts('XLR Out', 8, 'output', 'audio', 'XLR'),
      port('dante-primary', 'Dante Primary', 'bidirectional', 'network', 'Ethernet'),
      port('dante-secondary', 'Dante Secondary', 'bidirectional', 'network', 'Ethernet'),
    ],
  },

   {
    id: 'rio3224',
    name: 'RIO 3224',
    category: 'stage-box',
    inputs: [
      ...numberedPorts('XLR In', 32, 'input', 'audio', 'XLR'),
    ],
    outputs: [
      ...numberedPorts('XLR Out', 24, 'output', 'audio', 'XLR'),
      port('dante-primary', 'Dante Primary', 'bidirectional', 'network', 'Ethernet'),
      port('dante-secondary', 'Dante Secondary', 'bidirectional', 'network', 'Ethernet'),
    ],
  },

  {
    id: 'Midas-m32-full',
    name: 'Midas M32 Full',
    category: 'mixer-audio',
    inputs: [
      ...numberedPorts('XLR In', 32, 'input', 'audio', 'XLR'),
      port('AES-50-A', 'AES 50 A', 'bidirectional', 'audio', 'AES50'),
      port('AES-50-B', 'AES 50 B', 'bidirectional', 'audio', 'AES50'),
      port('control', 'Control', 'bidirectional', 'network', 'Ethernet'),
    ],
    outputs: [
      ...numberedPorts('XLR Out', 16, 'output', 'audio', 'XLR'),
    ],
  },
 
   {
    id: 'Midas-m32-r',
    name: 'Midas M32 R',
    category: 'mixer-audio',
    inputs: [
      ...numberedPorts('XLR In', 16, 'input', 'audio', 'XLR'),
      port('AES-50-A', 'AES 50 A', 'bidirectional', 'audio', 'AES50'),
      port('AES-50-B', 'AES 50 B', 'bidirectional', 'audio', 'AES50'),
      port('control', 'Control', 'bidirectional', 'network', 'Ethernet'),

    ],
    outputs: [
      ...numberedPorts('XLR Out', 8, 'output', 'audio', 'XLR'),
    ],
  },

  {
    id: 'ma3-light',
    name: 'MA 3 Light',
    category: 'mixer-luci',
    inputs: [
      port('dmx-in', 'DMX In', 'input', 'lighting', 'dmx5p'),

    ],
    outputs: [
      ...numberedPorts('DMX Out', 6, 'output', 'lighting', 'dmx5p'),
      ...numberedPorts('net', 3, 'bidirectional', 'network', 'ethernet'),

    ],
  },

  {
    id: 'ma3-full',
    name: 'MA 3 Full',
    category: 'mixer-luci',
    inputs: [
      port('dmx-in', 'DMX In', 'input', 'lighting', 'dmx5p'),

    ],
    outputs: [
      ...numberedPorts('DMX Out', 6, 'output', 'lighting', 'dmx5p'),
      ...numberedPorts('net', 3, 'bidirectional', 'network', 'ethernet'),

    ],
  },

  {
    id: 'DB-vio',
    name: 'DB Vio',
    category: 'pa',
    inputs: [
      port('audio-in', 'Audio In', 'input', 'audio', 'XLR'),
      port('rdnet-in', 'RDNet In', 'input', 'audio', 'RDNet'),

    ],
    outputs: [
      port('audio-out', 'Audio Out', 'output', 'audio', 'XLR'),
      port('rdnet-out', 'RDNet Out', 'output', 'audio', 'RDNet'),

    ],
  },

   {
    id: 'db-control-8',
    name: 'DB Control 8',
    category: 'pa',
    inputs: [
      ...numberedPorts('RDnet In', 8, 'input', 'audio', 'RDNet'),

    ],
    outputs: [
            port('controll', 'controll', 'bidirectional', 'network', 'ethernet'),


    ],
  },

  {
    id: 'dl32',
    name: 'Midas DL32',
    category: 'stage-box',
    inputs: [
      ...numberedPorts('XLR In', 32, 'input', 'audio', 'XLR'),
    ],
    outputs: [
      ...numberedPorts('XLR Out', 16, 'output', 'audio', 'XLR'),
      port('AES-50-A', 'AES 50 A', 'bidirectional', 'audio', 'AES50'),
      port('AES-50-B', 'AES 50 B', 'bidirectional', 'audio', 'AES50'),
    ],
  },

  /*{
    id: 'prodigy-mp',
    name: 'DirectOut Prodigy MP',
    category: 'dsp',
    inputs: [
      ...numberedPorts('XLR In', 32, 'input', 'audio', 'XLR'),
    ],
    outputs: [
      ...numberedPorts('XLR Out', 16, 'output', 'audio', 'XLR'),
      port('AES-50-A', 'AES 50 A', 'bidirectional', 'audio', 'AES50'),
      port('AES-50-B', 'AES 50 B', 'bidirectional', 'audio', 'AES50'),
    ],
  },*/
  
]
