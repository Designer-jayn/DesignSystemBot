import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from "jwt-decode";
import { calculatePalette } from './utils';
// 아이콘들 (설정, 로그아웃, 달, 해 포함)
import { Trash2, Plus, Save, User, Send, Folder, MoreHorizontal, Edit3, Copy, Loader2, X, Settings, LogOut, Moon, Sun, Check } from 'lucide-react'; 
import './App.css'; 

const CLIENT_ID = "997761035180-ho629l7o1e8ec1qhkmp6ona5mll5nbb5.apps.googleusercontent.com"; 

function App() {
  // --- [상태 관리: 유저 & 프로젝트] ---
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('designBotUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [projects, setProjects] = useState({ "기본 프로젝트": [] });
  const [activeProject, setActiveProject] = useState("기본 프로젝트");
  
  // --- [상태 관리: 입력 & UI] ---
  const [inputHex, setInputHex] = useState("");
  const [loading, setLoading] = useState(false); 
  const [showSpacingOptions, setShowSpacingOptions] = useState(false); 
  const [selectedPlatforms, setSelectedPlatforms] = useState([]); 
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const [isRenaming, setIsRenaming] = useState(null);     
  const [renameInput, setRenameInput] = useState("");     
  
  // --- [상태 관리: 새로 추가된 설정 기능] ---
  const [showProfileMenu, setShowProfileMenu] = useState(false); // 프로필 메뉴 토글
  const [showSettingsModal, setShowSettingsModal] = useState(false); // 설정 모달 토글
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'dark'); // 테마
  const [newNameInput, setNewNameInput] = useState(""); // 이름 변경 입력
  
  const scrollRef = useRef(null);
  const [toast, setToast] = useState(null);

  // --- [Effects] ---
  // 1. 유저 데이터 불러오기
  useEffect(() => {
    if (user && user.email) fetchUserData(user.email);
  }, [user]);

  // 2. 테마 적용 (body 태그에 클래스 추가)
  useEffect(() => {
    document.body.className = theme;
    localStorage.setItem('appTheme', theme);
  }, [theme]);

  // 3. 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [loading, activeProject, showSpacingOptions]);


  // --- [기능: 로그인 & 로그아웃] ---
  const handleLoginSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      console.log("로그인 성공!", decoded); // 확인용 로그
      setUser(decoded);
      localStorage.setItem('designBotUser', JSON.stringify(decoded)); 
      fetchUserData(decoded.email);
    } catch (error) {
      console.error("로그인 해독 실패", error);
    }
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setShowProfileMenu(false);
    setProjects({ "기본 프로젝트": [] });
    localStorage.removeItem('designBotUser'); 
  };

  const fetchUserData = async (email) => {
    try {
      const res = await axios.get(`https://designsystem.up.railway.app/api/projects/${email}`);
      setProjects(res.data || { "기본 프로젝트": [] });
    } catch (err) { console.error(err); }
  };

  // --- [기능: 설정 (이름 변경)] ---
  const handleUpdateName = () => {
    if (!newNameInput.trim()) return;
    const updatedUser = { ...user, name: newNameInput };
    setUser(updatedUser);
    localStorage.setItem('designBotUser', JSON.stringify(updatedUser));
    setToast("이름이 변경되었습니다.");
    setTimeout(() => setToast(null), 2000);
  };

  // --- [기능: 프로젝트 관리] ---
  const deleteProject = async (projectName, e) => {
    e.stopPropagation(); 
    if (Object.keys(projects).length === 1) {
      alert("최소 하나의 프로젝트는 있어야 합니다.");
      return;
    }
    if (!window.confirm(`'${projectName}' 프로젝트를 삭제하시겠습니까?`)) return;

    const updatedProjects = { ...projects };
    delete updatedProjects[projectName];

    if (activeProject === projectName) setActiveProject(Object.keys(updatedProjects)[0]);
    setProjects(updatedProjects);
    setDropdownOpen(null);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
  };

  const startRenaming = (projectName, e) => {
    e.stopPropagation();
    setIsRenaming(projectName);
    setRenameInput(projectName);
    setDropdownOpen(null); 
  };

  const saveRename = async () => {
    if (!renameInput || renameInput === isRenaming) { setIsRenaming(null); return; }
    const updated = { ...projects };
    updated[renameInput] = updated[isRenaming];
    delete updated[isRenaming];
    setProjects(updated);
    setActiveProject(renameInput); 
    setIsRenaming(null);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updated });
  };

  const startNewProject = () => {
    setActiveProject(null); 
    setDropdownOpen(null);
    setIsRenaming(null);
    setShowSpacingOptions(false);
    setInputHex("");
  };

  // --- [기능: 컬러 & Spacing 생성] ---
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

    let currentProjectName = activeProject;
    let newProjectsState = { ...projects };

    if (!currentProjectName) {
        let counter = 1;
        while (newProjectsState[`새 프로젝트 ${counter}`]) { counter++; }
        currentProjectName = `새 프로젝트 ${counter}`;
        newProjectsState[currentProjectName] = []; 
    }

    const newData = { 
        id: Date.now(), userInput: formattedHex, name: aiName, palette: palette, 
        target: targetLevel, isBookmarked: false, type: 'color' 
    };

    const projectList = newProjectsState[currentProjectName] || [];
    newProjectsState[currentProjectName] = [newData, ...projectList];

    setProjects(newProjectsState);
    setActiveProject(currentProjectName); 
    setLoading(false); 
    setInputHex("");

    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: newProjectsState });
  };

  const togglePlatform = (type) => {
    if (type === 'all') setSelectedPlatforms(['all']); 
    else {
      setSelectedPlatforms(prev => {
        const filtered = prev.filter(p => p !== 'all'); 
        if (filtered.includes(type)) return filtered.filter(p => p !== type);
        return [...filtered, type];
      });
    }
  };

  const generateSpacingTokens = async () => {
    if (selectedPlatforms.length === 0) return;
    setLoading(true);
    setShowSpacingOptions(false);
    
    let maxStep = 9; 
    if (selectedPlatforms.includes('all') || selectedPlatforms.includes('pc')) maxStep = 15; 
    else if (selectedPlatforms.includes('tablet')) maxStep = 12; 

    const newPalette = [];
    newPalette.push({ level: 'sp0.5', value: 2, isVisible: true });
    for (let i = 1; i <= maxStep; i++) newPalette.push({ level: `sp${i}`, value: i * 4, isVisible: true });
    if (selectedPlatforms.includes('all') || selectedPlatforms.includes('pc')) {
        newPalette.push({ level: 'sp20', value: 80, isVisible: true });
        newPalette.push({ level: 'sp25', value: 100, isVisible: true });
    }

    const updated = { ...projects };
    const curName = activeProject || "새 프로젝트";
    if (!updated[curName]) updated[curName] = [];
    
    const newData = { 
        id: Date.now(), userInput: `Spacing 요청`, name: `Spacing System`, 
        palette: newPalette, type: 'spacing', isBookmarked: false 
    };
    updated[curName] = [newData, ...updated[curName]];
    setProjects(updated);
    setLoading(false);
    setSelectedPlatforms([]);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updated });
  };

  // --- [기능: 보관함 및 유틸] ---
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setToast(`복사 완료! ${text}`);
    setTimeout(() => setToast(null), 2000);
  };

  const addToVault = async (itemIndex) => {
    const updated = { ...projects };
    const items = [...updated[activeProject]];
    if (items[itemIndex].isBookmarked) {
        setToast("이미 보관함에 있습니다.");
        setTimeout(() => setToast(null), 2000);
        return;
    }
    // 강제 보임 처리
    items[itemIndex].palette = items[itemIndex].palette.map(chip => ({ ...chip, isVisible: true }));
    items[itemIndex].isBookmarked = true;
    updated[activeProject] = items;
    setProjects(updated);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updated });
    setToast("보관함에 추가되었습니다!");
    setTimeout(() => setToast(null), 2000);
  };

  const removeColorFromVault = async (itemIndex) => {
    const updated = { ...projects };
    const items = [...updated[activeProject]];
    items[itemIndex].isBookmarked = false; 
    updated[activeProject] = items;
    setProjects(updated);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updated });
  };

  const removeAllSpacingFromVault = async () => {
    if (!window.confirm("Spacing 토큰을 모두 제거하시겠습니까?")) return;
    const updated = { ...projects };
    const items = [...updated[activeProject]];
    items.forEach(item => { if (item.type === 'spacing') item.isBookmarked = false; });
    updated[activeProject] = items;
    setProjects(updated);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updated });
  };

  const toggleColorVisibility = async (itemIndex, colorIndex) => {
    const updated = { ...projects };
    const items = [...updated[activeProject]];
    const updatedPalette = [...items[itemIndex].palette];
    updatedPalette[colorIndex].isVisible = updatedPalette[colorIndex].isVisible === false;
    items[itemIndex].palette = updatedPalette;
    updated[activeProject] = items;
    setProjects(updated);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updated });
  };

  // --- [화면 렌더링용 변수 정리] ---
  const historyList = projects[activeProject] || [];
  const displayHistory = [...historyList].reverse(); 
  const bookmarkedList = historyList.filter(item => item.isBookmarked);
  const spacingBookmarks = bookmarkedList.filter(i => i.type === 'spacing');
  const colorBookmarks = bookmarkedList.filter(i => i.type !== 'spacing');
  const mergedSpacingChips = [];
  const seenLevels = new Set();
  
  spacingBookmarks.forEach((item) => {
    const realIndex = historyList.indexOf(item); 
    item.palette.forEach((chip, cIdx) => {
        if (!seenLevels.has(chip.level)) {
            seenLevels.add(chip.level);
            mergedSpacingChips.push({ ...chip, realIndex, cIdx });
        }
    });
  });
  mergedSpacingChips.sort((a, b) => a.value - b.value);


  // --- [▼▼▼ 화면 그리기 (JSX) ▼▼▼] ---
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <div className={`app-container ${theme}`}>
        {toast && <div className="toast-notification"><Copy size={16} /> {toast}</div>}

        {/* 1. 설정 팝업창 (모달) */}
        {showSettingsModal && (
          <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>⚙️ 설정</h3>
                <button className="close-btn" onClick={() => setShowSettingsModal(false)}><X size={20}/></button>
              </div>
              
              {/* 이름 변경 */}
              <div className="setting-section">
                <label>내 프로필 편집</label>
                <div className="input-group">
                  <input 
                    value={newNameInput} 
                    onChange={e => setNewNameInput(e.target.value)} 
                    placeholder={user?.name || "이름 입력"} 
                  />
                  <button onClick={handleUpdateName}><Check size={16}/> 저장</button>
                </div>
              </div>

              {/* 테마 변경 */}
              <div className="setting-section">
                <label>테마 설정</label>
                <div className="theme-toggle">
                  <button className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
                    <Sun size={18} /> 라이트
                  </button>
                  <button className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
                    <Moon size={18} /> 다크
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. 사이드바 */}
        <div className="sidebar">
          <div className="sidebar-top">
            <div className="logo-area" onClick={() => setActiveProject(null)} style={{cursor: 'pointer'}}>
                <h1>🎨 디자인 시스템 봇</h1>
            </div>
            <button className="new-chat-btn" onClick={startNewProject}>
                <Plus size={16} /> 새로운 프로젝트 추가
            </button>
            
            <div className="project-list-area">
              <div className="list-title">나의 디자인시스템</div>
              <div className="project-items">
                {Object.keys(projects).map(p => (
                  <div key={p} className={`project-item-group ${activeProject === p ? 'active' : ''}`} onClick={() => setActiveProject(p)}>
                    {isRenaming === p ? (
                      <div className="rename-container" onClick={(e) => e.stopPropagation()}>
                        <input className="rename-input" value={renameInput} onChange={(e) => setRenameInput(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); }} />
                        <button className="rename-save-btn" onClick={saveRename}><Save size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <div className="project-name-wrapper"><Folder size={16} /><span className="truncate">{p}</span></div>
                        <button className="action-btn" onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === p ? null : p); }}>
                          <MoreHorizontal size={16} />
                        </button>
                        {dropdownOpen === p && (
                          <div className="dropdown-menu" onMouseLeave={() => setDropdownOpen(null)}>
                            <button onClick={(e) => startRenaming(p, e)}><Edit3 size={14} /> 이름 변경</button>
                            <button className="delete-opt" onClick={(e) => deleteProject(p, e)}><Trash2 size={14} /> 삭제</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 🔥 프로필 & 메뉴 영역 */}
          <div className="user-profile">
            {!user ? (
              <div style={{display:'flex', justifyContent:'center', padding:'10px'}}>
                  <GoogleLogin onSuccess={handleLoginSuccess} onError={() => console.log('Login Fail')} />
              </div>
            ) : (
              <div className="profile-wrapper">
                <div className="user-info-box" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                  {user.picture ? <img src={user.picture} alt="u" /> : <div style={{width:32, height:32, background:'#555', borderRadius:'50%'}}></div>}
                  <span className="user-name">{user.name}</span>
                  <Settings size={16} style={{marginLeft: 'auto', opacity: 0.5}}/>
                </div>

                {showProfileMenu && (
                  <div className="profile-dropdown">
                    <button onClick={() => { setShowSettingsModal(true); setShowProfileMenu(false); }}>
                      <Settings size={14} /> 설정
                    </button>
                    <button onClick={handleLogout} className="logout-opt">
                      <LogOut size={14} /> 로그아웃
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. 메인 채팅 영역 */}
        <div className="main-content">
          <main className="chat-area">
            {!activeProject ? (
                <div className="welcome-screen">
                    <h2>새로운 프로젝트를 시작하세요!<br />HEX 코드나 Spacing을 입력하세요.</h2>
                </div>
            ) : (
                displayHistory.map((item, idx) => {
                    const originalIndex = historyList.length - 1 - idx;
                    return (
                        <div key={item.id || idx} className="history-item-group">
                            <div className="user-message"><div className="bubble">{item.userInput}</div></div>
                            <div className="bot-response">
                                <div className="bot-avatar">🤖</div>
                                <div className="response-card" style={{borderColor: item.isBookmarked ? '#3b82f6' : '#333'}}>
                                    <div className="card-header">
                                        <h4>{item.name}</h4>
                                        <button onClick={() => addToVault(originalIndex)} className="save-button">저장</button>
                                    </div>
                                    <div className="palette-grid">
                                        {item.palette.map((c, i) => (
                                            <div key={i} className="color-item" onClick={() => copyToClipboard(c.hex || `${c.value}px`)}>
                                                <div className="color-box" style={{ backgroundColor: c.hex || '#3e3e44' }}>
                                                    {!c.hex && <span style={{fontSize:10, color:'#aaa'}}>{c.value}</span>}
                                                </div>
                                                <span className="level-text">{c.level}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}

            {showSpacingOptions && (
                <div className="bot-response">
                    <div className="bot-avatar">🤖</div>
                    <div className="response-card spacing-selection-card">
                        <p>어떤 환경인가요?</p>
                        <div className="flex-wrap" style={{display:'flex', gap:5, marginBottom:10}}>
                            {['pc', 'tablet', 'mobile', 'all'].map(t => (
                                <button key={t} className={`option-btn ${selectedPlatforms.includes(t)?'active':''}`} onClick={()=>togglePlatform(t)}>{t.toUpperCase()}</button>
                            ))}
                        </div>
                        <button className="generate-spacing-btn" onClick={generateSpacingTokens}>생성하기</button>
                    </div>
                </div>
            )}
            
            {loading && <div className="loading-bubble"><Loader2 className="animate-spin" size={16}/> 생각 중...</div>}
            <div ref={scrollRef}></div>
          </main>

          <div className="input-area">
            <form onSubmit={handleGenerate} className="input-form">
              <input placeholder="HEX 코드(#000000) 또는 'Spacing' 입력" value={inputHex} onChange={(e) => setInputHex(e.target.value)} />
              <button type="submit"><Send size={20} /></button>
            </form>
          </div>
        </div>

        {/* 4. 보관함 사이드바 */}
        <div className="vault-sidebar">
            <h3>🗂️ 보관함</h3>
            {mergedSpacingChips.length > 0 && (
                <div className="vault-item">
                    <div className="vault-header"><h4>Spacing</h4><button onClick={removeAllSpacingFromVault}><Trash2 size={12}/></button></div>
                    <div className="vault-palette-grid">
                        {mergedSpacingChips.map((c, i) => c.isVisible !== false && (
                            <div key={i} className="vault-chip" onClick={() => copyToClipboard(`${c.value}px`)}>
                                <span style={{fontSize:10}}>{c.level}</span>
                                <div className="overlay" onClick={(e)=>{e.stopPropagation(); toggleColorVisibility(c.realIndex, c.cIdx)}}><X size={12}/></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {colorBookmarks.map((item, idx) => {
                const realIndex = historyList.indexOf(item);
                return (
                    <div key={idx} className="vault-item">
                        <div className="vault-header"><h4>{item.name}</h4><button onClick={()=>removeColorFromVault(realIndex)}><Trash2 size={12}/></button></div>
                        <div className="vault-palette-grid">
                            {item.palette.map((c, ci) => c.isVisible !== false && (
                                <div key={ci} className="vault-chip" style={{backgroundColor: c.hex}} onClick={() => copyToClipboard(c.hex)}>
                                    <div className="overlay" onClick={(e)=>{e.stopPropagation(); toggleColorVisibility(realIndex, ci)}}><X size={12} color="white"/></div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;