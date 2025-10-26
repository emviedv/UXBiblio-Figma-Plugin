local wezterm = require "wezterm"

_G.BIBLIOKIT_WEZTERM_THEME = "bibliokit_figma_plugin"
return dofile((wezterm.home_dir or ".") .. "/.config/wezterm/wezterm.lua")
