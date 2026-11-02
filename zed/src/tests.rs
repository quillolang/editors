//! The extension's decisions, and its manifest checked against the repository: the
//! grammar's commit holds the grammar, the names agree, every file named is there.
use super::*;
use std::path::Path;
use std::process::Command as Process;

fn manifest() -> toml::Value {
    toml::from_str(&std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("extension.toml")).unwrap()).unwrap()
}

fn language() -> toml::Value {
    toml::from_str(&std::fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("languages/quillo/config.toml")).unwrap()).unwrap()
}

#[test]
fn the_server_is_the_setting_then_the_path() {
    assert_eq!(server_command(Some("/opt/q".into()), None, Some("/usr/bin/quillo".into())).unwrap(), ("/opt/q".into(), vec!["lsp".to_string()]));
    assert_eq!(server_command(None, None, Some("/usr/bin/quillo".into())).unwrap().0, "/usr/bin/quillo");
    // A blank setting is no setting.
    assert_eq!(server_command(Some("  ".into()), None, Some("/usr/bin/quillo".into())).unwrap().0, "/usr/bin/quillo");
    // Its own arguments replace `lsp`.
    assert_eq!(server_command(None, Some(vec!["lsp".into(), "--log".into()]), Some("q".into())).unwrap().1, vec!["lsp", "--log"]);
    let missing = server_command(None, None, None).unwrap_err();
    assert!(missing.contains("not on the PATH") && missing.contains("lsp.quillo.binary.path"), "{missing}");
}

#[test]
fn a_launch_needs_a_program() {
    let (cwd, config) = dap_launch(r#"{"program": "main.qwe", "args": ["--watch"], "cwd": "/app"}"#).unwrap();
    assert_eq!(cwd.as_deref(), Some("/app"));
    assert_eq!(config["program"], "main.qwe");
    assert_eq!(dap_launch(r#"{"program": "main.qwe"}"#).unwrap().0, None);
    assert_eq!(dap_launch(r#"{"program": "main.qwe", "request": "launch"}"#).unwrap().1["request"], "launch");
    for (bad, says) in [
        (r#"{}"#, "program"),
        (r#"{"program": ""}"#, "program"),
        (r#"{"program": 3}"#, "program"),
        (r#"{"program": "m.qwe", "args": "--watch"}"#, "list of strings"),
        (r#"{"program": "m.qwe", "args": [1]}"#, "list of strings"),
        (r#"{"program": "m.qwe", "request": "attach"}"#, "launch"),
        (r#"[1]"#, "not an object"),
        (r#"{"program": "#, "not JSON"),
    ] {
        let e = dap_launch(bad).unwrap_err();
        assert!(e.contains(says), "{bad}: {e}");
    }
}

#[test]
fn a_scenario_from_the_new_process_modal() {
    let s = scenario("Run".into(), "app/main.qwe".into(), vec!["--port".into(), "9000".into()], Some("/w".into()), Some(true));
    assert_eq!(s["adapter"], ADAPTER);
    assert_eq!(s["config"]["program"], "app/main.qwe");
    assert_eq!(s["config"]["args"][1], "9000");
    assert_eq!(s["config"]["cwd"], "/w");
    assert_eq!(s["config"]["stopOnEntry"], true);
    // What it makes, quillo dap is started with.
    assert!(dap_launch(&s["config"].to_string()).is_ok());
    let bare = scenario("Run".into(), "m.qwe".into(), vec![], None, None);
    assert!(bare["config"].get("cwd").is_none() && bare["config"].get("stopOnEntry").is_none());
}

#[test]
fn the_grammars_commit_holds_the_grammar() {
    let m = manifest();
    let g = &m["grammars"]["quillo"];
    assert_eq!(g["repository"].as_str(), Some("https://github.com/quillolang/editors"));
    let path = g["path"].as_str().unwrap();
    let rev = g["rev"].as_str().unwrap();
    assert_eq!(rev.len(), 40, "a full commit, as Zed fetches it");
    for file in ["src/parser.c", "src/scanner.c", "grammar.js"] {
        let ok = Process::new("git")
            .args(["cat-file", "-e", &format!("{rev}:{path}/{file}")])
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .status()
            .unwrap()
            .success();
        assert!(ok, "{path}/{file} is not in commit {rev}");
    }
}

#[test]
fn the_names_agree() {
    let m = manifest();
    let lang = language();
    let name = lang["name"].as_str().unwrap();
    let grammar = lang["grammar"].as_str().unwrap();
    assert!(m["grammars"].get(grammar).is_some(), "config.toml's grammar {grammar} is in extension.toml");
    let servers = m["language_servers"]["quillo"]["languages"].as_array().unwrap();
    assert!(servers.iter().any(|l| l.as_str() == Some(name)));
    let debuggers = lang["debuggers"].as_array().unwrap();
    assert!(debuggers.iter().all(|d| m["debug_adapters"].get(d.as_str().unwrap()).is_some()));
    assert!(m["debug_adapters"].get(ADAPTER).is_some());
    assert_eq!(lang["path_suffixes"].as_array().unwrap(), &vec![toml::Value::from("qwe")]);
    assert!(m["version"].as_str().unwrap() == env!("CARGO_PKG_VERSION"), "extension.toml and Cargo.toml give the same version");
}

#[test]
fn every_file_named_is_there() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let m = manifest();
    for (_, a) in m["debug_adapters"].as_table().unwrap() {
        let schema = dir.join(a["schema_path"].as_str().unwrap());
        let v: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(&schema).unwrap()).unwrap();
        assert_eq!(v["required"][0], "program");
    }
    for q in ["highlights.scm", "injections.scm", "indents.scm", "brackets.scm", "outline.scm"] {
        assert!(dir.join("languages/quillo").join(q).exists(), "{q}");
    }
}

#[test]
fn the_first_line_pattern_takes_a_script() {
    // Zed matches it with Rust's regex crate, as here.
    let re = regex::Regex::new(language()["first_line_pattern"].as_str().unwrap()).unwrap();
    for yes in ["#!/usr/bin/env quillo", "#!/usr/local/bin/quillo run", "#!/usr/bin/env -S quillo run --allow-path ."] {
        assert!(re.is_match(yes), "{yes}");
    }
    for no in ["#!/bin/sh", "#!/usr/bin/env quillo2", "#!/usr/bin/env myquillo", "// quillo", " #!/usr/bin/env quillo"] {
        assert!(!re.is_match(no), "{no}");
    }
}
