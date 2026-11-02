package org.quillolang.jetbrains

import com.intellij.openapi.vfs.VirtualFile
import com.redhat.devtools.lsp4ij.LSPIJUtils
import org.eclipse.lsp4j.Diagnostic
import com.intellij.psi.PsiFile
import com.intellij.testFramework.PlatformTestUtil
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.testFramework.fixtures.impl.TempDirTestFixtureImpl
import com.redhat.devtools.lsp4ij.LanguageServerManager
import com.redhat.devtools.lsp4ij.LanguageServiceAccessor
import org.jetbrains.plugins.textmate.TextMateService

/**
 * The real `quillo` in the real platform, on files on disk. QUILLO_BIN names the
 * binary: with none, these tests are skipped (no quillo was built for them).
 */
abstract class QuilloTestCase : BasePlatformTestCase() {
    protected val binary: String? = System.getenv("QUILLO_BIN")

    override fun createTempDirTestFixture() = TempDirTestFixtureImpl()

    override fun shouldRunTest() = binary != null && super.shouldRunTest()

    override fun setUp() {
        super.setUp()
        TextMateService.getInstance().reloadEnabledBundles()
        QuilloSettings.getInstance().state.path = binary
    }

    override fun tearDown() {
        try {
            // The project is shared between tests: a plain stop would disable the server for the next.
            LanguageServerManager.getInstance(project).stop(SERVER_ID, LanguageServerManager.StopOptions().setWillDisable(false))
            QuilloSettings.getInstance().state.path = null
        } catch (e: Throwable) {
            addSuppressedException(e)
        } finally {
            super.tearDown()
        }
    }

    /** Waits with the event queue running, as what is waited for may need it. */
    protected fun waitFor(what: String, seconds: Int = 30, condition: () -> Boolean) {
        val until = System.currentTimeMillis() + seconds * 1000L
        while (!condition()) {
            if (System.currentTimeMillis() > until) fail("timed out waiting for $what")
            PlatformTestUtil.dispatchAllEventsInIdeEventQueue()
            Thread.sleep(25)
        }
    }

    /** For what should not happen: the time for it to, with the event queue running. */
    protected fun settle(millis: Long = 600) {
        val until = System.currentTimeMillis() + millis
        while (System.currentTimeMillis() < until) {
            PlatformTestUtil.dispatchAllEventsInIdeEventQueue()
            Thread.sleep(25)
        }
    }

    /** Opens the file and waits for its server, which has the document by then. */
    protected fun connect(file: PsiFile) {
        val servers = LanguageServiceAccessor.getInstance(project).getLanguageServers(file, null, null)
        waitFor("the server for ${file.name}") { servers.isDone }
        assertFalse("no server for ${file.name}", servers.get().isEmpty())
    }

    protected fun open(name: String, text: String): PsiFile = myFixture.configureByText(name, text).also(::connect)

    protected fun openOnDisk(file: VirtualFile): PsiFile {
        myFixture.openFileInEditor(file)
        return myFixture.file.also(::connect)
    }

    protected fun errors(): List<String> =
        myFixture.doHighlighting().filter { it.severity == com.intellij.lang.annotation.HighlightSeverity.ERROR }.mapNotNull { it.description }

    /** What LSP4IJ holds for the open file: all the server said, whatever the editor has shown of it. */
    protected fun published(): List<Diagnostic> {
        val uri = LSPIJUtils.toUri(myFixture.file.virtualFile)
        return LanguageServiceAccessor.getInstance(project).startedServers
            .flatMap { it.getOpenedDocument(uri)?.diagnosticsForServer?.diagnostics.orEmpty() }
    }

    protected fun text() = myFixture.editor.document.text
}
