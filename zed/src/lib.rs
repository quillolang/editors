//! Quillo for Zed: `quillo lsp` as the language server, `quillo dap` as the debugger.
//! Highlighting and the rest come from tree-sitter-quillo (../tree-sitter), named in
//! extension.toml.
//!
//! What the extension decides is in plain functions (`server_command`, `dap_launch`,
//! `scenario`), so it is tested on the machine that builds it; the `Extension` impl only
//! asks Zed for the settings and the PATH.

use zed_extension_api::{
    self as zed, serde_json, settings::LspSettings, DebugAdapterBinary, DebugConfig, DebugRequest, DebugScenario,
    DebugTaskDefinition, LanguageServerId, StartDebuggingRequestArguments, StartDebuggingRequestArgumentsRequest,
    Worktree,
};

/// The debugger's name, in extension.toml and debug.json.
pub const ADAPTER: &str = "Quillo";

const MISSING: &str = "quillo is not on the PATH: install it from https://github.com/quillolang/quillo/releases/latest, or set lsp.quillo.binary.path in Zed's settings";

/// The language server's command: the `lsp.quillo.binary` setting, else `quillo` on the PATH.
pub fn server_command(path: Option<String>, arguments: Option<Vec<String>>, on_path: Option<String>) -> Result<(String, Vec<String>), String> {
    let command = path.filter(|p| !p.trim().is_empty()).or(on_path).ok_or_else(|| MISSING.to_string())?;
    Ok((command, arguments.unwrap_or_else(|| vec!["lsp".to_string()])))
}

/// What `quillo dap` is started with, from a debug.json configuration: the folder to run
/// in, and the configuration it is sent (`program` is required, as in VS Code).
pub fn dap_launch(config: &str) -> Result<(Option<String>, serde_json::Value), String> {
    let value: serde_json::Value = serde_json::from_str(config).map_err(|e| format!("the debug configuration is not JSON: {e}"))?;
    let map = value.as_object().ok_or("the debug configuration is not an object")?;
    match map.get("program") {
        Some(serde_json::Value::String(p)) if !p.trim().is_empty() => {}
        _ => return Err("set \"program\" to the .qwe file to debug".to_string()),
    }
    if let Some(args) = map.get("args") {
        if !args.as_array().is_some_and(|a| a.iter().all(|x| x.is_string())) {
            return Err("\"args\" is a list of strings, such as [\"--watch\"]".to_string());
        }
    }
    if map.get("request").and_then(|r| r.as_str()).is_some_and(|r| r != "launch") {
        return Err("quillo dap launches the program: \"request\" is \"launch\"".to_string());
    }
    let cwd = map.get("cwd").and_then(|c| c.as_str()).map(str::to_string);
    Ok((cwd, value))
}

/// A debug.json scenario from Zed's New Process modal: the program, its arguments and folder.
pub fn scenario(label: String, program: String, args: Vec<String>, cwd: Option<String>, stop_on_entry: Option<bool>) -> serde_json::Value {
    let mut config = serde_json::json!({ "request": "launch", "program": program, "args": args });
    if let Some(cwd) = cwd {
        config["cwd"] = cwd.into();
    }
    if let Some(stop) = stop_on_entry {
        config["stopOnEntry"] = stop.into();
    }
    serde_json::json!({ "label": label, "adapter": ADAPTER, "config": config })
}

struct Quillo;

impl zed::Extension for Quillo {
    fn new() -> Self {
        Quillo
    }

    fn language_server_command(&mut self, _id: &LanguageServerId, worktree: &Worktree) -> zed::Result<zed::Command> {
        let binary = LspSettings::for_worktree("quillo", worktree).ok().and_then(|s| s.binary);
        let (path, arguments, env) = match binary {
            Some(b) => (b.path, b.arguments, b.env),
            None => (None, None, None),
        };
        let (command, args) = server_command(path, arguments, worktree.which("quillo"))?;
        let mut env_vars = worktree.shell_env();
        env_vars.extend(env.unwrap_or_default());
        Ok(zed::Command { command, args, env: env_vars })
    }

    fn get_dap_binary(
        &mut self,
        _adapter_name: String,
        config: DebugTaskDefinition,
        user_provided_debug_adapter_path: Option<String>,
        worktree: &Worktree,
    ) -> Result<DebugAdapterBinary, String> {
        let (cwd, configuration) = dap_launch(&config.config)?;
        let command = user_provided_debug_adapter_path.or_else(|| worktree.which("quillo")).ok_or_else(|| MISSING.to_string())?;
        Ok(DebugAdapterBinary {
            command: Some(command),
            arguments: vec!["dap".to_string()],
            envs: worktree.shell_env(),
            cwd: cwd.or_else(|| Some(worktree.root_path())),
            connection: None,
            request_args: StartDebuggingRequestArguments {
                configuration: configuration.to_string(),
                request: StartDebuggingRequestArgumentsRequest::Launch,
            },
        })
    }

    fn dap_request_kind(&mut self, _adapter_name: String, config: serde_json::Value) -> Result<StartDebuggingRequestArgumentsRequest, String> {
        dap_launch(&config.to_string()).map(|_| StartDebuggingRequestArgumentsRequest::Launch)
    }

    fn dap_config_to_scenario(&mut self, config: DebugConfig) -> Result<DebugScenario, String> {
        let DebugRequest::Launch(launch) = config.request else {
            return Err("quillo dap launches a program; it does not attach to one".to_string());
        };
        let s = scenario(config.label.clone(), launch.program, launch.args, launch.cwd, config.stop_on_entry);
        Ok(DebugScenario { label: config.label, adapter: ADAPTER.to_string(), build: None, config: s["config"].to_string(), tcp_connection: None })
    }
}

zed::register_extension!(Quillo);

#[cfg(test)]
mod tests;
