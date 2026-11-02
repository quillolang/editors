package org.quillolang.jetbrains

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import java.nio.file.Files
import java.nio.file.Path

/**
 * New Quillo Program: the folder it takes, and `quillo new` run for real. QUILLO_BIN is a
 * quillo with `new` and QUILLO_OLD_BIN one from before it; with neither, those runs are skipped.
 */
class NewProgramTest : BasePlatformTestCase() {
    private lateinit var tmp: Path

    override fun setUp() {
        super.setUp()
        tmp = Files.createTempDirectory("quillo-new-")
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

    fun testTheFolderAskedFor() {
        Files.createDirectories(tmp.resolve("empty"))
        Files.createDirectories(tmp.resolve("full"))
        Files.writeString(tmp.resolve("full/main.qwe"), "print(1)\n")
        Files.writeString(tmp.resolve("a-file"), "x")
        assertNull(newFolderProblem(tmp.resolve("my-app").toString()))
        assertNull(newFolderProblem("  ${tmp.resolve("my-app")}  "))
        assertNull(newFolderProblem(tmp.resolve("empty").toString()))
        assertNull(newFolderProblem(tmp.resolve("a/b/c").toString()))
        for (bad in listOf("", "   ", "my-app", "./my-app", tmp.resolve("full").toString(), tmp.resolve("a-file").toString(), "/", "\u0000")) {
            assertNotNull("\"$bad\" is refused", newFolderProblem(bad))
        }
        assertTrue(newFolderProblem(tmp.resolve("full").toString())!!, "not an empty folder" in newFolderProblem(tmp.resolve("full").toString())!!)
    }

    fun testAMissingBinaryIsSaid() {
        val said = runQuilloNew(tmp.resolve("no-quillo").toString(), tmp.resolve("x"), true)
        assertTrue(said, said != null && "Could not run" in said)
        assertFalse(Files.exists(tmp.resolve("x")))
    }

    fun testMinimal() {
        val bin = System.getenv("QUILLO_BIN") ?: return
        val folder = tmp.resolve("mini")
        assertNull(runQuilloNew(bin, folder, true))
        for (f in listOf("main.qwe", "lib/greet.qwe", "ui/page.qwe")) assertTrue(f, Files.exists(folder.resolve(f)))
        assertFalse(Files.exists(folder.resolve("migrations")))
    }

    fun testTheToDoApp() {
        val bin = System.getenv("QUILLO_BIN") ?: return
        val folder = tmp.resolve("nested/todo")
        assertNull(runQuilloNew(bin, folder, false))
        assertTrue(Files.exists(folder.resolve("migrations/001_todos.sql")))
    }

    fun testQuillosRefusalIsShown() {
        val bin = System.getenv("QUILLO_BIN") ?: return
        val folder = Files.createDirectories(tmp.resolve("taken"))
        Files.writeString(folder.resolve("x"), "")
        val said = runQuilloNew(bin, folder, true)
        assertTrue(said, said != null && "not empty" in said)
        assertFalse(Files.exists(folder.resolve("main.qwe")))
    }

    fun testAQuilloFromBeforeNew() {
        val old = System.getenv("QUILLO_OLD_BIN") ?: return
        val said = runQuilloNew(old, tmp.resolve("old"), true)
        assertTrue(said, said != null && "has no `new`" in said)
    }
}
