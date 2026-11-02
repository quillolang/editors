import java.time.Duration
import org.jetbrains.intellij.platform.gradle.IntelliJPlatformType
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.tasks.PrepareSandboxTask
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion
import org.jetbrains.kotlin.gradle.tasks.KotlinJvmCompile

plugins {
    id("org.jetbrains.kotlin.jvm") version "2.4.10"
    id("org.jetbrains.intellij.platform") version "2.19.0"
}

group = "org.quillolang"
version = providers.gradleProperty("version").get()

repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}

dependencies {
    intellijPlatform {
        // -PlocalIde=/Applications/WebStorm.app builds against an IDE already on
        // this machine, and saves extracting a 3.5 GB download.
        val localIde = providers.gradleProperty("localIde")
        if (localIde.isPresent) local(localIde) else webstorm(providers.gradleProperty("platformVersion"))
        bundledPlugins("org.jetbrains.plugins.textmate", "com.intellij.css")
        plugin("com.redhat.devtools.lsp4ij", providers.gradleProperty("lsp4ijVersion").get())
        testFramework(TestFrameworkType.Platform)
    }
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.opentest4j:opentest4j:1.3.0")
}

intellijPlatform {
    buildSearchableOptions = false
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "253"
            untilBuild = provider { null }
        }
    }
    pluginVerification {
        ides {
            // -PverifyIdes=/a/WebStorm.app,/b/WebStorm.app: IDEs already on this machine.
            val installed = providers.gradleProperty("verifyIdes")
            if (installed.isPresent) {
                installed.get().split(",").forEach { local(file(it)) }
            } else {
                create(IntelliJPlatformType.WebStorm, providers.gradleProperty("platformVersion"))
                create(IntelliJPlatformType.WebStorm, providers.gradleProperty("newestVersion"))
            }
        }
    }
}

/**
 * The VS Code extension's snippets as live templates. The IDE's TextMate support would insert
 * them as they are written, `${1:name}` and all, so the bundle goes without them: its
 * package.json is the extension's with no `snippets`.
 */
abstract class LiveTemplates : DefaultTask() {
    @get:InputFile abstract val snippets: RegularFileProperty
    @get:InputFile abstract val manifest: RegularFileProperty
    @get:OutputDirectory abstract val templates: DirectoryProperty
    @get:OutputDirectory abstract val bundle: DirectoryProperty

    private class Stop(val n: Int, val expression: String)

    private fun literal(s: String) = "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

    private fun attr(s: String) = buildString {
        for (c in s) when (c) {
            '&' -> append("&amp;"); '<' -> append("&lt;"); '>' -> append("&gt;"); '"' -> append("&quot;")
            '\n' -> append("&#10;"); '\t' -> append("&#9;"); else -> append(c)
        }
    }

    /** A snippet's body as a template's text, with its stops: `$1`, `${1}`, `${1:text}`, `${1|a,b|}`, `$0` and `\$`. */
    private fun convert(name: String, body: String): Pair<String, List<Stop>> {
        val out = StringBuilder()
        val stops = LinkedHashMap<Int, Stop>()
        var i = 0
        fun stop(n: Int, expression: String) {
            if (n == 0 && expression.isEmpty()) out.append("\$END\$")
            else {
                out.append("\$V$n\$")
                if (n == 0) out.append("\$END\$")
                stops.putIfAbsent(n, Stop(n, expression))
            }
        }
        while (i < body.length) {
            val c = body[i]
            when {
                c == '\\' && i + 1 < body.length && body[i + 1] in "$}\\" -> {
                    out.append(if (body[i + 1] == '$') "\$\$" else body[i + 1].toString()); i += 2
                }
                c == '$' && i + 1 < body.length && body[i + 1].isDigit() -> {
                    var j = i + 1
                    while (j < body.length && body[j].isDigit()) j++
                    stop(body.substring(i + 1, j).toInt(), ""); i = j
                }
                c == '$' && body.startsWith("\${", i) && i + 2 < body.length && body[i + 2].isDigit() -> {
                    var j = i + 2
                    while (j < body.length && body[j].isDigit()) j++
                    val n = body.substring(i + 2, j).toInt()
                    when (body.getOrNull(j)) {
                        '}' -> { stop(n, ""); i = j + 1 }
                        ':' -> {
                            val end = body.indexOf('}', j)
                            val text = body.substring(j + 1, end)
                            require('$' !in text) { "snippet $name: a stop inside a stop's text is not supported" }
                            stop(n, literal(text)); i = end + 1
                        }
                        '|' -> {
                            val end = body.indexOf("|}", j)
                            val choices = body.substring(j + 1, end).split(',')
                            stop(n, "enum(" + choices.joinToString(",") { literal(it) } + ")"); i = end + 2
                        }
                        else -> error("snippet $name: cannot read ${body.substring(i, minOf(body.length, i + 10))}")
                    }
                }
                c == '$' && (body.getOrNull(i + 1)?.let { it == '{' || it.isLetter() || it == '_' } == true) ->
                    error("snippet $name: VS Code's variables (${body.substring(i, minOf(body.length, i + 16))}) are not supported")
                c == '$' -> { out.append("\$\$"); i++ }
                else -> { out.append(c); i++ }
            }
        }
        val ordered = stops.values.filter { it.n != 0 }.sortedBy { it.n } + stops.values.filter { it.n == 0 }
        return out.toString() to ordered
    }

    @TaskAction
    fun generate() {
        @Suppress("UNCHECKED_CAST")
        val all = groovy.json.JsonSlurper().parse(snippets.get().asFile) as Map<String, Map<String, Any>>
        val xml = StringBuilder("<templateSet group=\"Quillo\">\n")
        for ((name, snippet) in all) {
            val prefix = snippet["prefix"] as String
            @Suppress("UNCHECKED_CAST")
            val body = (snippet["body"] as? List<String>)?.joinToString("\n") ?: snippet["body"] as String
            val (text, stops) = convert(name, body)
            xml.append("  <template name=\"${attr(prefix)}\" value=\"${attr(text)}\" description=\"${attr(snippet["description"] as? String ?: name)}\" toReformat=\"false\" toShortenFQNames=\"false\">\n")
            for (s in stops) xml.append("    <variable name=\"V${s.n}\" expression=\"${attr(s.expression)}\" defaultValue=\"\" alwaysStopAt=\"true\"/>\n")
            xml.append("    <context>\n      <option name=\"QUILLO\" value=\"true\"/>\n    </context>\n  </template>\n")
        }
        xml.append("</templateSet>\n")
        templates.get().file("liveTemplates/Quillo.xml").asFile.apply { parentFile.mkdirs(); writeText(xml.toString()) }
        @Suppress("UNCHECKED_CAST")
        val pkg = groovy.json.JsonSlurper().parse(manifest.get().asFile) as MutableMap<String, Any>
        @Suppress("UNCHECKED_CAST")
        (pkg["contributes"] as MutableMap<String, Any>).remove("snippets")
        bundle.get().file("package.json").asFile.writeText(groovy.json.JsonOutput.prettyPrint(groovy.json.JsonOutput.toJson(pkg)))
    }
}

val liveTemplates = tasks.register<LiveTemplates>("liveTemplates") {
    snippets = layout.projectDirectory.file("../vscode/snippets/quillo.json")
    manifest = layout.projectDirectory.file("../vscode/package.json")
    templates = layout.buildDirectory.dir("generated/liveTemplates")
    bundle = layout.buildDirectory.dir("generated/bundle")
}

sourceSets.main { resources.srcDir(liveTemplates.flatMap { it.templates }) }

// The grammars and language configurations are the VS Code extension's.
tasks.withType<PrepareSandboxTask>().configureEach {
    from(layout.projectDirectory.dir("../vscode")) {
        include("language-configuration*.json", "syntaxes/**")
        into(pluginName.map { "$it/textmate/quillo" })
    }
    from(liveTemplates.flatMap { it.bundle }) {
        into(pluginName.map { "$it/textmate/quillo" })
    }
}

// The debugger starts in a background task, which waits for its process: run
// on the test's thread, as a test's tasks are by default, it would wait for itself.
tasks.prepareTestSandbox {
    // Its test service is a class that is not in the plugin as shipped, and a debug session needs it.
    disabledPlugins.add("com.intellij.plugins.html.instantEditing")
}

tasks.test {
    systemProperty("intellij.progress.task.ignoreHeadless", "true")
    timeout = Duration.ofMinutes(6)
}

java {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

// Bytecode for the oldest IDE in the plugin's range: Java 21, Kotlin 2.2. On the
// task, as the IntelliJ Platform plugin sets the target of the IDE built against there.
tasks.withType<KotlinJvmCompile>().configureEach {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_21
        apiVersion = KotlinVersion.KOTLIN_2_2
        languageVersion = KotlinVersion.KOTLIN_2_2
    }
}
