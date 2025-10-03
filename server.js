// server.js (CommonJS)
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // v2
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

const GNEWS_KEY = process.env.GNEWS_API_KEY;
const NEWS_KEY  = process.env.NEWSAPI_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY; // optional

// Map your UI categories to GNews topics
const topicMap = {
  general: "world",   // GNews doesn't have "general"
  business: "business",
  technology: "technology",
  sports: "sports",
  entertainment: "entertainment",
  science: "science",
  health: "health"
};

// Health
app.get("/", (_req, res) => res.send("GlobeX backend up"));

// -------------------- NEWS ROUTE --------------------
app.get("/api/news", async (req, res) => {
  try {
    const endpoint = req.query.endpoint || "top-headlines";

    // Prefer GNews for demo reliability
    if (GNEWS_KEY) {
      let url;

      if (endpoint === "everything") {
        // Your UI sends "sources" for everything; GNews doesn't support sources directly.
        // We'll treat it as a search for now. If you add a "q" later, pass it through.
        const q = req.query.q || "news";
        // max=50 is the cap, lang=en by default, adjust if needed
        url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&max=50&lang=en&token=${GNEWS_KEY}`;
      } else {
        const category = req.query.category || "general";
        const country  = req.query.country  || "us";

        const topic = topicMap[category] || "world";
        // Top headlines with topic + country
        // Docs: /v4/top-headlines?topic=...&country=...&lang=en&max=50&token=...
        url = `https://gnews.io/api/v4/top-headlines?topic=${encodeURIComponent(topic)}&country=${encodeURIComponent(country)}&lang=en&max=50&token=${GNEWS_KEY}`;
      }

      const r = await fetch(url);
      const bodyText = await r.text();
      if (!r.ok) {
        return res.status(r.status).json({ error: "GNews error", body: bodyText });
      }

      // Normalize GNews payload to NewsAPI-like shape for your frontend
      const g = JSON.parse(bodyText);
      // GNews returns { totalArticles, articles: [{title, description, url, source, publishedAt, ...}] }
      // Ensure "source.name" exists for your frontend
      const normalized = {
        status: "ok",
        totalResults: g.totalArticles || (g.articles ? g.articles.length : 0),
        articles: (g.articles || []).map(a => ({
          title: a.title,
          description: a.description,
          url: a.url,
          source: { name: (a.source && a.source.name) || "GNews" },
          publishedAt: a.publishedAt
        }))
      };

      return res.json(normalized);
    }

    // Fallback: NewsAPI (works on localhost for top-headlines; /everything may be blocked on free plan)
    if (NEWS_KEY) {
      let url;
      if (endpoint === "everything") {
        const sources = req.query.sources || "bbc-news";
        url = `https://newsapi.org/v2/everything?sources=${encodeURIComponent(sources)}&pageSize=50&sortBy=publishedAt&apiKey=${NEWS_KEY}`;
      } else {
        const category = req.query.category || "general";
        const country  = req.query.country  || "us";
        url = `https://newsapi.org/v2/top-headlines?country=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}&pageSize=50&apiKey=${NEWS_KEY}`;
      }

      const r = await fetch(url);
      const bodyText = await r.text();
      if (!r.ok) {
        return res.status(r.status).json({ error: "NewsAPI error", body: bodyText });
      }
      return res.json(JSON.parse(bodyText));
    }

    // If no keys at all:
    return res.status(500).json({
      error: "No news API key found. Set GNEWS_API_KEY or NEWSAPI_API_KEY in .env"
    });
  } catch (err) {
    console.error("GET /api/news failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------- LOCATION (LLM) ROUTE --------------------
app.post("/ask-claude", async (req, res) => {
  try {
    const { prompt } = req.body || {};

    // If you want to use OpenRouter (free/cheap models) instead of Anthropic directly:
    if (OPENROUTER_KEY) {
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-flash-1.5", // or another free/cheap model on OpenRouter
          messages: [{ role: "user", content: prompt || "Find location" }],
          max_tokens: 250
        })
      });
      const txt = await r.text();
      if (!r.ok) return res.status(r.status).json({ error: "OpenRouter error", body: txt });

      const data = JSON.parse(txt);
      // normalize to { content: [{ text: "..."}] } for your frontend
      const reply =
        data.choices?.[0]?.message?.content ||
        "Location: New Delhi, India\nLatitude: 28.6139\nLongitude: 77.2090\nReasoning: Fallback reply.";
      return res.json({ content: [{ text: reply }] });
    }

    // No LLM key? Return a safe demo location so markers render.
    return res.json({
      content: [{ text: "Location: New Delhi, India\nLatitude: 28.6139\nLongitude: 77.2090\nReasoning: Demo fallback without LLM key." }]
    });
  } catch (err) {
    console.error("POST /ask-claude failed:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`GlobeX server listening on http://localhost:${PORT}`);
});
