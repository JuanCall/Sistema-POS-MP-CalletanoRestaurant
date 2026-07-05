const { GoogleGenerativeAI } = require("@google/generative-ai");

// 🔐 Leer API Key desde variable de entorno (cargada por dotenv en main.js o server.js)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY no está configurada. Crea un archivo .env con: GEMINI_API_KEY=tu_clave");
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

module.exports = { genAI };