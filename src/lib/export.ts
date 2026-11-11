import type { jsPDF } from 'jspdf'
import type { Connection, PortDefinition, PortRef } from '../types/schematic'
import { downloadFile } from './download'
interface MatrixPort {
  key: string
  nodeLabel: string
  portLabel: string
  connectorType: string
}
function drawCheckMark(doc: jsPDF, x: number, y: number, size: number) {
  doc.setDrawColor(16, 80, 34)
  doc.setLineWidth(1.4)
  doc.line(x + size * 0.24, y + size * 0.54, x + size * 0.43, y + size * 0.72)
  doc.line(x + size * 0.43, y + size * 0.72, x + size * 0.78, y + size * 0.28)
}

export async function exportMatrix(
  connections: Connection[],
  getPortDefinition: (ref: PortRef) => PortDefinition | null,
  getNodeLabel: (id: string) => string,
) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 24
  const titleHeight = 44
  const rowHeaderWidth = 178
  const headerHeight = 132
  const cellSize = 18
  const rowHeight = 18
  const tableTop = margin + titleHeight + headerHeight
  const tableLeft = margin + rowHeaderWidth
  const maxColumnsPerPage = Math.max(
    1,
    Math.floor((pageWidth - margin - tableLeft) / cellSize),
  )
  const maxRowsPerPage = Math.max(
    1,
    Math.floor((pageHeight - tableTop - margin) / rowHeight),
  )

  const getPortKey = (port: PortRef) =>
    `${port.nodeId}:${port.kind}:${port.portId}`

  if (connections.length === 0) {
    doc.setFontSize(16)
    doc.text('Connections Matrix', margin, margin)
    doc.setFontSize(10)
    doc.text('No connections configured.', margin, margin + 22)
    doc.save('connections-report.pdf')
    return
  }

  const sourcesByKey = new Map<string, MatrixPort>()
  const receiversByKey = new Map<string, MatrixPort>()
  const connectedCells = new Set<string>()

  const addMatrixPort = (
    collection: Map<string, MatrixPort>,
    port: PortRef,
  ) => {
    const key = getPortKey(port)
    if (collection.has(key)) return
    const definition = getPortDefinition(port)
    collection.set(key, {
      key,
      nodeLabel: getNodeLabel(port.nodeId),
      portLabel: definition?.label ?? port.portId,
      connectorType: definition?.connectorType ?? 'Unknown',
    })
  }

  connections.forEach((connection) => {
    addMatrixPort(sourcesByKey, connection.from)
    addMatrixPort(receiversByKey, connection.to)
    connectedCells.add(
      `${getPortKey(connection.to)}>${getPortKey(connection.from)}`,
    )
  })

  const sources = Array.from(sourcesByKey.values())
  const receivers = Array.from(receiversByKey.values())

  if (sources.length === 0 || receivers.length === 0) {
    doc.setFontSize(16)
    doc.text('Connections Matrix', margin, margin)
    doc.setFontSize(10)
    doc.text(
      'No source/receiver ports available on the canvas.',
      margin,
      margin + 22,
    )
    doc.save('connections-report.pdf')
    return
  }

  let pageNumber = 0

  for (
    let rowStart = 0;
    rowStart < receivers.length;
    rowStart += maxRowsPerPage
  ) {
    for (
      let columnStart = 0;
      columnStart < sources.length;
      columnStart += maxColumnsPerPage
    ) {
      if (pageNumber > 0) doc.addPage()
      pageNumber += 1

      const pageSources = sources.slice(
        columnStart,
        columnStart + maxColumnsPerPage,
      )
      const pageReceivers = receivers.slice(rowStart, rowStart + maxRowsPerPage)
      const tableWidth = rowHeaderWidth + pageSources.length * cellSize
      const tableHeight = headerHeight + pageReceivers.length * rowHeight

      doc.setFillColor(17, 20, 27)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')

      doc.setTextColor(232, 235, 240)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text('Connections Matrix', margin, margin + 4)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(179, 194, 218)
      doc.text(
        `Generated: ${new Date().toLocaleString()}  |  Connections: ${connections.length}  |  Page: ${pageNumber}`,
        margin,
        margin + 21,
      )
      doc.text(
        `Sources ${columnStart + 1}-${columnStart + pageSources.length} of ${sources.length} / Receivers ${rowStart + 1}-${rowStart + pageReceivers.length} of ${receivers.length}`,
        margin,
        margin + 34,
      )

      doc.setFillColor(27, 39, 56)
      doc.setDrawColor(58, 78, 106)
      doc.rect(margin, margin + titleHeight, tableWidth, tableHeight, 'FD')

      doc.setFillColor(25, 34, 51)
      doc.rect(margin, margin + titleHeight, rowHeaderWidth, headerHeight, 'F')
      doc.setTextColor(159, 180, 214)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text('RECEIVERS', margin + 8, tableTop - 10)
      doc.text('SOURCES', tableLeft + 6, margin + titleHeight + 12)

      pageSources.forEach((source, sourceIndex) => {
        const x = tableLeft + sourceIndex * cellSize
        const isAlternating = sourceIndex % 2 === 0
        doc.setFillColor(
          isAlternating ? 36 : 42,
          isAlternating ? 47 : 54,
          isAlternating ? 62 : 70,
        )
        doc.rect(x, margin + titleHeight, cellSize, headerHeight, 'F')
        doc.setDrawColor(42, 51, 66)
        doc.rect(x, margin + titleHeight, cellSize, headerHeight, 'S')

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(232, 235, 240)
        const sourceLabel = `${source.nodeLabel} / ${source.portLabel}`
        doc.text(sourceLabel.slice(0, 56), x + 4, tableTop - 8, {
          angle: 90,
          baseline: 'middle',
        })
      })

      pageReceivers.forEach((receiver, receiverIndex) => {
        const y = tableTop + receiverIndex * rowHeight
        const isAlternating = receiverIndex % 2 === 0
        doc.setFillColor(
          isAlternating ? 29 : 34,
          isAlternating ? 38 : 44,
          isAlternating ? 51 : 58,
        )
        doc.rect(margin, y, rowHeaderWidth, rowHeight, 'F')
        doc.setDrawColor(42, 51, 66)
        doc.rect(margin, y, rowHeaderWidth, rowHeight, 'S')

        doc.setTextColor(232, 235, 240)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        doc.text(receiver.nodeLabel.slice(0, 28), margin + 6, y + 7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(179, 194, 218)
        doc.text(
          `${receiver.portLabel} [${receiver.connectorType}]`.slice(0, 34),
          margin + 6,
          y + 15,
        )

        pageSources.forEach((source, sourceIndex) => {
          const x = tableLeft + sourceIndex * cellSize
          doc.setFillColor(
            isAlternating ? 24 : 28,
            isAlternating ? 31 : 36,
            isAlternating ? 40 : 47,
          )
          doc.rect(x, y, cellSize, rowHeight, 'F')
          doc.setDrawColor(42, 51, 66)
          doc.rect(x, y, cellSize, rowHeight, 'S')

          if (connectedCells.has(`${receiver.key}>${source.key}`)) {
            doc.setFillColor(61, 220, 65)
            doc.rect(x + 2, y + 2, cellSize - 4, rowHeight - 4, 'F')
            drawCheckMark(doc, x + 2, y + 2, cellSize - 4)
          }
        })
      })
    }
  }

  doc.save('connections-report.pdf')
}

export async function exportGraphic(content: HTMLElement, title: string) {
  const { default: html2canvas } = await import('html2canvas')
  const width = content.offsetWidth,
    height = content.offsetHeight
  // Stay below WebKit's canvas limits even for large diagrams.
  const scale = Math.min(
    2,
    8192 / Math.max(width, height),
    Math.sqrt(16000000 / (width * height)),
  )
  const canvas = await html2canvas(content, {
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue('--canvas')
      .trim(),
    width,
    height,
    scale,
    logging: false,
    onclone: (doc) => {
      const element = doc.querySelector<HTMLElement>('.canvas-content')
      if (element) {
        element.style.transform = 'none'
        element.style.position = 'relative'
      }
      doc
        .querySelectorAll('.dimmed, .selected')
        .forEach((el) => el.classList.remove('dimmed', 'selected'))
      doc
        .querySelectorAll<HTMLElement>('[data-export-ignore]')
        .forEach((el) => {
          el.style.visibility = 'hidden'
        })
    },
  })
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Esportazione non disponibile')),
      'image/png',
    ),
  )
  downloadFile(`${title || 'schema'}.png`, blob)
}
