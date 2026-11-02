package org.quillolang.jetbrains

import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import java.nio.file.Files
import java.nio.file.Path

/** Which .rs files go to quillo lsp: the cases of the VS Code extension's test/rust-files.test.js. */
class RustFilesTest : BasePlatformTestCase() {
    private lateinit var tmp: Path

    override fun setUp() {
        super.setUp()
        tmp = Files.createTempDirectory("quillo-rs-").toRealPath()
        // The test platform lets the VFS see its own folders only.
        com.intellij.openapi.vfs.newvfs.impl.VfsRootAccess.allowRootAccess(testRootDisposable, tmp.toString())
    }

    override fun tearDown() {
        try {
            tmp.toFile().deleteRecursively()
        } catch (e: Throwable) {
            addSuppressedException(e)
        } finally {
            super.tearDown()
        }
    }

    private fun put(rel: String, text: String = ""): Path {
        val f = tmp.resolve(rel)
        Files.createDirectories(f.parent)
        Files.writeString(f, text)
        return f
    }

    fun testThePathsALineNames() {
        assertEquals(listOf("tw.rs", "lib/a.rs", "./b.rs"), RustFiles.rustPaths("import tw.rs use f\nuse \"lib/a.rs\"\nuse x, y from ./b.rs\nlet s = \"c.rs\"\n// use d.rs\nclient /e.js use E"))
        assertEquals(listOf("a.rs"), RustFiles.rustPaths("import a.rs use f // not b.rs"))
        assertEmpty(RustFiles.rustPaths("use tw.rs.bak"))
    }

    fun testAProgramAndWhatItUses() {
        put("app/main.qwe", "import tw.rs use tailwind\nuse lib/forum.qwe\n")
        val tw = put("app/tw.rs", "pub fn tailwind() -> String { String::new() }\n")
        put("app/lib/forum.qwe", "import lib/md.rs use render\nimport ./near.rs use near\n")
        assertTrue("main.qwe imports it", RustFiles.usedByProgram(tw))
        assertTrue("a path from the program's folder", RustFiles.usedByProgram(put("app/lib/md.rs")))
        assertTrue("./ from the file that writes it", RustFiles.usedByProgram(put("app/lib/near.rs")))
        assertFalse("nothing names it", RustFiles.usedByProgram(put("app/lib/loose.rs")))
        assertFalse("not a .rs file", RustFiles.usedByProgram(tmp.resolve("app/main.qwe")))
        assertFalse("not there", RustFiles.usedByProgram(tmp.resolve("app/none.rs")))
        Files.createSymbolicLink(tmp.resolve("app/linked.rs"), tw)
        assertTrue("a link to a used file", RustFiles.usedByProgram(tmp.resolve("app/linked.rs")))
    }

    fun testNotAboveACrateOrPastFourFolders() {
        put("crate/Cargo.toml", "[package]\nname = \"c\"\n")
        put("crate/src/notes.qwe", "// tw.rs in a comment\n")
        assertFalse("a crate's own .rs file", RustFiles.usedByProgram(put("crate/src/main.rs", "fn main() {}\n")))
        put("outer/main.qwe", "import inner/crate/src/x.rs use f\n")
        put("outer/inner/crate/Cargo.toml", "[package]\n")
        assertFalse("not above the crate's Cargo.toml", RustFiles.usedByProgram(put("outer/inner/crate/src/x.rs")))
        put("g/.git/HEAD", "ref: x\n")
        put("g/w/main.qwe", "import v.rs use v\n")
        assertTrue("a program inside a repository", RustFiles.usedByProgram(put("g/w/v.rs")))
        put("deep/main.qwe", "import a/b/c/d/e.rs use e\n")
        assertFalse("five folders below", RustFiles.usedByProgram(put("deep/a/b/c/d/e.rs")))
        put("deep2/main.qwe", "import a/b/c/f.rs use f\n")
        assertTrue("four folders below", RustFiles.usedByProgram(put("deep2/a/b/c/f.rs")))
    }

    fun testTheMatcher() {
        put("app/main.qwe", "import tw.rs use tailwind\n")
        val used = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(put("app/tw.rs"))!!
        val loose = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(put("app/loose.rs"))!!
        val matcher = UsedRustMatcher()
        assertTrue(matcher.match(used, project))
        assertFalse(matcher.match(loose, project))
        assertTrue("matched off the UI thread", matcher.shouldBeMatchedAsynchronously(project))
        assertTrue(matcher.matchAsync(used, project).get(10, java.util.concurrent.TimeUnit.SECONDS))
        assertFalse(matcher.matchAsync(loose, project).get(10, java.util.concurrent.TimeUnit.SECONDS))
    }
}
