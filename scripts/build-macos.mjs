import { execFileSync } from 'node:child_process'
import {
  cpSync,
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
  throw new Error(
    'La compilazione macOS richiede un Mac con Xcode Command Line Tools.',
  )
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const output = join(root, 'release')
const app = join(output, 'Schematic.app')
const resources = join(app, 'Contents', 'Resources')
const temporary = mkdtempSync(join(tmpdir(), 'schematic-build-'))
const run = (command, args) =>
  execFileSync(command, args, { cwd: root, stdio: 'inherit' })
const xml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;')

try {
  rmSync(app, { recursive: true, force: true })
  mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true })
  mkdirSync(resources, { recursive: true })
  cpSync(join(root, 'dist-desktop'), join(resources, 'web'), {
    recursive: true,
  })
  for (const arch of ['arm64', 'x86_64']) {
    run('xcrun', [
      'swiftc',
      '-swift-version',
      '5',
      '-parse-as-library',
      '-O',
      '-module-cache-path',
      join(temporary, 'modules'),
      '-target',
      `${arch}-apple-macos13.3`,
      '-framework',
      'Cocoa',
      '-framework',
      'WebKit',
      join(root, 'macos', 'Main.swift'),
      '-o',
      join(temporary, `Schematic-${arch}`),
    ])
  }
  run('xcrun', [
    'lipo',
    '-create',
    join(temporary, 'Schematic-arm64'),
    join(temporary, 'Schematic-x86_64'),
    '-output',
    join(app, 'Contents', 'MacOS', 'Schematic'),
  ])
  const iconset = join(temporary, 'Schematic.iconset')
  mkdirSync(iconset)
  run('xcrun', [
    'swift',
    '-module-cache-path',
    join(temporary, 'modules'),
    join(root, 'macos', 'Icon.swift'),
    iconset,
  ])
  // ICNS stores PNG representations with an eight-byte type/length header.
  // Writing the container directly also works on headless build hosts.
  const representations = [
    ['icp4', '16x16'],
    ['ic11', '16x16@2x'],
    ['icp5', '32x32'],
    ['ic12', '32x32@2x'],
    ['ic07', '128x128'],
    ['ic13', '128x128@2x'],
    ['ic08', '256x256'],
    ['ic14', '256x256@2x'],
    ['ic09', '512x512'],
    ['ic10', '512x512@2x'],
  ].map(([type, size]) => {
    const png = readFileSync(join(iconset, `icon_${size}.png`))
    const header = Buffer.alloc(8)
    header.write(type, 0, 4, 'ascii')
    header.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([header, png])
  })
  const iconBody = Buffer.concat(representations)
  const iconHeader = Buffer.alloc(8)
  iconHeader.write('icns')
  iconHeader.writeUInt32BE(iconBody.length + 8, 4)
  writeFileSync(
    join(resources, 'Schematic.icns'),
    Buffer.concat([iconHeader, iconBody]),
  )
  writeFileSync(
    join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>io.github.lorenzoapra.schematic-tool</string>
  <key>CFBundleName</key><string>Schematic</string>
  <key>CFBundleDisplayName</key><string>Schematic</string>
  <key>CFBundleExecutable</key><string>Schematic</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>Schematic.icns</string>
  <key>CFBundleShortVersionString</key><string>${xml(version)}</string>
  <key>CFBundleVersion</key><string>${xml(version)}</string>
  <key>LSMinimumSystemVersion</key><string>13.3</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>© Lorenzo Apra</string>
</dict></plist>
`,
  )
  const identity = process.env.MACOS_SIGN_IDENTITY || '-'
  run('codesign', [
    '--force',
    '--options',
    'runtime',
    identity === '-' ? '--timestamp=none' : '--timestamp',
    '--sign',
    identity,
    app,
  ])
  const archive = join(output, 'Schematic-macOS-universal.zip')
  const zip = () => {
    rmSync(archive, { force: true })
    run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, archive])
  }
  zip()
  if (process.env.MACOS_NOTARY_PROFILE) {
    if (identity === '-')
      throw new Error('La notarizzazione richiede MACOS_SIGN_IDENTITY')
    run('xcrun', [
      'notarytool',
      'submit',
      archive,
      '--keychain-profile',
      process.env.MACOS_NOTARY_PROFILE,
      '--wait',
    ])
    run('xcrun', ['stapler', 'staple', app])
    run('xcrun', ['stapler', 'validate', app])
    zip()
  }
  run('codesign', ['--verify', '--deep', '--strict', app])
  console.log(`Creato ${archive} (macOS 13.3+, Apple Silicon e Intel)`)
  if (identity === '-')
    console.log(
      'Build locale con firma ad hoc. Per la distribuzione pubblica usare Developer ID e notarizzazione.',
    )
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
