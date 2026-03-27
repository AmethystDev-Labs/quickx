#include <node_api.h>

#include <cstdlib>
#include <string>

extern "C" {
char* QuickStatusJSON();
char* QuickListConfigsJSON();
char* QuickUseConfig(char* name);
char* QuickAddConfig(char* input);
char* QuickUpdateConfig(char* input);
char* QuickRemoveConfig(char* name);
char* QuickListTemplatesJSON();
char* QuickPreviewTemplateJSON(char* id);
char* QuickGetTemplateSetupJSON(char* id);
char* QuickCreateConfigFromTemplate(char* input);
char* QuickLoginCodexRequestDeviceJSON();
char* QuickLoginCodexCompleteDevice(char* handle_id);
char* QuickLoginCodexBrowserStartJSON();
char* QuickLoginCodexBrowserWait(char* handle_id);
char* QuickCreateCodexLoginConfig(char* name);
void QuickFreeCString(char* value);
}

namespace {

napi_value ThrowTypeError(napi_env env, const char* message) {
  napi_throw_type_error(env, nullptr, message);
  return nullptr;
}

napi_value MakeString(napi_env env, char* value) {
  napi_value result;
  napi_status status =
      napi_create_string_utf8(env, value, NAPI_AUTO_LENGTH, &result);
  QuickFreeCString(value);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to create JS string");
    return nullptr;
  }
  return result;
}

char* ReadStringArg(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_status status = napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (status != napi_ok || argc != 1) {
    ThrowTypeError(env, "Expected exactly one string argument");
    return nullptr;
  }

  napi_valuetype type;
  status = napi_typeof(env, argv[0], &type);
  if (status != napi_ok || type != napi_string) {
    ThrowTypeError(env, "Expected a string argument");
    return nullptr;
  }

  size_t length = 0;
  status = napi_get_value_string_utf8(env, argv[0], nullptr, 0, &length);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to read string length");
    return nullptr;
  }

  char* buffer = static_cast<char*>(std::malloc(length + 1));
  if (buffer == nullptr) {
    napi_throw_error(env, nullptr, "Out of memory");
    return nullptr;
  }

  status = napi_get_value_string_utf8(env, argv[0], buffer, length + 1, &length);
  if (status != napi_ok) {
    std::free(buffer);
    napi_throw_error(env, nullptr, "Failed to read string argument");
    return nullptr;
  }

  return buffer;
}

napi_value StatusJSON(napi_env env, napi_callback_info info) {
  return MakeString(env, QuickStatusJSON());
}

napi_value ListConfigsJSON(napi_env env, napi_callback_info info) {
  return MakeString(env, QuickListConfigsJSON());
}

napi_value UseConfig(napi_env env, napi_callback_info info) {
  char* name = ReadStringArg(env, info);
  if (name == nullptr) {
    return nullptr;
  }
  char* result = QuickUseConfig(name);
  std::free(name);
  return MakeString(env, result);
}

napi_value AddConfig(napi_env env, napi_callback_info info) {
  char* input = ReadStringArg(env, info);
  if (input == nullptr) {
    return nullptr;
  }
  char* result = QuickAddConfig(input);
  std::free(input);
  return MakeString(env, result);
}

napi_value UpdateConfig(napi_env env, napi_callback_info info) {
  char* input = ReadStringArg(env, info);
  if (input == nullptr) {
    return nullptr;
  }
  char* result = QuickUpdateConfig(input);
  std::free(input);
  return MakeString(env, result);
}

napi_value RemoveConfig(napi_env env, napi_callback_info info) {
  char* name = ReadStringArg(env, info);
  if (name == nullptr) {
    return nullptr;
  }
  char* result = QuickRemoveConfig(name);
  std::free(name);
  return MakeString(env, result);
}

napi_value ListTemplatesJSON(napi_env env, napi_callback_info info) {
  return MakeString(env, QuickListTemplatesJSON());
}

napi_value PreviewTemplateJSON(napi_env env, napi_callback_info info) {
  char* id = ReadStringArg(env, info);
  if (id == nullptr) {
    return nullptr;
  }
  char* result = QuickPreviewTemplateJSON(id);
  std::free(id);
  return MakeString(env, result);
}

napi_value GetTemplateSetupJSON(napi_env env, napi_callback_info info) {
  char* id = ReadStringArg(env, info);
  if (id == nullptr) {
    return nullptr;
  }
  char* result = QuickGetTemplateSetupJSON(id);
  std::free(id);
  return MakeString(env, result);
}

napi_value CreateConfigFromTemplate(napi_env env, napi_callback_info info) {
  char* input = ReadStringArg(env, info);
  if (input == nullptr) {
    return nullptr;
  }
  char* result = QuickCreateConfigFromTemplate(input);
  std::free(input);
  return MakeString(env, result);
}

napi_value LoginCodexRequestDeviceJSON(napi_env env, napi_callback_info info) {
  return MakeString(env, QuickLoginCodexRequestDeviceJSON());
}

napi_value LoginCodexCompleteDevice(napi_env env, napi_callback_info info) {
  char* handle_id = ReadStringArg(env, info);
  if (handle_id == nullptr) {
    return nullptr;
  }
  char* result = QuickLoginCodexCompleteDevice(handle_id);
  std::free(handle_id);
  return MakeString(env, result);
}

napi_value LoginCodexBrowserStartJSON(napi_env env, napi_callback_info info) {
  return MakeString(env, QuickLoginCodexBrowserStartJSON());
}

napi_value LoginCodexBrowserWait(napi_env env, napi_callback_info info) {
  char* handle_id = ReadStringArg(env, info);
  if (handle_id == nullptr) {
    return nullptr;
  }
  char* result = QuickLoginCodexBrowserWait(handle_id);
  std::free(handle_id);
  return MakeString(env, result);
}

napi_value CreateCodexLoginConfig(napi_env env, napi_callback_info info) {
  char* name = ReadStringArg(env, info);
  if (name == nullptr) {
    return nullptr;
  }
  char* result = QuickCreateCodexLoginConfig(name);
  std::free(name);
  return MakeString(env, result);
}

}  // namespace

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
      {"statusJson", nullptr, StatusJSON, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"listConfigsJson", nullptr, ListConfigsJSON, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"useConfig", nullptr, UseConfig, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"addConfig", nullptr, AddConfig, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"updateConfig", nullptr, UpdateConfig, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"removeConfig", nullptr, RemoveConfig, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"listTemplatesJson", nullptr, ListTemplatesJSON, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"previewTemplateJson", nullptr, PreviewTemplateJSON, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"getTemplateSetupJson", nullptr, GetTemplateSetupJSON, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"createConfigFromTemplate", nullptr, CreateConfigFromTemplate, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"loginCodexRequestDeviceJson", nullptr, LoginCodexRequestDeviceJSON, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"loginCodexCompleteDevice", nullptr, LoginCodexCompleteDevice, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"loginCodexBrowserStartJson", nullptr, LoginCodexBrowserStartJSON, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"loginCodexBrowserWait", nullptr, LoginCodexBrowserWait, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"createCodexLoginConfig", nullptr, CreateCodexLoginConfig, nullptr, nullptr, nullptr, napi_default, nullptr},
  };

  napi_status status =
      napi_define_properties(env, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors);
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to define addon exports");
    return nullptr;
  }

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
