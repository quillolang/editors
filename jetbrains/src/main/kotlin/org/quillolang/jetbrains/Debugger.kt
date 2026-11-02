package org.quillolang.jetbrains

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.configurations.RunConfiguration
import com.intellij.execution.configurations.RunConfigurationOptions
import com.intellij.execution.process.ProcessHandler
import com.intellij.execution.runners.ExecutionEnvironment
import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.util.execution.ParametersListUtil
import com.redhat.devtools.lsp4ij.dap.DebugMode
import com.redhat.devtools.lsp4ij.dap.definitions.DebugAdapterServerDefinition
import com.redhat.devtools.lsp4ij.dap.descriptors.DebugAdapterDescriptor
import com.redhat.devtools.lsp4ij.dap.descriptors.DebugAdapterDescriptorFactory
import com.redhat.devtools.lsp4ij.dap.descriptors.ServerReadyConfig
import java.nio.charset.StandardCharsets

const val DEBUGGER_ID = "quillo"

/** The debugger: `quillo dap` runs the program and speaks the Debug Adapter Protocol. */
class QuilloDebugFactory : DebugAdapterDescriptorFactory() {
    override fun createDebugAdapterDescriptor(options: RunConfigurationOptions, environment: ExecutionEnvironment): DebugAdapterDescriptor =
        QuilloDebugAdapter(options, environment, serverDefinition)

    override fun isDebuggableFile(file: VirtualFile, project: Project): Boolean = file.extension == "qwe"

    // A .qwe file gets a Quillo run configuration (QuilloRunProducer), not a generic DAP one as well.
    override fun prepareConfiguration(configuration: RunConfiguration, file: VirtualFile, project: Project): Boolean = false
}

class QuilloDebugAdapter(
    options: RunConfigurationOptions,
    environment: ExecutionEnvironment,
    server: DebugAdapterServerDefinition?,
) : DebugAdapterDescriptor(options, environment, server) {
    private val run get() = options as QuilloRunOptions

    override fun startServer(): ProcessHandler {
        val project = environment.project
        val command = GeneralCommandLine(requireBinary(project), "dap")
            .withCharset(StandardCharsets.UTF_8)
            .withWorkDirectory(existingFolder(run.cwd(project)))
        return startServer(command)
    }

    override fun getDapParameters(): Map<String, Any> = mapOf(
        "type" to "quillo",
        "request" to "launch",
        "program" to run.file.orEmpty(),
        "args" to ParametersListUtil.parse(run.programArguments.orEmpty()),
        "cwd" to run.cwd(environment.project).orEmpty(),
        "stopOnEntry" to run.stopOnEntry,
    )

    override fun getServerReadyConfig(debugMode: DebugMode) = ServerReadyConfig(0)

    override fun getFileType(): FileType? = null
}
