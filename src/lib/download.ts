export function downloadFile(
  filename: string,
  content: Blob | string,
  type = 'application/json',
) {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // WebKit must have time to start reading the object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
