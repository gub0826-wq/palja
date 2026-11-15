// POST /api/checkout  { date, time, noTime, sex }  ->  { url }
// Creates a Polar checkout for the full reading. The birth details ride along
// as metadata, so the reading is always written for the chart that was paid for.
const { cleanInput } = require("../lib/saju");

const POLAR_API = process.env.POLAR_SERVER === "production"
  ? "https://api.polar.sh"
  : "https://sandbox-api.polar.sh";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  const input = cleanInput(typeof req.body === "string" ? safeJson(req.body) : req.body);
  if (!input) return res.status(400).json({ error: "Check your birth date and time, then try again." });

  const site = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, "");
  try {
    const r = await fetch(`${POLAR_API}/v1/checkouts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        products: [process.env.POLAR_PRODUCT_ID],
        success_url: `${site}/?checkout_id={CHECKOUT_ID}`,
        metadata: {
          date: input.date,
          time: input.time,
          noTime: input.noTime ? "true" : "false",
          sex: String(input.sex)
        }
      })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.url) {
      console.error("Polar checkout failed", r.status, JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: "Checkout is unavailable right now. Try again in a minute." });
    }
    return res.status(200).json({ url: data.url });
  } catch (e) {
    console.error("Polar checkout error", e);
    return res.status(502).json({ error: "Checkout is unavailable right now. Try again in a minute." });
  }
};

function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
