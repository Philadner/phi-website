import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Load these browser-independent helpers without adding a test framework.
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const attachmentSource = await compile('../src/lib/chatAttachments.ts')
const attachmentUrl = moduleUrl(attachmentSource)
const dropSource = (await compile('../src/lib/chatDrop.ts')).replace("'./chatAttachments'", JSON.stringify(attachmentUrl))
const { droppedFiles } = await import(moduleUrl(dropSource))
const { attachmentPath, uploadContentType } = await import(attachmentUrl)

function file(name) { return { name, size: 1, type: 'text/plain' } }
function fileEntry(name) { return { name, isFile: true, isDirectory: false, file: (resolve) => resolve(file(name)) } }
function directory(name, batches) {
  return { name, isFile: false, isDirectory: true, createReader: () => {
    let cursor = 0
    return { readEntries: (resolve) => resolve(batches[cursor++] || []) }
  } }
}
function transfer(entries) {
  return { items: entries.map((entry) => ({ kind: 'file', webkitGetAsEntry: () => entry, getAsFile: () => null })), files: [] }
}

const nested = await droppedFiles(transfer([directory('folder', [[fileEntry('a.txt'), directory('nested', [[fileEntry('b.txt')]])], [fileEntry('c.txt')]])]))
assert.deepEqual(nested.files.map((item) => item.relativePath), ['folder/a.txt', 'folder/nested/b.txt', 'folder/c.txt'])
assert.equal(nested.truncated, false)
const many = await droppedFiles(transfer([directory('big', [Array.from({ length: 100 }, (_, i) => fileEntry(`${i}.txt`)), [fileEntry('last.txt')]])]))
assert.equal(many.files.length, 20)
assert.equal(many.truncated, true)
const exact = await droppedFiles(transfer([directory('exact', [Array.from({ length: 20 }, (_, i) => fileEntry(`${i}.txt`))])]))
assert.equal(exact.truncated, false)
const flat = await droppedFiles({ items: [{ kind: 'file', getAsFile: () => file('flat.txt') }], files: [] })
assert.equal(flat.files[0].file.name, 'flat.txt')
const fallback = await droppedFiles({ items: [], files: [file('fallback.txt')] })
assert.equal(fallback.files[0].file.name, 'fallback.txt')
const empty = await droppedFiles(transfer([directory('empty', [[]])]))
assert.equal(empty.files.length, 0)
await assert.rejects(droppedFiles(transfer([{ ...fileEntry('unreadable'), file: (_resolve, reject) => reject(new Error('Permission denied')) }])))
assert.equal(uploadContentType('image/gif'), 'image/gif')
assert.equal(uploadContentType('image/svg+xml'), 'application/octet-stream')
assert.equal(uploadContentType('text/html'), 'application/octet-stream')
assert.equal(attachmentPath('author', 'id', '../../a b.txt'), 'chat/v2/author/id/.._.._a_b.txt')
console.log('Chat upload checks passed: nested folders, directory batches, limits, fallback files, read errors and safe content types.')
