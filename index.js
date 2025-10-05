import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Very Important!

// ✅ Root Check
app.get("/", (req, res) => {
  res.send("✅ AamarPay Proxy is running perfectly.");
});

// ✅ Sandbox / Live Config
const BASE_URL = "https://sandbox.aamarpay.com/jsonpost.php"; // sandbox
const VERIFY_URL = "https://sandbox.aamarpay.com/api/v1/trxcheck/request.php"; // verify

// ✅ Payment Create Endpoint
app.post("/aamarpay", async (req, res) => {
  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log("🟢 AamarPay Init Response:", data);

    if (data.payment_url) {
      return res.json({ payment_url: data.payment_url });
    } else {
      return res.status(400).json({ error: "Payment init failed", data });
    }
  } catch (err) {
    console.error("❌ Payment error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Redirect Handlers (Success / Fail / Cancel)
["success", "fail", "cancel"].forEach((kind) => {
  app.all(`/redirect/${kind}`, (req, res) => {
    const body = req.body || {};
    const query = req.query || {};

    // ✅ Extract QID and Transaction ID safely
    const qid = query.qid || body.qid || body.opt_a || "";
    const tran = query.tran_id || body.mer_txnid || body.tran_id || "";

    const target = `https://fatwa-darul-hidayah.web.app/payment/${kind}?qid=${qid}&tran_id=${tran}`;
    console.log(`➡️ Redirecting to ${target}`);

    return res.redirect(302, target);
  });
});

// ✅ Verify Transaction Endpoint
app.post("/aamarpay/verify", async (req, res) => {
  try {
    const { tran_id } = req.body;
    if (!tran_id)
      return res.status(400).json({ error: "Missing transaction ID" });

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        store_id: "aamarpaytest",
        signature_key: "dbb74894e82415a2f7ff0ec3a97e4183",
        type: "json",
        request_id: tran_id,
      }),
    });

    const data = await response.json();
    console.log("🟢 Verify Response:", data);
    res.json(data);
  } catch (err) {
    console.error("❌ Verify error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`🚀 AamarPay Proxy Live on port ${PORT}`);
  console.log(`   Mode: sandbox`);
});
