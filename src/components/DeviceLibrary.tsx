import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { Modal } from './Modal'
import {
  connectorCatalog,
  connectorCategoryLabels,
  defaultConnectorCategory,
  defaultConnectorType,
} from '../data/connectors'
import type {
  ConnectorCategory,
  DeviceCategory,
  DeviceDefinition,
  PortKind,
} from '../types/schematic'

interface DeviceLibraryProps {
  hidden?: boolean
  onClose: () => void
  categories: DeviceCategory[]
  devices: DeviceDefinition[]
  onAddDevice: (deviceId: string) => void
  onCreateCategory: (label: string) => boolean
  onCreateDevice: (name: string, categoryId: string) => boolean
  onAddPort: (
    deviceId: string,
    kind: PortKind,
    label: string,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ) => boolean
  onBulkAddPorts: (
    deviceId: string,
    kind: PortKind,
    labelPrefix: string,
    count: number,
    startIndex: number,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ) => boolean
  onBulkRemovePorts: (
    deviceId: string,
    kind: PortKind,
    labelPrefix: string,
    count: number,
    connectorCategory: ConnectorCategory,
    connectorType: string,
  ) => boolean
  onUpdateCategory: (categoryId: string, nextLabel: string) => boolean
  onDeleteCategory: (categoryId: string) => boolean
  onUpdateDevice: (
    deviceId: string,
    nextName: string,
    nextCategoryId: string,
  ) => boolean
  onMoveDevice: (deviceId: string, nextCategoryId: string) => boolean
  onDeleteDevice: (deviceId: string) => boolean
  onUpdatePort: (
    deviceId: string,
    portId: string,
    portKind: PortKind,
    nextLabel: string,
    nextKind: PortKind,
    nextConnectorCategory: ConnectorCategory,
    nextConnectorType: string,
  ) => boolean
  onDeletePort: (
    deviceId: string,
    portId: string,
    portKind: PortKind,
  ) => boolean
  onResetLibraryToDefaults: () => void
}

export function DeviceLibrary({
  hidden,
  onClose,
  categories,
  devices,
  onAddDevice,
  onCreateCategory,
  onCreateDevice,
  onAddPort,
  onBulkAddPorts,
  onBulkRemovePorts,
  onUpdateCategory,
  onDeleteCategory,
  onUpdateDevice,
  onMoveDevice,
  onDeleteDevice,
  onUpdatePort,
  onDeletePort,
  onResetLibraryToDefaults,
}: DeviceLibraryProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({ telecamere: true })
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [newDeviceName, setNewDeviceName] = useState('')
  const [newDeviceCategory, setNewDeviceCategory] = useState('')
  const [portDeviceId, setPortDeviceId] = useState('')
  const [portLabel, setPortLabel] = useState('')
  const [portKind, setPortKind] = useState<PortKind>('input')
  const [portConnectorCategory, setPortConnectorCategory] =
    useState<ConnectorCategory>(defaultConnectorCategory)
  const [portConnectorType, setPortConnectorType] =
    useState(defaultConnectorType)

  const [bulkDeviceId, setBulkDeviceId] = useState('')
  const [bulkPortKind, setBulkPortKind] = useState<PortKind>('input')
  const [bulkPrefix, setBulkPrefix] = useState('')
  const [bulkQuantità, setBulkQuantità] = useState('16')
  const [bulkStartIndex, setBulkStartIndex] = useState('1')
  const [bulkConnectorCategory, setBulkConnectorCategory] =
    useState<ConnectorCategory>(defaultConnectorCategory)
  const [bulkConnectorType, setBulkConnectorType] =
    useState(defaultConnectorType)

  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [editingCategoryLabel, setEditingCategoryLabel] = useState('')

  const [editingDeviceId, setEditingDeviceId] = useState('')
  const [editingDeviceName, setEditingDeviceName] = useState('')

  const [editingPortKey, setEditingPortKey] = useState('')
  const [editingPortLabel, setEditingPortLabel] = useState('')
  const [editingPortKind, setEditingPortKind] = useState<PortKind>('input')
  const [editingPortConnectorCategory, setEditingPortConnectorCategory] =
    useState<ConnectorCategory>(defaultConnectorCategory)
  const [editingPortConnectorType, setEditingPortConnectorType] =
    useState(defaultConnectorType)
  const [isManageDevicesOpen, setIsManageDevicesOpen] = useState(true)
  const [expandedDevices, setExpandedDevices] = useState<
    Record<string, boolean>
  >({})

  const hasCategories = categories.length > 0
  const hasDevices = devices.length > 0

  const sortedDevices = useMemo(
    () => [...devices].sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  )
  const categoryIds = useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories],
  )
  const uncategorizedDevices = devices.filter(
    (device) => !categoryIds.has(device.category),
  )
  const visibleCategories =
    uncategorizedDevices.length > 0
      ? [...categories, { id: '__uncategorized', label: 'Senza categoria' }]
      : categories
  const normalizedSearch = librarySearch.trim().toLocaleLowerCase()
  const isSearching = normalizedSearch.length > 0
  const visibleCategoryGroups = visibleCategories
    .map((category) => {
      const categoryDevices =
        category.id === '__uncategorized'
          ? uncategorizedDevices
          : devices.filter((device) => device.category === category.id)
      const categoryMatches = category.label
        .toLocaleLowerCase()
        .includes(normalizedSearch)
      const matchingDevices = isSearching
        ? categoryDevices.filter((device) => {
            const searchableText = [
              device.name,
              ...device.inputs.map((port) => port.label),
              ...device.outputs.map((port) => port.label),
              ...device.inputs.map((port) => port.connectorType),
              ...device.outputs.map((port) => port.connectorType),
            ]
              .join(' ')
              .toLocaleLowerCase()

            return categoryMatches || searchableText.includes(normalizedSearch)
          })
        : categoryDevices

      return {
        category,
        devices: matchingDevices,
        totalDevices: categoryDevices.length,
      }
    })
    .filter(({ category, devices }) => {
      if (!isSearching) return true
      return (
        category.label.toLocaleLowerCase().includes(normalizedSearch) ||
        devices.length > 0
      )
    })
  const hasSearchResults = visibleCategoryGroups.some(
    ({ devices }) => devices.length > 0,
  )

  return (
    <aside className="library-panel" hidden={hidden}>
      <div className="library-heading">
        <div>
          <span className="eyebrow">IL TUO INVENTARIO</span>
          <h2>Libreria dispositivi</h2>
        </div>
        <span className="count-badge">{devices.length}</span>
        <button
          type="button"
          className="icon-button library-close"
          onClick={onClose}
          aria-label="Chiudi libreria"
        >
          <Icon name="close" size={17} />
        </button>
      </div>
      <div className="library-search">
        <Icon name="search" size={17} />
        <input
          value={librarySearch}
          onChange={(event) => setLibrarySearch(event.target.value)}
          placeholder="Dispositivi, porte, connettori…"
          aria-label="Cerca nella libreria"
        />
        {librarySearch ? (
          <button
            type="button"
            aria-label="Cancella ricerca"
            onClick={() => setLibrarySearch('')}
          >
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>
      {visibleCategoryGroups.map(
        ({ category, devices: categoryDevices, totalDevices }) => {
          const isExpanded =
            isSearching || (expandedCategories[category.id] ?? false)
          return (
            <section key={category.id} className="library-category">
              <button
                type="button"
                className="library-category-toggle"
                disabled={isSearching}
                onClick={() =>
                  setExpandedCategories((current) => ({
                    ...current,
                    [category.id]: !(current[category.id] ?? false),
                  }))
                }
                aria-expanded={isExpanded}
              >
                <span>
                  <Icon
                    name="chevron"
                    size={14}
                    style={{
                      transform: isExpanded ? 'rotate(90deg)' : undefined,
                    }}
                  />
                </span>
                <strong>{category.label}</strong>
                <small>
                  {isSearching
                    ? `${categoryDevices.length}/${totalDevices}`
                    : totalDevices}
                </small>
              </button>
              {isExpanded ? (
                <div className="library-grid">
                  {categoryDevices.map((device) => (
                    <button
                      key={device.id}
                      type="button"
                      className="library-device"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          'application/x-schematic-device',
                          device.id,
                        )
                        event.dataTransfer.setData('text/plain', device.id)
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                      title={`Aggiungi ${device.name} allo schema`}
                      onClick={() => onAddDevice(device.id)}
                    >
                      <span className="library-device-icon">
                        <Icon name="box" size={17} />
                      </span>
                      <span className="library-device-info">
                        <strong>{device.name}</strong>
                        <small>
                          {
                            [...device.inputs, ...device.outputs].filter(
                              (p) => p.kind === 'input',
                            ).length
                          }{' '}
                          in ·{' '}
                          {
                            [...device.inputs, ...device.outputs].filter(
                              (p) => p.kind === 'output',
                            ).length
                          }{' '}
                          out ·{' '}
                          {
                            [...device.inputs, ...device.outputs].filter(
                              (p) => p.kind === 'bidirectional',
                            ).length
                          }{' '}
                          bi
                        </small>
                      </span>
                      <span className="add-device-icon">
                        <Icon name="plus" size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          )
        },
      )}
      {isSearching && !hasSearchResults ? (
        <p className="library-empty">
          Nessun dispositivo corrisponde alla ricerca.
        </p>
      ) : null}

      <div className="library-footer">
        <p>
          Fai clic per aggiungere.
          <br />
          Trascina per scegliere la posizione.
        </p>
        <button
          type="button"
          className="open-manager-button"
          onClick={() => setIsManagerOpen(true)}
        >
          <Icon name="settings" size={17} /> Gestisci libreria
        </button>
      </div>

      {isManagerOpen ? (
        <Modal
          title="Gestisci libreria"
          onClose={() => setIsManagerOpen(false)}
          wide
        >
          <div className="library-manager">
            <div className="manager-reset-panel">
              <div>
                <strong>Libreria iniziale</strong>
                <small>
                  Ripristina i dispositivi iniziali e svuota lo schema. Puoi
                  annullare l’operazione.
                </small>
              </div>
              <button type="button" onClick={onResetLibraryToDefaults}>
                Ripristina libreria
              </button>
            </div>

            <form
              className="manager-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (onCreateCategory(newCategoryLabel)) setNewCategoryLabel('')
              }}
            >
              <strong>Nuova categoria</strong>
              <input
                aria-label="Nome nuova categoria"
                value={newCategoryLabel}
                onChange={(event) => setNewCategoryLabel(event.target.value)}
                placeholder="Nome categoria"
              />
              <button type="submit">Crea categoria</button>
            </form>

            <form
              className="manager-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (onCreateDevice(newDeviceName, newDeviceCategory))
                  setNewDeviceName('')
              }}
            >
              <strong>Nuovo dispositivo</strong>
              <input
                aria-label="Nome nuovo dispositivo"
                value={newDeviceName}
                onChange={(event) => setNewDeviceName(event.target.value)}
                placeholder="Nome dispositivo"
              />
              <select
                aria-label="Categoria nuovo dispositivo"
                value={newDeviceCategory}
                onChange={(event) => setNewDeviceCategory(event.target.value)}
                disabled={!hasCategories}
              >
                <option value="">Scegli categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={!hasCategories}>
                Crea dispositivo
              </button>
            </form>

            <form
              className="manager-form"
              onSubmit={(event) => {
                event.preventDefault()
                if (
                  onAddPort(
                    portDeviceId,
                    portKind,
                    portLabel,
                    portConnectorCategory,
                    portConnectorType,
                  )
                ) {
                  setPortLabel('')
                }
              }}
            >
              <strong>Nuova porta</strong>
              <select
                aria-label="Dispositivo per la nuova porta"
                value={portDeviceId}
                onChange={(event) => setPortDeviceId(event.target.value)}
                disabled={!hasDevices}
              >
                <option value="">Scegli dispositivo</option>
                {sortedDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Direzione nuova porta"
                value={portKind}
                onChange={(event) =>
                  setPortKind(event.target.value as PortKind)
                }
              >
                <option value="input">Ingresso</option>
                <option value="output">Uscita</option>
                <option value="bidirectional">Bidirezionale</option>
              </select>
              <input
                aria-label="Nome nuova porta"
                value={portLabel}
                onChange={(event) => setPortLabel(event.target.value)}
                placeholder="Nome porta"
              />
              <select
                aria-label="Categoria connettore"
                value={portConnectorCategory}
                onChange={(event) => {
                  const next = event.target.value as ConnectorCategory
                  setPortConnectorCategory(next)
                  setPortConnectorType(connectorCatalog[next][0])
                }}
              >
                {Object.entries(connectorCategoryLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Tipo connettore"
                value={portConnectorType}
                onChange={(event) => setPortConnectorType(event.target.value)}
              >
                {connectorCatalog[portConnectorCategory].map((connector) => (
                  <option key={connector} value={connector}>
                    {connector}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={!hasDevices}>
                Aggiungi porta
              </button>
            </form>

            <form
              className="manager-form"
              onSubmit={(event) => {
                event.preventDefault()
                onBulkAddPorts(
                  bulkDeviceId,
                  bulkPortKind,
                  bulkPrefix,
                  Number.parseInt(bulkQuantità, 10),
                  Number.parseInt(bulkStartIndex, 10),
                  bulkConnectorCategory,
                  bulkConnectorType,
                )
              }}
            >
              <strong>Porte in serie</strong>
              <select
                aria-label="Dispositivo per le porte in serie"
                value={bulkDeviceId}
                onChange={(event) => setBulkDeviceId(event.target.value)}
                disabled={!hasDevices}
              >
                <option value="">Scegli dispositivo</option>
                {sortedDevices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Direzione porte in serie"
                value={bulkPortKind}
                onChange={(event) =>
                  setBulkPortKind(event.target.value as PortKind)
                }
              >
                <option value="input">Ingresso</option>
                <option value="output">Uscita</option>
                <option value="bidirectional">Bidirezionale</option>
              </select>
              <input
                aria-label="Prefisso porte in serie"
                value={bulkPrefix}
                onChange={(event) => setBulkPrefix(event.target.value)}
                placeholder="Prefisso (es. SDI In)"
              />
              <input
                value={bulkQuantità}
                onChange={(event) => setBulkQuantità(event.target.value)}
                placeholder="Quantità"
                type="number"
                min="1"
                max="256"
              />
              <input
                aria-label="Numero iniziale"
                value={bulkStartIndex}
                onChange={(event) => setBulkStartIndex(event.target.value)}
                placeholder="Numero iniziale"
                type="number"
                min="0"
                max="10000"
              />
              <select
                aria-label="Categoria connettore porte in serie"
                value={bulkConnectorCategory}
                onChange={(event) => {
                  const next = event.target.value as ConnectorCategory
                  setBulkConnectorCategory(next)
                  setBulkConnectorType(connectorCatalog[next][0])
                }}
              >
                {Object.entries(connectorCategoryLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Tipo connettore porte in serie"
                value={bulkConnectorType}
                onChange={(event) => setBulkConnectorType(event.target.value)}
              >
                {connectorCatalog[bulkConnectorCategory].map((connector) => (
                  <option key={connector} value={connector}>
                    {connector}
                  </option>
                ))}
              </select>
              <button type="submit">Aggiungi porte</button>
              <button
                type="button"
                onClick={() =>
                  onBulkRemovePorts(
                    bulkDeviceId,
                    bulkPortKind,
                    bulkPrefix,
                    Number.parseInt(bulkQuantità, 10),
                    bulkConnectorCategory,
                    bulkConnectorType,
                  )
                }
              >
                Rimuovi porte
              </button>
            </form>

            <div className="manager-list">
              <strong>Categorie</strong>
              {categories.map((category) => (
                <div key={category.id} className="manager-row">
                  {editingCategoryId === category.id ? (
                    <div className="inline-edit">
                      <input
                        aria-label="Nome categoria"
                        value={editingCategoryLabel}
                        onChange={(event) =>
                          setEditingCategoryLabel(event.target.value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            onUpdateCategory(category.id, editingCategoryLabel)
                          ) {
                            setEditingCategoryId('')
                            setEditingCategoryLabel('')
                          }
                        }}
                      >
                        Salva
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{category.label}</span>
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(category.id)
                            setEditingCategoryLabel(category.label)
                          }}
                        >
                          Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCategory(category.id)}
                        >
                          Elimina
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="manager-list">
              <div className="manager-list-header">
                <strong>Dispositivi e porte</strong>
                <button
                  type="button"
                  onClick={() => setIsManageDevicesOpen((current) => !current)}
                >
                  {isManageDevicesOpen ? 'Comprimi' : 'Espandi'}
                </button>
              </div>
              {isManageDevicesOpen
                ? sortedDevices.map((device) => (
                    <div key={device.id} className="manager-device">
                      <div className="manager-row">
                        {editingDeviceId === device.id ? (
                          <div className="inline-edit">
                            <input
                              aria-label="Nome dispositivo"
                              value={editingDeviceName}
                              onChange={(event) =>
                                setEditingDeviceName(event.target.value)
                              }
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  onUpdateDevice(
                                    device.id,
                                    editingDeviceName,
                                    device.category,
                                  )
                                ) {
                                  setEditingDeviceId('')
                                  setEditingDeviceName('')
                                }
                              }}
                            >
                              Salva
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="manager-row-main">
                              <span>{device.name}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedDevices((current) => ({
                                    ...current,
                                    [device.id]: !(current[device.id] ?? false),
                                  }))
                                }
                              >
                                {expandedDevices[device.id]
                                  ? 'Nascondi porte'
                                  : 'Mostra porte'}
                              </button>
                            </div>
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDeviceId(device.id)
                                  setEditingDeviceName(device.name)
                                }}
                              >
                                Modifica
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteDevice(device.id)}
                              >
                                Elimina
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {expandedDevices[device.id] ? (
                        <>
                          <div className="manager-move">
                            <select
                              aria-label={`Categoria di ${device.name}`}
                              value={device.category}
                              onChange={(event) =>
                                onMoveDevice(device.id, event.target.value)
                              }
                            >
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                            <small>Sposta nella categoria</small>
                          </div>

                          {[...device.inputs, ...device.outputs].map((port) => (
                            <div
                              key={`${device.id}:${port.kind}:${port.id}`}
                              className="manager-row port-row"
                            >
                              {editingPortKey ===
                              `${device.id}:${port.kind}:${port.id}` ? (
                                <div className="inline-edit">
                                  <input
                                    aria-label="Nome porta"
                                    value={editingPortLabel}
                                    onChange={(event) =>
                                      setEditingPortLabel(event.target.value)
                                    }
                                  />
                                  <select
                                    aria-label="Direzione porta"
                                    value={editingPortKind}
                                    onChange={(event) =>
                                      setEditingPortKind(
                                        event.target.value as PortKind,
                                      )
                                    }
                                  >
                                    <option value="input">Ingresso</option>
                                    <option value="output">Uscita</option>
                                    <option value="bidirectional">
                                      Bidirezionale
                                    </option>
                                  </select>
                                  <select
                                    aria-label="Categoria del connettore modificato"
                                    value={editingPortConnectorCategory}
                                    onChange={(event) => {
                                      const next = event.target
                                        .value as ConnectorCategory
                                      setEditingPortConnectorCategory(next)
                                      setEditingPortConnectorType(
                                        connectorCatalog[next][0],
                                      )
                                    }}
                                  >
                                    {Object.entries(
                                      connectorCategoryLabels,
                                    ).map(([id, label]) => (
                                      <option key={id} value={id}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    aria-label="Tipo del connettore modificato"
                                    value={editingPortConnectorType}
                                    onChange={(event) =>
                                      setEditingPortConnectorType(
                                        event.target.value,
                                      )
                                    }
                                  >
                                    {connectorCatalog[
                                      editingPortConnectorCategory
                                    ].map((connector) => (
                                      <option key={connector} value={connector}>
                                        {connector}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        onUpdatePort(
                                          device.id,
                                          port.id,
                                          port.kind,
                                          editingPortLabel,
                                          editingPortKind,
                                          editingPortConnectorCategory,
                                          editingPortConnectorType,
                                        )
                                      ) {
                                        setEditingPortKey('')
                                        setEditingPortLabel('')
                                      }
                                    }}
                                  >
                                    Salva
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span>
                                    {port.label} ({port.kind},{' '}
                                    {port.connectorType})
                                  </span>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPortKey(
                                          `${device.id}:${port.kind}:${port.id}`,
                                        )
                                        setEditingPortLabel(port.label)
                                        setEditingPortKind(port.kind)
                                        setEditingPortConnectorCategory(
                                          port.connectorCategory,
                                        )
                                        setEditingPortConnectorType(
                                          port.connectorType,
                                        )
                                      }}
                                    >
                                      Modifica
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onDeletePort(
                                          device.id,
                                          port.id,
                                          port.kind,
                                        )
                                      }
                                    >
                                      Elimina
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </>
                      ) : null}
                    </div>
                  ))
                : null}
            </div>
          </div>
        </Modal>
      ) : null}
    </aside>
  )
}
