Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'JS bridge for the Home-Screen Widget'
  s.description    = 'Writes the signed-in handle, theme and API origin into the app group the WidgetKit extension reads, and triggers timeline reloads.'
  s.license        = 'MIT'
  s.author         = 'Opnshelf'
  s.homepage       = 'https://opnshelf.xyz'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
