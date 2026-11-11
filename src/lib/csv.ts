export const csvCell = (value: string | number) => {
  const text = String(value)
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
