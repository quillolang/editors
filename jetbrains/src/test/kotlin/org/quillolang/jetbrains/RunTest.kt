package org.quillolang.jetbrains

import com.intellij.execution.ExecutionListener
import com.intellij.execution.ExecutionManager
import com.intellij.execution.ProgramRunnerUtil
import com.intellij.execution.RunManager
import com.intellij.execution.RunnerAndConfigurationSettings
import com.intellij.execution.actions.ConfigurationContext
import com.intellij.execution.executors.DefaultDebugExecutor
import com.intellij.execution.executors.DefaultRunExecutor
import com.intellij.execution.process.ProcessEvent
import com.intellij.execution.process.ProcessHandler
import com.intellij.execution.process.ProcessListener
import com.intellij.execution.runners.ExecutionEnvironment
import com.intellij.openapi.application.runWriteAction
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.Key
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.xdebugger.XDebugSession
import com.intellij.xdebugger.XDebuggerManager
import com.intellij.xdebugger.breakpoints.XLineBreakpointType
import com.intellij.xdebugger.evaluation.XDebuggerEvaluator
import com.intellij.xdebugger.frame.XValue
import com.intellij.xdebugger.frame.XValueNode
import com.intellij.xdebugger.frame.XValuePlace
import com.intellij.xdebugger.frame.presentation.XValuePresentation
import com.intellij.xdebugger.impl.breakpoints.XExpressionImpl
import com.redhat.devtools.lsp4ij.dap.breakpoints.DAPBreakpointType
import javax.swing.Icon

class RunTest : QuilloTestCase() {
    private fun configuration(file: VirtualFile, arguments: String = ""): RunnerAndConfigurationSettings {
        val factory = QuilloRunConfigurationType.getInstance().configurationFactories[0]
        val settings = RunManager.getInstance(project).createConfiguration(file.name, factory)
        val options = (settings.configuration as QuilloRunConfiguration).options
        options.file = file.path
        options.programArguments = arguments
        options.workingDirectory = file.parent.path
        return settings
    }

    fun testOneConfigurationIsOffered() {
        val file = myFixture.configureByText("main.qwe", "print(1)\n")
        val offered = ConfigurationContext(file).configurationsFromContext.orEmpty()
        assertEquals(offered.toString(), 1, offered.size)
        val configuration = offered.single().configuration as QuilloRunConfiguration
        assertEquals(file.virtualFile.path, configuration.options.file)
        assertEquals("--watch --port 8080", configuration.options.programArguments)
    }

    fun testRunIsQuilloRun() {
        val file = myFixture.addFileToProject("main.qwe", "print(\"hello from quillo\")\n").virtualFile
        val output = StringBuilder()
        var exit: Int? = null
        project.messageBus.connect(testRootDisposable).subscribe(ExecutionManager.EXECUTION_TOPIC, object : ExecutionListener {
            override fun processStarting(id: String, env: ExecutionEnvironment, handler: ProcessHandler) {
                handler.addProcessListener(object : ProcessListener {
                    override fun onTextAvailable(event: ProcessEvent, outputType: Key<*>) { synchronized(output) { output.append(event.text) } }
                    override fun processTerminated(event: ProcessEvent) { exit = event.exitCode }
                })
            }
        })
        ProgramRunnerUtil.executeConfiguration(configuration(file), DefaultRunExecutor.getRunExecutorInstance())
        waitFor("the program to end") { exit != null }
        assertEquals(0, exit)
        assertTrue(output.toString(), "hello from quillo" in output)
    }

    fun testBreakpointsGoInQweFiles() {
        val type = XLineBreakpointType.EXTENSION_POINT_NAME.findExtensionOrFail(DAPBreakpointType::class.java)
        val qwe = myFixture.addFileToProject("main.qwe", "print(1)\n").virtualFile
        val qwer = myFixture.addFileToProject("lib.qwer", "pub fn f() {}\n").virtualFile
        assertTrue(type.canPutAt(qwe, 0, project))
        assertFalse(type.canPutAt(qwer, 0, project))
    }

    /** Debugs the file with a breakpoint on the line, and hands over the session where it stops. */
    private fun debug(file: VirtualFile, line: Int, condition: String? = null, atTheStop: (XDebugSession) -> Unit) {
        val type = XLineBreakpointType.EXTENSION_POINT_NAME.findExtensionOrFail(DAPBreakpointType::class.java)
        val breakpoints = XDebuggerManager.getInstance(project).breakpointManager
        val breakpoint = runWriteAction { breakpoints.addLineBreakpoint(type, file.url, line, type.createBreakpointProperties(file, line)) }
        if (condition != null) breakpoint.conditionExpression = XExpressionImpl.fromText(condition)
        try {
            ProgramRunnerUtil.executeConfiguration(configuration(file), DefaultDebugExecutor.getDebugExecutorInstance())
            val manager = XDebuggerManager.getInstance(project)
            waitFor("the stop") { manager.currentSession?.isSuspended == true }
            val session = manager.currentSession!!
            atTheStop(session)
            session.resume()
            waitFor("the end") { session.isStopped }
            // The console, and the file the debugger opened where it stopped.
            Disposer.dispose(session.runContentDescriptor)
            Disposer.dispose(session.consoleView)
            FileEditorManager.getInstance(project).closeFile(file)
        } finally {
            runWriteAction { breakpoints.removeBreakpoint(breakpoint) }
        }
    }

    fun testDebugStopsAtABreakpoint() {
        val file = myFixture.addFileToProject("main.qwe", "let total = 40\nlet more = total + 2\nprint(more)\n").virtualFile
        debug(file, 2) { session ->
            assertEquals(2, session.currentPosition!!.line)
            assertEquals(file, session.currentPosition!!.file)
            assertEquals("42", evaluate(session.currentStackFrame!!.evaluator!!, "more"))
        }
    }

    fun testBreakpointWithACondition() {
        val file = myFixture.addFileToProject(
            "main.qwe",
            "fn twice(n) {\n    return n * 2\n}\nprint(twice(1))\nprint(twice(2))\nprint(twice(3))\n",
        ).virtualFile
        debug(file, 1, "n == 2") { session ->
            assertEquals("2", evaluate(session.currentStackFrame!!.evaluator!!, "n"))
        }
    }

    private fun evaluate(evaluator: XDebuggerEvaluator, expression: String): String {
        var value: String? = null
        evaluator.evaluate(expression, object : XDebuggerEvaluator.XEvaluationCallback {
            override fun evaluated(result: XValue) {
                result.computePresentation(object : XValueNode {
                    override fun setPresentation(icon: Icon?, type: String?, shown: String, hasChildren: Boolean) { value = shown }
                    override fun setPresentation(icon: Icon?, presentation: XValuePresentation, hasChildren: Boolean) {
                        val text = StringBuilder()
                        presentation.renderValue(object : XValuePresentation.XValueTextRenderer {
                            override fun renderValue(s: String) { text.append(s) }
                            override fun renderStringValue(s: String) { text.append(s) }
                            override fun renderNumericValue(s: String) { text.append(s) }
                            override fun renderKeywordValue(s: String) { text.append(s) }
                            override fun renderValue(s: String, key: com.intellij.openapi.editor.colors.TextAttributesKey) { text.append(s) }
                            override fun renderStringValue(s: String, chars: String?, max: Int) { text.append(s) }
                            override fun renderComment(s: String) {}
                            override fun renderSpecialSymbol(s: String) {}
                            override fun renderError(s: String) { text.append(s) }
                        })
                        value = text.toString()
                    }
                    override fun setFullValueEvaluator(e: com.intellij.xdebugger.frame.XFullValueEvaluator) {}
                }, XValuePlace.TREE)
            }
            override fun errorOccurred(message: String) { value = "error: $message" }
        }, null)
        waitFor("the value") { value != null }
        return value!!
    }
}
