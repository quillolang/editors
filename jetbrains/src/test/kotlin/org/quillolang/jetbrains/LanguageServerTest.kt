package org.quillolang.jetbrains

import com.intellij.notification.Notification
import com.intellij.notification.Notifications
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.application.ReadAction
import com.intellij.openapi.editor.Document
import com.redhat.devtools.lsp4ij.LSPIJUtils
import com.redhat.devtools.lsp4ij.LanguageServerManager
import com.redhat.devtools.lsp4ij.LanguageServiceAccessor
import com.redhat.devtools.lsp4ij.features.navigation.LSPGotoDeclarationHandler
import org.eclipse.lsp4j.DocumentSymbolParams
import org.eclipse.lsp4j.HoverParams
import org.eclipse.lsp4j.RenameParams
import org.eclipse.lsp4j.SignatureHelpParams
import org.eclipse.lsp4j.TextDocumentIdentifier
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.nio.file.attribute.FileTime

class LanguageServerTest : QuilloTestCase() {
    private val server get() =
        LanguageServerManager.getInstance(project).getLanguageServer(SERVER_ID).get()!!.server as QuilloServer

    private fun features() = LanguageServiceAccessor.getInstance(project).startedServers.single().clientFeatures as QuilloFeatures

    private fun document(): Document = myFixture.editor.document
    private fun id() = TextDocumentIdentifier(LSPIJUtils.toUriAsString(myFixture.file.virtualFile))
    private fun caret() = LSPIJUtils.toPosition(myFixture.caretOffset, document())

    fun testDiagnostics() {
        open("main.qwe", "fn f() = nope_name\n")
        waitFor("the diagnostic") { errors().any { "nope_name" in it } }
    }

    fun testQwerGoesToTheServer() {
        val file = open("lib.qwer", "pub fn add(a: i64) -> i64 { a }\n")
        assertEquals("qwer", file.virtualFile.extension)
    }

    fun testCompletion() {
        open("main.qwe", "fn greet_user(name) = name\nfn g() = gree<caret>\n")
        myFixture.completeBasic()
        val offered = myFixture.lookupElementStrings
        assertTrue("$offered / ${text()}", offered?.contains("greet_user") == true || "= greet_user" in text())
    }

    fun testCompletionOfMembers() {
        open("main.qwe", "fn g() = db.<caret>\n")
        myFixture.completeBasic()
        assertTrue("${myFixture.lookupElementStrings}", myFixture.lookupElementStrings.orEmpty().any { it.startsWith("exec") })
    }

    fun testGoToDefinition() {
        open("main.qwe", "fn target() = 1\nfn g() = tar<caret>get()\n")
        val editor = myFixture.editor
        val at = myFixture.caretOffset
        val found = ApplicationManager.getApplication().executeOnPooledThread<Int> {
            ReadAction.compute<Int, Throwable> {
                val element = myFixture.file.findElementAt(at)
                LSPGotoDeclarationHandler().getGotoDeclarationTargets(element, at, editor)?.firstOrNull()?.textOffset ?: -1
            }
        }
        waitFor("the definition") { found.isDone }
        assertEquals(text().indexOf("target"), found.get())
    }

    fun testHover() {
        open("main.qwe", "fn add(a, b) = a + b\nfn g() = ad<caret>d(1, 2)\n")
        val hover = server.textDocumentService.hover(HoverParams(id(), caret())).get()
        assertTrue(hover.toString(), "add" in hover.contents.right.value)
    }

    fun testParameterHints() {
        open("main.qwe", "fn add(a, b) = a + b\nfn g() = add(1, <caret>2)\n")
        val help = server.textDocumentService.signatureHelp(SignatureHelpParams(id(), caret())).get()
        assertEquals(1, help.activeParameter)
        assertTrue(help.toString(), "add" in help.signatures[0].label)
    }

    fun testOutline() {
        open("main.qwe", "fn add(a, b) = a + b\nroute GET /notes = \"x\"\n")
        val symbols = server.textDocumentService.documentSymbol(DocumentSymbolParams(id())).get()
        val names = symbols.map { it.toString() }
        assertTrue("$names", names.any { "add" in it } && names.any { "/notes" in it })
    }

    /** Quillo renames a class, in the markup and in the sheet. */
    fun testRenameOfAClass() {
        val sheet = myFixture.addFileToProject("public/app.css", ".chip { color: red }\n")
        val page = myFixture.addFileToProject("main.qwe", "use \"public/app.css\"\nview Page() = <span.chip>hi</span>\n")
        myFixture.openFileInEditor(sheet.virtualFile)
        connect(myFixture.file)
        myFixture.openFileInEditor(page.virtualFile)
        connect(myFixture.file)
        myFixture.editor.caretModel.moveToOffset(text().indexOf("chip") + 1)
        val edit = server.textDocumentService.rename(RenameParams(id(), caret(), "tag")).get()
        val files = edit.changes?.keys ?: edit.documentChanges.map { it.left.textDocument.uri }
        assertTrue("$files", files.any { it.endsWith("main.qwe") } && files.any { it.endsWith("app.css") })
    }

    fun testQuickFixAddsTheEndTag() {
        open("main.qwe", "component List() {\n    <ul>\n        <li>one\n    </ul>\n}\n")
        waitFor("the server's diagnostic") { published().any { "never closed" in it.toString() } }
        waitFor("the unclosed element in the editor") { errors().any { "never closed" in it } }
        myFixture.editor.caretModel.moveToOffset(text().indexOf("<li>") + 2)
        waitFor("its quick fix") { myFixture.getAllQuickFixes().any { it.text == "Add </li>" } }
        myFixture.launchAction(myFixture.getAllQuickFixes().first { it.text == "Add </li>" })
        waitFor("the end tag") { "</li>" in text() }
    }

    fun testStartTagClosed() {
        open("main.qwe", "view Page() = <ul<caret>\n")
        myFixture.type('>')
        waitFor("the end tag") { "</ul>" in text() }
        assertEquals("view Page() = <ul></ul>\n", text())
        assertEquals("<ul>".length + "view Page() = ".length, myFixture.caretOffset)
    }

    fun testEndTagFinished() {
        open("main.qwe", "view Page() = <ul><<caret>\n")
        myFixture.type('/')
        waitFor("the tag's name") { "</ul>" in text() }
        assertEquals("view Page() = <ul></ul>\n", text())
        assertEquals(text().indexOf("\n"), myFixture.caretOffset)
    }

    fun testComparisonIsLeftAlone() {
        open("main.qwe", "fn f(a, b) = a <caret>\n")
        myFixture.type('>')
        settle()
        assertEquals("fn f(a, b) = a >\n", text())
    }

    fun testAutoCloseTagsSetting() {
        QuilloSettings.getInstance().state.autoCloseTags = false
        try {
            open("main.qwe", "view Page() = <ul<caret>\n")
            myFixture.type('>')
            settle()
            assertEquals("view Page() = <ul>\n", text())
        } finally {
            QuilloSettings.getInstance().state.autoCloseTags = true
        }
    }

    fun testRestartsAfterARebuild() {
        val copy = Files.createTempDirectory("quillo").resolve("quillo")
        Files.copy(Path.of(binary!!), copy, StandardCopyOption.COPY_ATTRIBUTES)
        QuilloSettings.getInstance().state.path = copy.toString()
        open("main.qwe", "fn f() = 1\n")
        val wrapper = LanguageServiceAccessor.getInstance(project).startedServers.single()
        val before = wrapper.currentProcessId
        assertTrue(before != null)
        Files.setLastModifiedTime(copy, FileTime.fromMillis(System.currentTimeMillis() + 5000))
        waitFor("a new server") { wrapper.currentProcessId != null && wrapper.currentProcessId != before }
    }

    fun testSaysWhenTheBinaryIsMissing() {
        QuilloSettings.getInstance().state.path = "/nowhere/quillo"
        val said = ArrayList<Notification>()
        project.messageBus.connect(testRootDisposable).subscribe(Notifications.TOPIC, object : Notifications {
            override fun notify(notification: Notification) { said.add(notification) }
        })
        val file = myFixture.configureByText("main.qwe", "fn f() = 1\n")
        restartServer(project)
        val servers = LanguageServiceAccessor.getInstance(project).getLanguageServers(file, null, null)
        waitFor("the notification") { said.any { "/nowhere/quillo" in it.content } }
        assertEquals(listOf("Download quillo", "Open settings"), said.first().actions.map { it.templateText })
        waitFor("the answer") { servers.isDone }
        assertEmpty("the server is not tried", servers.get())

        // Said once, not at each file; and it is back once the binary is.
        val second = myFixture.configureByText("other.qwe", "fn g() = 2\n")
        val again = LanguageServiceAccessor.getInstance(project).getLanguageServers(second, null, null)
        waitFor("the second answer") { again.isDone }
        assertEquals(1, said.size)
        QuilloSettings.getInstance().state.path = binary
        connect(second)
    }

    fun testCssInPublicReachesTheServer() {
        val css = myFixture.addFileToProject("public/app.css", ".chip { color: red }\n")
        myFixture.openFileInEditor(css.virtualFile)
        connect(myFixture.file)
        assertTrue(features().cssWelcome)
        assertEmpty(errors())
    }

    fun testOtherCssDoesNot() {
        val css = myFixture.addFileToProject("styles/app.css", ".chip { color: red }\n")
        myFixture.openFileInEditor(css.virtualFile)
        val servers = LanguageServiceAccessor.getInstance(project).getLanguageServers(myFixture.file, null, null)
        waitFor("the matcher") { servers.isDone }
        assertEmpty(servers.get())
    }

    /** QUILLO_OLD_BIN: a server from before experimental.cssClasses, which reads CSS as Quillo. */
    fun testOldServerSaysNothingAboutCss() {
        val old = System.getenv("QUILLO_OLD_BIN") ?: return
        QuilloSettings.getInstance().state.path = old
        val css = myFixture.addFileToProject("public/app.css", ".chip { color: red }\n")
        myFixture.openFileInEditor(css.virtualFile)
        connect(myFixture.file)
        settle(1500)
        assertFalse(features().cssWelcome)
        assertEmpty(published())
    }
}
