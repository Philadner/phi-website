import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function load(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
}
const { parseChatCommand, mentionNames, mentionsAi, mentionText } = await load('../src/lib/chatFeatures.ts')
const { AI_MODEL, AI_SCHEMA, parseAiOutput, aiMessageInput } = await load('../api/_lib/chatAi.ts')
assert.equal(AI_MODEL, 'gpt-6-luna')
assert.deepEqual(Object.keys(AI_SCHEMA.properties), ['Message', 'modifiers'])
for (const typo of ['/aip hi', '/CLEAR', '/clear extra', '/badabingbadaboomforceclea', '/help extra']) assert.equal(parseChatCommand(typo).kind, 'invalid')
assert.equal(parseChatCommand('/clear').kind, 'clear')
assert.equal(parseChatCommand('/bigahhclear').kind, 'vote')
assert.equal(parseChatCommand('/badabingbadaboomforceclear').kind, 'force')
assert.deepEqual(parseChatCommand('//not-a-command'), { kind: 'message', content: '/not-a-command' })
assert.deepEqual(parseChatCommand('/ai hello'), { kind: 'ai', content: 'hello' })
assert.deepEqual(mentionNames('Hi @Phil, @"Person Two"! `@AI`\n```\n@Hidden\n```\na@fake.test'), ['phil', 'person two'])
assert.equal(mentionsAi('@AI hello', 'Beans'), true)
assert.equal(mentionsAi('@Beans hi', 'Beans'), true)
assert.equal(mentionsAi('email@ai.example', 'Beans'), false)
assert.equal(mentionsAi('`@ai`', 'Beans'), false)
assert.equal(mentionText('Person Two'), '@"Person Two" ')
const output = (value) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] })
assert.deepEqual(parseAiOutput(output({ Message: ' Hi ', modifiers: { request_context: true, name: 'Beans' } })), { Message: 'Hi', modifiers: { request_context: true, name: 'Beans' } })
assert.equal(parseAiOutput(output({ Message: 'Hi', modifiers: { request_context: false, name: '<script>' } })).modifiers.name, null)
assert.throws(() => parseAiOutput(output({ Message: '', modifiers: { request_context: false, name: null } })))
assert.throws(() => parseAiOutput(output({ Message: 'Hi', modifiers: { request_context: 'true', name: null } })))
assert.throws(() => parseAiOutput({ status: 'incomplete', output: [] }))
const message = { id: 1, username: 'Codex', content: 'image', attachments: [{ name: 'test.png', contentType: 'image/png', url: 'https://abc.public.blob.vercel-storage.com/chat/test.png' }, { name: 'tracking.png', contentType: 'image/png', url: 'https://example.invalid/tracking.png' }] }
assert.equal(aiMessageInput(message, false).filter((part) => part.type === 'input_image').length, 0)
assert.equal(aiMessageInput(message, true).filter((part) => part.type === 'input_image').length, 1)
console.log('Chat feature checks passed: command typos, escaped slash, mentions, code exclusion, exact model/schema, output validation and consent-gated image inputs.')
