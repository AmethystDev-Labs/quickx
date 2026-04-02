import { createHash, randomBytes } from "node:crypto";
import http from "node:http";

import type {
  BrowserLoginSession,
  DeviceCode,
  TokenResponse,
} from "../types.js";
import { persistTokens } from "./auth.js";

const ISSUER_URL = "https://auth.openai.com";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CALLBACK_PORT = 1455;
const OAUTH_SCOPE =
  "openid profile email offline_access api.connectors.read api.connectors.invoke";

interface CodeSuccessResponse {
  authorization_code: string;
  code_verifier: string;
}

function callbackHtml(
  title: string,
  message: string,
  success: boolean,
): string {
  const color = success ? "#38a169" : "#e53e3e";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f7fafc}.card{text-align:center;padding:2rem 3rem;border-radius:8px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.1)}h1{color:${color};margin-bottom:.5rem}p{color:#4a5568}</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(64).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

function generateState(): string {
  return randomBytes(32).toString("base64url");
}

function buildAuthorizeUrl(
  codeChallenge: string,
  state: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams();
  params.set("response_type", "code");
  params.set("client_id", CLIENT_ID);
  params.set("redirect_uri", redirectUri);
  params.set("scope", OAUTH_SCOPE);
  params.set("code_challenge", codeChallenge);
  params.set("code_challenge_method", "S256");
  params.set("id_token_add_organizations", "true");
  params.set("codex_cli_simplified_flow", "true");
  params.set("state", state);
  return `${ISSUER_URL}/oauth/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(
  authCode: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", authCode);
  body.set("redirect_uri", redirectUri);
  body.set("client_id", CLIENT_ID);
  body.set("code_verifier", codeVerifier);

  const response = await fetch(`${ISSUER_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Token exchange failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  const tokens = (await response.json()) as Partial<TokenResponse>;
  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Token exchange did not return an access token");
  }

  return {
    id_token: tokens.id_token || "",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  };
}

export async function requestDeviceCode(): Promise<DeviceCode> {
  const response = await fetch(`${ISSUER_URL}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });

  if (response.status === 404) {
    throw new Error("Device-code login is not enabled on this Codex server");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Device code request failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  const payload = (await response.json()) as {
    device_auth_id?: string;
    user_code?: string;
    interval?: string;
  };

  return {
    deviceAuthId: payload.device_auth_id || "",
    userCode: payload.user_code || "",
    verificationUrl: `${ISSUER_URL}/codex/device`,
    interval: Math.max(1, Number.parseInt(payload.interval || "5", 10) || 5),
  };
}

async function pollForCode(
  deviceCode: DeviceCode,
  tick?: () => void,
): Promise<CodeSuccessResponse> {
  const deadline = Date.now() + 15 * 60 * 1000;
  const interval = Math.max(1000, deviceCode.interval * 1000);

  while (Date.now() < deadline) {
    await delay(interval);
    tick?.();

    const response = await fetch(`${ISSUER_URL}/api/accounts/deviceauth/token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        device_auth_id: deviceCode.deviceAuthId,
        user_code: deviceCode.userCode,
      }),
    });

    if (response.ok) {
      const payload = (await response.json()) as CodeSuccessResponse;
      return payload;
    }

    if (response.status !== 403 && response.status !== 404) {
      throw new Error(
        `Device auth failed (${response.status} ${response.statusText})`,
      );
    }
  }

  throw new Error("Device auth timed out after 15 minutes");
}

export async function completeDeviceLogin(
  deviceCode: DeviceCode,
  tick?: () => void,
): Promise<void> {
  const code = await pollForCode(deviceCode, tick);
  const tokens = await exchangeCodeForTokens(
    code.authorization_code,
    code.code_verifier,
    `${ISSUER_URL}/deviceauth/callback`,
  );
  persistTokens(tokens);
}

export async function startBrowserLogin(): Promise<BrowserLoginSession> {
  const { codeChallenge, codeVerifier } = generatePkce();
  const state = generateState();
  const redirectUri = `http://localhost:${CALLBACK_PORT}/auth/callback`;
  const authUrl = buildAuthorizeUrl(codeChallenge, state, redirectUri);

  let settled = false;
  let resolveCode!: (code: string) => void;
  let rejectCode!: (reason?: unknown) => void;

  const completion = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(
      request.url || "/",
      `http://127.0.0.1:${CALLBACK_PORT}`,
    );

    if (requestUrl.pathname !== "/auth/callback") {
      response.statusCode = 404;
      response.end("Not found");
      return;
    }

    const receivedState = requestUrl.searchParams.get("state");
    if (receivedState !== state) {
      response.statusCode = 400;
      response.end(
        callbackHtml("Login Failed", "State mismatch. Please try again.", false),
      );
      if (!settled) {
        settled = true;
        rejectCode(new Error("OAuth state mismatch"));
      }
      return;
    }

    const errorCode = requestUrl.searchParams.get("error");
    if (errorCode) {
      const description = requestUrl.searchParams.get("error_description") || "";
      response.statusCode = 200;
      response.end(
        callbackHtml(
          "Login Failed",
          `${errorCode}: ${description}`,
          false,
        ),
      );
      if (!settled) {
        settled = true;
        rejectCode(new Error(`OAuth error: ${errorCode}: ${description}`));
      }
      return;
    }

    const code = requestUrl.searchParams.get("code");
    if (!code) {
      response.statusCode = 400;
      response.end(
        callbackHtml("Login Failed", "No code in callback.", false),
      );
      if (!settled) {
        settled = true;
        rejectCode(new Error("No code in callback"));
      }
      return;
    }

    response.statusCode = 200;
    response.end(
      callbackHtml(
        "Login Successful",
        "You can close this tab and return to the terminal.",
        true,
      ),
    );

    if (!settled) {
      settled = true;
      resolveCode(code);
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(CALLBACK_PORT, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true;
      rejectCode(new Error("Browser login timed out after 15 minutes"));
    }
  }, 15 * 60 * 1000);

  return {
    authUrl,
    wait: async () => {
      try {
        const code = await completion;
        const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);
        persistTokens(tokens);
      } finally {
        clearTimeout(timeout);
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
        });
      }
    },
  };
}
