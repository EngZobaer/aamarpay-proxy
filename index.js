import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ AamarPay Proxy is running!");
});

app.post("/aamarpay", async (req, res) => {
  try {
    const response = await fetch("https://sandbox.aamarpay.com/jsonpost.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log("🔸 AamarPay Response:", data);

    // ✅ Ensure valid URL returned
    if (data.payment_url) {
      res.json({ result: true, payment_url: data.payment_url });
    } else {
      res.status(400).json({ result: false, error: data });
    }
  } catch (err) {
    console.error("❌ Proxy Error:", err);
    res.status(500).json({ result: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 AamarPay Proxy running on port ${PORT}`));
