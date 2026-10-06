import { MAX_ATTACHMENTS } from './chatAttachments'

export type DroppedFile = { file: File; relativePath?: string }

// Capture entries synchronously: browsers release DataTransfer after the drop event.
export function droppedFiles(transfer: DataTransfer): Promise<{ files: DroppedFile[]; truncated: boolean }> {
  const entries = [...transfer.items].filter((item) => item.kind === 'file').map((item) => ({ entry: item.webkitGetAsEntry?.(), file: item.getAsFile() }))
  const fallback = [...transfer.files]
  return (async () => {
    const files: DroppedFile[] = []
    let truncated = false
    function add(file: File, relativePath?: string) {
      if (files.length >= MAX_ATTACHMENTS) { truncated = true; return }
      files.push({ file, relativePath })
    }
    async function walk(entry: FileSystemEntry, prefix = ''): Promise<void> {
      if (truncated) return
      const path = `${prefix}${entry.name}`
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
        add(file, prefix ? path : undefined)
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader()
        // readEntries returns batches (often 100), not the complete directory.
        while (!truncated) {
          const children = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
          if (!children.length) break
          for (const child of children) await walk(child, `${path}/`)
        }
      }
    }
    if (entries.length) for (const item of entries) { if (item.entry) await walk(item.entry); else if (item.file) add(item.file) }
    else for (const file of fallback) add(file)
    return { files, truncated }
  })()
}
