import './App.css'
import { DeviceLibrary } from './components/DeviceLibrary'
import { SchematicCanvas } from './components/SchematicCanvas'
import { Icon } from './components/Icon'
import { Modal } from './components/Modal'
import { useProjectEditor } from './hooks/useProjectEditor'
import { cleanConnections, createDefaultProject } from './lib/project'
import { arrangeBySignal } from './lib/layout'

function App() {
  const {
    update,
    undo,
    redo,
    endGroup,
    canUndo,
    canRedo,
    saveStatus,
    projectTitle,
    projectDescription,
    categories,
    deviceList,
    nodes,
    connections,
    isLibraryCollapsed,
    setIsLibraryCollapsed,
    activePort,
    setActivePort,
    selectedNode,
    setSelectedNode,
    message,
    setMessage,
    showClear,
    setShowClear,
    showHelp,
    setShowHelp,
    theme,
    setTheme,
    importInputRef,
    devicesById,
    notify,
    handleDeleteNode,
    duplicateNode,
    handleAddDevice,
    handlePortClick,
    handleCreateCategory,
    handleCreateDevice,
    addPorts,
    handleAddPort,
    handleBulkRemove,
    updateDevice,
    handleUpdatePort,
    handleDeletePort,
    handleExportProject,
    handleImportProject,
    loadDemo,
  } = useProjectEditor()
  return (
    <div
      className={`app-layout ${isLibraryCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      <header className="app-header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="Schematic Tool"
        >
          <span className="brand-symbol">
            <Icon name="diagram" size={23} />
          </span>
          <span>
            Schematic
            <span className="brand-subtitle">AUDIO / VIDEO / LUCI</span>
          </span>
        </a>
        <div className="header-project">
          <span className={`save-dot ${saveStatus}`} />
          <span>
            {saveStatus === 'error'
              ? 'Salvataggio non disponibile · esporta il progetto'
              : saveStatus === 'saving'
                ? 'Salvataggio…'
                : 'Salvato su questo browser'}
          </span>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button"
            title="Guida e scorciatoie"
            aria-label="Guida e scorciatoie"
            onClick={() => setShowHelp(true)}
          >
            <Icon name="help" />
          </button>
          <button
            type="button"
            className="icon-button theme-toggle"
            aria-label={
              theme === 'light' ? 'Attiva tema scuro' : 'Attiva tema chiaro'
            }
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} />
          </button>
          <span className="action-divider" />
          <button type="button" onClick={() => importInputRef.current?.click()}>
            <Icon name="upload" />
            <span>Apri progetto</span>
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleExportProject}
          >
            <Icon name="download" />
            <span>Esporta progetto</span>
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportProject}
          hidden
          aria-label="Importa progetto JSON"
        />
      </header>
      <DeviceLibrary
        hidden={isLibraryCollapsed}
        onClose={() => setIsLibraryCollapsed(true)}
        categories={categories}
        devices={deviceList}
        onAddDevice={handleAddDevice}
        onCreateCategory={handleCreateCategory}
        onCreateDevice={handleCreateDevice}
        onAddPort={handleAddPort}
        onBulkAddPorts={addPorts}
        onBulkRemovePorts={handleBulkRemove}
        onUpdateCategory={(id, label) => {
          if (!label.trim()) return false
          update((current) => ({
            ...current,
            categories: current.categories.map((c) =>
              c.id === id ? { ...c, label: label.trim() } : c,
            ),
          }))
          return true
        }}
        onDeleteCategory={(id) => {
          if (deviceList.some((d) => d.category === id))
            return notify(
              'Sposta o elimina i dispositivi della categoria prima di rimuoverla.',
            )
          update((current) => ({
            ...current,
            categories: current.categories.filter((c) => c.id !== id),
          }))
          return true
        }}
        onUpdateDevice={updateDevice}
        onMoveDevice={(id, category) =>
          updateDevice(id, devicesById[id].name, category)
        }
        onDeleteDevice={(id) => {
          update((current) => {
            const next = {
              ...current,
              deviceList: current.deviceList.filter((d) => d.id !== id),
              nodes: current.nodes.filter((n) => n.deviceId !== id),
            }
            return { ...next, connections: cleanConnections(next) }
          })
          setActivePort(null)
          return true
        }}
        onUpdatePort={handleUpdatePort}
        onDeletePort={handleDeletePort}
        onResetLibraryToDefaults={() => {
          if (
            window.confirm(
              'Ripristinare la libreria iniziale e svuotare lo schema? Potrai annullare questa operazione.',
            )
          ) {
            update(() => ({
              ...createDefaultProject(),
              projectTitle,
              projectDescription,
            }))
            setActivePort(null)
            setSelectedNode(null)
          }
        }}
      />
      <section className="workspace">
        <header className="workspace-header">
          <div className="project-heading">
            <div className="eyebrow">
              IL TUO PROGETTO <span> / </span> SCHEMA DI SEGNALE
            </div>
            <input
              className="project-title-input"
              aria-label="Titolo del progetto"
              value={projectTitle}
              onChange={(event) =>
                update(
                  (current) => ({
                    ...current,
                    projectTitle: event.target.value,
                  }),
                  'title',
                )
              }
              onBlur={endGroup}
              placeholder="Progetto senza titolo"
              maxLength={200}
            />
            <input
              className="project-description-input"
              aria-label="Descrizione del progetto"
              value={projectDescription}
              onChange={(event) =>
                update(
                  (current) => ({
                    ...current,
                    projectDescription: event.target.value,
                  }),
                  'description',
                )
              }
              onBlur={endGroup}
              placeholder="Aggiungi una descrizione, una location o una nota per il team…"
              maxLength={5000}
            />
          </div>
          <div className="project-stats">
            <span>
              <strong>{nodes.length}</strong> dispositivi
            </span>
            <span>
              <strong>{connections.length}</strong> collegamenti
            </span>
          </div>
        </header>
        <SchematicCanvas
          nodes={nodes}
          devicesById={devicesById}
          connections={connections}
          activePort={activePort}
          selectedNode={selectedNode}
          projectTitle={projectTitle}
          isLibraryCollapsed={isLibraryCollapsed}
          onToggleLibrary={() => setIsLibraryCollapsed((value) => !value)}
          onSelectNode={setSelectedNode}
          onPortClick={handlePortClick}
          onCancelConnection={() => setActivePort(null)}
          onAddDevice={handleAddDevice}
          onNodeMove={(id, x, y) =>
            update(
              (current) => ({
                ...current,
                nodes: current.nodes.map((n) =>
                  n.id === id ? { ...n, x, y } : n,
                ),
              }),
              `move-${id}`,
            )
          }
          onMoveEnd={endGroup}
          onDeleteNode={handleDeleteNode}
          onDuplicateNode={duplicateNode}
          onRenameNode={(id, name) => {
            if (name.trim())
              update((current) => ({
                ...current,
                nodes: current.nodes.map((n) =>
                  n.id === id ? { ...n, customName: name.trim() } : n,
                ),
              }))
          }}
          onToggleNodeCollapse={(id) =>
            update((current) => ({
              ...current,
              nodes: current.nodes.map((n) =>
                n.id === id ? { ...n, collapsed: !n.collapsed } : n,
              ),
            }))
          }
          onDeleteConnection={(id) =>
            update((current) => ({
              ...current,
              connections: current.connections.filter((c) => c.id !== id),
            }))
          }
          onArrange={(heights) =>
            update((current) => ({
              ...current,
              nodes: arrangeBySignal(
                current.nodes,
                current.connections,
                devicesById,
                heights,
              ),
            }))
          }
          onLoadDemo={loadDemo}
          onClear={() => setShowClear(true)}
          onNotify={setMessage}
          onUndo={() => {
            undo()
            setActivePort(null)
          }}
          onRedo={() => {
            redo()
            setActivePort(null)
          }}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      </section>
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => setMessage('')}
            aria-label="Chiudi messaggio"
          >
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {showClear && (
        <Modal title="Svuotare lo schema?" onClose={() => setShowClear(false)}>
          <p>
            Rimuoverai {nodes.length} dispositivi e {connections.length}{' '}
            collegamenti. La libreria resta disponibile. Potrai annullare
            l’operazione.
          </p>
          <div className="modal-actions">
            <button type="button" onClick={() => setShowClear(false)}>
              Annulla
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                update((current) => ({
                  ...current,
                  nodes: [],
                  connections: [],
                }))
                setActivePort(null)
                setSelectedNode(null)
                setShowClear(false)
              }}
            >
              Svuota schema
            </button>
          </div>
        </Modal>
      )}
      {showHelp && (
        <Modal title="Dall’idea al segnale" onClose={() => setShowHelp(false)}>
          <div className="help-content">
            <p>
              <strong>1. Aggiungi i dispositivi</strong>
              <br />
              Cerca nella libreria e fai clic su un dispositivo oppure
              trascinalo sullo schema. Crea i tuoi modelli da “Gestisci
              libreria”.
            </p>
            <p>
              <strong>2. Collega le porte</strong>
              <br />
              Fai clic su un’uscita e poi su un ingresso dello stesso tipo. Puoi
              partire anche dall’ingresso. Ogni porta accetta un solo cavo.
            </p>
            <p>
              <strong>3. Porta lo schema con te</strong>
              <br />
              Esporta il progetto per riaprirlo su un altro browser. Usa PNG,
              PDF e CSV per la documentazione operativa.
            </p>
            <dl className="shortcuts">
              <dt>Annulla / Ripristina</dt>
              <dd>⌘ / Ctrl + Z · ⇧ + Z</dd>
              <dt>Duplica selezionato</dt>
              <dd>⌘ / Ctrl + D</dd>
              <dt>Rimuovi selezionato</dt>
              <dd>Delete / Backspace</dd>
              <dt>Annulla collegamento</dt>
              <dd>Esc</dd>
              <dt>Sposta dispositivo</dt>
              <dd>Trascina l’intestazione · tasti freccia</dd>
            </dl>
            <p className="muted">
              Il salvataggio automatico è locale a questo browser. Esporta un
              file progetto per conservarne una copia o trasferirlo.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
export default App
