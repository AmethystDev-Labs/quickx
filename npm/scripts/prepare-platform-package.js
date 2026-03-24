#!/usr/bin/env node
"use strict";

const path = require("path");
const { execFileSync } = require("child_process");

const scriptsDir = __dirname;

function runNodeScript(scriptName, args) {
  execFileSync(process.execPath, [path.join(scriptsDir, scriptName), ...args], {
    stdio: "inherit",
  });
}

runNodeScript("build-platform-artifacts.js", []);
runNodeScript("stage-platform-package.js", process.argv.slice(2));
