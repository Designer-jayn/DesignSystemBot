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
// 🔥 Gemini AI 모델 설정
// ---------------------------------------------------------
let BEST_MODEL_URL = ""; 
const findBestModel = async () => {
    if (!process.env.GEMINI_API_KEY) return;
    try {
        console.log("🕵️‍♀️ AI 모델 검색 중...");
        const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const validModels = res.data.models.filter(m => m.supportedGenerationMethods.includes("generateContent") && m.name.includes("gemini"));
        if (validModels.length > 0) {
            let best = validModels.find(m => m.name.includes("flash")) || validModels[0];
            const modelName = best.name.replace("models/", "");
            BEST_MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
            console.log(`🎉 AI 모델 연결 성공: [ ${modelName} ]`);
        }
    } catch (e) { console.log("⚠️ 모델 검색 실패:", e.message); }
};
findBestModel();

// ---------------------------------------------------------
// 📡 API 라우트
// ---------------------------------------------------------
app.post('/api/ai-naming', async (req, res) => {
    const { hex } = req.body;
    try {
        if (BEST_MODEL_URL) {
            const response = await axios.post(BEST_MODEL_URL, { contents: [{ parts: [{ text: `Analyze HEX ${hex}. Return English color name only.` }] }] });
            return res.json({ name: response.data.candidates[0].content.parts[0].text.trim().replace(/["'\n]/g, "") });
        } 
        throw new Error("AI 연결 안됨");
    } catch (error) { const names = namer(hex); return res.json({ name: names.pantone[0].name }); }
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    try {
        if (BEST_MODEL_URL) {
            const promptText = `디자인 시스템 전문가로서 답해줘.\n[데이터] ${JSON.stringify(readData())}\n[질문] ${message}`;
            const response = await axios.post(BEST_MODEL_URL, { contents: [{ parts: [{ text: promptText }] }] });
            return res.json({ response: response.data.candidates[0].content.parts[0].text });
        }
        throw new Error("AI 연결 안됨");
    } catch (error) { return res.status(500).json({ response: "AI 연결 실패" }); }
});

app.get('/api/projects/:email', (req, res) => { res.json(readData()[req.params.email] || { "기본 프로젝트": [] }); });
app.post('/api/projects', (req, res) => { const { email, projects } = req.body; const data = readData(); data[email] = projects; writeData(data); res.json({ success: true }); });


// ---------------------------------------------------------
// 🕵️‍♀️ [레이더 가동] 폴더 위치 추적 시스템 (여기가 핵심!)
// ---------------------------------------------------------

// 1. 현재 위치 파악 (서버가 어디서 돌고 있나?)
const currentDir = __dirname;
const parentDir = path.join(__dirname, '../'); // 한 칸 위

// 2. 'web' 폴더 찾기 (부모 폴더에도 찾아보고, 현재 폴더에도 찾아봄)
const webPathInParent = path.join(parentDir, 'web');
const webPathInCurrent = path.join(currentDir, 'web');

// 어디에 'web'이 있는지 확인
let finalWebPath = null;
if (fs.existsSync(webPathInParent)) {
    finalWebPath = webPathInParent;
} else if (fs.existsSync(webPathInCurrent)) {
    finalWebPath = webPathInCurrent;
}

// // 3. 빌드 폴더(dist 또는 build) 찾기
// let clientBuildPath = null;
// if (finalWebPath) {
//     const dist = path.join(finalWebPath, 'dist');
//     const build = path.join(finalWebPath, 'build');
    
//     if (fs.existsSync(dist)) clientBuildPath = dist;
//     else if (fs.existsSync(build)) clientBuildPath = build;
// }


// ▼▼▼ 이 코드로 해당 구역을 싹 덮어씌우세요! ▼▼▼

// ---------------------------------------------------------
// 🕵️‍♀️ [최종 해결] Railway용 경로 고정 설정
// ---------------------------------------------------------

// Railway 환경에서는 모든 파일이 /app 아래에 모입니다.
const clientBuildPath = path.join(__dirname, '../web/build');

console.log(`🍊 화면 파일 경로: ${clientBuildPath}`);

app.use(express.static(clientBuildPath));
app.use('/static', express.static(path.join(clientBuildPath, 'static')));

// 핵심: 따옴표 '*' 대신 정규식을 써서 에러 방지
app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// 5. [핵심 수정] 모든 요청 받아주기 (따옴표 대신 /.*/ 사용)
app.get(/.*/, (req, res) => {
    if (clientBuildPath) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
        res.status(404).send(`
            <h1>🚧 화면 파일이 없어요!</h1>
            <p>하지만 서버는 안 죽고 살아있습니다! (로그 확인 필요)</p>
        `);
    }
});

// ---------------------------------------------------------
// 🏁 서버 시작
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 활기차게 돌아가고 있어!`);
});