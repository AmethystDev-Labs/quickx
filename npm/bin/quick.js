#!/usr/bin/env node
"use strict";

const { spawn } = require("child_process");
const readline = require("readline");
const { Command } = require("commander");
const { runInkTui } = require("../lib/ink-tui");

let native;

function getNative() {
  if (!native) {
    native = require("../lib/native");
  }
  return native;
}

function maskKey(key) {
  if (!key) return "(not set)";
  const visible = 4;
  if (key.length <= visible) return "*".repeat(key.length);
  return key.slice(0, visible) + "*".repeat(key.length - visible);
}

function orNone(value) {
  return value || "(none)";
}

function parseScope(scope) {
  const parsed = String(scope || "codex")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : ["codex"];
}

function openBrowser(url) {
  try {
    if (process.platform === "darwin") {
      const child = spawn("open", [url], { detached: true, stdio: "ignore" });
      child.unref();
      return true;
    }
    if (process.platform === "win32") {
      const child = spawn("cmd", ["/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return true;
    }
    const child = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function ask(question, { defaultValue = "", secret = false } = {}) {
  return new Promise((resolve) => {
    const suffix = defaultValue ? ` [default: ${defaultValue}]` : "";
    const prompt = `${question}${suffix}: `;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    if (secret) {
      rl.stdoutMuted = false;
      rl._writeToOutput = function writeToOutput(text) {
        if (rl.stdoutMuted && text !== "\n" && text !== "\r\n") {
          rl.output.write("*");
          return;
        }
        rl.output.write(text);
      };
    }

    rl.question(prompt, (answer) => {
      rl.close();
      if (secret) {
        process.stdout.write("\n");
      }
      resolve(answer || defaultValue);
    });

    if (secret) {
      rl.stdoutMuted = true;
    }
  });
}

async function askCustomConfigInputs(name, options) {
  let resolvedName = name || "";
  let baseUrl = options.baseUrl || "";
  let apiKey = options.apiKey || "";
  let model = options.model || "";

  if (!resolvedName) {
    resolvedName = await ask("Config name", { defaultValue: "my-config" });
  }
  if (!baseUrl) {
    baseUrl = await ask("Base URL", { defaultValue: "https://api.example.com/v1" });
  }
  if (!apiKey) {
    apiKey = await ask("API Key (leave blank to skip)", { secret: true });
  }
  if (!model) {
    model = await ask("Default model (optional)", { defaultValue: "gpt-4o" });
  }

  return { resolvedName, baseUrl, apiKey, model };
}

async function askTemplateAnswers(templateSetup) {
  const answers = {};
  for (const placeholder of templateSetup.placeholders || []) {
    answers[placeholder.question] = await ask(placeholder.question, {
      defaultValue: placeholder.default || "",
      secret: placeholder.secret,
    });
  }
  return answers;
}

function printToolStatus(tool, configs) {
  console.log(`\n${tool}`);
  console.log("─".repeat(20));
  if (!configs || configs.length === 0) {
    console.log("  (not configured)");
    return;
  }

  for (const config of configs) {
    const name = config.DisplayName || config.Name;
    console.log(`  Config    : ${name} (${config.Name})`);
    console.log(`  Base URL  : ${orNone(config.BaseURL)}`);
    console.log(`  API Key   : ${maskKey(config.APIKey)}`);
    console.log(`  Model     : ${orNone(config.Model)}`);
  }
}

function printStatus() {
  const info = getNative().status();
  console.log("quick status");
  console.log("─".repeat(40));
  console.log(`Config file  : ${info.ConfigFile}`);
  console.log(`Active       : ${orNone(info.ActiveConfig)}`);
  console.log("");

  if (!info.ActiveConfig) {
    console.log("No active config. Run `quick use <name>` to activate one.");
    return;
  }

  printToolStatus("Claude Code", info.ClaudeConfigs);
  printToolStatus("Codex", info.CodexConfigs);
  printToolStatus("OpenCode", info.OpenCodeConfigs);
}

function printConfigList() {
  const result = getNative().listConfigs();
  if (!result.configs || result.configs.length === 0) {
    console.log("No configs yet. Run `quick config add` to create one.");
    return;
  }

  console.log(`${"NAME".padEnd(20)} ${"SCOPE".padEnd(18)} DISPLAY NAME`);
  console.log("─".repeat(60));
  for (const config of result.configs) {
    const scope = (config.Scope || []).join(",");
    const marker = config.Name === result.activeConfig ? " ✓" : "";
    const name = config.DisplayName || config.Name;
    console.log(`${config.Name.padEnd(20)} ${scope.padEnd(18)} ${name}${marker}`);
  }
}

function printTemplateList() {
  const templates = getNative().listTemplates();
  if (!templates || templates.length === 0) {
    console.log("No templates found in the registry.");
    return;
  }

  console.log(`${"ID".padEnd(20)} ${"NAME".padEnd(30)} SCOPE`);
  console.log("─".repeat(70));
  for (const template of templates) {
    console.log(
      `${template.ID.padEnd(20)} ${template.DisplayName.padEnd(30)} ${(template.Scope || []).join(",")}`,
    );
  }
}

function printTemplatePreview(id) {
  const template = getNative().previewTemplate(id);
  console.log(`ID          : ${template.ID}`);
  console.log(`Name        : ${template.DisplayName}`);
  console.log(`Scope       : ${(template.Scope || []).join(", ")}`);
  console.log(`Base URL    : ${template.BaseURL || ""}`);
  console.log(`Model       : ${template.Model || ""}`);
  console.log(`Wire API    : ${template.WireAPI || ""}`);
  console.log(`Auth Method : ${template.AuthMethod || ""}`);
  if (template.DocsURL) {
    console.log(`Docs        : ${template.DocsURL}`);
  }
  if (template.RequiredEnvs && template.RequiredEnvs.length > 0) {
    console.log(`Required Env: ${template.RequiredEnvs.join(", ")}`);
  }

  const setup = getNative().getTemplateSetup(id);
  if (setup.placeholders && setup.placeholders.length > 0) {
    console.log("\nDynamic fields:");
    for (const placeholder of setup.placeholders) {
      const fallback = placeholder.default || "(required)";
      console.log(`  - ${placeholder.question} [default: ${fallback}]`);
    }
  }
}

async function spawnInkTUI() {
  await runInkTui(getNative());
}

async function runLogin(name, options) {
  if (options.device) {
    const result = getNative().loginCodexRequestDevice();
    console.log("Requesting device code…");
    console.log(`\n1. Open this URL in your browser:\n   ${result.verificationUrl}`);
    console.log(`\n2. Enter this one-time code:\n   ${result.userCode}\n`);
    console.log("Waiting for authentication to complete…");
    getNative().loginCodexCompleteDevice(result.handleId);
  } else {
    const result = getNative().loginCodexBrowserStart();
    console.log("Starting browser login…");
    console.log(`\nOpen this URL in your browser:\n  ${result.authUrl}\n`);
    if (openBrowser(result.authUrl)) {
      console.log("Opened your default browser.");
    }
    console.log("Waiting for you to complete login in your browser…");
    getNative().loginCodexBrowserWait(result.handleId);
  }

  const created = getNative().createCodexLoginConfig(name || "");
  console.log(`✓ Config "${created.name}" created.`);
  console.log(`  Run \`quick use ${created.name}\` to activate it.`);
}

async function runAdd(name, options) {
  if (options.fromTemplate) {
    const setup = getNative().getTemplateSetup(options.fromTemplate);
    const answers = await askTemplateAnswers(setup);
    const result = getNative().createConfigFromTemplate({
      name: name || "",
      id: options.fromTemplate,
      answers,
    });
    console.log(`Config "${result.name}" added from template "${options.fromTemplate}".`);
    console.log(`Run \`quick use ${result.name}\` to activate it.`);
    return;
  }

  const inputs = await askCustomConfigInputs(name, options);
  getNative().addConfig({
    name: inputs.resolvedName,
    scope: parseScope(options.scope),
    baseUrl: inputs.baseUrl,
    apiKey: inputs.apiKey,
    model: inputs.model,
    wireApi: options.wireApi,
    authMethod: options.authMethod,
  });
  console.log(`Config "${inputs.resolvedName}" added.`);
  console.log(`Run \`quick use ${inputs.resolvedName}\` to activate it.`);
}

const program = new Command();

program
  .name("quick")
  .description("Switch AI coding assistant providers with a Node CLI and Go core")
  .showHelpAfterError();

program
  .command("status")
  .description("Show current configuration")
  .action(() => {
    printStatus();
  });

program
  .command("use")
  .argument("<config-name>")
  .description("Activate a config")
  .action((name) => {
    getNative().useConfig(name);
    console.log(`Activated config "${name}"`);
    console.log("Restart your shell (or run `source ~/.zshrc`) for environment changes to take effect.");
  });

const config = program.command("config").description("Manage configs");

config
  .command("list")
  .description("List all configs")
  .action(() => {
    printConfigList();
  });

config
  .command("add")
  .argument("[name]")
  .description("Add a config, prompting for any missing values")
  .option("--scope <scope>", "Comma-separated scopes", "codex")
  .option("--base-url <url>", "Provider API base URL", "")
  .option("--api-key <key>", "API key", "")
  .option("--model <model>", "Default model name", "")
  .option("--wire-api <wireApi>", "Wire protocol", "responses")
  .option("--auth-method <authMethod>", "Auth method", "api_key")
  .option("--from-template <id>", "Template ID", "")
  .action(async (name, options) => {
    await runAdd(name, options);
  });

config
  .command("remove")
  .argument("<name>")
  .description("Remove a config")
  .action((name) => {
    getNative().removeConfig(name);
    console.log(`Config "${name}" removed.`);
  });

config
  .command("login")
  .argument("[name]")
  .description("Log in with ChatGPT (OpenAI Codex) and create a config")
  .option("--device", "Use device-code flow instead of browser")
  .action(async (name, options) => {
    await runLogin(name, options);
  });

const template = program.command("template").description("Browse templates");

template
  .command("list")
  .description("List available provider templates")
  .action(() => {
    printTemplateList();
  });

template
  .command("preview")
  .argument("<id>")
  .description("Preview a template")
  .action((id) => {
    printTemplatePreview(id);
  });

async function main() {
  if (process.argv.length <= 2) {
    await spawnInkTUI();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
