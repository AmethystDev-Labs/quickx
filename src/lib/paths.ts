import os from "node:os";
import path from "node:path";

export function cacheHome(): string {
  if (process.platform === "win32") {
    const base =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "quickx");
  }

  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  if (xdgCacheHome) {
    return path.join(xdgCacheHome, "quickx");
  }

  return path.join(os.homedir(), ".cache", "quickx");
}

export function configHome(): string {
  if (process.platform === "win32") {
    const base =
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, "quickx");
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, "quickx");
  }

  return path.join(os.homedir(), ".config", "quickx");
}

export function configFile(): string {
  return path.join(configHome(), "config.json");
}

export function codexHome(): string {
  return path.join(os.homedir(), ".codex");
}

export function codexConfigFile(): string {
  return path.join(codexHome(), "config.toml");
}

export function authFile(): string {
  return path.join(codexHome(), "auth.json");
}
