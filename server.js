import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const ai = new GoogleGenAI();

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/api/analyze', async (req, res) => {
    try {
        const firstPrompt = `
Analizza le ultime notizie economiche, finanziarie, politiche e geopolitiche globali, esaminando anche i post più significativi sui social. 
Puntualizza in modo particolare l'analisi sullo stato economico dell'Italia, sulle notizie macroeconomiche italiane (inflazione, PIL, manovre di bilancio, debito pubblico).
Assegna un indice numerico complessivo di Risk-On / Risk-Off da 1 a 90 con dedicmale a 1 cifra (dove 1 è estremo Risk-On ed euforia, e 90 è estremo Risk-Off con panico/paura).
Fornisci una breve motivazione in italiano di massimo 3 frasi che spieghi i fattori chiave di mercato, l'economia italiana e le banche centrali.
        `.trim();

        const response1 = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: [{ role: 'user', parts: [{ text: firstPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        score: { type: "NUMBER", description: "Indice Risk-On / Risk-Off da 1 a 90." },
                        motivation: { type: "STRING", description: "Breve motivazione in italiano." }
                    },
                    required: ["score", "motivation"]
                }
            }
        });

        const macroData = JSON.parse(response1.text);

        const secondPrompt = `
Considerando l'analisi di mercato e il contesto di rischio appena calcolato (Score Risk: ${macroData.score}/90 - Sintesi: "${macroData.motivation}"), 
valuta ciascuno dei seguenti asset e titoli specifici fornendo un'indicazione sintetica tra "Buy", "Hold" o "Sell" e una breve motivazione tecnica legata al momento di mercato:
- Azioni e Utility: A2A (A2A), Avio (AVIO), Banca Ifis (IF), BNP Paribas (BNP), Credit Agricole (ACA), Edison risp. (EDNR), Enel (ENEL), Eni (ENI), Hera (HER), Italgas (IG), Poste Italiane (PST), Snam (SRG), STMicroelectronics (SGM), Tenaris (TW10), Terna (TRN).
- ETF tematici e di reddito: Global X Euro Stoxx 50 Covered Call (SYLD), Invesco US Energy Infrastructure MLP (MLPD), iShares Developed Markets Property Yield (IQQ6), JPM Europe Equity Premium Income (JEPE), JPM Global Equity Premium Income (JEPG), JPM US Equity Premium Income (JEPI), Vanguard FTSE All-World High Dividend Yield (VGWD).
- Obbligazionario: BTP a medio-lungo termine e obbligazioni sovrane austriache a lungo termine.

Restituisci un array JSON puro contenente la lista di tutti i titoli analizzati. Per ciascun elemento includi:
- "name": Nome del titolo o ETF
- "ticker": Ticker identificativo
- "action": Esattamente una tra "Buy", "Hold", "Sell"
- "reason": Breve motivazione (massimo 1 frase)
        `.trim();

        const response2 = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: [{ role: 'user', parts: [{ text: secondPrompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING" },
                            ticker: { type: "STRING" },
                            action: { type: "STRING", description: "Deve essere Buy, Hold o Sell" },
                            reason: { type: "STRING" }
                        },
                        required: ["name", "ticker", "action", "reason"]
                    }
                }
            }
        });

        let titoliData = JSON.parse(response2.text);

        const orderPriority = { "SELL": 1, "BUY": 2, "HOLD": 3 };
        titoliData.sort((a, b) => {
            const pA = orderPriority[(a.action || "").trim().toUpperCase()] || 4;
            const pB = orderPriority[(b.action || "").trim().toUpperCase()] || 4;
            return pA - pB;
        });

        res.json({
            success: true,
            data: {
                score: macroData.score,
                motivation: macroData.motivation,
                titoli: titoliData
            }
        });

    } catch (error) {
        console.error("Errore durante la doppia analisi:", error);
        let errorMsg = error.message;
        if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
            errorMsg = "Troppe richieste inviate a Gemini in pochi secondi. Attendi un momento e riprova.";
        }
        res.status(500).json({ success: false, error: errorMsg });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server avviato sulla porta ${port}`);
    });
}

export default app;
