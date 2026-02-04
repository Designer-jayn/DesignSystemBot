const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); 
const namer = require('color-namer'); 
require('dotenv').config();

const app = express();
// Railway 포트 설정 (없으면 8080)
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

// ---------------------------------------------------------
// 📂 데이터베이스 설정 (프로젝트 저장용)
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
        console.log("⚠️ 모델 검색 실패:", e.message);
    }
};
findBestModel();

// ---------------------------------------------------------
// 📡 API 라우트 (AI 기능들)
// ---------------------------------------------------------

// 1. AI 색상 이름 짓기
app.post('/api/ai-naming', async (req, res) => {
    const { hex } = req.body;
    try {
        if (BEST_MODEL_URL) {
            const promptText = `Analyze the HEX code ${hex}. Give me a descriptive English color name. Reply ONLY with the name.`;
            const response = await axios.post(
                BEST_MODEL_URL,
                { contents: [{ parts: [{ text: promptText }] }] },
                { headers: { 'Content-Type': 'application/json' } }
            );
            if (response.data.candidates) {
                return res.json({ name: response.data.candidates[0].content.parts[0].text.trim().replace(/["'\n]/g, "") });
            }
        } 
        throw new Error("AI 모델 없음");
    } catch (error) {
        const names = namer(hex);
        return res.json({ name: names.pantone[0].name });
    }
});

// 2. AI 채팅
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    try {
        if (BEST_MODEL_URL) {
            const designData = JSON.stringify(readData());
            const promptText = `너는 UI/UX 디자인 시스템 전문가야. 다음 데이터를 참고해 질문에 답해줘.\n[데이터] ${designData}\n[질문] ${message}`;
            
            const response = await axios.post(
                BEST_MODEL_URL,
                { contents: [{ parts: [{ text: promptText }] }] },
                { headers: { 'Content-Type': 'application/json' } }
            );
            return res.json({ response: response.data.candidates[0].content.parts[0].text });
        }
        throw new Error("AI 모델 없음");
    } catch (error) {
        return res.status(500).json({ response: "AI 연결에 실패했어요. ㅠㅠ" });
    }
});

// 3. 프로젝트 저장/불러오기
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
// 🚀 [핵심] 리액트 화면 연결 (Web 폴더)
// ---------------------------------------------------------

// 정적 파일 위치를 'web/build'로 설정 (이제 reesefront 아님!)
app.use(express.static(path.join(__dirname, '../web/build')));

// 어떤 주소로 들어오든 무조건 index.html을 보여줘서 리액트가 뜨게 함
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../web/build', 'index.html'));
});

// ---------------------------------------------------------
// 🏁 서버 시작
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 활기차게 돌아가고 있어!`);
});