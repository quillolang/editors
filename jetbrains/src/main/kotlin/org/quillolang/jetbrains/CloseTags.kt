package org.quillolang.jetbrains

import com.intellij.codeInsight.editorActions.TypedHandlerDelegate
import com.intellij.codeInsight.editorActions.enter.EnterHandlerDelegate
import com.intellij.codeInsight.editorActions.enter.EnterHandlerDelegateAdapter
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiFile
import com.intellij.util.concurrency.AppExecutorUtil
import com.redhat.devtools.lsp4ij.LSPIJUtils
import com.redhat.devtools.lsp4ij.LanguageServerManager
import org.eclipse.lsp4j.TextDocumentIdentifier
import org.eclipse.lsp4j.TextDocumentPositionParams
import java.util.concurrent.TimeUnit

/**
 * Typing the `>` of a start tag puts its end tag after the cursor, and
 * typing `</` finishes the end tag of the element open there. The server
 * says which tag (`quillo/closeTag`), from the parser's own reading of the
 * text, so `a > b`, `=>` and `<br>` are left alone.
 */
class CloseTags : TypedHandlerDelegate() {
    override fun charTyped(c: Char, project: Project, editor: Editor, file: PsiFile): Result {
        if (c != '>' && c != '/') return Result.CONTINUE
        val virtual = file.virtualFile ?: return Result.CONTINUE
        if (virtual.extension != "qwe" || !QuilloSettings.getInstance().state.autoCloseTags) return Result.CONTINUE
        if (editor.caretModel.caretCount != 1 || editor.selectionModel.hasSelection()) return Result.CONTINUE
        val document = editor.document
        val stamp = document.modificationStamp
        val at = editor.caretModel.offset
        val params = TextDocumentPositionParams(TextDocumentIdentifier(LSPIJUtils.toUriAsString(virtual)), LSPIJUtils.toPosition(at, document))
        // The edit reaches the server once the document is committed.
        AppExecutorUtil.getAppScheduledExecutorService().schedule({
            LanguageServerManager.getInstance(project).getLanguageServer(SERVER_ID)
                .thenCompose { item -> (item?.server as? QuilloServer)?.closeTag(params) ?: java.util.concurrent.CompletableFuture.completedFuture(null) }
                .thenAccept { text ->
                    if (text == null) return@thenAccept
                    ApplicationManager.getApplication().invokeLater({
                        if (document.modificationStamp != stamp || editor.isDisposed || editor.caretModel.offset != at) return@invokeLater
                        insert(project, editor, at, text)
                    }, { project.isDisposed })
                }
        }, 100, TimeUnit.MILLISECONDS)
        return Result.CONTINUE
    }

    /** `text` is a snippet: `$0` is where the cursor stays, else it ends after the text. */
    private fun insert(project: Project, editor: Editor, at: Int, text: String) {
        val cursor = text.indexOf("$0")
        val plain = text.replace("$0", "")
        WriteCommandAction.runWriteCommandAction(project, "Close Tag", null, {
            editor.document.insertString(at, plain)
            editor.caretModel.moveToOffset(at + if (cursor >= 0) cursor else plain.length)
        })
    }
}

/**
 * Enter between a start tag and its end tag: the rules VS Code's language
 * configuration has for it indent the new line here but leave the end tag
 * on it, so the end tag goes to a line of its own, level with the start tag.
 */
class EnterBetweenTags : EnterHandlerDelegateAdapter() {
    override fun postProcessEnter(file: PsiFile, editor: Editor, dataContext: DataContext): EnterHandlerDelegate.Result {
        if (file.virtualFile?.extension != "qwe") return EnterHandlerDelegate.Result.Continue
        val document = editor.document
        val at = editor.caretModel.offset
        val line = document.getLineNumber(at)
        if (line == 0) return EnterHandlerDelegate.Result.Continue
        val text = document.charsSequence
        val rest = text.subSequence(at, document.getLineEndOffset(line))
        val before = indent(text, document.getLineStartOffset(line - 1), document.getLineEndOffset(line - 1))
        val here = text.subSequence(document.getLineStartOffset(line), at)
        if (rest.startsWith("</") && here.isBlank() && here.length > before.length) {
            document.insertString(at, "\n$before")
        }
        return EnterHandlerDelegate.Result.Continue
    }

    private fun indent(text: CharSequence, start: Int, end: Int): String =
        text.subSequence(start, end).takeWhile { it == ' ' || it == '\t' }.toString()
}
