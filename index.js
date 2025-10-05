import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// 🧩 Config
const AAMARPAY_MODE = (process.env.AAMARPAY_MODE || "sandbox").toLowerCase();
const STORE_ID = process.env.AAMARPAY_STORE_ID || "aamarpaytest";
const SIGNATURE_KEY =
  process.env.AAMARPAY_SIGNATURE_KEY ||
  "dbb74894e82415a2f7ff0ec3a97e4183";

const FRONTEND_BASE =
  process.env.FRONTEND_BASE || "https://fatwa-darul-hidayah.web.app";

// ✅ Middleware
app.use(
  cors({
    origin: "*", // allow all (CORS fix)
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Test
app.get("/", (_req, res) => res.send("✅ AamarPay Proxy working"));

// ✅ Payment Initialize
app.post("/aamarpay", async (req, res) => {
  try {
    const payload = req.body || {};
    const base =
      AAMARPAY_MODE === "live"
        ? "https://secure.aamarpay.com"
        : "https://sandbox.aamarpay.com";

    const body = {
      ...payload,
      store_id: STORE_ID,
      signature_key: SIGNATURE_KEY,
      type: "json",
    };

    const resp = await fetch(`${base}/jsonpost.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => ({}));
    const payment_url =
      data.payment_url || data.pay_url || data.redirect_url || data.url;

    if (!payment_url) {
      return res.status(400).json({ error: "No payment_url", raw: data });
    }

    return res.json({ payment_url });
  } catch (err) {
    console.error("❌ Init error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// ✅ Redirect handler
["success", "fail", "cancel"].forEach((kind) => {
  app.all(`/redirect/${kind}`, (req, res) => {
    const q = req.query || {};
    const b = req.body || {};

    const qid = q.qid || b.qid || b.opt_a || "";
    const tran = q.tran_id || b.tran_id || b.mer_txnid || "";

    const target = `${FRONTEND_BASE}/payment/${kind}?qid=${qid}&tran_id=${tran}`;
    console.log(`➡️ Redirect → ${target}`);

    return res.redirect(302, target);
  });
});

// ✅ Verify
app.post("/aamarpay/verify", async (req, res) => {
  try {
    const { tran_id } = req.body || {};
    if (!tran_id) return res.status(400).json({ error: "tran_id required" });

    const base =
      AAMARPAY_MODE === "live"
        ? "https://secure.aamarpay.com"
        : "https://sandbox.aamarpay.com";

    const verifyUrl = `${base}/api/v1/trxcheck/request.php?request_id=${tran_id}&store_id=${STORE_ID}&signature_key=${SIGNATURE_KEY}&type=json`;

    const resp = await fetch(verifyUrl);
    const data = await resp.json().catch(() => ({}));
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 AamarPay Proxy running on ${PORT} (${AAMARPAY_MODE})`)
);
