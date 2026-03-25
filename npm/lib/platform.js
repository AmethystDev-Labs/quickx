"use strict";

const platformPackages = {
  "darwin-arm64": "@amethyst-labs/quickcli-darwin-arm64",
  "darwin-x64": "@amethyst-labs/quickcli-darwin-x64",
  "linux-arm64": "@amethyst-labs/quickcli-linux-arm64",
  "linux-x64": "@amethyst-labs/quickcli-linux-x64",
  "win32-x64": "@amethyst-labs/quickcli-win32-x64",
};

function currentKey() {
  return `${process.platform}-${process.arch}`;
}

function currentPackageName() {
  const packageName = platformPackages[currentKey()];
  if (!packageName) {
    throw new Error(
      `QuickCLI does not currently ship a precompiled package for ${currentKey()}.`,
    );
  }
  return packageName;
}

function loadPlatformPackage() {
  const packageName = currentPackageName();
  try {
    return require(packageName);
  } catch (err) {
    err.message = [
      `Failed to load the QuickCLI platform package ${packageName}.`,
      "Reinstall the package on a supported platform so npm can fetch the matching optional dependency.",
      err.message,
    ].join(" ");
    throw err;
  }
}

module.exports = {
  currentKey,
  currentPackageName,
  loadPlatformPackage,
};
