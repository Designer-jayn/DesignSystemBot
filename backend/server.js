const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); 
const namer = require('color-namer'); 
require('dotenv').config();

const app = express();
// const PORT = 5001; 


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

// 서버 시작할 때 구글한테 "나 뭐 쓸 수 있어?" 물어보는 함수
const findBestModel = async () => {
    if (!process.env.GEMINI_API_KEY) return;
    
    try {
        console.log("🕵️‍♀️ 사용 가능한 AI 모델을 검색 중...");
        // 모델 리스트 요청
        const res = await axios.get(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
        );

        const models = res.data.models;
        // 'generateContent' 기능이 있고, 이름에 'gemini'가 들어가는 모델 찾기
        const validModels = models.filter(m => 
            m.supportedGenerationMethods.includes("generateContent") && 
            m.name.includes("gemini")
        );

        if (validModels.length > 0) {
            // 1순위: flash (빠름), 2순위: pro (똑똑함), 3순위: 아무거나
            let best = validModels.find(m => m.name.includes("flash")) || 
                       validModels.find(m => m.name.includes("pro")) || 
                       validModels[0];
            
            // models/gemini-pro 형태의 이름을 가져옴
            const modelName = best.name.replace("models/", "");
            
            // 최종 URL 확정
            BEST_MODEL_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;
            console.log(`🎉 찾았다! 이 모델을 사용합니다: [ ${modelName} ]`);
        } else {
            console.log("⚠️ 사용 가능한 Gemini 모델을 못 찾았습니다.");
        }
    } catch (e) {
        console.log("⚠️ 모델 검색 실패 (키 문제일 수도 있음):", e.response ? e.response.data : e.message);
    }
};

// 서버 켜지자마자 실행!
findBestModel();


// --- [API 1: AI 네이밍 (자동 감지된 모델 사용)] ---
app.post('/api/ai-naming', async (req, res) => {
    const { hex } = req.body;
    console.log(`🎨 작명 요청: ${hex}`);

    try {
        // 모델 URL이 준비되었는지 확인
        if (BEST_MODEL_URL) {
            console.log("✨ 감지된 AI 모델로 요청 보냄...");

            const promptText = `You are an expert UI/UX Designer.
Analyze the HEX code ${hex} deeply, focusing on its hue, saturation, and brightness.
Give me a **specific and descriptive** English color name.

[Rules]
1. **NEVER** return a single generic color name like 'Gray', 'Blue', 'Green', or 'Red'.
2. Capture the subtle undertone and nuance.
   - If it's a greenish gray, use names like 'Sage', 'Olive Gray', 'Moss'.
   - If it's a brownish gray, use 'Taupe', 'Stone', 'Warm Ash'.
   - If it's a bluish gray, use 'Slate', 'Cool Concrete'.
3. Keep it professional but distinct (suitable for a design system token).
4. Reply ONLY with the name (no punctuation).`;

            const response = await axios.post(
                BEST_MODEL_URL,
                {
                    contents: [{ parts: [{ text: promptText }] }]
                },
                { headers: { 'Content-Type': 'application/json' } }
            );

            // 응답 추출
            if (response.data.candidates && response.data.candidates.length > 0) {
                const aiName = response.data.candidates[0].content.parts[0].text.trim().replace(/["'\n]/g, "");
                console.log(`✅ AI 작명 성공: ${aiName}`);
                return res.json({ name: aiName });
            }
        } 
        
        throw new Error("AI 모델 준비 안됨");

    } catch (error) {
        console.error("⚠️ AI 실패:", error.response ? error.response.data : error.message);
        const names = namer(hex);
        const backupName = names.pantone[0].name; 
        console.log(`✅ 무료 작명 성공: ${backupName}`);
        return res.json({ name: backupName });
    }
});

// --- [나머지 API 유지] ---
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

