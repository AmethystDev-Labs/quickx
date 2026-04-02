import type {
  AddDraft,
  AddFieldKey,
  CodexProfile,
  EditDraft,
  EditFieldKey,
  FormFieldDefinition,
  LoginDraft,
  StatusInfo,
} from "../types.js";
import { maskKey } from "./utils.js";

export const addFieldDefs: FormFieldDefinition<AddFieldKey>[] = [
  { key: "name", label: "Name", placeholder: "my-codex", secret: false },
  {
    key: "displayName",
    label: "Display",
    placeholder: "My Codex",
    secret: false,
  },
  {
    key: "baseUrl",
    label: "Base URL",
    placeholder: "https://api.openai.com/v1",
    secret: false,
  },
  { key: "apiKey", label: "API Key", placeholder: "(optional)", secret: true },
  { key: "model", label: "Model", placeholder: "gpt-5", secret: false },
  {
    key: "wireApi",
    label: "Wire API",
    placeholder: "responses",
    secret: false,
  },
  {
    key: "authMethod",
    label: "Auth",
    placeholder: "api_key",
    secret: false,
  },
];

export const editFieldDefs: FormFieldDefinition<EditFieldKey>[] = [
  {
    key: "displayName",
    label: "Display",
    placeholder: "My Codex",
    secret: false,
  },
  {
    key: "baseUrl",
    label: "Base URL",
    placeholder: "https://api.openai.com/v1",
    secret: false,
  },
  { key: "apiKey", label: "API Key", placeholder: "(optional)", secret: true },
  { key: "model", label: "Model", placeholder: "gpt-5", secret: false },
  {
    key: "wireApi",
    label: "Wire API",
    placeholder: "responses",
    secret: false,
  },
  {
    key: "authMethod",
    label: "Auth",
    placeholder: "api_key",
    secret: false,
  },
];

export function defaultAddDraft(): AddDraft {
  return {
    name: "",
    displayName: "",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-5",
    wireApi: "responses",
    authMethod: "api_key",
  };
}

export function defaultEditDraft(): EditDraft {
  return {
    displayName: "",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-5",
    wireApi: "responses",
    authMethod: "api_key",
  };
}

export function defaultLoginDraft(): LoginDraft {
  return {
    name: "",
    method: "browser",
  };
}

export function profileToEditDraft(profile: CodexProfile): EditDraft {
  return {
    displayName: profile.displayName,
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    wireApi: profile.wireApi,
    authMethod: profile.authMethod,
  };
}

export function nextFieldIndex(current: number, total: number): number {
  return (current + 1) % total;
}

export function prevFieldIndex(current: number, total: number): number {
  return (current - 1 + total) % total;
}

export function isPrintableInput(
  input: string,
  key: { ctrl?: boolean; meta?: boolean },
): boolean {
  if (!input || key.ctrl || key.meta) {
    return false;
  }

  return /^[\x20-\x7E]$/u.test(input);
}

export function statusLines(info: StatusInfo): string[] {
  const lines = [
    `Config file: ${info.configFile}`,
    `Codex config: ${info.codexConfigFile}`,
    `Auth file: ${info.authFile}`,
    `Active: ${info.activeProfile || "(none)"}`,
    `Logged in: ${info.loggedInEmail || "(none)"}`,
    "",
    "Profiles:",
  ];

  if (info.profiles.length === 0) {
    lines.push("  (none)");
    return lines;
  }

  for (const profile of info.profiles) {
    const marker = profile.name === info.activeProfile ? "*" : " ";
    lines.push(` ${marker} ${profile.displayName} (${profile.name})`);
    lines.push(`    base : ${profile.baseUrl || "(none)"}`);
    lines.push(`    model: ${profile.model || "(none)"}`);
    lines.push(`    auth : ${profile.authMethod || "(none)"}`);
    lines.push(`    key  : ${maskKey(profile.apiKey)}`);
  }

  return lines;
}
