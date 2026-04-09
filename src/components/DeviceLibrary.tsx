import { useMemo, useState } from 'react'
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
  onDeletePort: (deviceId: string, portId: string, portKind: PortKind) => boolean
}

export function DeviceLibrary({
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
}: DeviceLibraryProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false)
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
  const [bulkCount, setBulkCount] = useState('16')
  const [bulkStartIndex, setBulkStartIndex] = useState('1')
  const [bulkConnectorCategory, setBulkConnectorCategory] =
    useState<ConnectorCategory>(defaultConnectorCategory)
  const [bulkConnectorType, setBulkConnectorType] = useState(defaultConnectorType)

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
  const [expandedDevices, setExpandedDevices] = useState<Record<string, boolean>>({})

  const hasCategories = categories.length > 0
  const hasDevices = devices.length > 0

  const sortedDevices = useMemo(
    () => [...devices].sort((a, b) => a.name.localeCompare(b.name)),
    [devices],
  )

  return (
    <aside className="library-panel">
      <h2>Device Library</h2>
      {categories.map((category) => {
        const categoryDevices = devices.filter(
          (device) => device.category === category.id,
        )

        return (
          <section key={category.id} className="library-category">
            <h3>{category.label}</h3>
            <div className="library-grid">
              {categoryDevices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  className="library-device"
                  onClick={() => onAddDevice(device.id)}
                >
                  <span>{device.name}</span>
                  <small>
                    In {device.inputs.length} / Out {device.outputs.length}
                  </small>
                </button>
              ))}
            </div>
          </section>
        )
      })}

      <button
        type="button"
        className="open-manager-button"
        onClick={() => setIsManagerOpen(true)}
      >
        Manage Library
      </button>

      {isManagerOpen ? (
        <div
          className="manager-modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsManagerOpen(false)
          }}
        >
          <section className="manager-modal">
            <div className="manager-modal-header">
              <h3>Library Manager</h3>
              <button
                type="button"
                className="manager-close-button"
                onClick={() => setIsManagerOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="library-manager">
              <form
                className="manager-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (onCreateCategory(newCategoryLabel)) setNewCategoryLabel('')
                }}
              >
                <strong>Add Category</strong>
                <input
                  value={newCategoryLabel}
                  onChange={(event) => setNewCategoryLabel(event.target.value)}
                  placeholder="Category name"
                />
                <button type="submit">Create Category</button>
              </form>

              <form
                className="manager-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (onCreateDevice(newDeviceName, newDeviceCategory)) setNewDeviceName('')
                }}
              >
                <strong>Add Device</strong>
                <input
                  value={newDeviceName}
                  onChange={(event) => setNewDeviceName(event.target.value)}
                  placeholder="Device name"
                />
                <select
                  value={newDeviceCategory}
                  onChange={(event) => setNewDeviceCategory(event.target.value)}
                  disabled={!hasCategories}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={!hasCategories}>
                  Create Device
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
                <strong>Add Port To Device</strong>
                <select
                  value={portDeviceId}
                  onChange={(event) => setPortDeviceId(event.target.value)}
                  disabled={!hasDevices}
                >
                  <option value="">Select device</option>
                  {sortedDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
                <select
                  value={portKind}
                  onChange={(event) => setPortKind(event.target.value as PortKind)}
                >
                  <option value="input">Input</option>
                  <option value="output">Output</option>
                  <option value="bidirectional">Bidirectional</option>
                </select>
                <input
                  value={portLabel}
                  onChange={(event) => setPortLabel(event.target.value)}
                  placeholder="Port label"
                />
                <select
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
                  Add Port
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
                    Number.parseInt(bulkCount, 10),
                    Number.parseInt(bulkStartIndex, 10),
                    bulkConnectorCategory,
                    bulkConnectorType,
                  )
                }}
              >
                <strong>Bulk Add / Remove Ports</strong>
                <select
                  value={bulkDeviceId}
                  onChange={(event) => setBulkDeviceId(event.target.value)}
                  disabled={!hasDevices}
                >
                  <option value="">Select device</option>
                  {sortedDevices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bulkPortKind}
                  onChange={(event) => setBulkPortKind(event.target.value as PortKind)}
                >
                  <option value="input">Input</option>
                  <option value="output">Output</option>
                  <option value="bidirectional">Bidirectional</option>
                </select>
                <input
                  value={bulkPrefix}
                  onChange={(event) => setBulkPrefix(event.target.value)}
                  placeholder="Prefix (e.g. SDI In)"
                />
                <input
                  value={bulkCount}
                  onChange={(event) => setBulkCount(event.target.value)}
                  placeholder="Count"
                />
                <input
                  value={bulkStartIndex}
                  onChange={(event) => setBulkStartIndex(event.target.value)}
                  placeholder="Start index"
                />
                <select
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
                  value={bulkConnectorType}
                  onChange={(event) => setBulkConnectorType(event.target.value)}
                >
                  {connectorCatalog[bulkConnectorCategory].map((connector) => (
                    <option key={connector} value={connector}>
                      {connector}
                    </option>
                  ))}
                </select>
                <button type="submit">Bulk Add</button>
                <button
                  type="button"
                  onClick={() =>
                    onBulkRemovePorts(
                      bulkDeviceId,
                      bulkPortKind,
                      bulkPrefix,
                      Number.parseInt(bulkCount, 10),
                      bulkConnectorCategory,
                      bulkConnectorType,
                    )
                  }
                >
                  Bulk Remove
                </button>
              </form>

              <div className="manager-list">
                <strong>Manage Categories</strong>
                {categories.map((category) => (
                  <div key={category.id} className="manager-row">
                    {editingCategoryId === category.id ? (
                      <div className="inline-edit">
                        <input
                          value={editingCategoryLabel}
                          onChange={(event) =>
                            setEditingCategoryLabel(event.target.value)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateCategory(category.id, editingCategoryLabel)) {
                              setEditingCategoryId('')
                              setEditingCategoryLabel('')
                            }
                          }}
                        >
                          Save
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
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCategory(category.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="manager-list">
                <div className="manager-list-header">
                  <strong>Manage Devices And Ports</strong>
                  <button
                    type="button"
                    onClick={() => setIsManageDevicesOpen((current) => !current)}
                  >
                    {isManageDevicesOpen ? 'Collapse' : 'Expand'}
                  </button>
                </div>
                {isManageDevicesOpen
                  ? sortedDevices.map((device) => (
                  <div key={device.id} className="manager-device">
                    <div className="manager-row">
                      {editingDeviceId === device.id ? (
                        <div className="inline-edit">
                          <input
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
                            Save
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
                              {expandedDevices[device.id] ? 'Hide Ports' : 'Show Ports'}
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
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDevice(device.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {expandedDevices[device.id] ? (
                      <>
                        <div className="manager-move">
                      <select
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
                      <small>Move device to category</small>
                        </div>

                        {[...device.inputs, ...device.outputs].map((port) => (
                      <div
                        key={`${device.id}:${port.kind}:${port.id}`}
                        className="manager-row port-row"
                      >
                        {editingPortKey === `${device.id}:${port.kind}:${port.id}` ? (
                          <div className="inline-edit">
                            <input
                              value={editingPortLabel}
                              onChange={(event) =>
                                setEditingPortLabel(event.target.value)
                              }
                            />
                            <select
                              value={editingPortKind}
                              onChange={(event) =>
                                setEditingPortKind(event.target.value as PortKind)
                              }
                            >
                              <option value="input">input</option>
                              <option value="output">output</option>
                              <option value="bidirectional">bidirectional</option>
                            </select>
                            <select
                              value={editingPortConnectorCategory}
                              onChange={(event) => {
                                const next = event.target
                                  .value as ConnectorCategory
                                setEditingPortConnectorCategory(next)
                                setEditingPortConnectorType(connectorCatalog[next][0])
                              }}
                            >
                              {Object.entries(connectorCategoryLabels).map(
                                ([id, label]) => (
                                  <option key={id} value={id}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                            <select
                              value={editingPortConnectorType}
                              onChange={(event) =>
                                setEditingPortConnectorType(event.target.value)
                              }
                            >
                              {connectorCatalog[editingPortConnectorCategory].map(
                                (connector) => (
                                  <option key={connector} value={connector}>
                                    {connector}
                                  </option>
                                ),
                              )}
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
                              Save
                            </button>
                          </div>
                        ) : (
                          <>
                            <span>
                              {port.label} ({port.kind}, {port.connectorType})
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
                                  setEditingPortConnectorType(port.connectorType)
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onDeletePort(device.id, port.id, port.kind)
                                }
                              >
                                Delete
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
          </section>
        </div>
      ) : null}
    </aside>
  )
}
