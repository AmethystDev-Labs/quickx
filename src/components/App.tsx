import React from "react";
import { Box, Text, useApp, useInput } from "ink";

import type { QuickxApi } from "../api.js";
import type {
  AddDraft,
  EditDraft,
  ListProfilesResult,
  StatusInfo,
  Template,
  TemplatePlaceholder,
} from "../types.js";
import { getTemplateSetup } from "../lib/templates.js";
import {
  addFieldDefs,
  defaultAddDraft,
  defaultLoginDraft,
  defaultEditDraft,
  editFieldDefs,
  isPrintableInput,
  nextFieldIndex,
  prevFieldIndex,
  profileToEditDraft,
} from "../lib/tui.js";
import { messageOf, openBrowser } from "../lib/utils.js";
import { StatusScreen } from "./screens/StatusScreen.js";
import { ProfilesScreen } from "./screens/ProfilesScreen.js";
import { TemplatesScreen } from "./screens/TemplatesScreen.js";
import { AddProfileForm } from "./forms/AddProfileForm.js";
import { EditProfileForm } from "./forms/EditProfileForm.js";
import { LoginForm } from "./forms/LoginForm.js";
import { ConfirmDeleteForm } from "./forms/ConfirmDeleteForm.js";
import { TemplateAddForm } from "./forms/TemplateAddForm.js";

type Tab = "status" | "profiles" | "templates";
type Mode = "browse" | "add" | "edit" | "login" | "confirm-delete" | "template-add";

export function App({ api }: { api: QuickxApi }): React.JSX.Element {
  const { exit } = useApp();
  const [tab, setTab] = React.useState<Tab>("status");
  const [mode, setMode] = React.useState<Mode>("browse");
  const [status, setStatus] = React.useState<StatusInfo>(api.status());
  const [profileResult, setProfileResult] = React.useState<ListProfilesResult>(
    api.listProfiles(),
  );
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [selectedProfile, setSelectedProfile] = React.useState(0);
  const [selectedTemplate, setSelectedTemplate] = React.useState(0);
  const [previewCache, setPreviewCache] = React.useState<Record<string, Template>>({});
  const [message, setMessage] = React.useState("Ready");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [addDraft, setAddDraft] = React.useState<AddDraft>(defaultAddDraft());
  const [addFieldIndex, setAddFieldIndex] = React.useState(0);
  const [editProfileName, setEditProfileName] = React.useState("");
  const [editDraft, setEditDraft] = React.useState<EditDraft>(defaultEditDraft());
  const [editFieldIndex, setEditFieldIndex] = React.useState(0);
  const [loginDraft, setLoginDraft] = React.useState(defaultLoginDraft());
  const [loginFieldIndex, setLoginFieldIndex] = React.useState(0);
  const [confirmDeleteName, setConfirmDeleteName] = React.useState("");
  const [templateAddId, setTemplateAddId] = React.useState("");
  const [templateAddName, setTemplateAddName] = React.useState("");
  const [templateAddPlaceholders, setTemplateAddPlaceholders] = React.useState<
    TemplatePlaceholder[]
  >([]);
  const [templateAnswers, setTemplateAnswers] = React.useState<Record<string, string>>({});
  const [templateAnswerIndex, setTemplateAnswerIndex] = React.useState(0);

  const stateRef = React.useRef({
    tab,
    mode,
    profiles: profileResult.profiles,
    activeProfile: profileResult.activeProfile,
    selectedProfile,
    selectedProfileRow: profileResult.profiles[selectedProfile] ?? null,
    templates,
    selectedTemplate,
    selectedTemplateRow: templates[selectedTemplate] ?? null,
    addFieldIndex,
    editFieldIndex,
    loginFieldIndex,
    loginDraft,
    confirmDeleteName,
    templateAddId,
    templateAddName,
    templateAddPlaceholders,
    templateAnswers,
    templateAnswerIndex,
  });

  stateRef.current = {
    tab,
    mode,
    profiles: profileResult.profiles,
    activeProfile: profileResult.activeProfile,
    selectedProfile,
    selectedProfileRow: profileResult.profiles[selectedProfile] ?? null,
    templates,
    selectedTemplate,
    selectedTemplateRow: templates[selectedTemplate] ?? null,
    addFieldIndex,
    editFieldIndex,
    loginFieldIndex,
    loginDraft,
    confirmDeleteName,
    templateAddId,
    templateAddName,
    templateAddPlaceholders,
    templateAnswers,
    templateAnswerIndex,
  };

  const refresh = React.useCallback(async () => {
    try {
      setStatus(api.status());
      const next = api.listProfiles();
      setProfileResult(next);
      setSelectedProfile((i) => Math.min(i, Math.max(0, next.profiles.length - 1)));

      if (stateRef.current.tab === "templates") {
        const rows = await api.listTemplates();
        setTemplates(rows);
        setSelectedTemplate((i) => Math.min(i, Math.max(0, rows.length - 1)));
      }
      setError("");
    } catch (err) {
      setError(messageOf(err));
    }
  }, [api]);

  React.useEffect(() => {
    void refresh();
  }, []);

  React.useEffect(() => {
    if (tab !== "templates") return;
    void api
      .listTemplates()
      .then((rows) => {
        setTemplates(rows);
        setSelectedTemplate((i) => Math.min(i, Math.max(0, rows.length - 1)));
      })
      .catch((err) => setError(messageOf(err)));
  }, [api, tab]);

  React.useEffect(() => {
    const row = templates[selectedTemplate];
    if (tab !== "templates" || !row || previewCache[row.id]) return;
    void api
      .previewTemplate(row.id)
      .then((preview) => {
        setPreviewCache((c) => ({ ...c, [row.id]: preview }));
        setError("");
      })
      .catch((err) => setError(messageOf(err)));
  }, [api, tab, selectedTemplate, templates]);

  const openAddForm = () => {
    setMode("add");
    setAddDraft(defaultAddDraft());
    setAddFieldIndex(0);
    setMessage("Add profile form");
    setError("");
  };

  const openEditForm = () => {
    const row = stateRef.current.selectedProfileRow;
    if (!row) { setError("No profile selected"); return; }
    setMode("edit");
    setEditProfileName(row.name);
    setEditDraft(profileToEditDraft(row));
    setEditFieldIndex(0);
    setMessage(`Edit profile: ${row.name}`);
    setError("");
  };

  const openLoginForm = () => {
    setMode("login");
    setLoginDraft(defaultLoginDraft());
    setLoginFieldIndex(0);
    setMessage("Codex login form");
    setError("");
  };

  const openTemplateAdd = (template: Template) => {
    const setup = getTemplateSetup(template);
    const initialAnswers: Record<string, string> = {};
    for (const p of setup.placeholders) initialAnswers[p.question] = p.defaultValue;
    setTemplateAddId(template.id);
    setTemplateAddName(template.id);
    setTemplateAddPlaceholders(setup.placeholders);
    setTemplateAnswers(initialAnswers);
    setTemplateAnswerIndex(0);
    setMode("template-add");
    setMessage(`Create profile from template: ${template.displayName || template.id}`);
    setError("");
  };

  const submitAddForm = () => {
    try {
      const d = addDraft;
      const created = api.addProfile({
        name: d.name.trim() || "my-codex",
        displayName: d.displayName.trim() || d.name.trim() || "my-codex",
        baseUrl: d.baseUrl.trim(),
        apiKey: d.apiKey,
        model: d.model.trim(),
        wireApi: d.wireApi.trim() || "responses",
        authMethod: d.authMethod.trim() || "api_key",
      });
      setMode("browse");
      setTab("profiles");
      setMessage(`Profile "${created.name}" added`);
      setError("");
      void refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const submitEditForm = () => {
    try {
      const d = editDraft;
      const updated = api.updateProfile({
        name: editProfileName,
        displayName: d.displayName.trim() || editProfileName,
        baseUrl: d.baseUrl.trim(),
        apiKey: d.apiKey,
        model: d.model.trim(),
        wireApi: d.wireApi.trim() || "responses",
        authMethod: d.authMethod.trim() || "api_key",
      });
      if (profileResult.activeProfile === updated.name) api.useProfile(updated.name);
      setMode("browse");
      setTab("profiles");
      setMessage(`Profile "${updated.name}" updated`);
      setError("");
      void refresh();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const submitLoginForm = async () => {
    setLoading(true);
    try {
      const { name: desiredName, method } = stateRef.current.loginDraft;
      if (method === "device") {
        const pending = await api.loginCodexRequestDevice();
        setMessage(`Device code: ${pending.userCode} | URL: ${pending.verificationUrl}`);
        const created = await api.loginCodexCompleteDevice(pending.handleId, desiredName);
        setMessage(`Login complete, created "${created.name}"`);
      } else {
        const pending = await api.loginCodexBrowserStart();
        setMessage(
          openBrowser(pending.authUrl)
            ? `Browser opened: ${pending.authUrl}`
            : `Open this URL: ${pending.authUrl}`,
        );
        const created = await api.loginCodexBrowserWait(pending.handleId, desiredName);
        setMessage(`Login complete, created "${created.name}"`);
      }
      setMode("browse");
      setTab("profiles");
      setError("");
      void refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  const submitTemplateAdd = async () => {
    setLoading(true);
    try {
      const c = stateRef.current;
      const created = await api.createProfileFromTemplate(
        c.templateAddName.trim() || c.templateAddId,
        c.templateAddId,
        c.templateAnswers,
      );
      setMode("browse");
      setTab("profiles");
      setMessage(`Profile "${created.name}" created from template`);
      setError("");
      void refresh();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  useInput((input, key) => {
    const c = stateRef.current;
    const ctrl = Boolean(key.ctrl);

    if (c.mode === "add") {
      if (key.escape) { setMode("browse"); setMessage("Canceled add profile"); return; }
      if (key.upArrow) { setAddFieldIndex((i) => prevFieldIndex(i, addFieldDefs.length)); return; }
      if (key.downArrow || key.return) { setAddFieldIndex((i) => nextFieldIndex(i, addFieldDefs.length)); return; }
      if (ctrl && input === "s") { submitAddForm(); return; }
      if (key.backspace || key.delete) {
        const fk = addFieldDefs[c.addFieldIndex]?.key;
        if (fk) setAddDraft((d) => ({ ...d, [fk]: d[fk].slice(0, Math.max(0, d[fk].length - 1)) }));
        return;
      }
      if (isPrintableInput(input, key)) {
        const fk = addFieldDefs[c.addFieldIndex]?.key;
        if (fk) setAddDraft((d) => ({ ...d, [fk]: `${d[fk]}${input}` }));
      }
      return;
    }

    if (c.mode === "edit") {
      if (key.escape) { setMode("browse"); setMessage("Canceled edit profile"); return; }
      if (key.upArrow) { setEditFieldIndex((i) => prevFieldIndex(i, editFieldDefs.length)); return; }
      if (key.downArrow || key.return) { setEditFieldIndex((i) => nextFieldIndex(i, editFieldDefs.length)); return; }
      if (ctrl && input === "s") { submitEditForm(); return; }
      if (key.backspace || key.delete) {
        const fk = editFieldDefs[c.editFieldIndex]?.key;
        if (fk) setEditDraft((d) => ({ ...d, [fk]: d[fk].slice(0, Math.max(0, d[fk].length - 1)) }));
        return;
      }
      if (isPrintableInput(input, key)) {
        const fk = editFieldDefs[c.editFieldIndex]?.key;
        if (fk) setEditDraft((d) => ({ ...d, [fk]: `${d[fk]}${input}` }));
      }
      return;
    }

    if (c.mode === "login") {
      if (key.escape) { setMode("browse"); setMessage("Canceled login"); return; }
      if (key.upArrow) { setLoginFieldIndex((i) => prevFieldIndex(i, 2)); return; }
      if (key.downArrow || key.return) { setLoginFieldIndex((i) => nextFieldIndex(i, 2)); return; }
      if (ctrl && input === "s") { void submitLoginForm(); return; }
      if (c.loginFieldIndex === 1 && (key.leftArrow || key.rightArrow || input === "m")) {
        setLoginDraft((d) => ({ ...d, method: d.method === "browser" ? "device" : "browser" }));
        return;
      }
      if (c.loginFieldIndex === 0) {
        if (key.backspace || key.delete) { setLoginDraft((d) => ({ ...d, name: d.name.slice(0, Math.max(0, d.name.length - 1)) })); return; }
        if (isPrintableInput(input, key)) setLoginDraft((d) => ({ ...d, name: `${d.name}${input}` }));
      }
      return;
    }

    if (c.mode === "template-add") {
      const totalFields = 1 + c.templateAddPlaceholders.length;
      if (key.escape) { setMode("browse"); setMessage("Canceled template add"); return; }
      if (key.upArrow) { setTemplateAnswerIndex((i) => prevFieldIndex(i, totalFields)); return; }
      if (key.downArrow || key.return) { setTemplateAnswerIndex((i) => nextFieldIndex(i, totalFields)); return; }
      if (ctrl && input === "s") { void submitTemplateAdd(); return; }
      if (key.backspace || key.delete) {
        if (c.templateAnswerIndex === 0) {
          setTemplateAddName((n) => n.slice(0, Math.max(0, n.length - 1)));
        } else {
          const ph = c.templateAddPlaceholders[c.templateAnswerIndex - 1];
          if (ph) setTemplateAnswers((a) => ({ ...a, [ph.question]: (a[ph.question] ?? "").slice(0, Math.max(0, (a[ph.question] ?? "").length - 1)) }));
        }
        return;
      }
      if (isPrintableInput(input, key)) {
        if (c.templateAnswerIndex === 0) {
          setTemplateAddName((n) => `${n}${input}`);
        } else {
          const ph = c.templateAddPlaceholders[c.templateAnswerIndex - 1];
          if (ph) setTemplateAnswers((a) => ({ ...a, [ph.question]: `${a[ph.question] ?? ""}${input}` }));
        }
      }
      return;
    }

    if (c.mode === "confirm-delete") {
      if (key.escape) { setMode("browse"); setMessage("Delete canceled"); return; }
      if (input === "d" || input === "D") {
        try {
          api.removeProfile(c.confirmDeleteName);
          setMessage(`Removed "${c.confirmDeleteName}"`);
          void refresh();
        } catch (err) {
          setError(messageOf(err));
        }
        setMode("browse");
      }
      return;
    }

    if (key.escape || (ctrl && input === "q")) { exit(); return; }
    if (input === "1") { setTab("status"); return; }
    if (input === "2") { setTab("profiles"); return; }
    if (input === "3") { setTab("templates"); return; }
    if (ctrl && input === "r") { void refresh(); setMessage("Refreshed"); return; }

    if (c.tab === "profiles") {
      if (key.upArrow) { setSelectedProfile((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) {
        setSelectedProfile((i) => Math.min(Math.max(0, c.profiles.length - 1), i + 1));
        return;
      }
      if ((key.return || (ctrl && input === "u")) && c.selectedProfileRow) {
        try {
          api.useProfile(c.selectedProfileRow.name);
          setMessage(`Activated ${c.selectedProfileRow.name}`);
          void refresh();
        } catch (err) {
          setError(messageOf(err));
        }
        return;
      }
      if (ctrl && input === "d" && c.selectedProfileRow) {
        setConfirmDeleteName(c.selectedProfileRow.name);
        setMode("confirm-delete");
        setMessage(`Delete "${c.selectedProfileRow.name}"?`);
        setError("");
        return;
      }
      if (ctrl && input === "a") { openAddForm(); return; }
      if (ctrl && input === "e") { openEditForm(); return; }
      if (ctrl && input === "l") { openLoginForm(); return; }
    }

    if (c.tab === "templates") {
      if (key.upArrow) { setSelectedTemplate((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) {
        setSelectedTemplate((i) => Math.min(Math.max(0, c.templates.length - 1), i + 1));
        return;
      }
      if (key.return && c.selectedTemplateRow) {
        const preview = previewCache[c.selectedTemplateRow.id];
        if (!preview) { setError("Template details not loaded yet, wait a moment"); return; }
        openTemplateAdd(preview);
      }
    }
  });

  const tabLine = (["status", "profiles", "templates"] as Tab[])
    .map((id) => {
      const label = id === "profiles" ? "Profiles" : id.charAt(0).toUpperCase() + id.slice(1);
      return id === tab ? `[${label}]` : ` ${label} `;
    })
    .join(" ");

  const hints =
    mode === "add"
      ? "Add form: Up/Down move field | Enter next | type | Ctrl+s submit | Esc cancel"
      : mode === "edit"
        ? "Edit form: Up/Down move field | Enter next | type | Ctrl+s submit | Esc cancel"
        : mode === "login"
          ? "Login form: Up/Down move field | Enter next | Left/Right or m toggle | Ctrl+s submit | Esc cancel"
          : mode === "confirm-delete"
            ? "Press D to confirm delete | Esc to cancel"
            : mode === "template-add"
              ? "Template form: Up/Down move field | type | Ctrl+s submit | Esc cancel"
              : tab === "templates"
                ? "Keys: 1/2/3 switch | Up/Down move | Enter create profile | Ctrl+r refresh | Ctrl+q quit"
                : tab === "profiles"
                  ? "Keys: Up/Down move | Enter or Ctrl+u use | Ctrl+a add | Ctrl+e edit | Ctrl+d delete | Ctrl+l login | Ctrl+r refresh | Ctrl+q quit"
                  : "Keys: 1/2/3 switch | Ctrl+r refresh | Ctrl+q quit";

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text color="cyanBright" bold>
        QuickX
      </Text>
      <Text color="gray">{tabLine}</Text>
      {loading ? <Text>Working...</Text> : null}

      {mode === "add" ? <AddProfileForm draft={addDraft} fieldIndex={addFieldIndex} /> : null}
      {mode === "edit" ? (
        <EditProfileForm profileName={editProfileName} draft={editDraft} fieldIndex={editFieldIndex} />
      ) : null}
      {mode === "login" ? <LoginForm draft={loginDraft} fieldIndex={loginFieldIndex} /> : null}
      {mode === "template-add" ? (
        <TemplateAddForm
          templateId={templateAddId}
          profileName={templateAddName}
          placeholders={templateAddPlaceholders}
          answers={templateAnswers}
          fieldIndex={templateAnswerIndex}
        />
      ) : null}
      {mode === "confirm-delete" ? <ConfirmDeleteForm name={confirmDeleteName} /> : null}

      {mode === "browse" && tab === "status" ? (
        <StatusScreen status={status} />
      ) : null}
      {mode === "browse" && tab === "profiles" ? (
        <ProfilesScreen
          profiles={profileResult.profiles}
          activeProfile={profileResult.activeProfile}
          selectedIndex={selectedProfile}
        />
      ) : null}
      {mode === "browse" && tab === "templates" ? (
        <TemplatesScreen
          templates={templates}
          selectedIndex={selectedTemplate}
          previewCache={previewCache}
        />
      ) : null}

      <Text>{""}</Text>
      <Text color="gray">{hints}</Text>
      <Text color="greenBright">{message}</Text>
      {error ? <Text color="redBright">{error}</Text> : null}
    </Box>
  );
}
