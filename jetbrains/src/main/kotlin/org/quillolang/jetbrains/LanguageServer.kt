package org.quillolang.jetbrains

import com.google.gson.JsonObject
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.concurrency.AppExecutorUtil
import com.redhat.devtools.lsp4ij.DocumentMatcher
import com.redhat.devtools.lsp4ij.LanguageServerFactory
import com.redhat.devtools.lsp4ij.LanguageServerManager
import com.redhat.devtools.lsp4ij.ServerStatus
import com.redhat.devtools.lsp4ij.client.LanguageClientImpl
import com.redhat.devtools.lsp4ij.client.features.FileUriSupport
import com.redhat.devtools.lsp4ij.client.features.LSPClientFeatures
import com.redhat.devtools.lsp4ij.features.diagnostics.LSPDiagnosticsApplier
import com.redhat.devtools.lsp4ij.server.CannotStartProcessException
import com.redhat.devtools.lsp4ij.server.OSProcessStreamConnectionProvider
import com.redhat.devtools.lsp4ij.server.StreamConnectionProvider
import org.eclipse.lsp4j.PublishDiagnosticsParams
import org.eclipse.lsp4j.ServerCapabilities
import org.eclipse.lsp4j.TextDocumentPositionParams
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest
import org.eclipse.lsp4j.services.LanguageServer
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

const val SERVER_ID = "quillo"

/** `quillo lsp`, with the one request of its own. */
interface QuilloServer : LanguageServer {
    @JsonRequest("quillo/closeTag")
    fun closeTag(params: TextDocumentPositionParams): CompletableFuture<String?>
}

class QuilloServerFactory : LanguageServerFactory {
    override fun createConnectionProvider(project: Project): StreamConnectionProvider = QuilloConnection(project)
    override fun createLanguageClient(project: Project): LanguageClientImpl = QuilloClient(project)
    override fun createClientFeatures(): LSPClientFeatures = QuilloFeatures()
    override fun getServerInterface(): Class<out LanguageServer> = QuilloServer::class.java
}

class QuilloFeatures : LSPClientFeatures() {
    /** Whether this server has `experimental.cssClasses`: it reads CSS as CSS. */
    @Volatile
    var cssWelcome = false
        private set

    override fun setServerCapabilities(serverCapabilities: ServerCapabilities) {
        super.setServerCapabilities(serverCapabilities)
        cssWelcome = (serverCapabilities.experimental as? JsonObject)?.get("cssClasses")?.asBoolean == true
    }

    /** With no binary the server is not tried: LSP4IJ logs each failed start as an internal error. */
    override fun isEnabled(file: VirtualFile): Boolean {
        if (serverStatus != ServerStatus.started && !binaryFound(project)) return false
        return super.isEnabled(file)
    }
}

class QuilloConnection(private val project: Project) : OSProcessStreamConnectionProvider() {
    override fun start() {
        val command = quilloPath(project)
        val binary = resolveBinary(command)
            ?: throw CannotStartProcessException("Install quillo or set its path: $command was not found")
        project.service<BinaryWatcher>().watch(binary)
        commandLine = GeneralCommandLine(binary.toString(), "lsp")
            .withCharset(StandardCharsets.UTF_8)
            .withWorkDirectory(existingFolder(project.basePath))
        super.start()
    }
}

/**
 * A server from before `experimental.cssClasses` reads CSS as Quillo and marks
 * it all as errors. LSP4IJ opens the file before it can know which server this
 * is, so what such a server says about CSS files is dropped here.
 */
class QuilloClient(project: Project) : LanguageClientImpl(project) {
    override fun publishDiagnostics(diagnostics: PublishDiagnosticsParams) {
        if (diagnostics.uri.endsWith(".css") && !(clientFeatures as QuilloFeatures).cssWelcome) return
        super.publishDiagnostics(diagnostics)
        if (LSPDiagnosticsApplier.GROUP_ID == -1) showOnceReady(diagnostics.uri, 100)
    }

    /**
     * LSP4IJ drops what it is told before the IDE's first highlighting pass is
     * registered, and `quillo lsp` answers fast enough for that: the first file
     * opened would show no errors until it was edited. So they are shown again.
     */
    private fun showOnceReady(uri: String, tries: Int) {
        AppExecutorUtil.getAppScheduledExecutorService().schedule({
            when {
                project.isDisposed -> Unit
                LSPDiagnosticsApplier.GROUP_ID == -1 -> if (tries > 0) showOnceReady(uri, tries - 1)
                else -> FileUriSupport.findFileByUri(uri, clientFeatures)?.let {
                    LSPDiagnosticsApplier.getInstance(project).scheduleRefresh(it, null)
                }
            }
        }, 100, TimeUnit.MILLISECONDS)
    }
}

/** An app's style sheets: hover, references and rename of their classes, which the markup writes. */
class PublicCssMatcher : DocumentMatcher {
    override fun match(file: VirtualFile, project: Project): Boolean = "/public/" in file.path
}

/** Whether the binary is there, saying so once if it is not, and not at each file and retry. */
fun binaryFound(project: Project): Boolean {
    val command = quilloPath(project)
    val found = resolveBinary(command) != null
    if (project.service<BinaryWatcher>().noteMissing(!found)) notifyMissingBinary(project, command)
    return found
}

fun restartServer(project: Project) {
    val manager = LanguageServerManager.getInstance(project)
    if (binaryFound(project)) manager.start(SERVER_ID, LanguageServerManager.StartOptions().setForceRestart(true))
    else manager.stop(SERVER_ID, LanguageServerManager.StopOptions().setWillDisable(false))
}

/**
 * The server runs the binary as it was when it started: after a rebuild
 * (cargo build, cargo install), it would still parse code as the old one
 * did, and new syntax would show as errors. So it is started again once the
 * file has been replaced and has stopped changing.
 */
@Service(Service.Level.PROJECT)
class BinaryWatcher(private val project: Project) : Disposable {
    private var task: ScheduledFuture<*>? = null
    private var watched: Path? = null
    private var running: Stamp? = null
    private var last: Stamp? = null
    private var warned = false

    private data class Stamp(val modified: Long, val size: Long)

    /** True when the binary has just gone missing. */
    @Synchronized
    fun noteMissing(missing: Boolean): Boolean = (missing && !warned).also { warned = missing }

    @Synchronized
    fun watch(file: Path) {
        watched = file
        running = stamp(file)
        last = running
        if (task != null) return
        task = AppExecutorUtil.getAppScheduledExecutorService()
            .scheduleWithFixedDelay(::poll, 2, 2, TimeUnit.SECONDS)
        Disposer.register(project, this)
    }

    @Synchronized
    private fun poll() {
        val now = watched?.let(::stamp) ?: return
        val settled = now == last
        last = now
        if (!settled || now == running || now.size == 0L) return
        running = now
        restartServer(project)
    }

    private fun stamp(file: Path): Stamp? =
        runCatching { Stamp(Files.getLastModifiedTime(file).toMillis(), Files.size(file)) }.getOrNull()

    override fun dispose() {
        task?.cancel(false)
    }
}
