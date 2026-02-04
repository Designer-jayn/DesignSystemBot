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

// 3. 빌드 폴더(dist 또는 build) 찾기
let clientBuildPath = null;
if (finalWebPath) {
    const dist = path.join(finalWebPath, 'dist');
    const build = path.join(finalWebPath, 'build');
    
    if (fs.existsSync(dist)) clientBuildPath = dist;
    else if (fs.existsSync(build)) clientBuildPath = build;
}

// 4. 화면 연결 (찾았으면 연결, 못 찾았으면 안내)
if (clientBuildPath) {
    console.log(`🍊 화면 파일 연결 성공! 경로: ${clientBuildPath}`);
    app.use(express.static(clientBuildPath));
    
    // 어떤 주소로 들어와도 index.html 보여주기
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
} else {
    console.log(`🚨 화면 파일을 못 찾았습니다.`);
    
    // 디버깅용: 주변에 무슨 파일이 있는지 조회
    let debugInfo = "";
    try {
        debugInfo += `<b>[현재 폴더 파일들]:</b> ${fs.readdirSync(currentDir).join(', ')}<br>`;
        debugInfo += `<b>[부모 폴더 파일들]:</b> ${fs.readdirSync(parentDir).join(', ')}`;
    } catch (e) { debugInfo = "파일 목록 조회 실패"; }

    // 화면에 '왜 안되는지' 리포트 출력
    app.get('*', (req, res) => {
        res.status(404).send(`
            <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                <h1>🚧 화면 파일(build/dist)을 못 찾았어요!</h1>
                <hr />
                <h3>🕵️‍♀️ 탐색 결과 리포트</h3>
                <ul>
                    <li><b>web 폴더 발견 여부:</b> ${finalWebPath ? '✅ 찾음 (' + finalWebPath + ')' : '❌ 못 찾음 (서버에 web 폴더가 안 왔어요!)'}</li>
                    <li><b>빌드 폴더(dist/build) 상태:</b> ${clientBuildPath ? '✅ 있음' : '❌ 없음 (빌드 명령어가 실패했거나 실행 안 됨)'}</li>
                </ul>
                <hr />
                <h3>📂 서버 주변 파일 목록 (범인 찾기용)</h3>
                <p>${debugInfo}</p>
            </div>
        `);
    });
}

// ---------------------------------------------------------
// 🏁 서버 시작
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 활기차게 돌아가고 있어!`);
});