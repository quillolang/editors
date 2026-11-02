package org.quillolang.jetbrains

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.redhat.devtools.lsp4ij.AbstractDocumentMatcher
import java.io.IOException
import java.nio.file.Files
import java.nio.file.Path

/**
 * Which .rs files quillo lsp is given: those a program uses (FEEDBACK37.md, Q-453). Most .rs
 * files are a crate's, and quillo would run cargo check on each and warn of every pub fn it
 * cannot export. So a .rs file goes to the server only when a .qwe file names it on a `use` or
 * `import` line, looked for as quillo's own program_entry looks: in the file's folder and up to
 * three above it, not above a Cargo.toml or a .git, the .qwe files there and three folders down.
 * The same rule as the VS Code extension's rust-files.js.
 */
object RustFiles {
    private val IMPORT = Regex("""^\s*(?:use|import|client|preload|preconnect)\b(.*)$""")
    private val RUST_PATH = Regex(""""([^"]+\.rs)"|([^\s",;"]+\.rs)(?![\w.])""")
    private const val MAX_FILES = 400

    /** The .rs paths a .qwe file's `use` and `import` lines name, as written. */
    fun rustPaths(text: String): List<String> =
        text.lines().flatMap { line ->
            val rest = IMPORT.find(line)?.groupValues?.get(1)?.replace(Regex("//.*$"), "") ?: return@flatMap emptyList()
            RUST_PATH.findAll(rest).map { it.groupValues[1].ifEmpty { it.groupValues[2] } }.toList()
        }

    private fun real(p: Path): Path = try {
        p.toRealPath()
    } catch (e: IOException) {
        p.toAbsolutePath().normalize()
    }

    private fun qweFiles(dir: Path, depth: Int, out: MutableList<Path>) {
        val entries = try {
            Files.list(dir).use { it.toList() }
        } catch (e: IOException) {
            return
        }
        for (e in entries.sorted()) {
            if (out.size >= MAX_FILES) return
            val name = e.fileName.toString()
            if (name.startsWith(".") || name == "node_modules" || name == "target") continue
            if (Files.isRegularFile(e) && name.endsWith(".qwe")) out.add(e)
            else if (Files.isDirectory(e) && depth > 0) qweFiles(e, depth - 1, out)
        }
    }

    private fun names(qwe: Path, base: Path, target: Path): Boolean {
        val text = try {
            Files.readString(qwe)
        } catch (e: IOException) {
            return false
        }
        return rustPaths(text).any { p ->
            // `./` and `../` count from the file that writes them; the rest from the program's folder.
            val from = if (p.startsWith("./") || p.startsWith("../")) listOf(qwe.parent) else listOf(base, qwe.parent)
            from.any { real(it.resolve(p)) == target }
        }
    }

    /** Whether a program uses the .rs file `file`. */
    fun usedByProgram(file: Path): Boolean {
        if (!file.toString().endsWith(".rs") || !Files.exists(file)) return false
        val target = real(file)
        var dir: Path = target.parent ?: return false
        repeat(4) {
            val found = mutableListOf<Path>()
            qweFiles(dir, 3, found)
            if (found.any { names(it, dir, target) }) return true
            if (Files.exists(dir.resolve("Cargo.toml")) || Files.exists(dir.resolve(".git"))) return false
            dir = dir.parent ?: return false
        }
        return false
    }
}

/** For LSP4IJ: a .rs file reaches quillo lsp only when a program uses it. Matched off the UI thread. */
class UsedRustMatcher : AbstractDocumentMatcher() {
    // It reads files: never on the UI thread, whatever LSP4IJ would choose.
    override fun shouldBeMatchedAsynchronously(project: Project): Boolean = true

    override fun match(file: VirtualFile, project: Project): Boolean =
        file.isInLocalFileSystem && RustFiles.usedByProgram(file.toNioPath())
}
