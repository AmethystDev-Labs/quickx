"use strict";

const fs = require("fs");
const path = require("path");

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const version = packageJson.version;
const packageNames = [
  "@amethyst-labs/quickcli-darwin-arm64",
  "@amethyst-labs/quickcli-darwin-x64",
  "@amethyst-labs/quickcli-linux-arm64",
  "@amethyst-labs/quickcli-linux-x64",
  "@amethyst-labs/quickcli-win32-x64",
];

packageJson.optionalDependencies = Object.fromEntries(
  packageNames.map((packageName) => [packageName, version]),
);

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
