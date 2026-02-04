const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); 
const namer = require('color-namer'); 
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

const DATA_FILE = path.join(__dirname, 'database.json');
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

const readData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// ---------------------------------------------------------
// 🔥 [핵심] 사용 가능한 모델을 자동으로 찾는 변수
// ---------------------------------------------------------
let BEST_MODEL_URL = ""; 

const findBestModel = async () => {
    if (!process.env.GEMINI_API_KEY) return;
    try {
        console.log("🕵️‍♀️ 사용 가능한 AI 모델을 검색 중...");
        const res = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
        );

        const models = res.data.models;
        const validModels = models.filter(m => 
            m.supportedGenerationMethods.includes("generateContent") && 
            m.name.includes("gemini")
        );

        if (validModels.length > 0) {
            let best = validModels.find(m => m.name.includes("flash")) || 
                       validModels.find(m => m.name.includes("pro")) || 
                       validModels[0];
            
            const modelName = best.name.replace("models/", "");
            BEST_MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
            console.log(`🎉 찾았다! 이 모델을 사용합니다: [ ${modelName} ]`);
        } else {
            console.log("⚠️ 사용 가능한 Gemini 모델을 못 찾았습니다.");
        }
    } catch (e) {
        console.log("⚠️ 모델 검색 실패 (키 문제일 수도 있음):", e.response ? e.response.data : e.message);
    }
};

findBestModel();

// --- [API 1: AI 네이밍] ---
app.post('/api/ai-naming', async (req, res) => {
    const { hex } = req.body;
    console.log(`🎨 작명 요청: ${hex}`);

    try {
        if (BEST_MODEL_URL) {
            const promptText = `You are an expert UI/UX Designer.
Analyze the HEX code ${hex} deeply. Give me a specific and descriptive English color name.
Reply ONLY with the name.`;

            const response = await axios.post(
                BEST_MODEL_URL,
                { contents: [{ parts: [{ text: promptText }] }] },
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (response.data.candidates && response.data.candidates.length > 0) {
                const aiName = response.data.candidates[0].content.parts[0].text.trim().replace(/["'\n]/g, "");
                return res.json({ name: aiName });
            }
        } 
        throw new Error("AI 모델 준비 안됨");
    } catch (error) {
        const names = namer(hex);
        const backupName = names.pantone[0].name; 
        return res.json({ name: backupName });
    }
});

// --- [API 2: AI 채팅] ---
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    try {
        if (BEST_MODEL_URL) {
            const designData = JSON.stringify(readData());
            const promptText = `너는 UI/UX 디자인 시스템 전문가야. 
아래 가이드를 참고해서 질문에 친절하게 답해줘.
[가이드 데이터] ${designData}
[질문] ${message}`;

            const response = await axios.post(
                BEST_MODEL_URL,
                { contents: [{ parts: [{ text: promptText }] }] },
                { headers: { 'Content-Type': 'application/json' } }
            );

            const aiResponse = response.data.candidates[0].content.parts[0].text;
            return res.json({ response: aiResponse });
        }
        throw new Error("AI 모델 준비 안됨");
    } catch (error) {
        console.error("⚠️ 대화 실패:", error.message);
        return res.status(500).json({ response: "미안해, 지금은 대화가 조금 어려워." });
    }
}); // 👈 여기가 닫혀있어야 합니다!

// --- [API 3: 프로젝트 관리] ---
app.get('/api/projects/:email', (req, res) => {
    const { email } = req.params;
    const data = readData();
    res.json(data[email] || { "기본 프로젝트": [] });
});

app.post('/api/projects', (req, res) => {
    const { email, projects } = req.body;
    const data = readData();
    data[email] = projects;
    writeData(data);
    res.json({ success: true });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 서버가 포트 ${port}에서 활기차게 돌아가고 있어!`);
});