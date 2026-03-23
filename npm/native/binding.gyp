{
  "targets": [
    {
      "target_name": "quickaddon",
      "sources": ["quick_addon.cc"],
      "conditions": [
        [
          "OS==\"mac\"",
          {
            "libraries": ["<(module_root_dir)/lib/libquickcore.dylib"],
            "xcode_settings": {
              "OTHER_LDFLAGS": ["-Wl,-rpath,@loader_path/../../lib"]
            }
          }
        ],
        [
          "OS==\"linux\"",
          {
            "libraries": ["<(module_root_dir)/lib/libquickcore.so"],
            "link_settings": {
              "ldflags": ["-Wl,-rpath,\\$$ORIGIN/../../lib"]
            }
          }
        ],
        [
          "OS==\"win\"",
          {
            "libraries": ["<(module_root_dir)\\lib\\quickcore.lib"]
          }
        ]
      ]
    }
  ]
}
