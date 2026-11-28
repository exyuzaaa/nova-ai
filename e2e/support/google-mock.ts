import { createServer, type Server } from "node:http";

/** Nachbildung der Google-Endpunkte für OAuth und Gmail-Versand (nur Tests). */
export type GoogleMock = {
  mode: "ok" | "deny" | "revoked";
  sent: string[];
  revoked: string[];
  email: string;
  close: () => Promise<void>;
};

const idToken = (email: string) => `e30.${Buffer.from(JSON.stringify({ email, email_verified: true })).toString("base64url")}.sig`;

export const startGoogleMock = async (port: number, email: string): Promise<GoogleMock> => {
  const mock: GoogleMock = { mode: "ok", sent: [], revoked: [], email, close: async () => undefined };
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const send = (status: number, data: object) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(data));
      };
      if (url.pathname === "/auth") {
        const target = new URL(url.searchParams.get("redirect_uri") ?? "");
        target.searchParams.set("state", url.searchParams.get("state") ?? "");
        if (mock.mode === "deny") target.searchParams.set("error", "access_denied");
        else target.searchParams.set("code", "CODE-123");
        response.writeHead(302, { Location: target.toString() });
        response.end();
        return;
      }
      if (url.pathname === "/token") {
        const form = new URLSearchParams(body);
        if (form.get("client_secret") !== "e2e-secret") return send(401, { error: "invalid_client" });
        if (form.get("grant_type") === "authorization_code") {
          if (form.get("code") !== "CODE-123") return send(400, { error: "invalid_grant" });
          return send(200, {
            access_token: "AT-1",
            refresh_token: "RT-1",
            scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.send",
            id_token: idToken(mock.email),
          });
        }
        if (mock.mode === "revoked" || form.get("refresh_token") !== "RT-1") return send(400, { error: "invalid_grant" });
        return send(200, { access_token: "AT-2" });
      }
      if (url.pathname === "/gmail/v1/users/me/messages/send") {
        if (request.headers.authorization !== "Bearer AT-2") return send(401, { error: { status: "UNAUTHENTICATED" } });
        mock.sent.push(Buffer.from((JSON.parse(body) as { raw: string }).raw, "base64url").toString("utf8"));
        return send(200, { id: `msg-${mock.sent.length}` });
      }
      if (url.pathname === "/revoke") {
        mock.revoked.push(new URLSearchParams(body).get("token") ?? "");
        return send(200, {});
      }
      send(404, {});
    });
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  mock.close = () => new Promise((resolve) => server.close(() => resolve()));
  return mock;
};
