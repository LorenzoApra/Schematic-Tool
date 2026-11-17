import Cocoa
import UniformTypeIdentifiers
import WebKit

// Serve only bundled assets under a stable origin. No server or network is needed.
final class AssetSchemeHandler: NSObject, WKURLSchemeHandler {
    let directory: URL

    init(directory: URL) {
        self.directory = directory.standardizedFileURL.resolvingSymlinksInPath()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              url.scheme == "schematic", url.host == "app" else {
            urlSchemeTask.didFailWithError(URLError(.unsupportedURL))
            return
        }
        let path = url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let file = directory.appendingPathComponent(path)
            .standardizedFileURL.resolvingSymlinksInPath()
        guard file.path.hasPrefix(directory.path + "/") else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }
        do {
            let data = try Data(contentsOf: file)
            let mime: String
            switch file.pathExtension.lowercased() {
            case "js", "mjs": mime = "application/javascript"
            case "css": mime = "text/css"
            case "html": mime = "text/html"
            case "svg": mime = "image/svg+xml"
            default:
                mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType
                    ?? "application/octet-stream"
            }
            urlSchemeTask.didReceive(URLResponse(
                url: url, mimeType: mime, expectedContentLength: data.count,
                textEncodingName: mime.hasPrefix("text/") || mime == "application/javascript"
                    ? "utf-8" : nil
            ))
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate,
    WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandlerWithReply {
    private(set) var window: NSWindow!
    private(set) var webView: WKWebView!
    private let webDirectory: URL
    let projectURL: URL
    private let showWindow: Bool
    private var closing = false
    private var projectLoaded = false
    private var loadedProjectData: Data?
    private var downloads: [ObjectIdentifier: (temporary: URL, destination: URL)] = [:]
    // Integration tests inject isolated files and avoid system panels.
    var onReady: (() -> Void)?
    var chooseDownloadDestination: ((String, @escaping (URL?) -> Void) -> Void)?

    init(webDirectory: URL? = nil, projectURL: URL? = nil, showWindow: Bool = true) {
        self.webDirectory = webDirectory
            ?? Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)
        self.projectURL = projectURL ?? FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0].appendingPathComponent("io.github.lorenzoapra.schematic-tool/project.json")
        self.showWindow = showWindow
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(
            AssetSchemeHandler(directory: webDirectory), forURLScheme: "schematic"
        )
        configuration.userContentController.addScriptMessageHandler(
            self, contentWorld: .page, name: "projectStorage"
        )
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 960),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false
        )
        window.title = "Schematic"
        window.minSize = NSSize(width: 720, height: 500)
        window.contentView = webView
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.center()
        if showWindow {
            window.setFrameAutosaveName("SchematicWorkspace")
            makeMenu()
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
        webView.load(URLRequest(url: URL(string: "schematic://app/index.html")!))
    }

    private func makeMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "Schematic")
        appMenu.addItem(withTitle: "Informazioni su Schematic",
                        action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)),
                        keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Nascondi Schematic",
                        action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Esci da Schematic",
                        action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)

        let edit = NSMenu(title: "Modifica")
        let undo = edit.addItem(withTitle: "Annulla", action: #selector(undoProject), keyEquivalent: "z")
        undo.target = self
        let redo = edit.addItem(withTitle: "Ripristina", action: #selector(redoProject), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        redo.target = self
        edit.addItem(.separator())
        for (title, action, key) in [
            ("Taglia", "cut:", "x"), ("Copia", "copy:", "c"),
            ("Incolla", "paste:", "v"), ("Seleziona tutto", "selectAll:", "a")
        ] {
            edit.addItem(withTitle: title, action: Selector(action), keyEquivalent: key)
        }
        let editItem = NSMenuItem()
        editItem.submenu = edit
        menu.addItem(editItem)

        let windowMenu = NSMenu(title: "Finestra")
        windowMenu.addItem(withTitle: "Contrai", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Chiudi", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        let windowItem = NSMenuItem()
        windowItem.submenu = windowMenu
        menu.addItem(windowItem)
        NSApp.windowsMenu = windowMenu
        NSApp.mainMenu = menu
    }

    @objc private func undoProject() { sendUndo(redo: false) }
    @objc private func redoProject() { sendUndo(redo: true) }

    private func sendUndo(redo: Bool) {
        webView.evaluateJavaScript("""
            if (document.activeElement?.matches('input,textarea,[contenteditable="true"]')) {
                document.execCommand('\(redo ? "redo" : "undo")');
            } else {
                window.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'z', metaKey: true, shiftKey: \(redo), bubbles: true
                }));
            }
            """)
    }

    // A narrow, main-frame-only bridge: no arbitrary filesystem paths from JavaScript.
    func userContentController(
        _ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
        replyHandler: @escaping (Any?, String?) -> Void
    ) {
        guard message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.scheme == "schematic",
              message.frameInfo.request.url?.host == "app",
              let body = message.body as? [String: Any], let action = body["action"] as? String else {
            replyHandler(nil, "Richiesta non autorizzata")
            return
        }
        do {
            switch action {
            case "load":
                projectLoaded = false
                if FileManager.default.fileExists(atPath: projectURL.path) {
                    let data = try Data(contentsOf: projectURL)
                    guard let value = String(data: data, encoding: .utf8) else {
                        throw CocoaError(.fileReadInapplicableStringEncoding)
                    }
                    // Protect an invalid existing file against automatic overwrites.
                    _ = try JSONSerialization.jsonObject(with: data)
                    loadedProjectData = data
                    projectLoaded = true
                    replyHandler(value, nil)
                } else {
                    loadedProjectData = nil
                    projectLoaded = true
                    replyHandler(nil, nil)
                }
            case "save":
                guard projectLoaded else {
                    replyHandler(nil, "Il progetto salvato non è leggibile. Esporta una copia prima di proseguire.")
                    return
                }
                guard let value = body["value"] as? String else {
                    replyHandler(nil, "Progetto non valido")
                    return
                }
                let current = FileManager.default.fileExists(atPath: projectURL.path)
                    ? try Data(contentsOf: projectURL) : nil
                guard current == loadedProjectData else {
                    replyHandler(nil, "Il file del progetto è stato modificato da un’altra applicazione. Esporta una copia prima di riaprirlo.")
                    return
                }
                let data = Data(value.utf8)
                _ = try JSONSerialization.jsonObject(with: data)
                try FileManager.default.createDirectory(
                    at: projectURL.deletingLastPathComponent(), withIntermediateDirectories: true
                )
                try data.write(to: projectURL, options: .atomic)
                loadedProjectData = data
                replyHandler(nil, nil)
            case "flush":
                // Earlier save messages have completed their atomic write on this thread.
                replyHandler(nil, nil)
            default:
                replyHandler(nil, "Operazione non supportata")
            }
        } catch {
            replyHandler(nil, error.localizedDescription)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if navigationAction.shouldPerformDownload && url.scheme == "blob" {
            decisionHandler(.download)
        } else if url.scheme == "schematic", url.host == "app" {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            if navigationAction.navigationType == .linkActivated, url.scheme == "https" {
                NSWorkspace.shared.open(url)
            }
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { onReady?() }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { showError(error) }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json]
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = false
        panel.beginSheetModal(for: window) { result in
            completionHandler(result == .OK ? panel.urls : nil)
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "Conferma")
        alert.addButton(withTitle: "Annulla")
        alert.beginSheetModal(for: window) { completionHandler($0 == .alertFirstButtonReturn) }
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let choose: (URL?) -> Void = { destination in
            guard let destination else { completionHandler(nil); return }
            // WKDownload requires a non-existent destination. Replace only after success.
            let temporary = destination.deletingLastPathComponent()
                .appendingPathComponent(".schematic-\(UUID().uuidString)")
            self.downloads[ObjectIdentifier(download)] = (temporary, destination)
            completionHandler(temporary)
        }
        if let chooseDownloadDestination {
            chooseDownloadDestination(suggestedFilename, choose)
            return
        }
        let panel = NSSavePanel()
        panel.canCreateDirectories = true
        panel.isExtensionHidden = false
        panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { choose($0 == .OK ? panel.url : nil) }
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let paths = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        do {
            if FileManager.default.fileExists(atPath: paths.destination.path) {
                _ = try FileManager.default.replaceItemAt(paths.destination, withItemAt: paths.temporary)
            } else {
                try FileManager.default.moveItem(at: paths.temporary, to: paths.destination)
            }
        } catch {
            try? FileManager.default.removeItem(at: paths.temporary)
            showError(error)
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let paths = downloads.removeValue(forKey: ObjectIdentifier(download)) {
            try? FileManager.default.removeItem(at: paths.temporary)
            showError(error)
        }
    }

    private func showError(_ error: Error) {
        let alert = NSAlert(error: error)
        alert.beginSheetModal(for: window)
    }

    private func flush(_ completion: @escaping () -> Void) {
        webView.callAsyncJavaScript("""
            window.dispatchEvent(new Event('schematic:save'));
            await window.webkit.messageHandlers.projectStorage.postMessage({ action: 'flush' });
            """, arguments: [:], in: nil, in: .page) { _ in completion() }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closing { return true }
        flush {
            self.closing = true
            sender.close()
        }
        return false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if closing { return .terminateNow }
        flush {
            self.closing = true
            sender.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        closing = false
        window.makeKeyAndOrderFront(nil)
        return true
    }
}

#if !SCHEMATIC_TEST
@main
struct SchematicApplication {
    @MainActor static func main() {
        let application = NSApplication.shared
        application.setActivationPolicy(.regular)
        let delegate = AppDelegate()
        application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }
}
#endif
