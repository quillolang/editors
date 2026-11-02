package org.quillolang.jetbrains

import com.intellij.execution.ExecutionException
import com.intellij.execution.Executor
import com.intellij.execution.actions.ConfigurationContext
import com.intellij.execution.actions.LazyRunConfigurationProducer
import com.intellij.execution.configurations.CommandLineState
import com.intellij.execution.configurations.ConfigurationFactory
import com.intellij.execution.configurations.ConfigurationType
import com.intellij.execution.configurations.ConfigurationTypeBase
import com.intellij.execution.configurations.ConfigurationTypeUtil
import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.execution.configurations.RunConfiguration
import com.intellij.execution.configurations.RunProfileState
import com.intellij.execution.configurations.RuntimeConfigurationError
import com.intellij.execution.executors.DefaultDebugExecutor
import com.intellij.execution.process.ProcessHandler
import com.intellij.execution.process.ProcessHandlerFactory
import com.intellij.execution.process.ProcessTerminatedListener
import com.intellij.execution.runners.ExecutionEnvironment
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.options.SettingsEditor
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.TextFieldWithBrowseButton
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.NotNullLazyValue
import com.intellij.openapi.util.Ref
import com.intellij.psi.PsiElement
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBTextField
import com.intellij.ui.dsl.builder.AlignX
import com.intellij.ui.dsl.builder.panel
import com.intellij.util.execution.ParametersListUtil
import com.redhat.devtools.lsp4ij.dap.DebugAdapterManager
import com.redhat.devtools.lsp4ij.dap.configurations.DAPRunConfigurationBase
import com.redhat.devtools.lsp4ij.dap.configurations.DAPRunConfigurationOptionsBase
import java.nio.charset.StandardCharsets
import javax.swing.JComponent

class QuilloRunOptions : DAPRunConfigurationOptionsBase() {
    var file by string()
    var programArguments by string("--watch")
    var workingDirectory by string()
    var stopOnEntry by property(false)

    /** The folder to run in: the one set, else the project's. */
    fun cwd(project: Project): String? = workingDirectory?.ifBlank { null } ?: project.basePath
}

class QuilloRunConfigurationType : ConfigurationTypeBase(
    "QuilloRunConfiguration",
    "Quillo",
    "Run or debug a .qwe program",
    NotNullLazyValue.createValue { IconLoader.getIcon("/icons/qwe.svg", QuilloRunConfigurationType::class.java) },
) {
    init {
        addFactory(object : ConfigurationFactory(this) {
            override fun getId() = "Quillo"
            override fun createTemplateConfiguration(project: Project): RunConfiguration = QuilloRunConfiguration(project, this, "Quillo")
            override fun getOptionsClass() = QuilloRunOptions::class.java
        })
    }

    companion object {
        fun getInstance(): ConfigurationType = ConfigurationTypeUtil.findConfigurationType(QuilloRunConfigurationType::class.java)
    }
}

/** Debug goes through `quillo dap`, Run is `quillo run` in a console. */
class QuilloRunConfiguration(project: Project, factory: ConfigurationFactory, name: String) :
    DAPRunConfigurationBase<QuilloRunOptions>(project, factory, name) {

    public override fun getOptions(): QuilloRunOptions = super.getOptions() as QuilloRunOptions

    override fun getDebugAdapterServer() = DebugAdapterManager.getInstance().getDebugAdapterServerById(DEBUGGER_ID)

    // LSP4IJ's runner takes the Debug button only: the Run button is the platform's, for quillo run.
    override fun canRun(executorId: String) = executorId == DefaultDebugExecutor.EXECUTOR_ID

    override fun getState(executor: Executor, environment: ExecutionEnvironment): RunProfileState? {
        if (executor.id == DefaultDebugExecutor.EXECUTOR_ID) return super.getState(executor, environment)
        return object : CommandLineState(environment) {
            override fun startProcess(): ProcessHandler {
                val command = GeneralCommandLine(requireBinary(project), "run", options.file.orEmpty())
                    .withParameters(ParametersListUtil.parse(options.programArguments.orEmpty()))
                    .withCharset(StandardCharsets.UTF_8)
                    .withWorkDirectory(existingFolder(options.cwd(project)))
                return ProcessHandlerFactory.getInstance().createColoredProcessHandler(command).also(ProcessTerminatedListener::attach)
            }
        }
    }

    override fun checkConfiguration() {
        if (options.file.isNullOrBlank()) throw RuntimeConfigurationError("Set the .qwe file to run.")
    }

    override fun getConfigurationEditor(): SettingsEditor<out RunConfiguration> = QuilloRunEditor()
}

class QuilloRunEditor : SettingsEditor<QuilloRunConfiguration>() {
    private val file = TextFieldWithBrowseButton()
    private val arguments = JBTextField()
    private val folder = TextFieldWithBrowseButton()
    private val stopOnEntry = JBCheckBox("Stop at the program's first statement (when debugging)")

    init {
        file.addBrowseFolderListener(null, FileChooserDescriptorFactory.singleFile().withExtensionFilter("qwe").withTitle("The .qwe File to Run"))
        folder.addBrowseFolderListener(null, FileChooserDescriptorFactory.singleDir().withTitle("The Folder to Run In"))
    }

    override fun createEditor(): JComponent = panel {
        row("File:") { cell(file).align(AlignX.FILL) }
        row("Options:") {
            cell(arguments).align(AlignX.FILL).comment("For quillo run, such as --watch --port 8080.")
        }
        row("Working directory:") { cell(folder).align(AlignX.FILL) }
        row { cell(stopOnEntry) }
    }

    override fun resetEditorFrom(configuration: QuilloRunConfiguration) {
        val options = configuration.options
        file.text = options.file.orEmpty()
        arguments.text = options.programArguments.orEmpty()
        folder.text = options.workingDirectory.orEmpty()
        stopOnEntry.isSelected = options.stopOnEntry
    }

    override fun applyEditorTo(configuration: QuilloRunConfiguration) {
        val options = configuration.options
        options.file = file.text
        options.programArguments = arguments.text
        options.workingDirectory = folder.text
        options.stopOnEntry = stopOnEntry.isSelected
    }
}

/** Run or Debug on a .qwe file: this file, watched, on the port in the settings. */
class QuilloRunProducer : LazyRunConfigurationProducer<QuilloRunConfiguration>() {
    override fun getConfigurationFactory(): ConfigurationFactory = QuilloRunConfigurationType.getInstance().configurationFactories[0]

    override fun setupConfigurationFromContext(
        configuration: QuilloRunConfiguration,
        context: ConfigurationContext,
        sourceElement: Ref<PsiElement>,
    ): Boolean {
        val file = context.location?.virtualFile ?: return false
        if (file.extension != "qwe") return false
        configuration.name = file.name
        configuration.options.file = file.path
        configuration.options.programArguments = "--watch --port ${QuilloSettings.getInstance().state.port}"
        return true
    }

    override fun isConfigurationFromContext(configuration: QuilloRunConfiguration, context: ConfigurationContext): Boolean =
        configuration.options.file == context.location?.virtualFile?.path
}

/** The binary to run, or the reason there is none. */
fun requireBinary(project: Project): String {
    val command = quilloPath(project)
    return resolveBinary(command)?.toString()
        ?: throw ExecutionException("Could not find $command: install quillo or set its path in Settings > Languages & Frameworks > Quillo.")
}
