import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import type { CodexProfile, ProfileInput, StoreData } from "../types.js";
import { configFile, configHome } from "./paths.js";

export function emptyStore(): StoreData {
  return {
    activeProfile: "",
    profiles: [],
  };
}

export function normalizeProfile(input: ProfileInput): CodexProfile {
  const name = String(input.name || "").trim();
  if (!name) {
    throw new Error("Profile name is required");
  }

  return {
    name,
    displayName: String(input.displayName || "").trim() || name,
    baseUrl: String(input.baseUrl || "").trim(),
    apiKey: String(input.apiKey || ""),
    model: String(input.model || "").trim(),
    wireApi: input.wireApi === "chat" ? "chat" : "responses",
    authMethod: input.authMethod === "chatgpt" ? "chatgpt" : "api_key",
    reasoningEffort: String(input.reasoningEffort || "").trim(),
    modelVerbosity: String(input.modelVerbosity || "").trim(),
  };
}

function normalizeStore(raw: unknown): StoreData {
  if (!raw || typeof raw !== "object") {
    return emptyStore();
  }

  const data = raw as { activeProfile?: unknown; profiles?: unknown[] };
  const profiles = Array.isArray(data.profiles)
    ? data.profiles
        .filter(
          (profile): profile is Record<string, unknown> =>
            Boolean(profile) && typeof profile === "object",
        )
        .map((profile) =>
          normalizeProfile({
            name: String(profile.name || ""),
            displayName: String(profile.displayName || ""),
            baseUrl: String(profile.baseUrl || ""),
            apiKey: String(profile.apiKey || ""),
            model: String(profile.model || ""),
            wireApi: String(profile.wireApi || ""),
            authMethod: String(profile.authMethod || ""),
            reasoningEffort: String(profile.reasoningEffort || ""),
            modelVerbosity: String(profile.modelVerbosity || ""),
          }),
        )
    : [];

  return {
    activeProfile: String(data.activeProfile || ""),
    profiles,
  };
}

export function loadStore(): StoreData {
  try {
    const text = readFileSync(configFile(), "utf8");
    return normalizeStore(JSON.parse(text));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyStore();
    }

    throw error;
  }
}

export function saveStore(store: StoreData): void {
  mkdirSync(configHome(), { recursive: true, mode: 0o700 });
  writeFileSync(
    configFile(),
    `${JSON.stringify(normalizeStore(store), null, 2)}\n`,
    { mode: 0o600 },
  );
}

export function getProfile(
  store: StoreData,
  name: string,
): CodexProfile | undefined {
  return store.profiles.find((profile) => profile.name === name);
}
