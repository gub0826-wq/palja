const crypto = require("crypto");
const { cleanInput, compute, buildPrompt } = require("../lib/saju");

const env = (k) => String(process.env[k] || "").trim().replace(/^["']|["']$/g, "");

function sign(data) {
  return crypto.createHmac("sha256", env("LEMONSQUEEZY_API_KEY")).update(data).digest("hex").slice(0, 32);
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const o = String(q.o || ""), d = String(q.d || ""), s = String(q.s || "");

  if (!/^\d{1,20}$/.test(o)) {
    console.error("Reading: bad order id", o);
    return res.status(400).json({ error: "We could not find your order number in this link. Check your receipt email for the reading link." });
  }
  const expected = sign(d);
  if (!d || s.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) {
    return res.status(400).json({ error: "This reading link is not valid." });
  }
  let payload;
  try { payload = JSON.parse(Buffer.from(d, "base64url").toString("utf8")); } catch { payload = null; }
  const input = cleanInput(payload || {});
  if (!input) return res.status(400).json({ error: "This reading link is not valid." });

  let order;
  try {
    const r = await fetch(`https://api.lemonsqueezy.com/v1/orders/${o}`, {
      headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${env("LEMONSQUEEZY_API_KEY")}` }
    });
    if (r.status === 404) return res.status(404).json({ error: "We could not find this order." });
    const data = await r.json();
    if (!r.ok) throw new Error(`Lemon Squeezy ${r.status} ${JSON.stringify(data).slice(0, 300)}`);
    order = data.data.attributes;
  } catch (e) {
    console.error("Order lookup error", e);
    return res.status(502).json({ error: "We could not confirm your payment yet. Refresh in a minute." });
  }
  const item = order.first_order_item || {};
  if (String(order.store_id) !== env("LEMONSQUEEZY_STORE_ID") || String(item.variant_id) !== env("LEMONSQUEEZY_VARIANT_ID")) {
    return res.status(402).json({ error: "This order is not for a Palja reading." });
  }
  if (order.status === "pending") {
    return res.status(202).json({ pending: true, error: "Your payment is still processing. This page will retry." });
  }
  if (order.status !== "paid") {
    return res.status(402).json({ error: "This order has not been paid." });
  }
  const made = Number(payload.t) || 0;
  const paidAt = Date.parse(order.created_at) || 0;
  if (paidAt < made - 5 * 60 * 1000 || paidAt > made + 24 * 60 * 60 * 1000) {
    return res.status(402).json({ error: "This order does not match this reading link." });
  }

  const chart = compute(input);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: env("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: buildPrompt(input, chart) }]
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Anthropic ${r.status} ${JSON.stringify(data).slice(0, 300)}`);
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!text) throw new Error("Empty reading");
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).json({ input, text, complete: data.stop_reason !== "max_tokens" });
  } catch (e) {
    console.error("Reading error", e);
    return res.status(502).json({ error: "Your payment went through, but the reading could not be written just now. Refresh this page to try again." });
  }
};
