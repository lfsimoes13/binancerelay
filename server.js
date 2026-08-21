/**
 * Relay de IP fixo para a Binance.
 *
 * Recebe uma requisição JÁ ASSINADA do backend do app e a repassa para a
 * Binance através do proxy da Fixie, saindo por um IP fixo autorizado na
 * allowlist da corretora. O relay NÃO conhece o segredo da API: ele só
 * repassa a URL, o método e os headers que recebe.
 *
 * Variáveis de ambiente:
 *   FIXIE_URL     -> http://fixie:TOKEN@criterium.usefixie.com:80
 *   RELAY_SECRET  -> segredo compartilhado com o app (header x-relay-secret)
 *   PORT          -> porta HTTP (padrão 8080)
 *
 * Deploy: Render / Railway / Fly / VPS / Heroku. `npm install && npm start`.
 */
import http from "node:http";
import { ProxyAgent, request as undiciRequest } from "undici";

const FIXIE_URL = process.env.FIXIE_URL;
const RELAY_SECRET = process.env.RELAY_SECRET;
const PORT = Number(process.env.PORT || 8080);

if (!FIXIE_URL) throw new Error("FIXIE_URL não configurada");
if (!RELAY_SECRET) throw new Error("RELAY_SECRET não configurado");

const parsedProxy = new URL(FIXIE_URL);
const proxyOrigin = `${parsedProxy.protocol}//${parsedProxy.host}`;
const authHeader = `Basic ${Buffer.from(`${parsedProxy.username}:${parsedProxy.password}`).toString("base64")}`;

const agent = new ProxyAgent({
  uri: proxyOrigin,
  token: authHeader,
});

const ALLOWED_HOSTS = new Set([
  "api.binance.com",
  "api-gcp.binance.com",
  "api1.binance.com",
  "api2.binance.com",
  "api3.binance.com",
  "api4.binance.com",
]);

const ALLOWED_HEADERS = new Set(["x-mbx-apikey", "content-type"]);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 100_000) reject(new Error("payload muito grande"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const send = (status, payload) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  };

  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });

  if (req.method === "GET" && req.url === "/ip") {
    try {
      const upstream = await undiciRequest("https://api.ipify.org?format=json", {
        method: "GET",
        dispatcher: agent,
        bodyTimeout: 10_000,
        headersTimeout: 10_000,
      });
      const data = await upstream.body.json();
      return send(200, data);
    } catch (error) {
      return send(502, { msg: `falha ao obter IP: ${error.message}` });
    }
  }

  if (req.method !== "POST") return send(405, { msg: "método não permitido" });
  if (req.headers["x-relay-secret"] !== RELAY_SECRET) {
    return send(401, { msg: "não autorizado" });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    return send(400, { msg: "JSON inválido" });
  }

  let target;
  try {
    target = new URL(payload.url);
  } catch {
    return send(400, { msg: "url inválida" });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return send(403, { msg: "destino não permitido" });
  }

  const headers = {};
  for (const [key, value] of Object.entries(payload.headers || {})) {
    if (ALLOWED_HEADERS.has(key.toLowerCase())) headers[key] = value;
  }

  try {
    const upstream = await undiciRequest(target, {
      method: payload.method === "POST" ? "POST" : "GET",
      headers,
      dispatcher: agent,
      bodyTimeout: 15_000,
      headersTimeout: 15_000,
    });
    const text = await upstream.body.text();
    res.writeHead(upstream.statusCode, { "content-type": "application/json" });
    res.end(text || "{}");
  } catch (error) {
    send(502, { msg: `falha no relay: ${error?.message ?? "erro desconhecido"}` });
  }
});

server.listen(PORT, () => {
  console.log(`relay ouvindo na porta ${PORT}`);
});
