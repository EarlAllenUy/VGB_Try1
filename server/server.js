import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { db } from "./firebaseAPI.js"; 
import { ref, push, get } from "firebase/database";

const app = express();
app.use(cors());
app.use(bodyParser.json());
// Note: Frontend serving is handled by the frontend dev server in this environment
// app.use(express.static("frontend")); 

/* =========================
   HELPER: Get Games with IDs
========================= */
const getGamesWithIds = async () => {
  const snapshot = await get(ref(db, "games"));
  const gamesObj = snapshot.val() || {};
  // Fix: Map Object keys (IDs) to the game objects so frontend gets the 'id' field
  return Object.entries(gamesObj).map(([id, game]) => ({ id, ...game }));
};

/* =========================
   ADD NEW GAME
========================= */
app.post("/add", async (req, res) => {
  try {
    const gameData = req.body;
    if (!gameData.title || !gameData.releaseDate) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    const newRef = await push(ref(db, "games"), gameData);
    // Return the new ID so the frontend can potentially use it immediately
    res.status(201).json({ message: "Game added successfully!", data: { id: newRef.key, ...gameData } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET ALL GAMES
========================= */
app.get("/games", async (req, res) => {
  try {
    const games = await getGamesWithIds();
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET UPCOMING GAMES
========================= */
app.get("/upcoming", async (req, res) => {
  try {
    const games = await getGamesWithIds();
    const upcoming = games.filter(g => g.status === "upcoming");
    res.json(upcoming);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET RELEASED GAMES
========================= */
app.get("/released", async (req, res) => {
  try {
    const games = await getGamesWithIds();
    const released = games.filter(g => g.status === "released");
    res.json(released);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET DELAYED GAMES
========================= */
app.get("/delayed", async (req, res) => {
  try {
    const games = await getGamesWithIds();
    const delayed = games.filter(g => g.status === "delayed");
    res.json(delayed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET CANCELLED GAMES
========================= */
app.get("/cancelled", async (req, res) => {
  try {
    const games = await getGamesWithIds();
    const cancelled = games.filter(g => g.status === "cancelled");
    res.json(cancelled);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   SERVER START
========================= */
// CHANGED: Port 3001 to avoid conflict with React (3000) or Vite (5173)
const PORT = 3001;
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));