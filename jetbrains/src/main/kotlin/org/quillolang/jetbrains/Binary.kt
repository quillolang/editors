package org.quillolang.jetbrains

import com.intellij.execution.configurations.PathEnvironmentVariableUtil
import com.intellij.ide.BrowserUtil
import com.intellij.ide.trustedProjects.TrustedProjects
import com.intellij.ide.trustedProjects.TrustedProjectsListener
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.components.service
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import java.nio.file.Files
import java.nio.file.Path

private const val RELEASES = "https://github.com/quillolang/quillo/releases/latest"

/**
 * The quillo binary, for the server, the debugger, Run, Check and New: the setting (the IDE's,
 * never the project's), a build in the project, or `quillo` on the PATH. The project's own build
 * only once the project is trusted: a cloned repository's target/release/quillo ran as soon as
 * one of its files opened, in safe mode too (FEEDBACK71.md, Q-967; branch q967-binary).
 */
fun quilloPath(project: Project?): String =
    quilloPath(QuilloSettings.getInstance().state.path, project?.basePath) {
        project != null && !project.isDisposed && TrustedProjects.isProjectTrusted(project)
    }

/** The choice itself: [trusted] is asked only when the project has a build of its own. */
internal fun quilloPath(configured: String?, base: String?, trusted: () -> Boolean): String {
    if (!configured.isNullOrBlank()) return configured
    val build = localBuild(base)
    return if (build != null && trusted()) build.toString() else "quillo"
}

/** target/release/quillo, then target/debug/quillo, in the folder [base]. */
internal fun localBuild(base: String?): Path? =
    base?.let { b -> listOf("target/release/quillo", "target/debug/quillo").map { Path.of(b, it) }.firstOrNull { Files.exists(it) } }

/**
 * A project trusted once it is open: its own build, when it has one, takes over from quillo on
 * the PATH, as the setting's change does (Q-967). Nothing starts in a project that never asked for
 * the server.
 */
class QuilloTrustListener : TrustedProjectsListener {
    override fun onProjectTrusted(project: Project) {
        if (project.isDisposed || !project.service<BinaryWatcher>().asked) return
        if (localBuild(project.basePath) != null) restartServer(project)
    }
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
