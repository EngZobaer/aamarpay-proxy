import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Test route
app.get("/", (req, res) => {
  res.send("✅ AamarPay Proxy is running!");
});

// ✅ Payment proxy endpoint
app.post("/aamarpay", async (req, res) => {
  try {
    const response = await fetch("https://sandbox.aamarpay.com/jsonpost.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Proxy Server Error", message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 AamarPay Proxy running on port ${PORT}`));
