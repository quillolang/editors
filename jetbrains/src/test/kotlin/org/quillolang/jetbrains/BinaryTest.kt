package org.quillolang.jetbrains

import com.intellij.ide.trustedProjects.TrustedProjects
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import java.nio.file.Files
import java.nio.file.Path

/**
 * Which quillo runs (FEEDBACK71.md, Q-967): the project's own target/release/quillo only once
 * the project is trusted; a cloned repository's ran as soon as one of its files opened. No
 * quillo is needed: the builds here are scripts, chosen and never started.
 */
class BinaryTest : BasePlatformTestCase() {
    private lateinit var dir: Path

    override fun setUp() {
        super.setUp()
        dir = Files.createTempDirectory("quillo-binary")
    }

    override fun tearDown() {
        try {
            dir.toFile().deleteRecursively()
            QuilloSettings.getInstance().state.path = null
        } catch (e: Throwable) {
            addSuppressedException(e)
        } finally {
            super.tearDown()
        }
    }

    private fun build(at: Path): Path {
        Files.createDirectories(at.parent)
        Files.writeString(at, "#!/bin/sh\nexit 0\n")
        at.toFile().setExecutable(true)
        return at
    }

    fun testTheProjectsBuildOnlyWhenTrusted() {
        val base = dir.toString()
        var asked = 0
        val no = { asked++; false }
        val yes = { asked++; true }
        assertEquals("quillo", quilloPath(null, base, yes))
        assertEquals("with no build, trust is not asked", 0, asked)
        val release = build(dir.resolve("target/release/quillo"))
        val debug = build(dir.resolve("target/debug/quillo"))
        assertEquals("not trusted: quillo on the PATH", "quillo", quilloPath(null, base, no))
        assertEquals("trusted: the release build", release.toString(), quilloPath(null, base, yes))
        Files.delete(release)
        assertEquals("trusted: the debug build when there is no release one", debug.toString(), quilloPath(null, base, yes))
        assertEquals("not trusted: not the debug build either", "quillo", quilloPath(null, base, no))
        assertEquals("the setting first", "/opt/quillo", quilloPath("/opt/quillo", base, no))
        assertEquals("the setting first, trusted too", "/opt/quillo", quilloPath("/opt/quillo", base, yes))
        assertEquals("a blank setting is none", "quillo", quilloPath("  ", base, no))
        assertEquals("no project folder", "quillo", quilloPath(null, null, yes))
    }

    fun testAnUntrustedProjectsBuildIsNotRun() {
        val base = Path.of(project.basePath!!)
        val target = base.resolve("target")
        val existed = Files.exists(target)
        val release = build(base.resolve("target/release/quillo"))
        QuilloSettings.getInstance().state.path = null
        try {
            // Tests trust every project unless told otherwise.
            assertEquals("trusted: the project's build", release.toString(), quilloPath(project))
            assertEquals("Run, Check and the debugger take it too", release.toString(), requireBinary(project))
            TrustedProjects.setProjectTrusted(project, false)
            assertEquals("not trusted: quillo on the PATH", "quillo", quilloPath(project))
            val chosen = runCatching { requireBinary(project) }.getOrNull()
            assertTrue("not trusted: Run, Check and the debugger do not take it: $chosen", chosen == null || !Path.of(chosen).startsWith(base))
            QuilloSettings.getInstance().state.path = "/opt/quillo"
            assertEquals("not trusted: the IDE's setting", "/opt/quillo", quilloPath(project))
        } finally {
            // The build goes first, so that trusting the project again starts nothing.
            Files.deleteIfExists(release)
            if (!existed) target.toFile().deleteRecursively()
            TrustedProjects.setProjectTrusted(project, true)
        }
    }
}
