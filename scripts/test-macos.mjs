import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'darwin')
  throw new Error('Il test dell’app macOS richiede un Mac.')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const temporary = mkdtempSync(join(tmpdir(), 'schematic-native-test-'))
const prepareOnly = process.argv.includes('--prepare')
const run = (command, args) =>
  execFileSync(command, args, { cwd: root, stdio: 'inherit', timeout: 120_000 })
try {
  const bundle = join(temporary, 'SchematicTests.app')
  const contents = join(bundle, 'Contents')
  mkdirSync(join(contents, 'MacOS'), { recursive: true })
  mkdirSync(join(contents, 'Resources'), { recursive: true })
  cpSync(join(root, 'dist-desktop'), join(contents, 'Resources', 'web'), {
    recursive: true,
  })
  writeFileSync(
    join(contents, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>io.github.lorenzoapra.schematic-tool.tests</string>
  <key>CFBundleName</key><string>SchematicTests</string>
  <key>CFBundleExecutable</key><string>SchematicTests</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>`,
  )
  const executable = join(contents, 'MacOS', 'SchematicTests')
  run('xcrun', [
    'swiftc',
    '-swift-version',
    '5',
    '-parse-as-library',
    '-D',
    'SCHEMATIC_TEST',
    '-module-cache-path',
    join(temporary, 'modules'),
    '-framework',
    'Cocoa',
    '-framework',
    'WebKit',
    join(root, 'macos', 'Main.swift'),
    join(root, 'tests', 'macos', 'SmokeTests.swift'),
    '-o',
    executable,
  ])
  if (prepareOnly) {
    console.log(`Test app: ${bundle}`)
    console.log(`Results: ${join(temporary, 'result.json')}`)
  } else {
    // LaunchServices provides the GUI session required by WebKit and native panels.
    run('open', ['-W', '-n', bundle])
    const resultPath = join(temporary, 'result.json')
    if (!existsSync(resultPath))
      throw new Error('Il test macOS non ha prodotto un risultato')
    const result = JSON.parse(readFileSync(resultPath, 'utf8'))
    if (!result.success) throw new Error(result.error)
    console.log(
      '✓ Avvio offline, salvataggio e ripristino, esportazioni JSON/PNG/PDF e protezione dei file danneggiati',
    )
  }
} finally {
  if (!prepareOnly) rmSync(temporary, { recursive: true, force: true })
}
