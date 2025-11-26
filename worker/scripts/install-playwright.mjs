#!/usr/bin/env node
import { spawn } from 'node:child_process'

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false })
    child.on('close', code => {
      if (code === 0) {
        resolve(undefined)
      } else {
        reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))
      }
    })
  })

const installArgs = ['playwright', 'install', 'chromium']
const linuxArgs = ['playwright', 'install', '--with-deps', 'chromium']

async function main() {
  const isLinux = process.platform === 'linux'
  const baseArgs = isLinux ? linuxArgs : installArgs

  try {
    await run('npx', ['--yes', ...baseArgs])
    return
  } catch (error) {
    if (isLinux) {
      console.warn('[install-playwright] Falling back to vanilla install:', error.message)
      await run('npx', ['--yes', ...installArgs])
      return
    }
    console.warn('[install-playwright] Initial install failed, retrying without --yes flag:', error.message)
    await run('npx', [...installArgs])
  }
}

main().catch(error => {
  console.error('[install-playwright] Failed to install browsers:', error)
  process.exitCode = 1
})

