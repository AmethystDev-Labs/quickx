"use strict";

const { loadPlatformPackage } = require("./platform");

const platformPackage = loadPlatformPackage();
const addon = require(platformPackage.addonPath);

function unwrap(raw) {
  const payload = JSON.parse(raw);
  if (!payload.ok) {
    throw new Error(payload.error || "Unknown QuickCLI error");
  }
  return payload.result;
}

module.exports = {
  status() {
    return unwrap(addon.statusJson());
  },

  listConfigs() {
    return unwrap(addon.listConfigsJson());
  },

  useConfig(name) {
    return unwrap(addon.useConfig(name));
  },

  addConfig(input) {
    return unwrap(addon.addConfig(JSON.stringify(input)));
  },

  updateConfig(input) {
    return unwrap(addon.updateConfig(JSON.stringify(input)));
  },

  removeConfig(name) {
    return unwrap(addon.removeConfig(name));
  },

  listTemplates() {
    return unwrap(addon.listTemplatesJson());
  },

  previewTemplate(id) {
    return unwrap(addon.previewTemplateJson(id));
  },

  getTemplateSetup(id) {
    return unwrap(addon.getTemplateSetupJson(id));
  },

  createConfigFromTemplate(input) {
    return unwrap(addon.createConfigFromTemplate(JSON.stringify(input)));
  },

  loginCodexRequestDevice() {
    return unwrap(addon.loginCodexRequestDeviceJson());
  },

  loginCodexCompleteDevice(handleId) {
    return unwrap(addon.loginCodexCompleteDevice(handleId));
  },

  loginCodexBrowserStart() {
    return unwrap(addon.loginCodexBrowserStartJson());
  },

  loginCodexBrowserWait(handleId) {
    return unwrap(addon.loginCodexBrowserWait(handleId));
  },

  createCodexLoginConfig(name = "") {
    return unwrap(addon.createCodexLoginConfig(name));
  },
};
