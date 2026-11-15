// GET /api/reading?checkout_id=...  ->  { input, text }
// Confirms with Polar that the checkout was paid, then writes the reading with Claude.
const { cleanInput, compute, buildPrompt } = require("../lib/saju");

const POLAR_API = process.env.POLAR_SERVER === "production"
  ? "https://api.polar.sh"
  : "https://sandbox-api.polar.sh";

module.exports = async (req, res) => {
  const id = String((req.query && req.query.checkout_id) || "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) {
    return res.status(400).json({ error: "This reading link is not valid." });
  }

  // 1. Is this checkout paid?
  let checkout;
  try {
    const r = await fetch(`${POLAR_API}/v1/checkouts/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}` }
    });
    if (r.status === 404) return res.status(404).json({ error: "We could not find this order." });
    checkout = await r.json();
    if (!r.ok) throw new Error(`Polar ${r.status}`);
  } catch (e) {
    console.error("Polar lookup error", e);
    return res.status(502).json({ error: "We could not confirm your payment yet. Refresh in a minute." });
  }
  if (checkout.status === "confirmed") {
    return res.status(202).json({ pending: true, error: "Your payment is still processing. This page will retry." });
  }
  if (checkout.status !== "succeeded") {
    return res.status(402).json({ error: "This order has not been paid." });
  }

  // 2. Rebuild the chart from what was paid for, not from anything the browser sends now.
  const input = cleanInput(checkout.metadata || {});
  if (!input) return res.status(500).json({ error: "This order is missing its birth details. Contact support." });
  const chart = compute(input);

  // 3. Write the reading.
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 2500,
        messages: [{ role: "user", content: buildPrompt(input, chart) }]
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Anthropic ${r.status} ${JSON.stringify(data).slice(0, 300)}`);
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) throw new Error("Empty reading");
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ input, text });
  } catch (e) {
    console.error("Reading error", e);
    return res.status(502).json({ error: "Your payment went through, but the reading could not be written just now. Refresh this page to try again." });
  }
};
