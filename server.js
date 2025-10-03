import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const NEWS_API_KEY = process.env.NEWSAPI_API_KEY;
const NEWS_API_BASE_URL = "https://newsapi.org/v2/";

// 🧠 Route: Ask Claude via OpenRouter
app.post("/ask-claude", async (req, res) => {
  console.log("Received request to /ask-claude");
  try {
    console.log("Sending request to OpenRouter API");

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "anthropic/claude-3.5-sonnet",
        messages: [{ role: "user", content: req.body.prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Received response from OpenRouter API");
    const text = response.data?.choices?.[0]?.message?.content || null;
    res.json({ content: [{ text }] });
  } catch (error) {
    console.error("Error calling OpenRouter API:", error.message);
    if (error.response) {
      console.error("OpenRouter API response:", error.response.data);
    }
    res.status(500).json({
      error: "Failed to get response from OpenRouter",
      details: error.message,
    });
  }
});

// 📰 Route: News API
app.get("/api/news", async (req, res) => {
  console.log("Received request to /api/news with query:", req.query);
  const { endpoint, category, country, sources } = req.query;

  let url;
  if (endpoint === "top-headlines") {
    url = `${NEWS_API_BASE_URL}top-headlines?category=${category}&country=${country}&apiKey=${NEWS_API_KEY}`;
  } else if (endpoint === "everything") {
    url = `${NEWS_API_BASE_URL}everything?sources=${sources}&apiKey=${NEWS_API_KEY}`;
  } else {
    console.error("Invalid endpoint specified:", endpoint);
    return res.status(400).json({ error: "Invalid endpoint specified" });
  }

  try {
    console.log(`Sending request to News API: ${url}`);
    const response = await axios.get(url);
    console.log(
      "Received response from News API:",
      response.status,
      response.statusText
    );
    res.json(response.data);
  } catch (error) {
    console.error("Error calling News API:", error.message);
    if (error.response) {
      console.error("News API response status:", error.response.status);
      console.error("News API response data:", error.response.data);
    }
    res.status(500).json({
      error: "Failed to get response from News API",
      details: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
