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
        assertEquals(
            listOf("tw.rs", "lib/a.rs", "./b.rs", "lib/auth.qwe", "lib/forum.qwe", "lib/q.qwe"),
            RustFiles.usePaths("import tw.rs use f\nuse \"lib/a.rs\"\nuse x, y from ./b.rs\nlet s = \"c.rs\"\n// use d.rs\nclient /e.js use E\nuse lib/auth\nuse a as b from redis.qwer\nuse Chart with preload from \"https://x/c.js\"\nimport lib/forum.qwe use latest // a note\nuse x\nimport \"lib/q.qwe\" use q"),
        )
        assertEmpty(RustFiles.usePaths("use tw.rs.bak"))
    }

    fun testAProgramAndWhatItUses() {
        put("app/main.qwe", "import tw.rs use tailwind\nuse lib/forum.qwe\n")
        val tw = put("app/tw.rs", "pub fn tailwind() -> String { String::new() }\n")
        put("app/lib/forum.qwe", "import lib/md.rs use render\nimport ./near.rs use near\n")
        assertTrue("main.qwe imports it", RustFiles.usedByProgram(tw))
        assertTrue("a path from the program's folder", RustFiles.usedByProgram(put("app/lib/md.rs")))
        assertTrue("./ from the file that writes it", RustFiles.usedByProgram(put("app/lib/near.rs")))
        assertFalse("nothing names it", RustFiles.usedByProgram(put("app/lib/loose.rs")))
        put("app/other/side.qwe", "import ../tw2.rs use t\n")
        assertFalse("a .qwe beside it that no program takes", RustFiles.usedByProgram(put("app/tw2.rs")))
        put("noext/main.qwe", "use lib/a\n")
        put("noext/lib/a.qwe", "import lib/x.rs use x\n")
        assertTrue("a path with no extension is a .qwe file", RustFiles.usedByProgram(put("noext/lib/x.rs")))
        put("cycle/main.qwe", "use a.qwe\n")
        put("cycle/a.qwe", "use main.qwe\nuse b.qwe\n")
        put("cycle/b.qwe", "import c.rs use c\n")
        assertTrue("files that use each other, followed once each", RustFiles.usedByProgram(put("cycle/c.rs")))
        assertFalse("in a cycle, a file nothing names", RustFiles.usedByProgram(put("cycle/d.rs")))
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

    /** As on Linux CI, where the walk up reached /tmp and folders it could not read. */
    fun testAFolderThatCannotBeReadIsPassedOver() {
        put("locked/inner/main.qwe", "import x.rs use x\n")
        val x = put("locked/inner/x.rs")
        val loose = put("locked/inner/loose.rs")
        val locked = tmp.resolve("locked")
        Files.setPosixFilePermissions(locked, java.nio.file.attribute.PosixFilePermissions.fromString("-wx--x--x"))
        try {
            assertTrue(RustFiles.usedByProgram(x))
            assertFalse(RustFiles.usedByProgram(loose))
        } finally {
            Files.setPosixFilePermissions(locked, java.nio.file.attribute.PosixFilePermissions.fromString("rwxr-xr-x"))
        }
    }

    fun testTheMatcher() {
        put("app/main.qwe", "import tw.rs use tailwind\n")
        val used = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(put("app/tw.rs"))!!
        val loose = LocalFileSystem.getInstance().refreshAndFindFileByNioFile(put("app/loose.rs"))!!
        val matcher = UsedRustMatcher()
        assertTrue(matcher.match(used, project))
        assertFalse(matcher.match(loose, project))
        assertTrue(matcher.matchAsync(used, project).get(10, java.util.concurrent.TimeUnit.SECONDS))
        assertFalse(matcher.matchAsync(loose, project).get(10, java.util.concurrent.TimeUnit.SECONDS))
    }
}
