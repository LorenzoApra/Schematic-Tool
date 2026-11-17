import Cocoa
import WebKit

struct TestFailure: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

@main
struct SmokeTests {
    @MainActor static func js(_ delegate: AppDelegate, _ source: String) async throws -> Any? {
        try await delegate.webView.callAsyncJavaScript(source, arguments: [:], in: nil, contentWorld: .page)
    }

    @MainActor static func ready(_ delegate: AppDelegate) async throws {
        _ = try await js(delegate, """
            for (let i = 0; i < 200; i++) {
                if (document.querySelector('.app-layout')) return true;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            throw new Error('Editor non caricato');
            """)
    }

    @MainActor static func download(_ delegate: AppDelegate, label: String, destination: URL) async throws -> Data {
        delegate.chooseDownloadDestination = { _, choose in choose(destination) }
        _ = try await js(delegate, """
            const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '\(label)');
            if (!button) throw new Error('Pulsante \(label) non trovato');
            button.click();
            """)
        for _ in 0..<150 {
            if FileManager.default.fileExists(atPath: destination.path) {
                return try Data(contentsOf: destination)
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw TestFailure("Esportazione \(label) non completata")
    }

    @MainActor static func run(_ delegate: AppDelegate, directory: URL) async throws {
        try await ready(delegate)
        let isOffline = try await js(delegate, """
            return location.origin === 'schematic://app'
                && !document.querySelector('[aria-label="Scarica per Mac"]')
                && [...document.querySelectorAll('script[src],link[rel="stylesheet"]')]
                    .every(el => new URL(el.src || el.href).protocol === 'schematic:');
            """) as? Bool
        guard isOffline == true else { throw TestFailure("L’app deve usare soltanto risorse locali") }
        _ = try await js(delegate, """
            [...document.querySelectorAll('button')].find(b => b.textContent.includes('Esplora uno schema di esempio')).click();
            await new Promise(resolve => setTimeout(resolve, 100));
            const input = document.querySelector('[aria-label="Titolo del progetto"]');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Prova macOS');
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(resolve => setTimeout(resolve, 100));
            window.dispatchEvent(new Event('schematic:save'));
            await window.webkit.messageHandlers.projectStorage.postMessage({ action: 'flush' });
            """)
        let saved = try JSONSerialization.jsonObject(with: Data(contentsOf: delegate.projectURL)) as? [String: Any]
        guard saved?["projectTitle"] as? String == "Prova macOS",
              (saved?["nodes"] as? [Any])?.count == 3 else {
            throw TestFailure("Il progetto non è stato salvato sul disco")
        }
        delegate.webView.reload()
        // Wait for the old document to be replaced before checking the new one.
        try await Task.sleep(nanoseconds: 600_000_000)
        try await ready(delegate)
        let restored = try await js(delegate, """
            return document.querySelector('[aria-label="Titolo del progetto"]').value === 'Prova macOS'
                && document.querySelectorAll('.device-node').length === 3
                && document.querySelector('.header-project').textContent.includes('Salvato su questo Mac');
            """) as? Bool
        guard restored == true else { throw TestFailure("Il progetto non viene ripristinato dopo la riapertura") }
        print("✓ Avvio offline, salvataggio nativo e ripristino del progetto")

        let project = try await download(delegate, label: "Esporta progetto", destination: directory.appendingPathComponent("export.json"))
        let exported = try JSONSerialization.jsonObject(with: project) as? [String: Any]
        guard exported?["format"] as? String == "live-show-schematic-project" else {
            throw TestFailure("Formato JSON incompatibile con la versione web")
        }
        let png = try await download(delegate, label: "PNG", destination: directory.appendingPathComponent("export.png"))
        guard Array(png.prefix(8)) == [137, 80, 78, 71, 13, 10, 26, 10] else { throw TestFailure("PNG non valido") }
        let pdf = try await download(delegate, label: "PDF", destination: directory.appendingPathComponent("export.pdf"))
        guard String(data: pdf.prefix(4), encoding: .utf8) == "%PDF" else { throw TestFailure("PDF non valido") }
        print("✓ Esportazione JSON, PNG e PDF tramite download nativi")

        // A damaged on-disk file must survive automatic saving untouched.
        let damaged = Data("{progetto danneggiato".utf8)
        try damaged.write(to: delegate.projectURL)
        delegate.webView.reload()
        try await Task.sleep(nanoseconds: 600_000_000)
        try await ready(delegate)
        _ = try await js(delegate, """
            window.dispatchEvent(new Event('schematic:save'));
            await new Promise(resolve => setTimeout(resolve, 700));
            if (!document.querySelector('.save-dot.error')) throw new Error('Errore di salvataggio non segnalato');
            """)
        guard try Data(contentsOf: delegate.projectURL) == damaged else {
            throw TestFailure("Il salvataggio automatico ha sovrascritto un file danneggiato")
        }
        print("✓ Protezione dei progetti non leggibili")
    }

    @MainActor static func main() {
        let directory = Bundle.main.bundleURL.deletingLastPathComponent()
        func finish(success: Bool, error: String = "") {
            let result: [String: Any] = ["success": success, "error": error]
            if let data = try? JSONSerialization.data(withJSONObject: result) {
                try? data.write(to: directory.appendingPathComponent("result.json"), options: .atomic)
            }
            exit(success ? EXIT_SUCCESS : EXIT_FAILURE)
        }
        let application = NSApplication.shared
        application.setActivationPolicy(.accessory)
        let delegate = AppDelegate(
            webDirectory: Bundle.main.resourceURL!.appendingPathComponent("web"),
            projectURL: directory.appendingPathComponent("project.json"), showWindow: false
        )
        application.delegate = delegate
        var started = false
        delegate.onReady = {
            guard !started else { return }
            started = true
            Task { @MainActor in
                do {
                    try await run(delegate, directory: directory)
                    print("Test macOS completati")
                    finish(success: true)
                } catch {
                    fputs("Test macOS fallito: \(error)\n", stderr)
                    finish(success: false, error: String(describing: error))
                }
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 75) {
            fputs("Timeout durante il test dell’app macOS\n", stderr)
            finish(success: false, error: "Timeout durante il test dell’app macOS")
        }
        withExtendedLifetime(delegate) { application.run() }
    }
}
