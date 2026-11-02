package org.quillolang.jetbrains

import com.intellij.execution.ExecutionException
import com.intellij.execution.RunContentExecutor
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.process.ProcessHandlerFactory
import com.intellij.execution.process.ProcessTerminatedListener
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.fileEditor.FileDocumentManager
import com.intellij.openapi.ui.Messages
import java.nio.charset.StandardCharsets

class CheckFileAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.getData(CommonDataKeys.VIRTUAL_FILE)?.extension == "qwe"
    }

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return
        FileDocumentManager.getInstance().saveAllDocuments()
        try {
            val command = GeneralCommandLine(requireBinary(project), "check", file.path)
                .withCharset(StandardCharsets.UTF_8)
                .withWorkDirectory(existingFolder(project.basePath))
            val handler = ProcessHandlerFactory.getInstance().createColoredProcessHandler(command)
            ProcessTerminatedListener.attach(handler)
            RunContentExecutor(project, handler).withTitle("Quillo: check ${file.name}").withActivateToolWindow(true).run()
        } catch (err: ExecutionException) {
            Messages.showErrorDialog(project, err.message, "Quillo")
        }
    }
}

class RestartServerAction : AnAction() {
    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }

    override fun actionPerformed(e: AnActionEvent) {
        restartServer(e.project ?: return)
    }
}
