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
// 🕵️‍♀️ [핵심] 폴더 탐정 (dist 인지 build 인지 찾아냄)
// ---------------------------------------------------------
const webPath = path.join(__dirname, '../web');
const distPath = path.join(webPath, 'dist');
const buildPath = path.join(webPath, 'build');

console.log(`📂 Frontend 폴더 위치: ${webPath}`);

// 1. web 폴더 안에 무슨 파일이 있는지 로그를 찍어봅니다. (디버깅용)
try {
    if (fs.existsSync(webPath)) {
        console.log(`📄 web 폴더 내용물:`, fs.readdirSync(webPath));
    } else {
        console.error(`🚨 web 폴더가 아예 없습니다!`);
    }
} catch (e) { console.error(`⚠️ 폴더 확인 중 에러:`, e.message); }

// 2. dist 또는 build 폴더 결정
let finalPath = null;
if (fs.existsSync(distPath)) {
    console.log("🍊 [감지됨] 'dist' 폴더를 사용합니다.");
    finalPath = distPath;
} else if (fs.existsSync(buildPath)) {
    console.log("🍎 [감지됨] 'build' 폴더를 사용합니다.");
    finalPath = buildPath;
} else {
    console.error("🚨 [비상] build 폴더도 없고 dist 폴더도 없습니다!");
}

// 3. 폴더가 있으면 연결, 없으면 안내 메시지
if (finalPath) {
    // ▼▼▼▼▼ 여기부터 복사해서 덮어씌우세요! ▼▼▼▼▼

// 1. 프로젝트의 '진짜 바닥(Root)' 위치를 기준으로 길을 찾습니다. (제일 안전함)
const rootPath = process.cwd(); 
const webPath = path.join(rootPath, 'web');

// 2. 옛날 방식(build)인지 요즘 방식(dist)인지 서버가 직접 확인합니다.
const distPath = path.join(webPath, 'dist');
const buildPath = path.join(webPath, 'build');

// 3. 있는 폴더를 선택! (dist가 있으면 dist, 아니면 build)
let finalPath = fs.existsSync(distPath) ? distPath : buildPath;

// 4. 화면 연결 (만약 폴더가 없으면 없다고 알려줌)
if (fs.existsSync(finalPath)) {
    console.log(`🍊 화면 파일 연결 성공! 경로: ${finalPath}`);
    app.use(express.static(finalPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(finalPath, 'index.html'));
    });
} else {
    console.log(`🚨 화면 파일(build/dist)을 못 찾겠어요. 현재 탐색 경로: ${webPath}`);
    // 화면이 없어도 서버가 죽지 않게 안내 문구 띄우기
    app.get('*', (req, res) => {
        res.send(`<h1>서버는 켜졌는데 build/dist 폴더가 없어요! (경로: ${webPath})</h1>`);
    });
}

// ▲▲▲▲▲ 여기까지! ▲▲▲▲▲
}

// ---------------------------------------------------------
// 🏁 서버 시작
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 활기차게 돌아가고 있어!`);
});