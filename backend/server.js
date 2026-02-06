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

// 1. [작명가 AI] 색상 이름 짓기 (창의성 0, 단답형)
app.post('/api/ai-naming', async (req, res) => {
    const { hex } = req.body;
    console.log(`🎨 작명 요청: ${hex}`);

    try {
        if (BEST_MODEL_URL) {
            // 📝 작명가 전용 프롬프트
            const prompt = `
                You are a UI/UX Design Expert.
                Analyze the HEX color code: ${hex}
                
                Task: Create ONE professional, concise English color name.
                
                Rules:
                1. No abstract names like "Whispering Mist".
                2. Use noun-based or descriptive names (e.g., Cobalt, Slate, Sage, Amber).
                3. JUST return the name. No explanation.
            `;

            const response = await axios.post(
                BEST_MODEL_URL, 
                { 
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0, // 항상 같은 대답
                        maxOutputTokens: 20
                    }
                }
            );

            const aiName = response.data.candidates[0].content.parts[0].text.trim().replace(/["'\n]/g, "");
            console.log(`🤖 AI 작명: ${aiName}`);
            return res.json({ name: aiName });
        } 
        throw new Error("AI 연결 안됨");
    } catch (error) { 
        const names = namer(hex);
        const fallbackName = names.pantone[0].name;
        console.log(`📚 라이브러리 작명: ${fallbackName}`);
        return res.json({ name: fallbackName }); 
    }
});

// 2. [상담원 AI] 채팅 기능 (창의성 있음, 데이터 조회 가능)
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    try {
        if (BEST_MODEL_URL) {
            // 📝 상담원 전용 프롬프트 (여기에 생략된 부분을 다 채워넣었습니다!)
            const promptText = `
                Role: 당신은 친절하고 전문적인 'UI/UX 디자인 시스템 컨설턴트'입니다.
                
                Context:
                사용자는 현재 웹사이트에서 디자인 시스템(컬러, Spacing)을 관리하고 있습니다.
                아래 JSON 데이터는 사용자가 현재 저장한 프로젝트 목록입니다.
                
                [사용자 데이터]
                ${JSON.stringify(readData())}

                [사용자 질문]
                ${message}

                Instructions:
                1. 사용자의 질문에 대해 [사용자 데이터]를 참고하여 구체적으로 답변하세요.
                (예: "현재 저장된 'Blue' 컬러와 어울리는..." 처럼 구체적으로 언급)
                2. 데이터에 없는 내용은 일반적인 디자인 지식으로 답변하세요.
                3. 말투는 정중하고, 전문 용어를 쉽게 풀어서 설명해주세요.
                4. 답변은 한국어로 하세요.
            `;

            const response = await axios.post(BEST_MODEL_URL, { contents: [{ parts: [{ text: promptText }] }] });
            
            console.log("🤖 채팅 응답 완료");
            return res.json({ response: response.data.candidates[0].content.parts[0].text });
        }
        throw new Error("AI 연결 안됨");
    } catch (error) { 
        console.error("❌ 채팅 에러:", error.message);
        return res.status(500).json({ response: "죄송합니다. AI 연결에 문제가 생겼어요." }); 
    }
});

app.get('/api/projects/:email', (req, res) => { res.json(readData()[req.params.email] || { "기본 프로젝트": [] }); });
app.post('/api/projects', (req, res) => { const { email, projects } = req.body; const data = readData(); data[email] = projects; writeData(data); res.json({ success: true }); });


// ---------------------------------------------------------
// 🕵️‍♀️ [최종 해결] Railway용 경로 고정 설정
// ---------------------------------------------------------
const clientBuildPath = path.join(__dirname, '../web/build');
console.log(`🍊 화면 파일 경로: ${clientBuildPath}`);

app.use(express.static(clientBuildPath));
app.use('/static', express.static(path.join(clientBuildPath, 'static')));

app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// ---------------------------------------------------------
// 🏁 서버 시작
// ---------------------------------------------------------
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 활기차게 돌아가고 있어!`);
});