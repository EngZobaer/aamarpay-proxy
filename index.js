/**
 * ✅ AamarPay Proxy Server
 * Works both sandbox and live.
 * No further edits required — plug & deploy.
 * Author: EngZobaer (maintained)
 */

import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

// Environment Config
const AAMARPAY_MODE = (process.env.AAMARPAY_MODE || "sandbox").toLowerCase();
const STORE_ID = process.env.AAMARPAY_STORE_ID || "aamarpaytest";
const SIGNATURE_KEY =
  process.env.AAMARPAY_SIGNATURE_KEY ||
  "dbb74894e82415a2f7ff0ec3a97e4183";
const ALLOW_ORIGINS = (process.env.ALLOW_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: (origin, cb) => {
      if (ALLOW_ORIGINS.includes("*") || !origin) return cb(null, true);
      return cb(null, ALLOW_ORIGINS.includes(origin));
    },
  })
);

// Health Route
app.get("/", (_req, res) => {
  res
    .status(200)
    .type("text/plain")
    .send("✅ AamarPay Proxy is running perfectly.");
});

// Main Payment Initiate Endpoint
app.post("/aamarpay", async (req, res) => {
  try {
    const payload = req.body || {};

    // Secure defaults
    const store_id = payload.store_id || STORE_ID;
    const signature_key = payload.signature_key || SIGNATURE_KEY;

    if (!store_id || !signature_key) {
      return res
        .status(400)
        .json({ error: "Missing AamarPay credentials (store/signature)" });
    }

    const base =
      AAMARPAY_MODE === "live"
        ? "https://secure.aamarpay.com"
        : "https://sandbox.aamarpay.com";

    const body = { ...payload, store_id, signature_key };

    const resp = await fetch(`${base}/jsonpost.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => ({}));

    const payment_url =
      data.payment_url || data.pay_url || data.redirect_url || data.url;

    if (!payment_url)
      return res.status(400).json({
        error: "No payment_url returned from AamarPay",
        raw: data,
      });

    return res.json({ payment_url });
  } catch (err) {
    console.error("❌ Proxy error:", err);
    return res
      .status(500)
      .json({ error: "Internal proxy error", detail: String(err) });
  }
});

// Optional: Verify transaction
app.post("/aamarpay/verify", async (req, res) => {
  try {
    const { tran_id } = req.body || {};
    if (!tran_id)
      return res.status(400).json({ error: "tran_id is required" });

    const base =
      AAMARPAY_MODE === "live"
        ? "https://secure.aamarpay.com"
        : "https://sandbox.aamarpay.com";

    const verifyUrl = `${base}/api/v1/trxcheck/request.php?request_id=${encodeURIComponent(
      tran_id
    )}&store_id=${encodeURIComponent(
      STORE_ID
    )}&signature_key=${encodeURIComponent(SIGNATURE_KEY)}`;

    const resp = await fetch(verifyUrl);
    const data = await resp.json().catch(() => ({}));

    return res.json(data);
  } catch (err) {
    console.error("❌ Verify error:", err);
    return res
      .status(500)
      .json({ error: "Verify endpoint failed", detail: String(err) });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 AamarPay Proxy Live on port ${PORT}`);
  console.log(`   Mode: ${AAMARPAY_MODE}`);
});
