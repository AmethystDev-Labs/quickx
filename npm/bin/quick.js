#!/usr/bin/env node
"use strict";
const { execFileSync } = require("child_process");
const path = require("path");

const binaryName = process.platform === "win32" ? "quick.exe" : "quick-bin";
const binaryPath = path.join(__dirname, binaryName);

try {
  execFileSync(binaryPath, process.argv.slice(2), { stdio: "inherit" });
} catch (err) {
  if (err.status !== undefined) process.exit(err.status);
  throw err;
}
