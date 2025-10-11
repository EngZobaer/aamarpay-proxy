import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔹 Config
const AAMARPAY_MODE = (process.env.AAMARPAY_MODE || "sandbox").toLowerCase();
const STORE_ID = process.env.AAMARPAY_STORE_ID || "aamarpaytest";
const SIGNATURE_KEY =
  process.env.AAMARPAY_SIGNATURE_KEY ||
  "dbb74894e82415a2f7ff0ec3a97e4183";

const FRONTEND_BASE =
  process.env.FRONTEND_BASE || "https://fatwa-darul-hidayah.web.app";

// 🔹 Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 🟩 FIX: AamarPay header requirements (for Web)
app.use((req, res, next) => {
  req.headers["user-agent"] = req.headers["user-agent"] || "AamarPayProxy/1.0";
  req.headers["accept"] = "application/json";
  next();
});

// ✅ Root route
app.get("/", (_req, res) => {
  res.status(200).send("✅ AamarPay Proxy is running perfectly.");
});

// ✅ Init Payment (400 FIXED)
app.post("/aamarpay", async (req, res) => {
  try {
    const payload = req.body || {};
    const store_id = payload.store_id || STORE_ID;
    const signature_key = payload.signature_key || SIGNATURE_KEY;

    const base =
      AAMARPAY_MODE === "live"
        ? "https://secure.aamarpay.com"
        : "https://sandbox.aamarpay.com";

    const body = { ...payload, store_id, signature_key, type: "json" };

    console.log("🟢 Init Payment Payload:", body);

    // ✅ FIX: Send as form-urlencoded instead of JSON
    const resp = await fetch(`${base}/jsonpost.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
    });

    const text = await resp.text();
    console.log("🔹 Raw AamarPay Response:", text);

    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      console.warn("⚠️ Response not JSON, trying fallback");
    }

    const payment_url =
      data.payment_url || data.pay_url || data.redirect_url || data.url;

    if (!payment_url) {
      return res
        .status(400)
        .json({ error: "No payment_url returned from AamarPay", raw: text });
    }

    res.json({ payment_url });
  } catch (err) {
    console.error("❌ Proxy error:", err);
    res.status(500).json({
      error: "Proxy crashed",
      detail: String(err?.message || err),
    });
  }
});

// ✅ Redirect Builder
function buildRedirectUrl(kind, req) {
  const q = req.query || {};
  const b = req.body || {};

  const qid = q.qid || b.qid || b.opt_a || "";
  const tran_id = q.tran_id || b.tran_id || b.mer_txnid || "";

  const map = {
    success: "/payment/success",
    fail: "/payment/fail",
    cancel: "/payment/cancel",
  };

  const url = new URL(map[kind], FRONTEND_BASE);
  if (qid) url.searchParams.set("qid", qid);
  if (tran_id) url.searchParams.set("tran_id", tran_id);

  console.log(`➡️ Redirecting to: ${url.toString()}`);
  return url.toString();
}

// ✅ Redirects
["success", "fail", "cancel"].forEach((kind) => {
  app.all(`/redirect/${kind}`, (req, res) => {
    try {
      const to = buildRedirectUrl(kind, req);
      res.redirect(302, to);
    } catch (err) {
      console.error(`❌ Redirect error (${kind}):`, err);
      res.status(500).send("Redirect error");
    }
  });
});

// ✅ Verify Transaction
app.post("/aamarpay/verify", async (req, res) => {
  try {
    const { tran_id } = req.body;
    if (!tran_id) return res.status(400).json({ error: "tran_id required" });

    const base =
      AAMARPAY_MODE === "live"
        ? "https://secure.aamarpay.com"
        : "https://sandbox.aamarpay.com";

    const verifyUrl = `${base}/api/v1/trxcheck/request.php?request_id=${encodeURIComponent(
      tran_id
    )}&store_id=${STORE_ID}&signature_key=${SIGNATURE_KEY}&type=json`;

    console.log("🔍 Verify URL:", verifyUrl);
    const resp = await fetch(verifyUrl);
    const data = await resp.json().catch(() => ({}));
    res.json(data);
  } catch (err) {
    console.error("❌ Verify error:", err);
    res.status(500).json({ error: "Verify failed", detail: String(err) });
  }
});

// ✅ Start
app.listen(PORT, () => {
  console.log(`🚀 AamarPay Proxy running on port ${PORT}`);
  console.log(`🌐 Frontend: ${FRONTEND_BASE}`);
});
