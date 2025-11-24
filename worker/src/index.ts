import { createProxyServer } from './proxy-server.js'

async function main() {
  console.log('Starting AI Interview Worker Proxy Server...')
  createProxyServer()
}

main().catch(console.error)
