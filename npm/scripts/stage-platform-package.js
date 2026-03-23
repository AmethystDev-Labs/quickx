#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function copyFile(src, dest, mode) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  if (mode !== undefined) {
    fs.chmodSync(dest, mode);
  }
}

function writeJSON(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const args = parseArgs(process.argv);
  const required = [
    "platform",
    "arch",
    "version",
    "addon",
    "tui",
    "output-dir",
  ];

  for (const key of required) {
    if (!args[key]) {
      throw new Error(`Missing required --${key}`);
    }
  }

  const sharedLibRequired = args.platform !== "win32";
  if (sharedLibRequired && !args["core-lib"]) {
    throw new Error(`Missing required --core-lib for ${args.platform}`);
  }

  const packageName = `@starryskyworld/quickcli-${args.platform}-${args.arch}`;
  const packageDir = path.join(args["output-dir"], `${args.platform}-${args.arch}`);
  const readmePath = path.join(__dirname, "..", "README.md");
  const isWindows = args.platform === "win32";
  const tuiFileName = isWindows ? "quick-tui.exe" : "quick-tui";
  const runtimeFiles = [];

  fs.rmSync(packageDir, { recursive: true, force: true });
  fs.mkdirSync(packageDir, { recursive: true });

  copyFile(args.addon, path.join(packageDir, "native", "build", "Release", "quickaddon.node"));
  runtimeFiles.push("native/build/Release/quickaddon.node");

  if (sharedLibRequired) {
    const sharedLibName = path.basename(args["core-lib"]);
    copyFile(
      args["core-lib"],
      path.join(packageDir, "native", "lib", sharedLibName),
    );
    runtimeFiles.push(`native/lib/${sharedLibName}`);
  }

  if (isWindows && args["core-dll"]) {
    copyFile(
      args["core-dll"],
      path.join(packageDir, "native", "build", "Release", path.basename(args["core-dll"])),
    );
    runtimeFiles.push(`native/build/Release/${path.basename(args["core-dll"])}`);
  }

  copyFile(args.tui, path.join(packageDir, "bin", tuiFileName), isWindows ? undefined : 0o755);
  runtimeFiles.push(`bin/${tuiFileName}`);

  if (fs.existsSync(readmePath)) {
    copyFile(readmePath, path.join(packageDir, "README.md"));
  }

  writeJSON(path.join(packageDir, "package.json"), {
    name: packageName,
    version: args.version,
    description: `Precompiled QuickCLI runtime for ${args.platform}-${args.arch}`,
    license: "GPL-3.0-only",
    os: [args.platform],
    cpu: [args.arch],
    files: runtimeFiles.concat("index.js", "README.md"),
    main: "index.js",
    repository: {
      type: "git",
      url: "https://github.com/AmethystDev-Labs/QuickCLI.git",
    },
  });

  fs.writeFileSync(
    path.join(packageDir, "index.js"),
    [
      "\"use strict\";",
      "",
      "const path = require(\"path\");",
      "",
      "module.exports = {",
      "  addonPath: path.join(__dirname, \"native\", \"build\", \"Release\", \"quickaddon.node\"),",
      `  tuiPath: path.join(__dirname, "bin", "${tuiFileName}"),`,
      "};",
      "",
    ].join("\n"),
  );
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
