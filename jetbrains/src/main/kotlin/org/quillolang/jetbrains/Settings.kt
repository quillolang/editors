package org.quillolang.jetbrains

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.BaseState
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.SimplePersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.options.BoundConfigurable
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.ui.DialogPanel
import com.intellij.ui.dsl.builder.AlignX
import com.intellij.ui.dsl.builder.bindIntText
import com.intellij.ui.dsl.builder.bindSelected
import com.intellij.ui.dsl.builder.bindText
import com.intellij.ui.dsl.builder.panel

class QuilloSettingsState : BaseState() {
    var path by string()
    var autoCloseTags by property(true)
    var port by property(8080)
}

@Service
@State(name = "QuilloSettings", storages = [Storage("quillo.xml")])
class QuilloSettings : SimplePersistentStateComponent<QuilloSettingsState>(QuilloSettingsState()) {
    companion object {
        fun getInstance(): QuilloSettings = ApplicationManager.getApplication().getService(QuilloSettings::class.java)
    }
}

/** Settings > Languages & Frameworks > Quillo. */
class QuilloConfigurable : BoundConfigurable("Quillo") {
    private val state get() = QuilloSettings.getInstance().state

    override fun createPanel(): DialogPanel = panel {
        row("Path to quillo:") {
            textFieldWithBrowseButton(FileChooserDescriptorFactory.singleFile().withTitle("Path to quillo"))
                .bindText({ state.path.orEmpty() }, { state.path = it.ifBlank { null } })
                .align(AlignX.FILL)
                .comment("Empty: target/release/quillo or target/debug/quillo in the project, then quillo on the PATH.")
        }
        row {
            checkBox("Add an element's end tag when its start tag's > is typed, and finish the end tag when </ is typed")
                .bindSelected({ state.autoCloseTags }, { state.autoCloseTags = it })
        }
        row("Port for new run configurations:") {
            intTextField(1..65535).bindIntText({ state.port }, { state.port = it })
        }
    }

    override fun apply() {
        val before = state.path
        super.apply()
        if (state.path != before) ProjectManager.getInstance().openProjects.forEach(::restartServer)
    }
}
