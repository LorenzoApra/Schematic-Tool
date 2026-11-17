import Cocoa

// Draw the existing Schematic mark as a macOS icon, without external tools.
let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
        )!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let context = NSGraphicsContext.current!.cgContext
        context.scaleBy(x: CGFloat(pixels) / 64, y: CGFloat(pixels) / 64)
        NSColor(calibratedRed: 8 / 255, green: 127 / 255, blue: 112 / 255, alpha: 1).setFill()
        NSBezierPath(roundedRect: NSRect(x: 2, y: 2, width: 60, height: 60), xRadius: 14, yRadius: 14).fill()
        NSColor.white.setStroke()
        let path = NSBezierPath()
        path.lineWidth = 3
        path.lineJoinStyle = .round
        path.appendRect(NSRect(x: 13, y: 36, width: 15, height: 15))
        path.appendRect(NSRect(x: 36, y: 36, width: 15, height: 15))
        path.appendRect(NSRect(x: 36, y: 13, width: 15, height: 15))
        path.move(to: NSPoint(x: 20, y: 36))
        path.line(to: NSPoint(x: 20, y: 21))
        path.line(to: NSPoint(x: 36, y: 21))
        path.move(to: NSPoint(x: 44, y: 36))
        path.line(to: NSPoint(x: 44, y: 28))
        path.stroke()
        NSGraphicsContext.restoreGraphicsState()
        let name = "icon_\(size)x\(size)\(scale == 2 ? "@2x" : "").png"
        try bitmap.representation(using: .png, properties: [:])!.write(to: directory.appendingPathComponent(name))
    }
}
