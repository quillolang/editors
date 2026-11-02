"""quillo lsp for Sublime Text's LSP package (sublimelsp/LSP), as its LSP-* packages
register a server. The command and the files it takes are in LSP-quillo.sublime-settings;
Preferences > Package Settings > LSP > Servers > LSP-quillo changes them."""
from LSP.plugin import AbstractPlugin, register_plugin, unregister_plugin


class LspQuilloPlugin(AbstractPlugin):
    @classmethod
    def name(cls):
        return "quillo"


def plugin_loaded():
    register_plugin(LspQuilloPlugin)


def plugin_unloaded():
    unregister_plugin(LspQuilloPlugin)
