import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

let analysisHistory = [];

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Chiave GEMINI_API_KEY non trovata nelle variabili d'ambiente.");
  }
  return new GoogleGenAI({ apiKey });
};

app.get('/', (req, res) => {
  const lastAnalysis = analysisHistory.length > 0 ? analysisHistory[analysisHistory.length - 1] : null;
  res.render('index', { 
    lastAnalysis, 
    history: analysisHistory 
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const ai = getGeminiClient();

    const prompt = `
      Analizza le ultime notizie economiche, finanziarie e politiche globali.
      Assegna un indice numerico di Risk-On / Risk-Off da 1 a 90 (dove 1 è estremo Risk-On ed euforia, e 90 è estremo Risk-Off con panico/paura).
      Fornisci una breve motivazione di massimo 3-4 frasi in italiano che spiega i fattori principali (geopolitica, banche centrali, mercati).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            indexValue: { type: Type.INTEGER, description: "Valore numerico dell'indice da 1 a 90" },
            classification: { type: Type.STRING, description: "Etichetta breve, es. Moderatamente Risk-Off" },
            reasoning: { type: Type.STRING, description: "Motivazione dettagliata in italiano" }
          },
          required: ["indexValue", "classification", "reasoning"]
        }
      }
    });

    const result = JSON.parse(response.text);
    const now = new Date();
    const timeString = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + ' ' + now.toLocaleDateString('it-IT');

    const newRecord = {
      id: Date.now(),
      time: timeString,
      index: result.indexValue,
      classification: result.classification,
      reasoning: result.reasoning
    };

    analysisHistory.push(newRecord);
    if (analysisHistory.length > 50) analysisHistory.shift();

    return res.json({ success: true, record: newRecord, history: analysisHistory });

  } catch (error) {
    console.error('Errore durante l\'analisi:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/clear-history', (req, res) => {
  analysisHistory = [];
  res.json({ success: true });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server attivo su http://localhost:${PORT}`);
  });
}

export default app;
