// index.js
// AamarPay Proxy — robust JSON-first with form-urlencoded fallback

import express from "express";
import cors from "cors";

// Node 18+ has global fetch. If you're on older Node, install node-fetch and import it.

const app = express();
const PORT = process.env.PORT || 10000;

// 🔧 Config
const AAMARPAY_MODE = (process.env.AAMARPAY_MODE || "sandbox").toLowerCase(); // "sandbox" | "live"
const STORE_ID = process.env.AAMARPAY_STORE_ID || "aamarpaytest";
const SIGNATURE_KEY =
  process.env.AAMARPAY_SIGNATURE_KEY || "dbb74894e82415a2f7ff0ec3a97e4183";

const FRONTEND_BASE =
  process.env.FRONTEND_BASE || "https://fatwa-darul-hidayah.web.app";

const AAMARPAY_BASE =
  AAMARPAY_MODE === "live"
    ? "https://secure.aamarpay.com"
    : "https://sandbox.aamarpay.com";

// 🔐 Basic sanity logs on boot
console.log("⚙️  AAMARPAY_MODE:", AAMARPAY_MODE);
console.log("⚙️  AAMARPAY_BASE:", AAMARPAY_BASE);

// 🧱 Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 🟩 Helpful header defaults (harmless on server)
app.use((req, _res, next) => {
  req.headers["user-agent"] = req.headers["user-agent"] || "AamarPayProxy/1.0";
  req.headers["accept"] = req.headers["accept"] || "application/json";
  next();
});

// ✅ Health
app.get("/", (_req, res) => {
  res.status(200).send("✅ AamarPay Proxy is running perfectly.");
});

// ---------- Helpers ----------

/**
 * Try JSON request first (AamarPay jsonpost.php). If it returns an error
 * that looks like "Invalid json", the caller can switch to form attempt.
 */
async function tryJsonInit(body) {
  const jsonResp = await fetch(`${AAMARPAY_BASE}/jsonpost.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await jsonResp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  return { status: jsonResp.status, text, data };
}

/** Same payload but sent as application/x-www-form-urlencoded */
async function tryFormInit(body) {
  const formResp = await fetch(`${AAMARPAY_BASE}/jsonpost.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  const text = await formResp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  return { status: formResp.status, text, data };
}

function pickPaymentUrl(d) {
  if (!d || typeof d !== "object") return undefined;
  return (
    d.payment_url ||
    d.pay_url ||
    d.redirect_url ||
    d.url ||
    (d.result === true && typeof d.payment_url === "string" ? d.payment_url : undefined)
  );
}

// ---------- Routes ----------

// ✅ Init Payment (JSON-first, fallback to FORM if needed)
app.post("/aamarpay", async (req, res) => {
  try {
    // merge client payload with server credentials & defaults
    const payload = req.body || {};
    const store_id = payload.store_id || STORE_ID;
    const signature_key = payload.signature_key || SIGNATURE_KEY;

    const body = {
      ...payload,
      store_id,
      signature_key,
      type: "json", // AamarPay expects this when using jsonpost.php
    };

    console.log("🟢 Init Payment Payload:", body);

    // 1) Try JSON
    const j = await tryJsonInit(body);
    console.log("🔹 AamarPay JSON response:", j.text);

    let paymentUrl = pickPaymentUrl(j.data);
    let rawText = j.text;

    // If JSON attempt failed due to "Invalid json" or no payment_url, try FORM
    const looksInvalidJson =
      !paymentUrl &&
      typeof j.text === "string" &&
      /invalid\s*json|inavalid\s*j/i.test(j.text);

    if (!paymentUrl && (looksInvalidJson || j.status >= 400)) {
      console.log("↪️  Retrying with form-urlencoded...");
      const f = await tryFormInit(body);
      console.log("🔹 AamarPay FORM response:", f.text);
      paymentUrl = pickPaymentUrl(f.data);
      rawText = f.text;
    }

    if (!paymentUrl) {
      return res.status(400).json({
        error: "No payment_url returned from AamarPay",
        raw: rawText,
      });
    }

    return res.json({ payment_url: paymentUrl });
  } catch (err) {
    console.error("❌ Proxy error (/aamarpay):", err);
    return res.status(500).json({
      error: "Proxy crashed",
      detail: String(err?.message || err),
    });
  }
});

// ---------- Redirect helpers ----------

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

  const to = new URL(map[kind], FRONTEND_BASE);
  if (qid) to.searchParams.set("qid", qid);
  if (tran_id) to.searchParams.set("tran_id", tran_id);

  console.log(`➡️ Redirecting to: ${to.toString()}`);
  return to.toString();
}

// ✅ Redirects: success / fail / cancel
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

// ✅ Verify Transaction (supports POST body or GET query)
app.all("/aamarpay/verify", async (req, res) => {
  try {
    const tran_id =
      (req.method === "GET" ? req.query?.tran_id : req.body?.tran_id) || "";

    if (!tran_id) {
      return res.status(400).json({ error: "tran_id required" });
    }

    const verifyUrl = `${AAMARPAY_BASE}/api/v1/trxcheck/request.php?request_id=${encodeURIComponent(
      tran_id
    )}&store_id=${encodeURIComponent(
      STORE_ID
    )}&signature_key=${encodeURIComponent(
      SIGNATURE_KEY
    )}&type=json`;

    console.log("🔍 Verify URL:", verifyUrl);

    const resp = await fetch(verifyUrl);
    const text = await resp.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }

    if (!data) {
      return res
        .status(502)
        .json({ error: "Invalid verify response", raw: text });
    }

    return res.json(data);
  } catch (err) {
    console.error("❌ Verify error:", err);
    return res.status(500).json({ error: "Verify failed", detail: String(err) });
  }
});

// ✅ Start
app.listen(PORT, () => {
  console.log(`🚀 AamarPay Proxy running on port ${PORT}`);
  console.log(`🌐 Frontend: ${FRONTEND_BASE}`);
});
