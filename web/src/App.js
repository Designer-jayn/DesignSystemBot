import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import { calculatePalette } from './utils';
import { Trash2, Plus, Save, User, Send, Folder, MoreHorizontal, Edit3, Star, Copy, Loader2, X } from 'lucide-react'; 
import './App.css'; 

const CLIENT_ID = "997761035180-ho629l7o1e8ec1qhkmp6ona5mll5nbb5.apps.googleusercontent.com"; 

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('designBotUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [projects, setProjects] = useState({ "기본 프로젝트": [] });
  const [activeProject, setActiveProject] = useState("기본 프로젝트");
  const [inputHex, setInputHex] = useState("");
  const [loading, setLoading] = useState(false); 
  const [showSpacingOptions, setShowSpacingOptions] = useState(false); 
  const [selectedPlatforms, setSelectedPlatforms] = useState([]); 
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const [isRenaming, setIsRenaming] = useState(null);
  const [renameInput, setRenameInput] = useState("");
  
  const scrollRef = useRef(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (user && user.email) fetchUserData(user.email);
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, activeProject, showSpacingOptions]);

  const handleLoginSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    setUser(decoded);
    localStorage.setItem('designBotUser', JSON.stringify(decoded)); 
    fetchUserData(decoded.email);
  };

  const fetchUserData = async (email) => {
    try {
      const res = await axios.get(`https://designsystem.up.railway.app/api/projects/${email}`);
      setProjects(res.data || { "기본 프로젝트": [] });
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setProjects({ "기본 프로젝트": [] });
    localStorage.removeItem('designBotUser'); 
  };

  const startNewProject = () => {
    setActiveProject(null);
    setDropdownOpen(null);
    setIsRenaming(null);
    setShowSpacingOptions(false);
    setInputHex("");
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!inputHex) return;

    if (inputHex.toLowerCase().includes("spacing") || inputHex.includes("스페이싱")) {
      setShowSpacingOptions(true); 
      setSelectedPlatforms([]); 
      setInputHex("");
      return;
    }
    
    setLoading(true);
    const formattedHex = inputHex.startsWith("#") ? inputHex : "#" + inputHex;
    const { palette, targetLevel } = calculatePalette(formattedHex);
    
    let aiName = `Color-${formattedHex}`;
    try {
      const res = await axios.post('https://designsystem.up.railway.app/api/ai-naming', { hex: formattedHex });
      aiName = res.data.name;
    } catch (err) { console.error(err); }

    const updatedProjects = { ...projects };
    let currentP = activeProject || "새 프로젝트";
    if (!updatedProjects[currentP]) updatedProjects[currentP] = [];

    const newData = { 
        id: Date.now(),
        userInput: formattedHex,
        name: aiName, 
        palette: palette, 
        type: 'color',
        isBookmarked: false 
    };

    updatedProjects[currentP] = [newData, ...updatedProjects[currentP]];
    setProjects(updatedProjects);
    setActiveProject(currentP);
    setLoading(false); 
    setInputHex("");

    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setToast(`복사 완료! ${text}`);
    setTimeout(() => setToast(null), 2000);
  };

  const historyList = activeProject ? (projects[activeProject] || []) : [];
  const displayHistory = [...historyList].reverse(); 

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <div className="app-container">
        {toast && <div className="toast-notification">{toast}</div>}

        <div className="sidebar">
          <div className="sidebar-top">
            <div className="logo-area" onClick={startNewProject} style={{ cursor: 'pointer' }}>
              <h1>🎨 디자인 시스템 봇</h1>
            </div>
            <button className="new-chat-btn" onClick={startNewProject}>
              <Plus size={16} /> 새로운 프로젝트 추가
            </button>
          </div>

          <div className="user-profile">
            {!user ? (
              <GoogleLogin onSuccess={handleLoginSuccess} onError={() => console.log('Login Failed')} />
            ) : (
              <div className="user-info-box">
                {user.picture && <img src={user.picture} alt="p" className="user-img" />}
                <p>{user.name}님</p>
                <button onClick={handleLogout} className="logout-btn">로그아웃</button>
              </div>
            )}
          </div>
        </div>

        <div className="main-content">
          <main className="chat-area">
            {!activeProject ? (
              <div className="welcome">컬러 HEX 코드나 Spacing을 입력하세요.</div>
            ) : (
              displayHistory.map((item, idx) => (
                <div key={item.id || idx} className="bot-response">
                  <div className="response-card">
                    <h4>{item.name}</h4>
                    <div className="palette-grid">
                      {item.palette.map((color, i) => (
                        <div key={i} className="color-item" onClick={() => copyToClipboard(color.hex)}>
                          <div className="color-box" style={{ backgroundColor: color.hex }}></div>
                          <span>{color.level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={scrollRef}></div>
          </main>

          <div className="input-area">
            <form onSubmit={handleGenerate} className="input-form">
              <input placeholder="HEX 코드 입력" value={inputHex} onChange={(e) => setInputHex(e.target.value)} />
              <button type="submit"><Send size={20} /></button>
            </form>
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;