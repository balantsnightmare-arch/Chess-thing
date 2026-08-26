import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  // Cloud Run (and most container hosts) inject the port to listen on and
  // kill the container if nothing binds to it. Fall back to 3000 locally.
  const PORT = Number(process.env.PORT) || 3000;

  // Configure body parser to allow uploading base64 chess images
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Initialize Gemini AI SDK
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;

  if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
    try {
      ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("Gemini AI SDK initialized successfully.");
    } catch (err) {
      console.error("Error initializing Gemini AI SDK:", err);
    }
  } else {
    console.warn("GEMINI_API_KEY is not configured or has default placeholder. AI analysis will run in simulation mode.");
  }

  // API endpoint for chess position image analysis
  app.post("/api/analyze-position", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image data provided" });
      }

      // Check if SDK is available
      if (!ai) {
        // Return simulated analysis if Gemini API is missing
        console.warn("Gemini SDK not initialized. Returning high-quality simulated analysis.");
        return res.json({
          title: "Tactical Position Study",
          sideToPlay: "White",
          tacticalThemes: ["Tactics", "Middle-Game", "Self-Created Card"],
          suggestedFront: "What is White's best continuation in this position?",
          suggestedBack: "White has a strong attack. Look for pins, forks, or active piece play.",
          additionalNotes: "Self-uploaded card notes. Note: Setup a valid GEMINI_API_KEY in the secrets tab to enable instant real-time Grandmaster tactical analysis!",
          isSimulated: true,
        });
      }

      // Parse MIME type and base64 data
      let mimeType = "image/png";
      let base64Data = image;

      if (image.startsWith("data:")) {
        const parts = image.split(";base64,");
        if (parts.length === 2) {
          mimeType = parts[0].replace("data:", "");
          base64Data = parts[1];
        }
      }

      const promptText = `You are an expert chess grandmaster and coach. Analyze this uploaded picture of a chess board.
Identify:
1. What position is this? (e.g. White to play, key tactical theme, or endgame pattern). If it's a famous position or puzzle, name it.
2. Suggested Side to Play (White, Black, or Unknown).
3. The best move or continuation if it's a puzzle/tactical position, or strategic recommendation.
4. Suggested Front content for a Flashcard (e.g., a clear study question like "What is White's winning tactical sequence here?").
5. Suggested Back content for a Flashcard (e.g., "1. Rd8+! Kxd8 2. Qxf8# White delivers back-rank mate.").
6. Any helpful Grandmaster coaching tips or annotations for study notes.

Format your output STRICTLY as a JSON object with the exact properties:
{
  "title": "Short title describing the position (e.g., Smothered Mate Threat, King & Pawn Endgame)",
  "sideToPlay": "White" | "Black" | "Unknown",
  "tacticalThemes": ["Pin", "Fork", "Back-rank mate", "etc"],
  "suggestedFront": "Short study question",
  "suggestedBack": "Solution/Answer",
  "additionalNotes": "Grandmaster commentary and tips to improve chess skill in this position"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: promptText,
          },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response text received from Gemini AI");
      }

      try {
        const parsedData = JSON.parse(responseText.trim());
        return res.json(parsedData);
      } catch (parseErr) {
        console.error("Error parsing Gemini JSON response:", responseText, parseErr);
        // Fallback: extract JSON structure with regex if it's wrapped in markdown blocks
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            const extracted = JSON.parse(match[0]);
            return res.json(extracted);
          } catch {
            // ignore and drop to generic handler
          }
        }
        return res.json({
          title: "Analyzed Chess Position",
          sideToPlay: "White",
          tacticalThemes: ["Analyzing Board"],
          suggestedFront: "What is the best move for White?",
          suggestedBack: responseText,
          additionalNotes: "Analysis was returned as free-form text: " + responseText,
        });
      }
    } catch (err: any) {
      console.error("Chess Position analysis failed:", err);
      return res.status(500).json({
        error: "Failed to analyze chess position. Please check your image or try again later.",
        details: err.message,
      });
    }
  });

  /*
   * Turn a photographed sheet of notes into flashcards.
   *
   * The model id is not hardcoded to a single string: a wrong or retired id
   * fails the whole feature, so a short list is tried in order and the first
   * that answers is used. GEMINI_MODEL overrides the list entirely.
   */
  const SCAN_MODELS = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

  app.post("/api/scan-sheet", async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) {
        return res.status(400).json({ error: "No image data provided" });
      }

      if (!ai) {
        return res.status(503).json({
          error:
            "Reading a photo needs a Gemini API key. Set GEMINI_API_KEY on the server and try again.",
        });
      }

      let mimeType = "image/png";
      let base64Data = image;
      if (image.startsWith("data:")) {
        const parts = image.split(";base64,");
        if (parts.length === 2) {
          mimeType = parts[0].replace("data:", "");
          base64Data = parts[1];
        }
      }

      const promptText = `You are reading a photograph of a page of study notes.

Extract the material and turn it into flashcards. Each flashcard has exactly two
fields: a front (the prompt, term, or question) and a back (the answer,
definition, or explanation). Use the wording on the page; do not invent facts
that are not there.

Rules:
- Produce one card per distinct idea, term, question or definition on the page.
- If the page is a list of term/definition pairs, each pair is one card.
- If the page is prose, write a sensible question for the front and the
  supporting detail for the back.
- Skip page numbers, headers, decorations and anything unreadable.
- Keep each field short: a phrase or a couple of sentences.
- Suggest a short deck name describing the page's subject.

Return STRICTLY this JSON shape and nothing else:
{
  "deckName": "Short subject name",
  "cards": [ { "front": "...", "back": "..." } ]
}`;

      let responseText: string | undefined;
      let lastError: unknown = null;
      for (const model of SCAN_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              { inlineData: { data: base64Data, mimeType } },
              { text: promptText },
            ],
            config: { responseMimeType: "application/json" },
          });
          responseText = response.text;
          if (responseText) break;
        } catch (err) {
          lastError = err;
          console.warn(`Sheet scan failed on model ${model}:`, (err as Error)?.message);
        }
      }

      if (!responseText) {
        console.error("Sheet scan: no model produced a response.", lastError);
        return res.status(502).json({
          error:
            "Could not reach the image model. Check the server's Gemini API key and model access.",
        });
      }

      let parsed: any;
      try {
        parsed = JSON.parse(responseText.trim());
      } catch {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) {
          return res.status(502).json({ error: "The model did not return usable JSON." });
        }
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return res.status(502).json({ error: "The model did not return usable JSON." });
        }
      }

      // Only front and back are taken; everything else on a card is left alone.
      const cards = Array.isArray(parsed?.cards)
        ? parsed.cards
            .map((card: any) => ({
              front: typeof card?.front === "string" ? card.front.trim() : "",
              back: typeof card?.back === "string" ? card.back.trim() : "",
            }))
            .filter((card: any) => card.front && card.back)
        : [];

      if (cards.length === 0) {
        return res.status(422).json({
          error:
            "Nothing readable was found on that photo. Try again with the page filling the frame in good light.",
        });
      }

      return res.json({
        deckName:
          typeof parsed?.deckName === "string" && parsed.deckName.trim()
            ? parsed.deckName.trim()
            : "Scanned Notes",
        cards,
      });
    } catch (err: any) {
      console.error("Sheet scan failed:", err);
      return res.status(500).json({
        error: "Could not read that photo. Please try again.",
        details: err?.message,
      });
    }
  });

  // Serve static files and handle routing based on environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
