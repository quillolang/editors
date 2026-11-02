package org.quillolang.jetbrains

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.redhat.devtools.lsp4ij.AbstractDocumentMatcher
import java.nio.file.Files
import java.nio.file.Path

/**
 * Which .rs files quillo lsp is given: those a program uses (FEEDBACK37.md, Q-453). Most .rs
 * files are a crate's, and quillo would run cargo check on each and warn of every pub fn it
 * cannot export. So a .rs file goes to the server only when a program reaches it through its
 * `use` and `import` lines. The program is looked for as quillo's own program_entry looks: the
 * .qwe files in the file's folder and in up to three folders above it, not above a Cargo.toml or
 * a .git, each followed through the .qwe files it takes. A folder or file that cannot be read is
 * passed over. The same rule as the VS Code extension's rust-files.js.
 */
object RustFiles {
    private val IMPORT = Regex("""^\s*(import|client|preload|preconnect)\s+(?:module\s+)?("[^"]*"|\S+)\s+use\b""")
    private val USE = Regex("""^\s*use\s+(.*)$""")
    private val FROM = Regex("""\bfrom\s+("[^"]*"|\S+)\s*$""")
    private const val MAX_FILES = 500

    private fun unquote(p: String) = if (p.length >= 2 && p.startsWith('"') && p.endsWith('"')) p.substring(1, p.length - 1) else p

    /** The files a .qwe file's `use` and `import` lines name, as written: .qwe (a path with no
     *  extension is one) and .rs. Browser scripts and .qwer files are left out. */
    fun usePaths(text: String): List<String> {
        val out = mutableListOf<String>()
        for (raw in text.lines()) {
            val line = raw.replace(Regex("""\s//.*$"""), "")
            var p: String?
            val imp = IMPORT.find(line)
            if (imp != null) {
                if (imp.groupValues[1] != "import") continue
                p = unquote(imp.groupValues[2])
            } else {
                val rest = USE.find(line)?.groupValues?.get(1)?.trim() ?: continue
                val from = FROM.find(rest)
                p = unquote(from?.groupValues?.get(1) ?: rest.split(Regex("""\s+""")).first())
                if (from == null && '/' !in p && '.' !in p && !rest.startsWith('"')) p = null
            }
            if (p == null || Regex("""^[a-z]+://""").containsMatchIn(p) || p.startsWith("/")) continue
            when {
                p.endsWith(".rs") || p.endsWith(".qwe") -> out.add(p)
                !Regex("""\.\w+$""").containsMatchIn(p) -> out.add("$p.qwe")
            }
        }
        return out
    }

    private fun real(p: Path): Path? = try {
        p.toRealPath()
    } catch (e: Exception) {
        null
    }

    /** The .qwe files right in `dir`, sorted. */
    private fun qweIn(dir: Path): List<Path> = try {
        Files.list(dir).use { s -> s.filter { it.fileName.toString().endsWith(".qwe") && Files.isRegularFile(it) }.toList() }.sorted()
    } catch (e: Exception) {
        // An IOException from the listing, an UncheckedIOException from its entries.
        emptyList()
    }

    private fun reaches(main: Path, base: Path, target: Path): Boolean {
        val todo = ArrayDeque(listOf(main))
        val seen = HashSet<Path>()
        while (todo.isNotEmpty()) {
            val f = todo.removeLast()
            if (f in seen || seen.size >= MAX_FILES) continue
            seen.add(f)
            val text = try {
                Files.readString(f)
            } catch (e: Exception) {
                continue
            }
            for (p in usePaths(text)) {
                // `./` and `../` count from the file that writes them; the rest from the program's folder.
                val from = if (p.startsWith("./") || p.startsWith("../")) f.parent else base
                val full = real(from.resolve(p)) ?: continue
                if (p.endsWith(".rs")) {
                    if (full == target) return true
                } else {
                    todo.addLast(full)
                }
            }
        }
        return false
    }

    /** Whether a program uses the .rs file `file`. */
    fun usedByProgram(file: Path): Boolean {
        if (!file.toString().endsWith(".rs")) return false
        val target = real(file) ?: return false
        var dir: Path = target.parent ?: return false
        repeat(4) {
            if (qweIn(dir).any { reaches(it, dir, target) }) return true
            if (Files.exists(dir.resolve("Cargo.toml")) || Files.exists(dir.resolve(".git"))) return false
            dir = dir.parent ?: return false
        }
        return false
    }
}

/**
 * For LSP4IJ: a .rs file reaches quillo lsp only when a program uses it. LSP4IJ decides where it
 * runs (in the background while the IDE indexes); the work is small: at most four folders listed
 * and the .qwe files a program reaches read. Forcing it into the background made LSP4IJ cancel and
 * log the match whenever a write came first.
 */
class UsedRustMatcher : AbstractDocumentMatcher() {
    override fun match(file: VirtualFile, project: Project): Boolean =
        file.isInLocalFileSystem && RustFiles.usedByProgram(file.toNioPath())
}
