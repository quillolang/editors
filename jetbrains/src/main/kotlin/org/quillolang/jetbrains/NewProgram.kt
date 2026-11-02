package org.quillolang.jetbrains

import com.intellij.execution.ExecutionException
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.util.ExecUtil
import com.intellij.ide.impl.ProjectUtil
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.ComboBox
import com.intellij.openapi.ui.DialogWrapper
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.TextFieldWithBrowseButton
import com.intellij.openapi.ui.ValidationInfo
import com.intellij.ui.dsl.builder.AlignX
import com.intellij.ui.dsl.builder.panel
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.InvalidPathException
import java.nio.file.Path
import javax.swing.JComponent

/** What is wrong with `folder` as a new program's folder, or null. */
fun newFolderProblem(folder: String): String? {
    val text = folder.trim()
    if (text.isEmpty()) return "Choose a folder."
    val path = try {
        Path.of(text)
    } catch (e: InvalidPathException) {
        return "Not a path: $text"
    }
    if (!path.isAbsolute) return "A full path, from the root."
    if (path.normalize().parent == null) return "Not the root of the disk."
    if (Files.exists(path) && (!Files.isDirectory(path) || Files.list(path).use { it.findFirst().isPresent })) {
        return "${path.fileName} is there and not an empty folder."
    }
    return null
}

/** `quillo new <folder>`: null when the program was made, else what to say. A quillo from before `new` answers with its usage and status 2. */
fun runQuilloNew(binary: String, folder: Path, minimal: Boolean): String? {
    val args = mutableListOf(binary, "new", folder.toString())
    if (minimal) args.add("--minimal")
    val out = try {
        ExecUtil.execAndGetOutput(GeneralCommandLine(args).withCharset(StandardCharsets.UTF_8), 60_000)
    } catch (e: ExecutionException) {
        return "Could not run \"$binary new\": ${e.message}"
    }
    if (out.isTimeout) return "\"$binary new\" did not finish in a minute."
    if (out.exitCode == 0) return null
    val text = (out.stderr + out.stdout).trim()
    if (out.exitCode == 2 && "quillo new" !in text) return "\"$binary\" has no `new`: install a newer quillo."
    return text.ifEmpty { "Could not run \"$binary new\"." }
}

class NewProgramDialog(project: Project?) : DialogWrapper(project) {
    val location = TextFieldWithBrowseButton()
    private val kind = ComboBox(arrayOf(TODO, MINIMAL))
    val minimal get() = kind.selectedItem == MINIMAL

    init {
        title = "New Quillo Program"
        location.addBrowseFolderListener(project, FileChooserDescriptorFactory.singleDir().withTitle("The Program's Folder"))
        location.text = defaultFolder()
        init()
    }

    override fun createCenterPanel(): JComponent = panel {
        row("Program:") { cell(kind).comment("The to-do app: a database, a component, files served. Minimal: a page, a component and a function both sides use.") }
        row("Folder:") { cell(location).align(AlignX.FILL).comment("A new folder, or an empty one.") }
    }

    override fun getPreferredFocusedComponent(): JComponent = location.textField

    override fun doValidate(): ValidationInfo? = newFolderProblem(location.text)?.let { ValidationInfo(it, location) }

    private companion object {
        const val TODO = "The to-do app"
        const val MINIMAL = "Minimal"

        /** ~/my-app, or my-app-2 and on if that is taken. */
        fun defaultFolder(): String {
            val home = Path.of(System.getProperty("user.home"))
            return generateSequence(1) { it + 1 }
                .map { home.resolve(if (it == 1) "my-app" else "my-app-$it") }
                .first { newFolderProblem(it.toString()) == null }
                .toString()
        }
    }
}

/** Tools > Quillo > New Quillo Program, and on the welcome screen: `quillo new`, then the folder opened as a project. */
class NewProgramAction : DumbAwareAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project
        val dialog = NewProgramDialog(project)
        if (!dialog.showAndGet()) return
        val folder = Path.of(dialog.location.text.trim())
        val binary = quilloPath(project)
        val minimal = dialog.minimal
        val problem = ProgressManager.getInstance().runProcessWithProgressSynchronously<String?, RuntimeException>(
            { runQuilloNew(binary, folder, minimal) }, "Quillo: New Program", false, project,
        )
        if (problem != null) {
            Messages.showErrorDialog(project, problem, "Quillo")
            return
        }
        // With a project open, the platform asks whether to use this window, as its setting says.
        ProjectUtil.openOrImport(folder, project, false)
    }
}
