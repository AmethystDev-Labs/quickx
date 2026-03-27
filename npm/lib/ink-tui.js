"use strict";

const { spawn } = require("child_process");
const React = require("react");

function maskKey(key) {
  if (!key) return "(not set)";
  const visible = 4;
  if (key.length <= visible) return "*".repeat(key.length);
  return key.slice(0, visible) + "*".repeat(key.length - visible);
}

function truncate(value, max) {
  if (!value) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}...`;
}

function pickWindow(items, selectedIndex, limit = 12) {
  if (!Array.isArray(items) || items.length === 0) {
    return { start: 0, rows: [] };
  }
  const clamped = Math.min(Math.max(selectedIndex, 0), items.length - 1);
  const half = Math.floor(limit / 2);
  const maxStart = Math.max(0, items.length - limit);
  const start = Math.max(0, Math.min(maxStart, clamped - half));
  return {
    start,
    rows: items.slice(start, start + limit),
  };
}

function statusLines(info) {
  const lines = [];
  lines.push(`Config file: ${info.ConfigFile || "(unknown)"}`);
  lines.push(`Active: ${info.ActiveConfig || "(none)"}`);
  lines.push("");
  lines.push("Codex:");

  const codex = info.CodexConfigs || [];
  if (codex.length === 0) {
    lines.push("  (not configured)");
  } else {
    for (const config of codex) {
      const display = config.DisplayName || config.Name || "(unnamed)";
      lines.push(`  ${display} (${config.Name || "-"})`);
      lines.push(`    base: ${config.BaseURL || "(none)"}`);
      lines.push(`    key : ${maskKey(config.APIKey)}`);
      lines.push(`    model: ${config.Model || "(none)"}`);
    }
  }
  return lines;
}

function templateDetailLines(template) {
  if (!template) {
    return ["Select a template to preview details."];
  }

  return [
    `ID: ${template.ID || "-"}`,
    `Name: ${template.DisplayName || "-"}`,
    `Scope: ${(template.Scope || []).join(", ") || "-"}`,
    `Base URL: ${template.BaseURL || "-"}`,
    `Model: ${template.Model || "-"}`,
    `Wire API: ${template.WireAPI || "-"}`,
    `Auth Method: ${template.AuthMethod || "-"}`,
    `Docs: ${template.DocsURL || "-"}`,
  ];
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

const addFieldDefs = [
  { key: "name", label: "Name", placeholder: "my-config", secret: false },
  { key: "scope", label: "Scope", placeholder: "codex", secret: false },
  { key: "baseUrl", label: "Base URL", placeholder: "https://api.example.com/v1", secret: false },
  { key: "apiKey", label: "API Key", placeholder: "(optional)", secret: true },
  { key: "model", label: "Model", placeholder: "(optional)", secret: false },
  { key: "wireApi", label: "Wire API", placeholder: "responses", secret: false },
  { key: "authMethod", label: "Auth Method", placeholder: "api_key", secret: false },
];

function defaultAddDraft() {
  return {
    name: "",
    scope: "codex",
    baseUrl: "",
    apiKey: "",
    model: "",
    wireApi: "responses",
    authMethod: "api_key",
  };
}

function defaultLoginDraft() {
  return {
    name: "",
    method: "browser",
  };
}

function nextFieldIndex(current, total) {
  return (current + 1) % total;
}

function prevFieldIndex(current, total) {
  return (current - 1 + total) % total;
}

function isPrintableInput(input, key) {
  if (!input || key.ctrl || key.meta) {
    return false;
  }
  return /^[\x20-\x7E]$/u.test(input);
}

async function runInkTui(nativeApi) {
  const ink = await import("ink");
  const { render, Box, Text, useApp, useInput } = ink;
  const h = React.createElement;

  const tabs = [
    { id: "status", label: "Status" },
    { id: "configs", label: "Configs" },
    { id: "templates", label: "Templates" },
  ];

  function App() {
    const { exit } = useApp();
    const [tab, setTab] = React.useState("status");
    const [status, setStatus] = React.useState(null);
    const [configResult, setConfigResult] = React.useState(null);
    const [templates, setTemplates] = React.useState([]);
    const [selectedConfig, setSelectedConfig] = React.useState(0);
    const [selectedTemplate, setSelectedTemplate] = React.useState(0);
    const [previewCache, setPreviewCache] = React.useState({});
    const [message, setMessage] = React.useState("Ready");
    const [error, setError] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [mode, setMode] = React.useState("browse");
    const [addDraft, setAddDraft] = React.useState(defaultAddDraft());
    const [addFieldIndex, setAddFieldIndex] = React.useState(0);
    const [loginDraft, setLoginDraft] = React.useState(defaultLoginDraft());
    const [loginFieldIndex, setLoginFieldIndex] = React.useState(0);

    const refresh = React.useCallback(() => {
      setLoading(true);
      try {
        if (tab === "status") {
          setStatus(nativeApi.status());
        } else if (tab === "configs") {
          const result = nativeApi.listConfigs();
          setConfigResult(result);
          if (!result.configs || result.configs.length === 0) {
            setSelectedConfig(0);
          } else {
            setSelectedConfig((index) => Math.min(index, result.configs.length - 1));
          }
        } else if (tab === "templates") {
          const rows = nativeApi.listTemplates() || [];
          setTemplates(rows);
          if (rows.length === 0) {
            setSelectedTemplate(0);
          } else {
            setSelectedTemplate((index) => Math.min(index, rows.length - 1));
          }
        }
        setError("");
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }, [tab, nativeApi]);

    React.useEffect(() => {
      refresh();
    }, [refresh]);

    const configs = (configResult && configResult.configs) || [];
    const activeConfig = (configResult && configResult.activeConfig) || "";
    const selectedConfigRow = configs[selectedConfig] || null;
    const selectedTemplateRow = templates[selectedTemplate] || null;

    React.useEffect(() => {
      if (tab !== "templates" || !selectedTemplateRow) {
        return;
      }
      if (previewCache[selectedTemplateRow.ID]) {
        return;
      }
      try {
        const preview = nativeApi.previewTemplate(selectedTemplateRow.ID);
        setPreviewCache((cache) => ({
          ...cache,
          [selectedTemplateRow.ID]: preview,
        }));
        setError("");
      } catch (err) {
        setError(err.message || String(err));
      }
    }, [nativeApi, previewCache, selectedTemplateRow, tab]);

    const openAddForm = React.useCallback(() => {
      setMode("add");
      setAddDraft(defaultAddDraft());
      setAddFieldIndex(0);
      setMessage("Add config form");
      setError("");
    }, []);

    const openLoginForm = React.useCallback(() => {
      setMode("login");
      setLoginDraft(defaultLoginDraft());
      setLoginFieldIndex(0);
      setMessage("Login form");
      setError("");
    }, []);

    const submitAddForm = React.useCallback(() => {
      try {
        const resolvedName = (addDraft.name || "").trim() || "my-config";
        const payload = {
          name: resolvedName,
          scope: parseScope(addDraft.scope || "codex"),
          baseUrl: (addDraft.baseUrl || "").trim(),
          apiKey: addDraft.apiKey || "",
          model: (addDraft.model || "").trim(),
          wireApi: (addDraft.wireApi || "").trim() || "responses",
          authMethod: (addDraft.authMethod || "").trim() || "api_key",
        };
        nativeApi.addConfig(payload);
        setMode("browse");
        setTab("configs");
        setMessage(`Config "${resolvedName}" added`);
        setError("");
        refresh();
      } catch (err) {
        setError(err.message || String(err));
      }
    }, [addDraft, nativeApi, refresh]);

    const submitLoginForm = React.useCallback(() => {
      setLoading(true);
      try {
        if (loginDraft.method === "device") {
          const result = nativeApi.loginCodexRequestDevice();
          setMessage(`Device code: ${result.userCode} | URL: ${result.verificationUrl}`);
          nativeApi.loginCodexCompleteDevice(result.handleId);
        } else {
          const result = nativeApi.loginCodexBrowserStart();
          if (openBrowser(result.authUrl)) {
            setMessage(`Browser opened: ${result.authUrl}`);
          } else {
            setMessage(`Open this URL: ${result.authUrl}`);
          }
          nativeApi.loginCodexBrowserWait(result.handleId);
        }
        const created = nativeApi.createCodexLoginConfig((loginDraft.name || "").trim());
        setMode("browse");
        setTab("configs");
        setMessage(`Login complete, created "${created.name}"`);
        setError("");
        refresh();
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }, [loginDraft, nativeApi, refresh]);

    useInput((input, key) => {
      if (mode === "add") {
        if (key.escape) {
          setMode("browse");
          setMessage("Canceled add config");
          return;
        }
        if (key.upArrow || input === "k") {
          setAddFieldIndex((index) => prevFieldIndex(index, addFieldDefs.length));
          return;
        }
        if (key.downArrow || input === "j" || key.tab || key.return) {
          setAddFieldIndex((index) => nextFieldIndex(index, addFieldDefs.length));
          return;
        }
        if (input === "s") {
          submitAddForm();
          return;
        }
        if (key.backspace || key.delete) {
          const fieldKey = addFieldDefs[addFieldIndex].key;
          setAddDraft((draft) => ({
            ...draft,
            [fieldKey]: draft[fieldKey].slice(0, Math.max(0, draft[fieldKey].length - 1)),
          }));
          return;
        }
        if (isPrintableInput(input, key)) {
          const fieldKey = addFieldDefs[addFieldIndex].key;
          setAddDraft((draft) => ({
            ...draft,
            [fieldKey]: `${draft[fieldKey]}${input}`,
          }));
        }
        return;
      }

      if (mode === "login") {
        if (key.escape) {
          setMode("browse");
          setMessage("Canceled login");
          return;
        }
        if (key.upArrow || input === "k") {
          setLoginFieldIndex((index) => prevFieldIndex(index, 2));
          return;
        }
        if (key.downArrow || input === "j" || key.tab || key.return) {
          setLoginFieldIndex((index) => nextFieldIndex(index, 2));
          return;
        }
        if (input === "s") {
          submitLoginForm();
          return;
        }
        if (loginFieldIndex === 1 && (key.leftArrow || key.rightArrow || input === "m")) {
          setLoginDraft((draft) => ({
            ...draft,
            method: draft.method === "browser" ? "device" : "browser",
          }));
          return;
        }
        if (loginFieldIndex === 0) {
          if (key.backspace || key.delete) {
            setLoginDraft((draft) => ({
              ...draft,
              name: draft.name.slice(0, Math.max(0, draft.name.length - 1)),
            }));
            return;
          }
          if (isPrintableInput(input, key)) {
            setLoginDraft((draft) => ({
              ...draft,
              name: `${draft.name}${input}`,
            }));
          }
        }
        return;
      }

      if (key.escape || input === "q") {
        exit();
        return;
      }

      if (input === "1") setTab("status");
      if (input === "2") setTab("configs");
      if (input === "3") setTab("templates");

      if (input === "r") {
        refresh();
        setMessage("Refreshed");
        return;
      }

      if (tab === "configs") {
        if (key.upArrow || input === "k") {
          setSelectedConfig((index) => Math.max(0, index - 1));
          return;
        }
        if (key.downArrow || input === "j") {
          setSelectedConfig((index) => Math.min(Math.max(0, configs.length - 1), index + 1));
          return;
        }
        if ((input === "u" || key.return) && selectedConfigRow) {
          try {
            nativeApi.useConfig(selectedConfigRow.Name);
            setMessage(`Activated ${selectedConfigRow.Name}`);
            refresh();
          } catch (err) {
            setError(err.message || String(err));
          }
          return;
        }
        if (input === "d" && selectedConfigRow) {
          try {
            nativeApi.removeConfig(selectedConfigRow.Name);
            setMessage(`Removed ${selectedConfigRow.Name}`);
            refresh();
          } catch (err) {
            setError(err.message || String(err));
          }
          return;
        }
        if (input === "a") {
          openAddForm();
          return;
        }
        if (input === "l") {
          openLoginForm();
        }
        return;
      }

      if (tab === "templates") {
        if (key.upArrow || input === "k") {
          setSelectedTemplate((index) => Math.max(0, index - 1));
          return;
        }
        if (key.downArrow || input === "j") {
          setSelectedTemplate((index) => Math.min(Math.max(0, templates.length - 1), index + 1));
        }
      }
    });

    const currentPreview = selectedTemplateRow
      ? previewCache[selectedTemplateRow.ID] || null
      : null;

    const tabLine = tabs.map((item) => {
      if (item.id === tab) return `[${item.label}]`;
      return ` ${item.label} `;
    }).join(" ");

    const hints = {
      status: "Keys: 1/2/3 switch | r refresh | q quit",
      configs: "Keys: j/k move | Enter/u use | d delete | a add | l login | r refresh | q quit",
      templates: "Keys: j/k move | r refresh | q quit",
      add: "Add form: j/k move field | type | s submit | Esc cancel",
      login: "Login form: j/k move field | m or <- -> toggle method | s submit | Esc cancel",
    };

    const configWindow = pickWindow(configs, selectedConfig, 14);
    const templateWindow = pickWindow(templates, selectedTemplate, 14);

    const addFormRows = addFieldDefs.map((field, index) => {
      const focused = index === addFieldIndex;
      const rawValue = addDraft[field.key] || "";
      const shown = field.secret ? maskKey(rawValue) : rawValue;
      const displayValue = shown || field.placeholder;
      return h(
        Text,
        { key: `add-${field.key}`, color: focused ? "greenBright" : "white" },
        `${focused ? ">" : " "} ${field.label.padEnd(12, " ")} : ${displayValue}`,
      );
    });

    const loginRows = [
      h(
        Text,
        { key: "login-name", color: loginFieldIndex === 0 ? "greenBright" : "white" },
        `${loginFieldIndex === 0 ? ">" : " "} Name        : ${loginDraft.name || "(auto)"}`,
      ),
      h(
        Text,
        { key: "login-method", color: loginFieldIndex === 1 ? "greenBright" : "white" },
        `${loginFieldIndex === 1 ? ">" : " "} Method      : ${loginDraft.method}`,
      ),
    ];

    return h(
      Box,
      { flexDirection: "column", paddingX: 1, paddingY: 1 },
      h(Text, { color: "cyanBright", bold: true }, "QuickCLI Ink TUI"),
      h(Text, { color: "gray" }, tabLine),
      h(Text, null, ""),
      mode === "add" && h(
        Box,
        { borderStyle: "round", borderColor: "green", paddingX: 1, flexDirection: "column" },
        h(Text, { bold: true }, "Add Config"),
        ...addFormRows,
      ),
      mode === "login" && h(
        Box,
        { borderStyle: "round", borderColor: "yellow", paddingX: 1, flexDirection: "column" },
        h(Text, { bold: true }, "Codex Login"),
        ...loginRows,
      ),
      mode === "browse" && tab === "status" && h(
        Box,
        { borderStyle: "round", borderColor: "blue", paddingX: 1, paddingY: 0, flexDirection: "column" },
        ...(statusLines(status || {}).map((line, index) => h(Text, { key: `status-${index}` }, line))),
      ),
      mode === "browse" && tab === "configs" && h(
        Box,
        { gap: 1 },
        h(
          Box,
          { borderStyle: "round", borderColor: "green", paddingX: 1, flexDirection: "column", width: 72 },
          h(Text, { bold: true }, "Configs"),
          ...(configs.length === 0
            ? [h(Text, { key: "empty-configs", color: "gray" }, "No configs found.")]
            : configWindow.rows.map((config, index) => {
              const absolute = configWindow.start + index;
              const marker = absolute === selectedConfig ? ">" : " ";
              const active = config.Name === activeConfig ? "*" : " ";
              const scope = truncate((config.Scope || []).join(","), 16).padEnd(16, " ");
              const name = truncate(config.Name || "-", 24).padEnd(24, " ");
              const display = truncate(config.DisplayName || config.Name || "-", 24);
              return h(
                Text,
                { key: `cfg-${config.Name}-${absolute}`, color: absolute === selectedConfig ? "greenBright" : undefined },
                `${marker}${active} ${name} ${scope} ${display}`,
              );
            })),
        ),
        h(
          Box,
          { borderStyle: "round", borderColor: "yellow", paddingX: 1, flexDirection: "column", width: 45 },
          h(Text, { bold: true }, "Selected"),
          !selectedConfigRow && h(Text, { color: "gray" }, "No config selected."),
          selectedConfigRow && h(Text, null, `Name: ${selectedConfigRow.Name || "-"}`),
          selectedConfigRow && h(Text, null, `Display: ${selectedConfigRow.DisplayName || "-"}`),
          selectedConfigRow && h(Text, null, `Scope: ${(selectedConfigRow.Scope || []).join(", ") || "-"}`),
          selectedConfigRow && h(Text, null, `Base: ${selectedConfigRow.BaseURL || "-"}`),
          selectedConfigRow && h(Text, null, `Model: ${selectedConfigRow.Model || "-"}`),
          selectedConfigRow && h(Text, null, `Key: ${maskKey(selectedConfigRow.APIKey)}`),
        ),
      ),
      mode === "browse" && tab === "templates" && h(
        Box,
        { gap: 1 },
        h(
          Box,
          { borderStyle: "round", borderColor: "magenta", paddingX: 1, flexDirection: "column", width: 72 },
          h(Text, { bold: true }, "Templates"),
          ...(templates.length === 0
            ? [h(Text, { key: "empty-templates", color: "gray" }, "No templates available.")]
            : templateWindow.rows.map((template, index) => {
              const absolute = templateWindow.start + index;
              const marker = absolute === selectedTemplate ? ">" : " ";
              const id = truncate(template.ID || "-", 22).padEnd(22, " ");
              const display = truncate(template.DisplayName || "-", 34).padEnd(34, " ");
              const scope = truncate((template.Scope || []).join(","), 12);
              return h(
                Text,
                { key: `tpl-${template.ID}-${absolute}`, color: absolute === selectedTemplate ? "magentaBright" : undefined },
                `${marker} ${id} ${display} ${scope}`,
              );
            })),
        ),
        h(
          Box,
          { borderStyle: "round", borderColor: "yellow", paddingX: 1, flexDirection: "column", width: 45 },
          h(Text, { bold: true }, "Preview"),
          ...(templateDetailLines(currentPreview).map((line, index) => h(Text, { key: `preview-${index}` }, line))),
        ),
      ),
      h(Text, null, ""),
      h(Text, { color: loading ? "yellow" : "gray" }, loading ? "Loading..." : hints[mode === "browse" ? tab : mode]),
      message && h(Text, { color: "green" }, message),
      error && h(Text, { color: "redBright" }, `Error: ${error}`),
    );
  }

  const app = render(h(App));
  await app.waitUntilExit();
}

module.exports = {
  runInkTui,
};
