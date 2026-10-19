import { createServer } from 'vite'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { host: { type: 'string', default: 'localhost' } } })
const servers = []
let stopping = false
async function stop(code) {
  if (stopping) return
  stopping = true
  await Promise.allSettled(servers.map(server => server.close()))
  process.exit(code)
}
process.on('SIGINT', () => void stop(130))
process.on('SIGTERM', () => void stop(143))
try {
  for (const { label, mode, port } of [
    { label: '紹介ページ', mode: 'development', port: 5173 },
    { label: '家計簿', mode: 'app', port: 5174 },
  ]) {
    const server = await createServer({ mode, server: { host: values.host, port, strictPort: true } })
    servers.push(server)
    await server.listen()
    console.log(`\n${label}`)
    server.printUrls()
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  await stop(1)
}
