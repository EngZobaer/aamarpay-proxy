import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ✅ Default route
app.get("/", (req, res) => {
  res.send("✅ AamarPay Proxy is running successfully!");
});

// ✅ AamarPay payment proxy route
app.post("/aamarpay", async (req, res) => {
  try {
    const response = await fetch("https://sandbox.aamarpay.com/jsonpost.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Proxy Error:", err);
    res.status(500).json({ error: "Proxy request failed", details: err.message });
  }
});

// ✅ Optional: safe IP info route
app.get("/ipinfo", async (req, res) => {
  try {
    const response = await fetch("https://ipapi.co/json/");
    const data = await response.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to fetch IP info" });
  }
});

app.listen(PORT, () => console.log(`🚀 Proxy server running on port ${PORT}`));
