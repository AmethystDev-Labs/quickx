#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const npmRoot = path.resolve(__dirname, "..");
const nativeDir = path.join(npmRoot, "native");
const nativeLibDir = path.join(nativeDir, "lib");
const binDir = path.join(npmRoot, "bin");

function run(cmd, args, cwd) {
  const useShell =
    process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: useShell });
}

function sharedLibraryName() {
  if (process.platform === "win32") return "quickcore.dll";
  if (process.platform === "darwin") return "libquickcore.dylib";
  return "libquickcore.so";
}

function windowsImportLibraryName() {
  return "quickcore.lib";
}

function tuiBinaryName() {
  return process.platform === "win32" ? "quick-tui.exe" : "quick-tui";
}

function nodeGypBin() {
  return path.join(
    npmRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "node-gyp.cmd" : "node-gyp",
  );
}

function macSharedLibPath() {
  return path.join(nativeLibDir, "libquickcore.dylib");
}

function windowsMachineType() {
  if (process.arch === "x64") return "X64";
  if (process.arch === "ia32") return "X86";
  if (process.arch === "arm64") return "ARM64";
  throw new Error(`Unsupported Windows architecture for import library generation: ${process.arch}`);
}

function goExportedSymbols() {
  const cabiSource = fs.readFileSync(
    path.join(repoRoot, "bridge", "cabi", "main.go"),
    "utf8",
  );

  return cabiSource
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*\/\/export\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/u))
    .filter(Boolean)
    .map((match) => match[1]);
}

function buildWindowsImportLibrary() {
  const dllName = sharedLibraryName();
  const defPath = path.join(nativeLibDir, "quickcore.def");
  const libPath = path.join(nativeLibDir, windowsImportLibraryName());
  const exportedSymbols = goExportedSymbols();

  if (exportedSymbols.length === 0) {
    throw new Error("No //export symbols found in bridge/cabi/main.go");
  }

  const defContents = [
    `LIBRARY ${dllName}`,
    "EXPORTS",
    ...exportedSymbols.map((symbol) => `  ${symbol}`),
    "",
  ].join("\r\n");

  fs.writeFileSync(defPath, defContents);
  run(
    "lib.exe",
    [
      `/def:${defPath}`,
      `/out:${libPath}`,
      `/machine:${windowsMachineType()}`,
    ],
    repoRoot,
  );
}

function buildGoArtifacts() {
  fs.mkdirSync(nativeLibDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });

  run(
    "go",
    [
      "build",
      "-buildmode=c-shared",
      "-o",
      path.join(nativeLibDir, sharedLibraryName()),
      "./bridge/cabi",
    ],
    repoRoot,
  );
  run("go", ["build", "-o", path.join(binDir, tuiBinaryName()), "./cmd/quick-tui"], repoRoot);

  if (process.platform === "darwin") {
    run("install_name_tool", ["-id", "@rpath/libquickcore.dylib", macSharedLibPath()], repoRoot);
  }

  if (process.platform === "win32") {
    buildWindowsImportLibrary();
  }
}

function buildAddon() {
  run(nodeGypBin(), ["rebuild"], nativeDir);

  if (process.platform === "darwin") {
    run(
      "install_name_tool",
      [
        "-change",
        "libquickcore.dylib",
        "@rpath/libquickcore.dylib",
        path.join(nativeDir, "build", "Release", "quickaddon.node"),
      ],
      repoRoot,
    );
  }

  if (process.platform === "win32") {
    fs.copyFileSync(
      path.join(nativeLibDir, sharedLibraryName()),
      path.join(nativeDir, "build", "Release", sharedLibraryName()),
    );
  }
}

buildGoArtifacts();
buildAddon();
