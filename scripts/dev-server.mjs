import { spawn, execFileSync } from 'node:child_process'
import { openSync, closeSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createConnection, createServer } from 'node:net'

const taskRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const taskPidFile = resolve(taskRoot, '.dev-server.pid')
const taskLogFile = resolve(taskRoot, '.dev-server.log')
const taskPort = Number(process.env.SCHEMATIC_PORT || 4173)
const taskHost = process.env.SCHEMATIC_HOST || '127.0.0.1'
const require = createRequire(import.meta.url)
const taskVite = resolve(dirname(require.resolve('vite/package.json')), 'bin/vite.js')
const delay = ms => new Promise(done => setTimeout(done, ms))
const alive = pid => { try { process.kill(pid, 0); return true } catch { return false } }
const readPid = () => { try { return JSON.parse(readFileSync(taskPidFile, 'utf8')) } catch { return null } }
const forgetPid = () => { if (existsSync(taskPidFile)) unlinkSync(taskPidFile) }
const owned = info => {
  if (!info || !Number.isInteger(info.pid) || info.root !== taskRoot || !alive(info.pid)) return false
  try {
    const command = process.platform === 'win32'
      ? execFileSync('powershell.exe', ['-NoProfile', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${info.pid}').CommandLine`], { encoding: 'utf8' })
      : execFileSync('ps', ['-p', String(info.pid), '-o', 'command='], { encoding: 'utf8' })
    return command.includes(taskVite)
  } catch { return false }
}
const portFree = () => new Promise((done, fail) => {
  const server = createServer()
  server.once('error', fail)
  server.listen(taskPort, taskHost, () => server.close(() => done()))
})
const ready = () => new Promise(done => {
  const socket = createConnection({ host: taskHost, port: taskPort })
  socket.once('connect', () => { socket.destroy(); done(true) })
  socket.once('error', () => { socket.destroy(); done(false) })
  socket.setTimeout(500, () => { socket.destroy(); done(false) })
})

try {
  if (!Number.isInteger(taskPort) || taskPort < 1024 || taskPort > 65535) throw new Error('SCHEMATIC_PORT deve essere una porta tra 1024 e 65535.')
  const action = process.argv[2], previous = readPid()
  if (action === 'stop') {
    if (owned(previous)) {
      process.kill(previous.pid, 'SIGTERM')
      for (let i = 0; i < 30 && alive(previous.pid); i++) await delay(100)
      if (alive(previous.pid)) throw new Error(`Il server ${previous.pid} non si è ancora arrestato. Riprova tra un momento.`)
      console.log('Server Schematic arrestato.')
    } else console.log('Nessun server Schematic avviato da questo strumento è attivo.')
    forgetPid()
  } else if (action === 'start') {
    if (owned(previous)) {
      console.log(`Schematic è già disponibile su http://${previous.host}:${previous.port}/`)
      process.exit(0)
    }
    await portFree()
    const log = openSync(taskLogFile, 'a')
    const child = spawn(process.execPath, [taskVite, '--host', taskHost, '--port', String(taskPort), '--strictPort'], { cwd: taskRoot, detached: true, stdio: ['ignore', log, log], windowsHide: true })
    closeSync(log)
    await new Promise((done, fail) => { child.once('spawn', done); child.once('error', fail) })
    writeFileSync(taskPidFile, JSON.stringify({ pid: child.pid, root: taskRoot, host: taskHost, port: taskPort }))
    child.unref()
    let started = false
    for (let i = 0; i < 80 && alive(child.pid); i++) {
      if (await ready()) { started = true; break }
      await delay(100)
    }
    if (!started) {
      if (alive(child.pid)) process.kill(child.pid, 'SIGTERM')
      forgetPid()
      throw new Error(`Avvio non riuscito. Controlla ${taskLogFile}`)
    }
    console.log(`Schematic è pronto: http://${taskHost}:${taskPort}/`)
  } else throw new Error('Usa: node scripts/dev-server.mjs start|stop')
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? `La porta ${taskPort} è occupata. Imposta SCHEMATIC_PORT per usarne un’altra.` : error.message)
  process.exitCode = 1
}
