const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); 
const namer = require('color-namer'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

// ---------------------------------------------------------
// 📂 데이터베이스 설정
// ---------------------------------------------------------
const DATA_FILE = path.join(__dirname, 'database.json');
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}
const readData = () => JSON.parse(fs.readFileSync(DATA_FILE));
const writeData = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// ---------------------------------------------------------
// 🔥 [핵심] Gemini AI 모델 자동 검색
// ---------------------------------------------------------
let BEST_MODEL_URL = ""; 

const findBestModel = async () => {
    if (!process.env.GEMINI_API_KEY) return;
    try {
        console.log("🕵️‍♀️ AI 모델 검색 중...");
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
            console.log(`🎉 모델 연결 성공: [ ${modelName} ]`);
        }
    } catch (e) {
        console.log("⚠️ 모델 검색 실패:", e.message);
    }
};
findBestModel();

// ---------------------------------------------------------
// 📡 API 라우트
// ---------------------------------------------------------
app.post('/api/ai-naming', async (req, res) => {
    const { hex } = req.body;
    try {
        if (BEST_MODEL_URL) {
            const promptText = `Analyze HEX code ${hex}. Return ONLY an English color name.`;
            const response = await axios.post(
                BEST_MODEL_URL,
                { contents: [{ parts: [{ text: promptText }] }] },
                { headers: { 'Content-Type': 'application/json' } }
            );
            return res.json({ name: response.data.candidates[0].content.parts[0].text.trim().replace(/["'\n]/g, "") });
        } 
        throw new Error("AI 연결 안됨");
    } catch (error) {
        const names = namer(hex);
        return res.json({ name: names.pantone[0].name });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    try {
        if (BEST_MODEL_URL) {
            const designData = JSON.stringify(readData());
            const promptText = `디자인 시스템 전문가로서 답해줘.\n[데이터] ${designData}\n[질문] ${message}`;
            const response = await axios.post(
                BEST_MODEL_URL,
                { contents: [{ parts: [{ text: promptText }] }] },
                { headers: { 'Content-Type': 'application/json' } }
            );
            return res.json({ response: response.data.candidates[0].content.parts[0].text });
        }
        throw new Error("AI 연결 안됨");
    } catch (error) {
        return res.status(500).json({ response: "AI 연결 실패" });
    }
});

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

// ---------------------------------------------------------
// 🚀 [중요] 화면 파일 위치 자동 찾기 (build vs dist)
// ---------------------------------------------------------
// 1. 두 가지 경로를 모두 준비합니다.
const buildPath = path.join(__dirname, '../web/build'); // 옛날 방식 (CRA)
const distPath = path.join(__dirname, '../web/dist');   // 요즘 방식 (Vite)

let finalPath = buildPath; // 일단 build라고 가정

// 2. 만약 dist 폴더가 존재하면, 그걸로 경로를 바꿉니다!
if (fs.existsSync(distPath)) {
    console.log("🍊 [감지됨] Vite(dist) 폴더를 사용합니다.");
    finalPath = distPath;
} else if (fs.existsSync(buildPath)) {
    console.log("🍎 [감지됨] CRA(build) 폴더를 사용합니다.");
} else {
    console.log("🚨 [경고] 화면 빌드 폴더를 못 찾겠어요! (web/build 또는 web/dist 확인 필요)");
    // 디버깅을 위해 현재 폴더 구조를 찍어봅니다.
    try {
        console.log("📂 web 폴더 내용:", fs.readdirSync(path.join(__dirname, '../web')));
    } catch (e) { console.log("web 폴더도 못 찾음"); }
}

app.use(express.static(finalPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(finalPath, 'index.html'));
});

// ---------------------------------------------------------
// 🏁 서버 시작
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 활기차게 돌아가고 있어!`);
});