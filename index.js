import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// 🔹 Configuration
const AAMARPAY_MODE = (process.env.AAMARPAY_MODE || "sandbox").toLowerCase();
const STORE_ID = process.env.AAMARPAY_STORE_ID || "aamarpaytest";
const SIGNATURE_KEY =
  process.env.AAMARPAY_SIGNATURE_KEY ||
  "dbb74894e82415a2f7ff0ec3a97e4183";

const FRONTEND_BASE =
  process.env.FRONTEND_BASE || "https://fatwa-darul-hidayah.web.app";

// 🔹 Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 🔹 Health Check
app.get("/", (_req, res) =>
  res.status(200).send("✅ AamarPay Proxy is running perfectly.")
);

// 🔹 Payment Initialization
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

    const resp = await fetch(`${base}/jsonpost.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => ({}));
    console.log("🔹 AamarPay Response:", data);

    const payment_url =
      data.payment_url || data.pay_url || data.redirect_url || data.url;

    if (!payment_url) {
      console.error("❌ Missing payment_url in response:", data);
      return res.status(400).json({
        error: "No payment_url returned from AamarPay",
        raw: data,
      });
    }

    return res.json({ payment_url });
  } catch (err) {
    console.error("❌ Proxy error:", err);
    return res.status(500).json({
      error: "Proxy crashed",
      detail: String(err?.message || err),
    });
  }
});

// 🔹 Build Redirect URL
function buildRedirectUrl(kind, req) {
  const qp = req.query || {};
  const body = req.body || {};

  // extract qid & tran_id safely
  const qid = qp.qid || body.qid || body.opt_a || body?.opt_a?.[0] || "";
  const tran_id =
    qp.tran_id ||
    body.tran_id ||
    body.mer_txnid ||
    body?.mer_txnid?.[0] ||
    "";

  const map = {
    success: "/payment/success",
    fail: "/payment/fail",
    cancel: "/payment/cancel",
  };
  const path = map[kind] || "/";

  const url = new URL(path, FRONTEND_BASE);
  if (qid) url.searchParams.set("qid", qid);
  if (tran_id) url.searchParams.set("tran_id", tran_id);

  return url.toString();
}

// 🔹 Redirect Routes (for AamarPay callback)
["success", "fail", "cancel"].forEach((kind) => {
  app.all(`/redirect/${kind}`, (req, res) => {
    try {
      console.log(`\n🟢 Incoming Redirect [${kind.toUpperCase()}]`);
      console.log("🔸 Query:", req.query);
      console.log("🔸 Body:", req.body);

      const to = buildRedirectUrl(kind, req);
      console.log(`➡️ Redirecting to: ${to}\n`);

      return res.redirect(302, to);
    } catch (err) {
      console.error(`❌ Redirect error (${kind}):`, err);
      return res.status(500).send("Redirect error");
    }
  });
});

// 🔹 Verify Transaction
app.post("/aamarpay/verify", async (req, res) => {
  try {
    const { tran_id } = req.body || {};
    if (!tran_id) {
      return res.status(400).json({ error: "tran_id required" });
    }

    const base =
      AAMARPAY_MODE === "live"
        ? "https://secure.aamarpay.com"
        : "https://sandbox.aamarpay.com";

    const verifyUrl = `${base}/api/v1/trxcheck/request.php?request_id=${encodeURIComponent(
      tran_id
    )}&store_id=${encodeURIComponent(
      STORE_ID
    )}&signature_key=${encodeURIComponent(SIGNATURE_KEY)}&type=json`;

    console.log("🔍 Verify URL:", verifyUrl);

    const resp = await fetch(verifyUrl);
    const data = await resp.json().catch(() => ({}));
    console.log("🔍 Verify Response:", data);

    return res.json(data);
  } catch (err) {
    console.error("❌ Verify error:", err);
    return res.status(500).json({
      error: "Verify failed",
      detail: String(err?.message || err),
    });
  }
});

// 🔹 Start Server
app.listen(PORT, () => {
  console.log(`🚀 AamarPay Proxy Live on port ${PORT}`);
  console.log(`   Mode: ${AAMARPAY_MODE}`);
  console.log(`   Frontend: ${FRONTEND_BASE}`);
});
