// indexar-mapa — Lee un mapa público de Google My Maps y devuelve una vista previa.
// Entrada (POST JSON): { "url": "<link de My Maps o maps.app.goo.gl>" }  ó  { "mid": "..." }
// Salida: { ok, mid, source_url, title, description, author, slug, places[], skipped }
// No guarda nada: el sitio guarda después con la sesión de la persona (reglas de la base).
// Desplegada en Supabase (proyecto mapademapas) con verify_jwt = true.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { XMLParser } from "npm:fast-xml-parser@4.5.0";

const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_KML_BYTES = 15_000_000;
const MAX_PLACES = 3000;
const ALLOWED_ORIGINS = ["https://mapademapas.netlify.app", "http://localhost:8888", "http://127.0.0.1:5500"];

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

const MID_RE = /[?&#]mid=([A-Za-z0-9_-]{16,})/;
const LIST_RE = /!11m\d+!2s|\/placelists\//;
const LIST_ID_RE = /!11m\d+!2s([A-Za-z0-9_-]{10,})/;

type Resolved = { mid?: string; error?: string; listId?: string; listUrl?: string };

// Lista de Google Maps: se devuelve su id y un link canónico (no se leen sus lugares)
function asList(url: string): Resolved {
  const m = url.match(LIST_ID_RE);
  if (!m) return { error: "lista" };
  return { error: "lista", listId: m[1], listUrl: `https://www.google.com/maps/@/data=!4m3!11m2!2s${m[1]}!3e3` };
}

async function resolveMid(input: string): Promise<Resolved> {
  input = (input || "").trim();
  const direct = input.match(MID_RE);
  if (direct) return { mid: direct[1] };
  if (/^[A-Za-z0-9_-]{16,}$/.test(input)) return { mid: input };
  let url: URL;
  try { url = new URL(/^https?:\/\//.test(input) ? input : "https://" + input); } catch { return { error: "link_invalido" }; }
  if (!/(^|\.)(goo\.gl|google\.[a-z.]+)$/.test(url.hostname)) return { error: "no_es_google" };
  if (LIST_RE.test(url.href)) return asList(url.href);
  let current = url.toString();
  for (let i = 0; i < 6; i++) {
    const res = await fetch(current, { redirect: "manual", headers: { "User-Agent": "curl/8.5.0" } });
    const loc = res.headers.get("location");
    await res.body?.cancel();
    if (!loc) break;
    current = new URL(loc, current).toString();
    const m = current.match(MID_RE);
    if (m) return { mid: m[1] };
    if (LIST_RE.test(current)) return asList(current);
  }
  return { error: "sin_mapa" };
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return String(o["#text"] ?? o["__cdata"] ?? "");
  }
  return String(v);
}

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
function cleanHtml(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

// Las capas sin nombre de My Maps no aportan: se descartan
function cleanLayer(s: string): string | null {
  const t = cleanHtml(s);
  if (!t || /^(capa sin (nombre|t[ií]tulo)|untitled layer|capa \d+)$/i.test(t)) return null;
  return t;
}

function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "mapa";
}

type Place = { name: string; layer: string | null; address: string | null; lat: number; lng: number; description: string | null; photo: string | null };

function parseKml(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: (name) => ["Document", "Folder", "Placemark", "Data"].includes(name),
  });
  const root = parser.parse(xml);
  const kml = root.kml || {};
  const doc = (kml.Document || [])[0] || kml;
  const places: Place[] = [];
  let skipped = 0;

  // deno-lint-ignore no-explicit-any
  const visit = (node: Record<string, any>, layer: string | null) => {
    for (const f of node.Folder || []) visit(f, cleanLayer(text(f.name)) || layer);
    for (const p of node.Placemark || []) {
      const coords = text(p.Point?.coordinates).split(",").map((x: string) => parseFloat(x));
      if (coords.length < 2 || isNaN(coords[0]) || isNaN(coords[1])) { skipped++; continue; }
      const [lng, lat] = coords;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) { skipped++; continue; }
      const rawDesc = text(p.description);
      const data: Record<string, string> = {};
      for (const d of p.ExtendedData?.Data || []) data[String(d["@_name"] || "")] = text(d.value);
      let photo = (data["gx_media_links"] || "").split(/\s+/).find((u) => /^https?:\/\//.test(u)) || null;
      if (!photo) {
        const img = rawDesc.match(/<img[^>]+src="([^"]+)"/i);
        if (img) photo = img[1];
      }
      const addrKey = Object.keys(data).find((k) => /direcci|address|domicilio/i.test(k));
      let description = cleanHtml(rawDesc);
      // My Maps repite los campos extra dentro de la descripción ("campo: valor"): se quitan
      for (const [k, v] of Object.entries(data)) {
        if (k === "gx_media_links") description = description.replace(new RegExp("(^|\\n)\\s*" + k + ":[^\\n]*", "g"), "");
        else if (v && k && /^(nombre|name)$/i.test(k)) description = description.replace(new RegExp("(^|\\n)\\s*" + k + ":[^\\n]*", "gi"), "");
      }
      description = description.replace(/https?:\/\/\S*googleusercontent\S*/g, "").trim();
      places.push({
        name: cleanHtml(text(p.name)) || "Sin nombre",
        layer,
        address: addrKey ? (data[addrKey] || null) : null,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        description: description || null,
        photo,
      });
      if (places.length >= MAX_PLACES) return;
    }
  };
  visit(doc, null);
  return { title: cleanHtml(text(doc.name)), description: cleanHtml(text(doc.description)) || null, places, skipped };
}

async function fetchAuthor(mid: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.google.com/maps/d/viewer?mid=${mid}&hl=es`, { headers: { "User-Agent": BROWSER_UA } });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/\[\\*"([^"\\]{1,80})\\*",\\*"https:\/\/lh3\.googleusercontent\.com\//);
    return m ? m[1] : null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "metodo" }, 405);

  let body: { url?: string; mid?: string } = {};
  try { body = await req.json(); } catch { /* vacío */ }

  const resolved = await resolveMid(body.mid || body.url || "");
  if (!resolved.mid) {
    const messages: Record<string, string> = {
      lista: "Ese link es una lista de Google Maps. Por ahora solo se pueden sumar mapas de Google My Maps.",
      no_es_google: "El link tiene que ser de Google Maps / My Maps.",
      link_invalido: "No parece un link válido.",
      sin_mapa: "No encontramos un mapa de My Maps en ese link.",
    };
    return json(req, {
      ok: false,
      error: resolved.error,
      message: messages[resolved.error!] || "No se pudo leer el link.",
      list_id: resolved.listId || null,
      source_url: resolved.listUrl || null,
    }, 422);
  }

  const mid = resolved.mid;
  const kmlRes = await fetch(`https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`, { headers: { "User-Agent": BROWSER_UA } });
  if (!kmlRes.ok) {
    return json(req, { ok: false, error: "no_publico", message: "No pudimos abrir ese mapa. Revisá que sea público (\"Cualquier persona con el vínculo\")." }, 422);
  }
  const xml = await kmlRes.text();
  if (xml.length > MAX_KML_BYTES) return json(req, { ok: false, error: "muy_grande", message: "El mapa es demasiado grande." }, 413);
  if (!xml.includes("<kml")) return json(req, { ok: false, error: "no_publico", message: "No pudimos abrir ese mapa. Revisá que sea público." }, 422);

  let parsed;
  try { parsed = parseKml(xml); } catch (e) {
    return json(req, { ok: false, error: "kml", message: "No pudimos leer el contenido del mapa.", detail: String(e) }, 422);
  }
  if (parsed.places.length === 0) return json(req, { ok: false, error: "vacio", message: "El mapa no tiene lugares marcados." }, 422);

  const author = await fetchAuthor(mid);
  return json(req, {
    ok: true,
    mid,
    source_url: `https://www.google.com/maps/d/viewer?mid=${mid}`,
    title: parsed.title || "Mapa sin título",
    description: parsed.description,
    author,
    slug: slugify(parsed.title || mid),
    places: parsed.places,
    skipped: parsed.skipped,
  });
});
