// Server principal (Node.js/Express)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pdfParse = require('pdf-parse');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!OPENAI_API_KEY) {
  console.error('Defina OPENAI_API_KEY no .env');
  process.exit(1);
}

function toBase64(filePath, mime) {
  const data = fs.readFileSync(filePath);
  return `data:${mime};base64,${data.toString('base64')}`;
}
function guessMime(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

async function openaiChat(messages, asJson=false) {
  const res = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: OPENAI_MODEL,
    messages,
    temperature: 0,
    ...(asJson ? { response_format: { type: "json_object" } } : {})
  }, {
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
  });
  return res.data.choices?.[0]?.message?.content ?? '';
}

function buildMessages({ rawText, targetKg }) {
  const system = `Você é um extrator/calculador de fórmulas de pigmentação.
- Unidades: Y (1Y = 48 partes). Valores como "2Y 29,25" significam 2*48 + 29,25 partes.
- Detecte base_kg, produto, cor, pigmentos.
- ESCALA proporcional para peso alvo informado.
- SEM arredondar. Trabalhe com decimais exatos.
- Saída JSON:
{ produto, cor, base_kg_detectada, peso_alvo_kg, itens:[ {pigmento, valor_lido, partes_lidas, partes_escaladas, y_inteiro, y_resto, y_formatado} ] }`;
  const user = `TEXTO: ${rawText}
Peso alvo (kg): ${targetKg}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  const { targetKg } = req.body;
  if (!file || !targetKg) {
    if (file) fs.unlinkSync(file.path);
    return res.status(400).json({ error: 'Envie file e targetKg.' });
  }
  try {
    let rawText = '';
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf') {
      const data = await pdfParse(fs.readFileSync(file.path));
      rawText = data.text;
    } else {
      const mime = guessMime(file.originalname);
      const b64 = toBase64(file.path, mime);
      const ocr = await openaiChat([
        { role: "system", content: "Você faz OCR. Retorne texto bruto." },
        { role: "user", content: [
          { type: "text", text: "Extraia todo o texto legível (use vírgula decimal PT-BR)." },
          { type: "image_url", image_url: { url: b64 } }
        ]}
      ]);
      rawText = ocr;
    }
    const messages = buildMessages({ rawText, targetKg: Number(targetKg) });
    const json = await openaiChat(messages, true);
    res.json(JSON.parse(json));
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: 'Falha ao processar arquivo.' });
  } finally {
    try { fs.unlinkSync(file.path); } catch {}
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));
