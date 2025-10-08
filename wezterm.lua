local wezterm = require 'wezterm'

-- Light pink workspace theme for the UXBiblio Figma Plugin folder
local config = wezterm.config_builder and wezterm.config_builder() or {}

config.colors = {
  foreground = '#2f1521',
  background = '#fef1f7',
  cursor_bg = '#d75695',
  cursor_border = '#d75695',
  cursor_fg = '#fff6fb',
  selection_bg = '#fdd6e8',
  selection_fg = '#2a101d',
  ansi = {
    '#341422',
    '#cf2463',
    '#6b9552',
    '#ef94b3',
    '#8a2ba3',
    '#e96994',
    '#2c8d9d',
    '#fae5ef',
  },
  brights = {
    '#592c41',
    '#f54a84',
    '#8bbd50',
    '#f986ad',
    '#b58ef9',
    '#fa9dc8',
    '#52b1a8',
    '#ffffff',
  },
  tab_bar = {
    background = '#f4c1dc',
    inactive_tab_edge = '#edadcb',
    active_tab = {
      bg_color = '#fef1f7',
      fg_color = '#2f1521',
      intensity = 'Bold',
    },
    inactive_tab = {
      bg_color = '#edadcb',
      fg_color = '#482132',
    },
    inactive_tab_hover = {
      bg_color = '#fdd6e8',
      fg_color = '#2f1521',
      italic = true,
    },
    new_tab = {
      bg_color = '#edadcb',
      fg_color = '#2f1521',
    },
    new_tab_hover = {
      bg_color = '#fddee9',
      fg_color = '#2f1521',
      italic = true,
    },
  },
}

config.command_palette_bg_color = '#fdd6e8'
config.command_palette_fg_color = '#2f1521'
config.window_background_opacity = 0.94
config.macos_window_background_blur = 22
config.window_background_gradient = {
  colors = {
    '#fef1f7',
    '#f4c1dc',
    '#fdd6e8',
    '#fef1f7',
  },
  orientation = { Linear = { angle = 45.0 } },
  blend = 'Rgb',
  interpolation = 'Linear',
  noise = 48,
}

return config
