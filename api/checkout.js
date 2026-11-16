const crypto = require("crypto");
const { cleanInput } = require("../lib/saju");

const env = (k) => String(process.env[k] || "").trim().replace(/^["']|["']$/g, "");

function siteUrl(req) {
  let s = env("SITE_URL") || `https://${req.headers.host}`;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s.replace(/\/+$/, "");
}

function sign(data) {
  return crypto.createHmac("sha256", env("LEMONSQUEEZY_API_KEY")).update(data).digest("hex").slice(0, 32);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  const input = cleanInput(typeof req.body === "string" ? safeJson(req.body) : req.body);
  if (!input) return res.status(400).json({ error: "Check your birth date and time, then try again." });

  const d = Buffer.from(JSON.stringify({ ...input, t: Date.now() })).toString("base64url");
  const s = sign(d);
  const redirect = `${siteUrl(req)}/?o=[order_id]&d=${d}&s=${s}`;

  try {
    const r = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Bearer ${env("LEMONSQUEEZY_API_KEY")}`
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_data: { custom: { date: input.date, time: input.time || "-", sex: String(input.sex) } },
            product_options: { redirect_url: redirect }
          },
          relationships: {
            store: { data: { type: "stores", id: env("LEMONSQUEEZY_STORE_ID") } },
            variant: { data: { type: "variants", id: env("LEMONSQUEEZY_VARIANT_ID") } }
          }
        }
      })
    });
    const data = await r.json().catch(() => ({}));
    const url = data && data.data && data.data.attributes && data.data.attributes.url;
    if (!r.ok || !url) {
      const hint = Array.isArray(data.errors)
        ? data.errors.map((e) => `${(e.source && e.source.pointer) || ""} ${e.detail || e.title || ""}`.trim()).join(" | ")
        : "";
      console.error("Lemon Squeezy checkout failed", r.status, JSON.stringify(data));
      return res.status(502).json({
        error: "Checkout is unavailable right now. Try again in a minute.",
        ls_status: r.status,
        ls_hint: hint.slice(0, 400)
      });
    }
    return res.status(200).json({ url });
  } catch (e) {
    console.error("Lemon Squeezy checkout error", e);
    return res.status(502).json({ error: "Checkout is unavailable right now. Try again in a minute." });
  }
};

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
module.exports.sign = sign;
