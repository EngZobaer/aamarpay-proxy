// index.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 AamarPay Proxy Endpoint
app.post("/aamarpay", async (req, res) => {
  try {
    const response = await fetch("https://sandbox.aamarpay.com/jsonpost.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error("Proxy Error:", err);
    res.status(500).send({ error: "Proxy server error", details: err.message });
  }
});

// 🔹 Default Route
app.get("/", (req, res) => {
  res.send("✅ AamarPay Proxy is running successfully!");
});

// 🔹 Run Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 AamarPay Proxy running on port ${PORT}`));
