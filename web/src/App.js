return (
    /* 🚨 중요: GoogleOAuthProvider로 전체를 감싸야 로그인이 작동합니다! */
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <div className="app-container">
        {toast && <div className="toast-notification"><Copy size={16} /> {toast}</div>}

        <div className="sidebar">
          <div className="sidebar-top">
            {/* 로고 영역 */}
            <div className="logo-area" onClick={startNewProject} style={{ cursor: 'pointer' }}>
              <h1>🎨 디자인 시스템 봇</h1>
            </div>

            <button className="new-chat-btn" onClick={startNewProject}>
              <Plus size={16} /> 새로운 프로젝트 추가
            </button>

            {/* 프로젝트 리스트 */}
            <div className="project-list-area">
              <div className="list-title">나의 디자인시스템</div>
              <div className="project-items">
                {Object.keys(projects).map(p => (
                  <div
                    key={p}
                    className={`project-item-group ${activeProject === p ? 'active' : ''}`}
                    onClick={() => setActiveProject(p)}
                  >
                    {isRenaming === p ? (
                      <div className="rename-container" onClick={(e) => e.stopPropagation()}>
                        <input
                          className="rename-input"
                          value={renameInput}
                          onChange={(e) => setRenameInput(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); }}
                        />
                        <button className="rename-save-btn" onClick={saveRename}><Save size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <div className="project-name-wrapper">
                          <Folder size={16} />
                          <span className="truncate">{p}</span>
                        </div>
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDropdownOpen(dropdownOpen === p ? null : p);
                          }}
                        >
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

          {/* ▼▼▼ [수정됨] 사이드바 하단: 로그인 버튼 & 프로필 영역 ▼▼▼ */}
          <div className="user-profile">
            {!user ? (
              // 1. 로그인이 안 되어 있을 때 -> 구글 로그인 버튼 표시
              <div style={{ padding: '10px', display: 'flex', justifyContent: 'center' }}>
                <GoogleLogin
                  onSuccess={handleLoginSuccess}
                  onError={() => console.log('Login Failed')}
                  theme="filled_black"
                  shape="pill"
                  size="medium"
                  text="signin_with"
                />
              </div>
            ) : (
              // 2. 로그인이 되어 있을 때 -> 프로필 정보 표시 (안전장치 추가됨)
              <>
                <div className="user-info">
                  {/* user.picture가 있으면 이미지, 없으면 기본 아이콘 */}
                  {user.picture ? (
                    <img src={user.picture} alt="user" referrerPolicy="no-referrer" />
                  ) : (
                    <div style={{width: 36, height: 36, borderRadius: '50%', background: '#666', display:'flex', alignItems:'center', justifyContent:'center'}}><User size={18}/></div>
                  )}
                  <div className="user-text">
                    <p>{user.name}</p>
                    <span style={{fontSize: '11px', color: '#888'}}>Logged in</span>
                  </div>
                </div>
                <button onClick={handleLogout} className="logout-btn">로그아웃</button>
              </>
            )}
          </div>
          {/* ▲▲▲ 여기까지 수정됨 ▲▲▲ */}
        </div>

        <div className="main-content">
          <main className="chat-area">
            {!activeProject ? (
              <div className="welcome-screen">
                <h2>
                  새로운 프로젝트를 추가하시겠어요?<br />
                  <span className="highlight-text">시스템에 필요한 컬러나 Spacing</span>을<br />
                  입력해주세요.
                </h2>
              </div>
            ) : (
              displayHistory.map((item, idx) => {
                const originalIndex = historyList.length - 1 - idx;
                return (
                  <div key={item.id || idx} className="history-item-group animate-fade-in-up">
                    <div className="user-message">
                      <div className="bubble">{item.userInput}</div>
                    </div>
                    <div className="bot-response">
                      <div className="bot-avatar">🤖</div>
                      <div className="response-card" style={{ borderColor: item.isBookmarked ? '#3b82f6' : '#374151' }}>
                        <div className="card-header">
                          <div className="tag-row">
                            <span className="ai-tag">{item.type === 'spacing' ? 'Spacing' : 'Color'}</span>
                            <h4 className="card-title">{item.name}</h4>
                          </div>
                          <button onClick={() => addToVault(originalIndex)} className="save-button">저장</button>
                        </div>

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

            {loading && <div className="loading-bubble"><Loader2 className="animate-spin" size={16} /> 생각 중...</div>}
            <div ref={scrollRef} style={{ height: '1px' }}></div>
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
                        <div className="vault-chip" style={{ backgroundColor: '#3e3e44' }} onClick={() => copyToClipboard(`${chip.value}px`)}>
                          <div className="vault-chip-overlay" onClick={(e) => { e.stopPropagation(); toggleColorVisibility(chip.realIndex, chip.cIdx); }}><X size={14} color="white" /></div>
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
                          <div className="vault-chip" style={{ backgroundColor: chip.hex }} onClick={() => copyToClipboard(chip.hex)}>
                            <div className="vault-chip-overlay" onClick={(e) => { e.stopPropagation(); toggleColorVisibility(realIndex, cIdx); }}><X size={14} color="white" /></div>
                          </div>
                        ) : (
                          <button className="vault-chip-restore" onClick={() => toggleColorVisibility(realIndex, cIdx)}><Plus size={14} /></button>
                        )}
                        <span className="vault-chip-label">{chip.level}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {mergedSpacingChips.length === 0 && colorBookmarks.length === 0 && <p className="empty-msg">보관된 토큰이 없습니다.</p>}
          </div>
        </div>
      </div>
    </GoogleOAuthProvider>
  );