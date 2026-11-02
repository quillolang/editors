package org.quillolang.jetbrains

import com.intellij.codeInsight.template.TemplateActionContext
import com.intellij.codeInsight.template.TemplateContextType
import com.intellij.ide.FileIconProvider
import com.intellij.openapi.extensions.PluginAware
import com.intellij.openapi.extensions.PluginDescriptor
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.IconLoader
import com.intellij.openapi.util.Iconable
import com.intellij.openapi.vfs.VirtualFile
import org.jetbrains.plugins.textmate.api.TextMateBundleProvider
import javax.swing.Icon

/**
 * Highlighting, comments, brackets and indentation are VS Code's:
 * the build copies its grammars and language configurations to textmate/quillo
 * in the plugin, and the IDE reads them as it reads a VS Code extension.
 */
class QuilloBundleProvider : TextMateBundleProvider, PluginAware {
    private lateinit var plugin: PluginDescriptor

    override fun setPluginDescriptor(pluginDescriptor: PluginDescriptor) {
        plugin = pluginDescriptor
    }

    override fun getBundles(): List<TextMateBundleProvider.PluginBundle> =
        listOf(TextMateBundleProvider.PluginBundle("quillo", plugin.pluginPath.resolve("textmate/quillo")))
}

/** A quill for `.qwe` files, and a quill with a gear for `.qwer` files. */
class QuilloIconProvider : FileIconProvider {
    private val qwe = IconLoader.getIcon("/icons/qwe.svg", QuilloIconProvider::class.java)
    private val qwer = IconLoader.getIcon("/icons/qwer.svg", QuilloIconProvider::class.java)

    override fun getIcon(file: VirtualFile, @Iconable.IconFlags flags: Int, project: Project?): Icon? =
        when (file.extension) {
            "qwe" -> qwe
            "qwer" -> qwer
            else -> null
        }
}

/** Where the snippets, made live templates from VS Code's at build time, are offered: `.qwe` files. */
class QuilloTemplateContext : TemplateContextType("Quillo") {
    override fun isInContext(context: TemplateActionContext): Boolean =
        (context.file.virtualFile ?: context.file.originalFile.virtualFile)?.extension == "qwe" || context.file.name.endsWith(".qwe")
}
