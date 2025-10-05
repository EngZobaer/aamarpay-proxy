const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");

const app = express();

// ✅ Enable CORS for all origins (Flutter Web)
app.use(cors());
app.use(bodyParser.json());

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("✅ AamarPay Proxy is running successfully!");
});

// ✅ Proxy POST route for AamarPay
app.post("/aamarpay", async (req, res) => {
  try {
    console.log("🔹 Incoming Request Body:", req.body);

    const response = await fetch("https://sandbox.aamarpay.com/jsonpost.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 AamarPay Proxy running on port ${PORT}`)
);
