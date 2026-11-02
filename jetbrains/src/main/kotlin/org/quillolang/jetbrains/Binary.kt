package org.quillolang.jetbrains

import com.intellij.execution.configurations.PathEnvironmentVariableUtil
import com.intellij.ide.BrowserUtil
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import java.nio.file.Files
import java.nio.file.Path

private const val RELEASES = "https://github.com/quillolang/quillo/releases/latest"

/** The quillo binary: the setting, a build in the project, or `quillo` on the PATH. */
fun quilloPath(project: Project?): String {
    val configured = QuilloSettings.getInstance().state.path.orEmpty()
    if (configured.isNotBlank()) return configured
    val base = project?.basePath
    if (base != null) {
        for (p in listOf("target/release/quillo", "target/debug/quillo")) {
            val full = Path.of(base, p)
            if (Files.exists(full)) return full.toString()
        }
    }
    return "quillo"
}

/** Where `command` is on disk: itself if it is a path, else found on the PATH. */
fun resolveBinary(command: String): Path? {
    if ('/' in command || '\\' in command) return Path.of(command).takeIf { Files.exists(it) }
    return PathEnvironmentVariableUtil.findExecutableInPathOnAnyOS(command)?.toPath()
}

/** A process cannot start in a folder that is not there, which a project's base path may be. */
fun existingFolder(path: String?): String? = path?.takeIf { Files.isDirectory(Path.of(it)) }

fun notifyMissingBinary(project: Project, command: String) {
    NotificationGroupManager.getInstance()
        .getNotificationGroup("Quillo")
        .createNotification("Quillo: could not start \"$command\". Install quillo or set its path.", NotificationType.WARNING)
        .addAction(NotificationAction.createSimple("Download quillo") { BrowserUtil.browse(RELEASES) })
        .addAction(NotificationAction.createSimple("Open settings") {
            ShowSettingsUtil.getInstance().showSettingsDialog(project, QuilloConfigurable::class.java)
        })
        .notify(project)
}
