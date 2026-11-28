import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizationUrl, decryptToken, encryptToken, exchangeCode, GmailError, isGmailConfigured, sendRawMessage } from "./gmail";

const idToken = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;
const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "geheim");
  vi.stubEnv("NOVA_TEST_GOOGLE_BASE_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Konfiguration und Verschlüsselung", () => {
  it("erkennt fehlende Zugangsdaten", () => {
    expect(isGmailConfigured({ NODE_ENV: "test", GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" })).toBe(true);
    expect(isGmailConfigured({ NODE_ENV: "test", GOOGLE_CLIENT_ID: "a" })).toBe(false);
  });

  it("verschlüsselt das Token nur für diesen Server lesbar", () => {
    const encrypted = encryptToken("1//refresh");
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("refresh");
    expect(encryptToken("1//refresh")).not.toBe(encrypted);
    expect(decryptToken(encrypted)).toBe("1//refresh");
    expect(() => decryptToken(encrypted, "anderes-geheimnis")).toThrow(GmailError);
    expect(() => decryptToken(`${encrypted.slice(0, -2)}AA`)).toThrow(GmailError);
  });

  it("fragt nur das Senderecht an und erzwingt ein Refresh-Token", () => {
    const url = new URL(authorizationUrl("STATE", "https://nova.example/api/google/callback"));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe("openid email https://www.googleapis.com/auth/gmail.send");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("STATE");
  });

  it("ignoriert die Test-Attrappe auf Vercel", () => {
    vi.stubEnv("NOVA_TEST_GOOGLE_BASE_URL", "http://127.0.0.1:3199");
    expect(new URL(authorizationUrl("S", "http://localhost/cb")).origin).toBe("http://127.0.0.1:3199");
    vi.stubEnv("VERCEL", "1");
    expect(new URL(authorizationUrl("S", "http://localhost/cb")).origin).toBe("https://accounts.google.com");
  });
});

describe("Google-Aufrufe", () => {
  it("tauscht den Code und prüft die Freigabe", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      json({ access_token: "at", refresh_token: "rt", scope: "openid https://www.googleapis.com/auth/gmail.send email", id_token: idToken({ email: "Firma@Gmail.com", email_verified: true }) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(exchangeCode("CODE", "https://nova.example/cb")).resolves.toEqual({ email: "firma@gmail.com", refreshToken: "rt" });
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("client_secret")).toBe("geheim");
    expect(body.get("redirect_uri")).toBe("https://nova.example/cb");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ access_token: "at", refresh_token: "rt", scope: "openid email", id_token: idToken({ email: "a@b.de" }) })));
    await expect(exchangeCode("CODE", "x")).rejects.toMatchObject({ code: "scope" });
  });

  it("sendet über die Gmail-API", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ access_token: "AT" })).mockResolvedValueOnce(json({ id: "msg-1" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendRawMessage(encryptToken("rt"), "UkFX")).resolves.toBe("msg-1");
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(init.headers.Authorization).toBe("Bearer AT");
    expect(JSON.parse(init.body)).toEqual({ raw: "UkFX" });
  });

  it("meldet widerrufene Zugänge und Limits verständlich", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ error: "invalid_grant" }, 400)));
    await expect(sendRawMessage(encryptToken("rt"), "x")).rejects.toMatchObject({ code: "revoked", reconnect: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ access_token: "AT" })).mockResolvedValueOnce(json({ error: { status: "PERMISSION_DENIED" } }, 403)));
    await expect(sendRawMessage(encryptToken("rt"), "x")).rejects.toMatchObject({ code: "denied" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ access_token: "AT" })).mockResolvedValueOnce(json({}, 429)));
    await expect(sendRawMessage(encryptToken("rt"), "x")).rejects.toMatchObject({ code: "limit", reconnect: false });
  });
});
