// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch"; // ✅ Node v18+ এ fetch built-in, কিন্তু compat রাখাই ভালো

const app = express();

// ✅ Enable CORS (all origins for Flutter Web)
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json()); // modern alternative to bodyParser.json()

// ✅ Health check
app.get("/", (req, res) => {
  res.send("✅ AamarPay Proxy is running successfully!");
});

// ✅ Proxy route for AamarPay
app.post("/aamarpay", async (req, res) => {
  try {
    console.log("🔹 Incoming Request Body:", req.body);

    const response = await fetch("https://sandbox.aamarpay.com/jsonpost.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    // ⚙️ Check for non-JSON response (fallback)
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("✅ AamarPay API Response:", data);
    res.json(data);
  } catch (error) {
    console.error("❌ Proxy Error:", error);
    res.status(500).json({
      success: false,
      message: "Proxy Failed",
      error: error.message,
    });
  }
});

// ✅ Optional route: Get client IP info
app.get("/ipinfo", async (req, res) => {
  try {
    const response = await fetch("https://ipapi.co/json/");
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ IP Info Error:", err);
    res.status(500).json({ error: "Failed to fetch IP info" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AamarPay Proxy running on port ${PORT}`);
});
