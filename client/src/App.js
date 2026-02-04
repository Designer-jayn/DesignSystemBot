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
  const [dropdownOpen, setDropdownOpen] = useState(null); // 어떤 프로젝트의 메뉴가 열렸는지 (프로젝트명 저장)
const [isRenaming, setIsRenaming] = useState(null);     // 어떤 프로젝트 이름을 수정 중인지
const [renameInput, setRenameInput] = useState("");     // 수정할 이름 입력값
  
  const scrollRef = useRef(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (user && user.email) fetchUserData(user.email);
  }, [user]);

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
        // 💡 로딩 상태가 변하거나(대화 생성 시), 방을 옮기거나, 옵션창이 뜰 때만 스크롤!
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, activeProject, showSpacingOptions]); // 👈 projects를 뺐습니다!

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
  // 프로젝트 삭제 핸들러
  const deleteProject = async (projectName, e) => {
    e.stopPropagation(); // 부모 클릭 방지
    if (Object.keys(projects).length === 1) {
      alert("최소 하나의 프로젝트는 있어야 합니다.");
      return;
    }
    if (!window.confirm(`'${projectName}' 프로젝트를 삭제하시겠습니까?`)) return;

    const updatedProjects = { ...projects };
    delete updatedProjects[projectName];

    // 만약 삭제한게 현재 보고있는 프로젝트라면 다른걸로 변경
    if (activeProject === projectName) {
      setActiveProject(Object.keys(updatedProjects)[0]);
    }

    setProjects(updatedProjects);
    setDropdownOpen(null);
    // 백엔드 저장
    // await axios.post('http://localhost:5001/api/projects', { email: user.email, projects: updatedProjects });
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
  };


  // 이름 수정 모드 진입
  const startRenaming = (projectName, e) => {
    e.stopPropagation();
    setIsRenaming(projectName);
    setRenameInput(projectName);
    setDropdownOpen(null); // 메뉴 닫기
    
  };

  // 이름 수정 저장
  const saveRename = async () => {
    if (!renameInput || renameInput === isRenaming) {
      setIsRenaming(null);
      return;
    }
    
    // 키 이름 변경 (기존 데이터 복사 -> 새 키 생성 -> 기존 키 삭제)
    const updatedProjects = { ...projects };
    updatedProjects[renameInput] = updatedProjects[isRenaming];
    delete updatedProjects[isRenaming];

    setProjects(updatedProjects);
    setActiveProject(renameInput); // 활성 프로젝트 명도 업데이트
    setIsRenaming(null);
    
    // 백엔드 저장
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
  };

  // 새 프로젝트(새 채팅) 모드로 진입
  const startNewProject = () => {
    setActiveProject(null); // null이면 '새 프로젝트 대기 상태'로 간주
    setDropdownOpen(null);
    setIsRenaming(null);
    setShowSpacingOptions(false);
    setInputHex("");
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!inputHex) return;

    // Spacing 옵션 처리 (기존 동일)
    if (inputHex.toLowerCase().includes("spacing") || inputHex.includes("스페이싱")) {
      setShowSpacingOptions(true); 
      setSelectedPlatforms([]); 
      setInputHex("");
      return;
    }
    
    // 유효성 검사 (기존 동일)
    const hexRegex = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    if (!hexRegex.test(inputHex)) {
        alert("HEX 코드 또는 'Spacing'을 입력해주세요.");
        return;
    }

    setLoading(true);
    const formattedHex = inputHex.startsWith("#") ? inputHex : "#" + inputHex;
    const { palette, targetLevel } = calculatePalette(formattedHex);
    
    // AI 이름 생성 (기존 동일)
    let aiName = `Color-${formattedHex}`;
    try {
      const res = await axios.post('https://designsystem.up.railway.app/api/ai-naming', { hex: formattedHex });
      aiName = res.data.name;
    } catch (err) { console.error(err); }

    // 🔥 [수정됨] 현재 활성 프로젝트가 없으면(새 채팅 모드면) 새 프로젝트 이름 생성
    let currentProjectName = activeProject;
    let newProjectsState = { ...projects };

    if (!currentProjectName) {
        // 이름 중복 방지: '새 프로젝트 1', '새 프로젝트 2'...
        let counter = 1;
        while (newProjectsState[`새 프로젝트 ${counter}`]) {
            counter++;
        }
        currentProjectName = `새 프로젝트 ${counter}`;
        newProjectsState[currentProjectName] = []; // 새 배열 생성
        // 여기서 미리 setProjects를 하지 않고, 아래 saveProjectData와 합쳐서 처리하거나
        // saveProjectData 함수를 약간 수정해서 처리합니다.
    }

    // 데이터 생성
    const newData = { 
        id: Date.now(),
        userInput: formattedHex,
        name: aiName, 
        palette: palette, 
        target: targetLevel,
        isBookmarked: false,
        type: 'color' 
    };

    // 저장 로직 (직접 구현 - 기존 saveProjectData 함수 대신 이 로직 사용 권장)
    // 왜냐하면 saveProjectData는 activeProject 상태를 의존하기 때문에 
    // 방금 만든 currentProjectName을 바로 반영하기 어려울 수 있음
    const projectList = newProjectsState[currentProjectName] || [];
    newProjectsState[currentProjectName] = [newData, ...projectList];

    setProjects(newProjectsState);
    setActiveProject(currentProjectName); // 방금 만든 프로젝트로 이동!
    setLoading(false); 
    setInputHex("");

    // 백엔드 저장
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: newProjectsState });
  };

  const togglePlatform = (type) => {
    if (type === 'all') {
      setSelectedPlatforms(['all']); 
    } else {
      setSelectedPlatforms(prev => {
        const filtered = prev.filter(p => p !== 'all'); 
        if (filtered.includes(type)) return filtered.filter(p => p !== type);
        return [...filtered, type];
      });
    }
  };

  const saveProjectData = async (dataToSave) => {
    const updatedProjects = { ...projects };
    const currentList = [dataToSave, ...(updatedProjects[activeProject] || [])];
    updatedProjects[activeProject] = currentList;
    setProjects(updatedProjects);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
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

    for (let i = 1; i <= maxStep; i++) {
        newPalette.push({ level: `sp${i}`, value: i * 4, isVisible: true });
    }

    if (selectedPlatforms.includes('all') || selectedPlatforms.includes('pc')) {
        newPalette.push({ level: 'sp20', value: 80, isVisible: true });
        newPalette.push({ level: 'sp25', value: 100, isVisible: true });
    }

    saveProjectData({ 
        id: Date.now(),
        userInput: `Spacing 요청 (${selectedPlatforms.join(', ')})`,
        name: `Spacing`, 
        palette: newPalette, 
        type: 'spacing',
        isBookmarked: false 
    });

    setLoading(false);
    setSelectedPlatforms([]);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setToast(`복사 완료! ${text}`);
    setTimeout(() => setToast(null), 2000);
  };

  // 🔥 [핵심 수정] 보관함 추가 시 '숨김 상태' 초기화!
  const addToVault = async (itemIndex) => {
    const updatedProjects = { ...projects };
    const items = [...updatedProjects[activeProject]];
    
    if (items[itemIndex].isBookmarked) {
        setToast("이미 보관함에 저장된 항목입니다.");
        setTimeout(() => setToast(null), 2000);
        return;
    }

    // 🔥 여기서 칩 상태를 '모두 보임'으로 리셋합니다!
    const resetPalette = items[itemIndex].palette.map(chip => ({
        ...chip,
        isVisible: true // 강제 보임 처리
    }));
    items[itemIndex].palette = resetPalette;

    items[itemIndex].isBookmarked = true;
    updatedProjects[activeProject] = items;
    setProjects(updatedProjects);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
    setToast("보관함에 추가되었습니다!");
    setTimeout(() => setToast(null), 2000);
  };

  const removeColorFromVault = async (itemIndex) => {
    const updatedProjects = { ...projects };
    const items = [...updatedProjects[activeProject]];
    items[itemIndex].isBookmarked = false; 
    updatedProjects[activeProject] = items;
    setProjects(updatedProjects);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
  };

  const removeAllSpacingFromVault = async () => {
    if (!window.confirm("보관함에서 모든 Spacing 토큰을 제거하시겠습니까?")) return;
    
    const updatedProjects = { ...projects };
    const items = [...updatedProjects[activeProject]];

    items.forEach(item => {
        if (item.type === 'spacing') {
            item.isBookmarked = false;
        }
    });

    updatedProjects[activeProject] = items;
    setProjects(updatedProjects);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
  };

  // 칩 개별 토글 (보관함 내부용)
  const toggleColorVisibility = async (itemIndex, colorIndex) => {
    const updatedProjects = { ...projects };
    const items = [...updatedProjects[activeProject]];
    const updatedPalette = [...items[itemIndex].palette];
    
    // 상태 반전
    const currentVis = updatedPalette[colorIndex].isVisible !== false;
    updatedPalette[colorIndex].isVisible = !currentVis;
    
    items[itemIndex].palette = updatedPalette;
    updatedProjects[activeProject] = items;
    setProjects(updatedProjects);
    await axios.post('https://designsystem.up.railway.app/api/projects', { email: user.email, projects: updatedProjects });
  };

  const historyList = projects[activeProject] || [];
  const displayHistory = [...historyList].reverse(); 
  const bookmarkedList = historyList.filter(item => item.isBookmarked);

  // 보관함 데이터 병합 로직
  const spacingBookmarks = bookmarkedList.filter(i => i.type === 'spacing');
  const colorBookmarks = bookmarkedList.filter(i => i.type !== 'spacing');

  const mergedSpacingChips = [];
  const seenLevels = new Set();
  
  // 중복 없이 병합
  spacingBookmarks.forEach((item) => {
    const realIndex = historyList.indexOf(item); 
    item.palette.forEach((chip, cIdx) => {
        if (!seenLevels.has(chip.level)) {
            seenLevels.add(chip.level);
            // 원본 위치 추적 (토글을 위해)
            mergedSpacingChips.push({ ...chip, realIndex, cIdx });
        }
    });
  });
  mergedSpacingChips.sort((a, b) => a.value - b.value);


  return (
    <div className="app-container">
      {toast && <div className="toast-notification"><Copy size={16} /> {toast}</div>}

      <div className="sidebar">
        <div className="sidebar-top">
            {/* 로고 영역 클릭 시 새 프로젝트 모드 */}
            <div className="logo-area" onClick={startNewProject} style={{cursor: 'pointer'}}>
                <h1>🎨 디자인 시스템 봇</h1>
            </div>
            
            {/* 명시적인 새 채팅 버튼 추가 (선택사항) */}
            <button className="new-chat-btn" onClick={startNewProject}>
                <Plus size={16} /> 새로운 프로젝트 추가
            </button>

            
<div className="project-list-area">
  <div className="list-title">나의 디자인시스템</div>
  <div className="project-items">
    {Object.keys(projects).map(p => (
      <div 
        key={p} 
        className={`project-item-group ${activeProject === p ? 'active' : ''}`} 
        onClick={() => setActiveProject(p)}
      >
        {/* 수정 모드일 때와 아닐 때를 분기 */}
        {isRenaming === p ? (
          <div className="rename-container" onClick={(e) => e.stopPropagation()}>
            <input 
              className="rename-input"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); }}
            />
            <button className="rename-save-btn" onClick={saveRename}>
              <Save size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="project-name-wrapper">
               <Folder size={16} /> 
               <span className="truncate">{p}</span>
            </div>
            
            {/* 쓰리닷 버튼 (호버 시 등장) */}
            <button 
              className="action-btn" 
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(dropdownOpen === p ? null : p);
              }}
            >
              <MoreHorizontal size={16} />
            </button>

            {/* 드롭다운 메뉴 */}
            {dropdownOpen === p && (
              <div className="dropdown-menu" onMouseLeave={() => setDropdownOpen(null)}>
                <button onClick={(e) => startRenaming(p, e)}>
                  <Edit3 size={14} /> 이름 변경
                </button>
                <button className="delete-opt" onClick={(e) => deleteProject(p, e)}>
                  <Trash2 size={14} /> 삭제
                </button>
              </div>
            )}
          </>
        )}
      </div>
    ))}
  </div>
</div>
        </div>
        <div className="user-profile">
            <div className="user-info">
                {user.picture && <img src={user.picture} alt="p" />}
                <div className="user-text"><p>{user.name}</p></div>
            </div>
            <button onClick={handleLogout} className="logout-btn">로그아웃</button>
        </div>
      </div>

      <div className="main-content">
        <main className="chat-area">
    {/* 1. activeProject가 없을 때 (새 채팅 모드) -> 웰컴 스크린 표시 */}
    {!activeProject ? (
        <div className="welcome-screen">
            <h2>
                새로운 프로젝트를 추가하시겠어요?<br />
                <span className="highlight-text">시스템에 필요한 컬러나 Spacing</span>을<br/>
                입력해주세요.
            </h2>
        </div>
    ) : (
        /* 2. activeProject가 있을 때 -> 기존 채팅 기록(Map) 표시 */
        displayHistory.map((item, idx) => {
            const originalIndex = historyList.length - 1 - idx;
            return (
                <div key={item.id || idx} className="history-item-group animate-fade-in-up">
                    {/* 유저 질문 */}
                    <div className="user-message">
                        <div className="bubble">{item.userInput}</div>
                    </div>
                    
                    {/* 봇 응답 */}
                    <div className="bot-response">
                        <div className="bot-avatar">🤖</div>
                        <div className="response-card" style={{borderColor: item.isBookmarked ? '#3b82f6' : '#374151'}}>
                            <div className="card-header">
                                <div className="tag-row">
                                    <span className="ai-tag">{item.type === 'spacing' ? 'Spacing' : 'Color'}</span>
                                    <h4 className="card-title">{item.name}</h4>
                                </div>
                                <button onClick={() => addToVault(originalIndex)} className="save-button">
                                    저장
                                </button>
                            </div>

                            {/* Spacing일 때 vs Color일 때 렌더링 분기 */}
                            {item.type === 'spacing' ? (
                                <div className="spacing-grid">
                                    {item.palette.map((sp, i) => (
                                        <div key={i} className="spacing-item" onClick={() => copyToClipboard(`${sp.value}px`)}>
                                            <div className="spacing-box"><p className="sp-label">{sp.level}</p> </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="palette-grid">
                                    {item.palette.map((color, i) => (
                                        <div key={i} className="color-item">
                                            <div className="color-box" style={{ backgroundColor: color.hex }} onClick={() => copyToClipboard(color.hex)}></div>
                                            <p className="level-text">{color.level}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        })
    )}

    {/* 3. 옵션 선택창 (Spacing 입력 시 등장) */}
    {showSpacingOptions && (
        <div className="bot-response animate-fade-in-up">
            <div className="bot-avatar">🤖</div>
            <div className="response-card spacing-selection-card">
                <p className="mb-4">어떤 프로젝트 인가요?</p>
                <div className="flex flex-wrap gap-3 mb-6">
                    <button className={`option-btn ${selectedPlatforms.includes('pc') ? 'active' : ''}`} onClick={() => togglePlatform('pc')}>PC</button>
                    <button className={`option-btn ${selectedPlatforms.includes('tablet') ? 'active' : ''}`} onClick={() => togglePlatform('tablet')}>Tablet</button>
                    <button className={`option-btn ${selectedPlatforms.includes('mobile') ? 'active' : ''}`} onClick={() => togglePlatform('mobile')}>Mobile</button>
                    <button className={`option-btn ${selectedPlatforms.includes('all') ? 'active' : ''}`} onClick={() => togglePlatform('all')}>모두 해당</button>
                </div>
                <button 
                    className={`generate-spacing-btn ${selectedPlatforms.length > 0 ? 'visible' : ''}`}
                    onClick={generateSpacingTokens}
                >
                    Spacing 토큰 생성하기
                </button>
            </div>
        </div>
    )}

    {/* 4. 로딩 및 스크롤 */}
    {loading && <div className="loading-bubble">생각 중...</div>}
    <div ref={scrollRef} style={{height: '1px'}}></div>
</main>
        
        <div className="input-area">
            <form onSubmit={handleGenerate} className="input-form">
                <input placeholder="HEX 코드 또는 'Spacing' 입력" value={inputHex} onChange={(e) => setInputHex(e.target.value)} />
                <button type="submit"><Send size={20} /></button>
            </form>
        </div>
      </div>

      <div className="vault-sidebar">
          <h3> 🗂️ 내 보관함</h3>
          <div className="vault-list">
            
            {/* Spacing 통합 카드 */}
            {mergedSpacingChips.length > 0 && (
                <div className="vault-item">
                    <div className="vault-header">
                        <h4>Spacing</h4>
                        <button onClick={removeAllSpacingFromVault} className="vault-remove-btn">제거</button>
                    </div>
                    <div className="vault-palette-grid">
                        {mergedSpacingChips.map((chip, idx) => (
                             <div key={idx} className="vault-chip-wrapper">
                                 {chip.isVisible !== false ? (
                                     <div className="vault-chip" style={{backgroundColor: '#3e3e44'}} onClick={() => copyToClipboard(`${chip.value}px`)}>
                                         <div className="vault-chip-overlay" onClick={(e) => {e.stopPropagation(); toggleColorVisibility(chip.realIndex, chip.cIdx);}}><X size={14} color="white"/></div>
                                     </div>
                                 ) : (
                                     <button className="vault-chip-restore" onClick={() => toggleColorVisibility(chip.realIndex, chip.cIdx)}><Plus size={14} /></button>
                                 )}
                                 <span className="vault-chip-label">{chip.level}</span>
                             </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 컬러 카드들 */}
            {colorBookmarks.map((item, idx) => {
                const realIndex = historyList.indexOf(item);
                return (
                <div key={idx} className="vault-item">
                    <div className="vault-header">
                        <h4>{item.name}</h4>
                        <button onClick={() => removeColorFromVault(realIndex)} className="vault-remove-btn">제거</button>
                    </div>
                    <div className="vault-palette-grid">
                         {item.palette.map((chip, cIdx) => (
                                <div key={cIdx} className="vault-chip-wrapper">
                                    {chip.isVisible !== false ? (
                                        <div className="vault-chip" style={{backgroundColor: chip.hex}} onClick={() => copyToClipboard(chip.hex)}>
                                            <div className="vault-chip-overlay" onClick={(e) => {e.stopPropagation(); toggleColorVisibility(realIndex, cIdx);}}><X size={14} color="white"/></div>
                                        </div>
                                    ) : (
                                        <button className="vault-chip-restore" onClick={() => toggleColorVisibility(realIndex, cIdx)}><Plus size={14} /></button>
                                    )}
                                    <span className="vault-chip-label">{chip.level}</span>
                                </div>
                         ))}
                    </div>
                </div>
            )})}
            
            {mergedSpacingChips.length === 0 && colorBookmarks.length === 0 && <p className="empty-msg">보관된 토큰이 없습니다.</p>}

          </div>
      </div>
    </div>
  );
}
export default App;


// Railway 배포 테스트용 주석