import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Configurazione di EJS come motore di template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Inizializzazione SDK Google GenAI (legge la chiave dalle variabili d'ambiente di Vercel)
const ai = new GoogleGenAI();

// Rotta principale che carica la pagina EJS
app.get('/', (req, res) => {
    res.render('index');
});

// Rotta API per eseguire l'analisi con Gemini
app.get('/api/analyze', async (req, res) => {
    try {
        const promptText = `
Analizza le ultime notizie economiche, finanziarie, politiche e geopolitiche globali, esaminando anche i post più significativi sui social. 
Puntualizza in modo particolare l'analisi sullo stato economico dell'Italia, sulle notizie macroeconomiche italiane (inflazione, PIL, manovre di bilancio, debito pubblico) e sull'impatto specifico sui seguenti asset e categorie:
- Azioni e Utility italiane/europee: A2A (A2A), Avio (AVIO), Banca Ifis (IF), BNP Paribas (BNP), Credit Agricole (ACA), Edison risp. (EDNR), Enel (ENEL), Eni (ENI), Hera (HER), Italgas (IG), Poste Italiane (PST), Snam (SRG), STMicroelectronics (SGM), Tenaris (TW10), Terna (TRN).
- ETF tematici e di reddito/dividendi: Global X Euro Stoxx 50 Covered Call (SYLD), Invesco US Energy Infrastructure MLP (MLPD), iShares Developed Markets Property Yield (IQQ6), JPM Europe Equity Premium Income (JEPE), JPM Global Equity Premium Income (JEPG), JPM US Equity Premium Income (JEPI), Vanguard FTSE All-World High Dividend Yield (VGWD).
- Obbligazionario: BTP a medio-lungo termine e obbligazioni sovrane austriache a lungo termine.

Assegna un indice numerico complessivo di Risk-On / Risk-Off da 1 a 90 (dove 1 è estremo Risk-On ed euforia, e 90 è estremo Risk-Off con panico/paura).
Fornisci una breve motivazione in italiano di massimo 3 frasi che spieghi i fattori chiave di mercato, l'economia italiana, le banche centrali e l'impatto su questo portafoglio specifico.
        `.trim();

        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: promptText }]
                }
            ],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        score: {
                            type: "NUMBER",
                            description: "Un numero compreso tra 1 e 90 che rappresenta l'indice Risk-On / Risk-Off."
                        },
                        motivation: {
                            type: "STRING",
                            description: "Breve motivazione in italiano di massimo 3 frasi incentrata anche sull'economia italiana e i titoli."
                        }
                    },
                    required: ["score", "motivation"]
                }
            }
        });

        const data = JSON.parse(response.text);
        res.json({ success: true, data });

    } catch (error) {
        console.error("Errore durante l'analisi:", error);
        let errorMsg = error.message;
        if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
            errorMsg = "Troppe richieste inviate a Gemini in pochi secondi. Attendi un momento e riprova.";
        }
        res.status(500).json({ success: false, error: errorMsg });
    }
});

// Avvio del server (per test in locale)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server avviato sulla porta ${port}`);
    });
}

export default app;
