// POST /api/checkout  { date, time, noTime, sex }  ->  { url }
const { cleanInput } = require("../lib/saju");

const env = (k) => String(process.env[k] || "").trim().replace(/^["']|["']$/g, "");
const POLAR_API = env("POLAR_SERVER").toLowerCase() === "production"
  ? "https://api.polar.sh"
  : "https://sandbox-api.polar.sh";

function siteUrl(req) {
  let s = env("SITE_URL") || `https://${req.headers.host}`;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s.replace(/\/+$/, "");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  const input = cleanInput(typeof req.body === "string" ? safeJson(req.body) : req.body);
  if (!input) return res.status(400).json({ error: "Check your birth date and time, then try again." });

  const metadata = { date: input.date, noTime: input.noTime ? "true" : "false", sex: String(input.sex) };
  if (input.time) metadata.time = input.time;

  try {
    const r = await fetch(`${POLAR_API}/v1/checkouts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("POLAR_ACCESS_TOKEN")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        products: [env("POLAR_PRODUCT_ID")],
        success_url: `${siteUrl(req)}/?checkout_id={CHECKOUT_ID}`,
        metadata
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.url) {
      const hint = Array.isArray(data.detail)
        ? data.detail.map((d) => `${(d.loc || []).join(".")}: ${d.msg}`).join(" | ")
        : (data.error || data.detail || "");
      console.error("Polar checkout failed", r.status, JSON.stringify(data));
      return res.status(502).json({
        error: "Checkout is unavailable right now. Try again in a minute.",
        polar_status: r.status,
        polar_hint: String(hint).slice(0, 400),
        polar_server: POLAR_API.includes("sandbox") ? "sandbox" : "production"
      });
    }
    return res.status(200).json({ url: data.url });
  } catch (e) {
    console.error("Polar checkout error", e);
    return res.status(502).json({ error: "Checkout is unavailable right now. Try again in a minute." });
  }
};

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
