const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");

const app = express();

// ✅ Allow CORS from anywhere
app.use(cors());
app.use(bodyParser.json());

// ✅ Health Check Route
app.get("/", (req, res) => {
  res.send("✅ AamarPay Proxy is running!");
});

// ✅ Proxy POST endpoint
app.post("/aamarpay", async (req, res) => {
  try {
    const response = await fetch("https://sandbox.aamarpay.com/jsonpost.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxy Error:", error);
    res.status(500).json({ error: "Proxy Failed", details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 AamarPay Proxy running on port ${PORT}`));
