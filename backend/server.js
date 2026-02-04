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
 // ▼▼▼▼▼ 여기부터 복사해서 덮어씌우세요! (조건문 제거 버전) ▼▼▼▼▼

// 1. 경로 설정 (CWD 기준)
const rootPath = process.cwd();
const webPath = path.join(rootPath, 'web');
const distPath = path.join(webPath, 'dist');
const buildPath = path.join(webPath, 'build');

// 2. 어떤 폴더가 있는지 확인 (로그로 범인 찾기)
const hasDist = fs.existsSync(distPath);
const hasBuild = fs.existsSync(buildPath);

// 3. 폴더 선택 (dist 우선, 없으면 build)
const finalPath = hasDist ? distPath : buildPath;

console.log(`📂 경로 확인중...`);
console.log(`- web 폴더: ${webPath}`);
console.log(`- dist 존재여부: ${hasDist}`);
console.log(`- build 존재여부: ${hasBuild}`);

// 4. [중요] 정적 파일 연결 (폴더가 있을 때만)
if (hasDist || hasBuild) {
    app.use(express.static(finalPath));
}

// 5. [핵심] 무엇이든 들어오면 무조건 응답하기 (Cannot GET / 해결사)
app.get('*', (req, res) => {
    if (hasDist || hasBuild) {
        // 화면 파일이 있으면 보여줌
        res.sendFile(path.join(finalPath, 'index.html'));
    } else {
        // 화면 파일이 없으면 '없다'고 글자라도 보여줌 (이제 흰 화면 안 나옴!)
        res.status(404).send(`
            <h1>서버는 켜졌는데 화면 파일이 없어요! ㅠㅠ</h1>
            <p>현재 경로: ${rootPath}</p>
            <p>확인된 web 폴더: ${webPath}</p>
            <p>빌드 폴더 상태 -> dist: ${hasDist}, build: ${hasBuild}</p>
            <p><b>해결법:</b> package.json의 build 명령어가 제대로 돌았는지 확인해주세요.</p>
        `);
    }
});

// ▲▲▲▲▲ 여기까지! ▲▲▲▲▲
}

// ---------------------------------------------------------
// 🏁 서버 시작
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 활기차게 돌아가고 있어!`);
});