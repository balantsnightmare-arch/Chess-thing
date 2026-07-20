import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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
