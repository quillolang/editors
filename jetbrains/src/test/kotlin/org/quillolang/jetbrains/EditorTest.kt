package org.quillolang.jetbrains

import com.google.gson.JsonElement
import com.google.gson.JsonParser
import com.intellij.codeInsight.template.impl.TemplateManagerImpl
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.IdeActions
import com.intellij.openapi.editor.ex.EditorEx
import com.intellij.openapi.editor.highlighter.HighlighterIterator
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.util.Disposer
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.testFramework.fixtures.impl.TempDirTestFixtureImpl
import org.jetbrains.plugins.textmate.TextMateFileType
import org.jcodings.specific.UTF8Encoding
import org.jetbrains.plugins.textmate.TextMateService
import org.joni.Regex
import org.joni.WarnCallback
import org.joni.exception.JOniException
import java.nio.file.Files

/** What comes from VS Code's bundle, with no language server: the file types, highlighting, comments, brackets. */
class EditorTest : BasePlatformTestCase() {
    override fun createTempDirTestFixture() = TempDirTestFixtureImpl()

    override fun setUp() {
        super.setUp()
        TextMateService.getInstance().reloadEnabledBundles()
    }

    private fun tokens(): List<Pair<String, String>> {
        val text = myFixture.editor.document.text
        val it: HighlighterIterator = (myFixture.editor as EditorEx).highlighter.createIterator(0)
        val out = ArrayList<Pair<String, String>>()
        while (!it.atEnd()) {
            out.add(text.substring(it.start, it.end) to it.tokenType.toString())
            it.advance()
        }
        return out
    }

    private fun scopeOf(word: String): String =
        tokens().firstOrNull { it.first.trim() == word }?.second ?: error("no token $word in ${tokens()}")

    fun testFileTypes() {
        val qwe = myFixture.configureByText("main.qwe", "fn f() = 1\n")
        assertSame(TextMateFileType.INSTANCE, qwe.virtualFile.fileType)
        val qwer = myFixture.configureByText("lib.qwer", "pub fn f() -> i64 { 1 }\n")
        assertSame(TextMateFileType.INSTANCE, qwer.virtualFile.fileType)
    }

    fun testQuilloHighlighting() {
        myFixture.configureByText("main.qwe", "// hello\nfn add(a, b) = a + 1\nroute GET /notes = \"x\"\n")
        val fn = scopeOf("fn")
        assertTrue(fn, "source.quillo" in fn && "storage.type.function" in fn)
        val comment = tokens().first { "hello" in it.first }.second
        assertTrue(comment, "comment" in comment)
    }

    fun testSqlInsideDbExec() {
        myFixture.configureByText("main.qwe", "db.exec(\"select id from notes\")\n")
        val select = tokens().first { it.first.trim().equals("select", ignoreCase = true) }.second
        assertTrue(select, "keyword" in select && ("sql" in select))
    }

    fun testRustInQwer() {
        myFixture.configureByText("lib.qwer", "pub fn add(a: i64) -> i64 { a }\n")
        val fn = scopeOf("fn")
        assertTrue(fn, "source.qwer" in fn && "rust" in fn)
    }

    fun testTypeInAPattern() {
        myFixture.configureByText("main.qwe", "route POST /things { json: { name: str } } {\n}\n")
        val type = scopeOf("str")
        assertTrue(type, "support.type" in type)
    }

    fun testImportsReadTheFileFirst() {
        myFixture.configureByText("main.qwe", "import lib/forum.qwe use latest, older as past\n")
        assertTrue(scopeOf("import"), "keyword.other.import" in scopeOf("import"))
        assertTrue(scopeOf("lib/forum.qwe"), "string.unquoted.path" in scopeOf("lib/forum.qwe"))
        assertTrue(scopeOf("past"), "entity.name.function" in scopeOf("past"))
    }

    fun testALongAddressLeavesItsUseToTheNextLine() {
        myFixture.configureByText("main.qwe", "preload module \"https://a.b/c.js\"\n    use confetti\nfn next() = 1\n")
        assertTrue(scopeOf("preload"), "keyword.other.library-hint" in scopeOf("preload"))
        assertTrue(scopeOf("confetti"), "entity.name.function" in scopeOf("confetti"))
        assertTrue(scopeOf("fn"), "storage.type.function" in scopeOf("fn"))
    }

    fun testTheWordsOfAnImportAreStillNames() {
        myFixture.configureByText("main.qwe", "client = 8\nlet x = client / 2\n")
        val first = tokens().first { "client" in it.first }.second
        assertFalse(first, "keyword.other.import" in first)
    }

    fun testSiteIsAKeywordOnlyBeforeANameAndEquals() {
        myFixture.configureByText("main.qwe", "site shop = \"https://shop.example.com\"\nlet site = 1\nlet n = site + 2\n")
        val all = tokens().filter { it.first.trim() == "site" }
        assertEquals(all.toString(), 3, all.size)
        assertTrue(all[0].second, "keyword.other.site" in all[0].second)
        assertFalse(all[1].second, "keyword.other.site" in all[1].second)
        assertFalse(all[2].second, "keyword.other.site" in all[2].second)
        assertTrue(scopeOf("shop"), "variable.other.declaration" in scopeOf("shop"))
    }

    /** `mcp` before a name on its line is the tag of a tool, and a name everywhere else (quillo FEEDBACK56.md, Q-853). */
    fun testMcpIsATagOnlyBeforeAName() {
        myFixture.configureByText(
            "main.qwe",
            "fn mcp total() = 1\nfn mcp mcp() = 2\nfn mcp(x) = x\nservice mcp crm = \"https://crm.example.com/mcp\"\nservice mcp = \"mcp.qwe\"\n",
        )
        val all = tokens().filter { it.first.trim() == "mcp" }
        assertEquals(all.toString(), 6, all.size)
        for (i in listOf(0, 1, 4)) assertTrue(all[i].second, "storage.modifier.mcp" in all[i].second)
        for (i in listOf(2, 3)) assertTrue(all[i].second, "entity.name.function" in all[i].second)
        assertFalse(all[5].second, "storage.modifier.mcp" in all[5].second)
        assertTrue(scopeOf("total"), "entity.name.function" in scopeOf("total"))
    }

    /**
     * VS Code reads `\A` as the document's start. The IDE's lexer reads it as each line's, so a `#!`
     * after the first line is a comment here too: a line `quillo check` refuses anyway.
     */
    fun testShebang() {
        myFixture.configureByText("tool.qwe", "#!/usr/bin/env quillo\nlet a = 1\n")
        val first = tokens().first { it.first.startsWith("#!/usr") }.second
        assertTrue(first, "comment.line.shebang" in first)
        assertTrue(scopeOf("let"), "storage.type.let" in scopeOf("let"))
    }

    fun testNewerBuiltinsAndModules() {
        myFixture.configureByText("main.qwe", "run_after(300, f)\nlet p = local_path(next)\nlet s = later.status(id)\nlet x = bit.and(a, b)\n")
        assertTrue(scopeOf("run_after"), "support.function.builtin" in scopeOf("run_after"))
        assertTrue(scopeOf("local_path"), "support.function.builtin" in scopeOf("local_path"))
        assertTrue(scopeOf("later"), "support.module" in scopeOf("later"))
        assertTrue(scopeOf("bit"), "support.module" in scopeOf("bit"))
    }

    /** `/* ... */` is a comment, over lines too, where it was code; in a route group's path `/*` is a wildcard. */
    fun testBlockComments() {
        myFixture.configureByText("main.qwe", "let a = 1 /* a\nnote */ + 2\nroutes /*x with db {\n}\nlet b = 3\n")
        val note = tokens().first { "note" in it.first }.second
        assertTrue(note, "comment.block" in note)
        assertTrue(scopeOf("2"), "constant.numeric" in scopeOf("2"))
        val wildcard = tokens().first { it.first == "*" }.second
        assertTrue(wildcard, "keyword.operator.wildcard" in wildcard)
        assertTrue(scopeOf("b"), "variable.other.declaration" in scopeOf("b"))
    }

    /** A tool's questions and the MCP door's tokens are builtins; `//!` is a comment (quillo FEEDBACK56.md). */
    fun testTheToolsBuiltins() {
        myFixture.configureByText("main.qwe", "//! Notes are private.\npublic server fn save(t: str) = confirm(t)\nlet k = mcp_tokens() ?? revoke_mcp_token(id) ?? mcp_token()\nlet who = about(\"Who?\", { a: \"A\" }, \"a\")\n")
        val instructions = tokens().first { "Notes are private" in it.first }.second
        assertTrue(instructions, "comment" in instructions)
        assertTrue(scopeOf("server"), "storage.modifier.server" in scopeOf("server"))
        for (name in listOf("confirm", "mcp_tokens", "revoke_mcp_token", "mcp_token", "about")) {
            assertTrue(scopeOf(name), "support.function.builtin" in scopeOf(name))
        }
    }

    fun testARelativeImport() {
        myFixture.configureByText("main.qwe", "import ../shared/auth.qwe use login\n")
        assertTrue(scopeOf("../shared/auth.qwe"), "string.unquoted.path" in scopeOf("../shared/auth.qwe"))
    }

    /**
     * The IDE's regex engine is stricter than VS Code's, and a rule it cannot
     * read is dropped without a word when it is first reached. So all of them.
     */
    fun testEveryRuleOfTheGrammarsCompiles() {
        val plugin = PluginManagerCore.getPlugin(PluginId.getId("org.quillolang.quillo"))!!
        val grammars = plugin.pluginPath.resolve("textmate/quillo/syntaxes")
        val patterns = ArrayList<String>()
        fun walk(node: JsonElement) {
            when {
                node.isJsonArray -> node.asJsonArray.forEach(::walk)
                node.isJsonObject -> for ((key, value) in node.asJsonObject.entrySet()) {
                    if (key in listOf("match", "begin", "end", "while") && value.isJsonPrimitive) patterns.add(value.asString) else walk(value)
                }
            }
        }
        for (name in listOf("quillo.tmLanguage.json", "qwer.tmLanguage.json")) {
            Files.newBufferedReader(grammars.resolve(name)).use { walk(JsonParser.parseReader(it)) }
        }
        assertTrue("${patterns.size} rules", patterns.size > 50)
        val bad = patterns.filter {
            val bytes = it.toByteArray()
            try {
                Regex(bytes, 0, bytes.size, 0, UTF8Encoding.INSTANCE, WarnCallback.NONE)
                false
            } catch (e: JOniException) {
                true
            }
        }
        assertEmpty(bad)
    }

    fun testLineComment() {
        myFixture.configureByText("main.qwe", "<caret>fn f() = 1\n")
        myFixture.performEditorAction(IdeActions.ACTION_COMMENT_LINE)
        assertEquals("// fn f() = 1\n", myFixture.editor.document.text)
    }

    fun testBracketsClose() {
        myFixture.configureByText("main.qwe", "fn f<caret>\n")
        myFixture.type('(')
        assertEquals("fn f()\n", myFixture.editor.document.text)
    }

    fun testEnterBetweenTags() {
        myFixture.configureByText("main.qwe", "view Page() {\n    <ul><caret></ul>\n}\n")
        myFixture.type('\n')
        assertEquals("view Page() {\n    <ul>\n        \n    </ul>\n}\n", myFixture.editor.document.text)
    }

    fun testIcons() {
        val provider = QuilloIconProvider()
        val qwe = myFixture.configureByText("main.qwe", "").virtualFile
        val qwer = myFixture.configureByText("lib.qwer", "").virtualFile
        val other = myFixture.configureByText("notes.txt", "").virtualFile
        val icon = provider.getIcon(qwe, 0, project)!!
        // The plugin's own SVG, square: its size in pixels depends on the screen's scale.
        assertSame(com.intellij.openapi.util.IconLoader.getIcon("/icons/qwe.svg", QuilloIconProvider::class.java), icon)
        assertTrue("${icon.iconWidth}x${icon.iconHeight}", icon.iconWidth > 0 && icon.iconWidth == icon.iconHeight)
        assertNotSame(icon, provider.getIcon(qwer, 0, project))
        assertNull(provider.getIcon(other, 0, project))
    }

    fun testActionsAreRegistered() {
        val actions = ActionManager.getInstance()
        assertInstanceOf(actions.getAction("Quillo.Check"), CheckFileAction::class.java)
        assertInstanceOf(actions.getAction("Quillo.RestartServer"), RestartServerAction::class.java)
        assertInstanceOf(actions.getAction("Quillo.NewProgram"), NewProgramAction::class.java)
        // On the welcome screen too, where no project is open to reach Tools.
        val welcome = actions.getAction("WelcomeScreen.QuickStart") as com.intellij.openapi.actionSystem.DefaultActionGroup
        assertTrue(welcome.getChildActionsOrStubs().any { actions.getId(it) == "Quillo.NewProgram" })
    }

    fun testSettingsPage() {
        val page = QuilloConfigurable()
        try {
            assertNotNull(page.createComponent())
            page.reset()
            assertFalse(page.isModified)
        } finally {
            page.disposeUIResources()
        }
    }

    fun testRunConfigurationEditor() {
        val factory = QuilloRunConfigurationType.getInstance().configurationFactories[0]
        val configuration = factory.createTemplateConfiguration(project) as QuilloRunConfiguration
        configuration.options.file = "/a/main.qwe"
        configuration.options.programArguments = "--port 9000"
        val editor = configuration.configurationEditor as QuilloRunEditor
        try {
            assertNotNull(editor.component)
            editor.resetFrom(configuration)
            val copy = factory.createTemplateConfiguration(project) as QuilloRunConfiguration
            editor.applyTo(copy)
            assertEquals("/a/main.qwe", copy.options.file)
            assertEquals("--port 9000", copy.options.programArguments)
        } finally {
            Disposer.dispose(editor)
        }
    }

    /**
     * Every snippet of VS Code's, expanded by Tab and run to its end, is its body with each stop's
     * text: its default, its first choice, or nothing. Read from the snippets here, not from the
     * templates made of them.
     */
    fun testEverySnippetExpands() {
        TemplateManagerImpl.setTemplateTesting(testRootDisposable)
        val file = java.nio.file.Path.of("../vscode/snippets/quillo.json")
        val all = JsonParser.parseString(Files.readString(file)).asJsonObject
        assertTrue(all.size() > 20)
        for ((name, snippet) in all.entrySet()) {
            val o = snippet.asJsonObject
            val prefix = o["prefix"].asString
            val body = o["body"].let { b -> if (b.isJsonArray) b.asJsonArray.joinToString("\n") { it.asString } else b.asString }
            val want = body
                .replace(kotlin.text.Regex("""\$\{\d+\|([^,|]*)[^|]*\|}"""), "$1")
                .replace(kotlin.text.Regex("""\$\{\d+:([^}]*)}"""), "$1")
                .replace(kotlin.text.Regex("""\$\{\d+}|\$\d+"""), "")
                .replace("\\$", "$")
            myFixture.configureByText("s.qwe", "$prefix<caret>")
            myFixture.performEditorAction(IdeActions.ACTION_EXPAND_LIVE_TEMPLATE_BY_TAB)
            finish()
            assertEquals("snippet $name", want, myFixture.editor.document.text)
        }
    }

    /** Tab in the first stop moves to the next, and the text typed there is kept: a template, not text. */
    fun testASnippetsStopsAreStops() {
        TemplateManagerImpl.setTemplateTesting(testRootDisposable)
        myFixture.configureByText("main.qwe", "site<caret>")
        myFixture.performEditorAction(IdeActions.ACTION_EXPAND_LIVE_TEMPLATE_BY_TAB)
        val state = TemplateManagerImpl.getTemplateState(myFixture.editor)
        assertNotNull("site is a live template", state)
        myFixture.type("store")
        com.intellij.openapi.command.WriteCommandAction.runWriteCommandAction(project) { state!!.nextTab() }
        myFixture.type("https://store.example.com")
        finish()
        assertEquals("site store = \"https://store.example.com\"", myFixture.editor.document.text)
    }

    /** Runs the template open in the editor to its end, as Enter at its last stop would. */
    private fun finish() {
        val state = TemplateManagerImpl.getTemplateState(myFixture.editor) ?: return
        com.intellij.openapi.command.WriteCommandAction.runWriteCommandAction(project) { state.gotoEnd(false) }
    }

    fun testSnippetsOnlyInQuilloFiles() {
        TemplateManagerImpl.setTemplateTesting(testRootDisposable)
        myFixture.configureByText("notes.txt", "site<caret>")
        myFixture.performEditorAction(IdeActions.ACTION_EXPAND_LIVE_TEMPLATE_BY_TAB)
        assertFalse(myFixture.editor.document.text, "https://" in myFixture.editor.document.text)
    }

    /** The bundle has no snippets of its own, which the IDE would insert as raw text beside the templates. */
    fun testTheBundleHasNoSnippets() {
        val plugin = PluginManagerCore.getPlugin(PluginId.getId("org.quillolang.quillo"))!!
        val manifest = JsonParser.parseString(Files.readString(plugin.pluginPath.resolve("textmate/quillo/package.json"))).asJsonObject
        assertFalse(manifest["contributes"].asJsonObject.has("snippets"))
        assertTrue(manifest["contributes"].asJsonObject.has("grammars"))
    }
}
