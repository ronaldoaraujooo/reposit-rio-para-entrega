// ===== CONFIGURAÇÃO =====
const API_BASE = 'http://localhost:8080/api';
const DEV_MODE = false;

// ===== ESTADO GLOBAL =====
let currentConversationId = null;
let currentQuestions = [];
let currentAttachment = null;
let typingIndicator = null;

// ===== FUNÇÕES DE AUTENTICAÇÃO =====
function getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

function getUserData() {
    const userDataStr = localStorage.getItem('userData');
    if (userDataStr) {
        try {
            return JSON.parse(userDataStr);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function checkAuthentication() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '/Pages/login.html';
        return false;
    }
    return true;
}

// ===== FUNÇÕES DE REQUISIÇÃO AUTENTICADA =====
async function authenticatedFetch(url, options = {}) {
    const token = getAuthToken();
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        throw new Error('Sessão expirada');
    }

    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.message || 'Erro na requisição');
    }

    return data;
}

// ===== FUNÇÕES DE LOGOUT =====
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    sessionStorage.removeItem('authToken');
    window.location.href = '/Pages/login.html';
}

// ===== INDICADOR DE DIGITAÇÃO =====
function showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    hideTypingIndicator();
    
    typingIndicator = document.createElement('div');
    typingIndicator.className = 'message typing-indicator-message';
    typingIndicator.id = 'typingIndicator';
    
    typingIndicator.innerHTML = `
        <div class="message-avatar">
            <img src="/Images/infinity.svg" alt="IA">
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }
}

// ===== GERENCIAMENTO DE CONVERSAS =====
async function loadConversations() {
    try {
        const data = await authenticatedFetch('/chat/conversations');
        const historyList = document.getElementById('historyList');
        
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        if (data.data.length === 0) {
            historyList.innerHTML = `
                <li class="no-history">
                    <a href="#">
                        <i class="fas fa-comment-slash"></i>
                        <span>Nenhuma conversa</span>
                    </a>
                </li>`;
            return;
        }

        data.data.forEach(conv => {
            const li = document.createElement('li');
            li.innerHTML = `
                <a href="#" onclick="loadConversation(${conv.id})">
                    <i class="fas fa-message"></i>
                    <span>${conv.title.substring(0, 30)}${conv.title.length > 30 ? '...' : ''}</span>
                    <small>${new Date(conv.created_at).toLocaleDateString()}</small>
                </a>
            `;
            historyList.appendChild(li);
        });
    } catch (error) {
        console.error('Erro ao carregar conversas:', error);
    }
}

async function loadConversation(conversationId) {
    try {
        showTypingIndicator();
        
        const data = await authenticatedFetch(`/chat/messages/${conversationId}`);
        const chatMessages = document.getElementById('chatMessages');
        
        if (!chatMessages) return;
        
        chatMessages.innerHTML = '';
        
        data.data.forEach(msg => {
            let content = '';
            switch(msg.message_type) {
                case 'text':
                    content = `<p>${msg.content}</p>`;
                    break;
                case 'image':
                    content = `<img src="${msg.file_url}" alt="Imagem" style="max-width: 300px; border-radius: 8px;">`;
                    break;
                case 'audio':
                    content = `<audio controls src="${msg.file_url}" style="width: 100%;"></audio>`;
                    break;
                case 'file':
                    content = `<p>📎 <a href="${msg.file_url}" target="_blank">${msg.file_name}</a></p>`;
                    break;
                default:
                    content = `<p>${msg.content}</p>`;
            }
            
            addMessage(content, msg.sender);
        });
        
        currentConversationId = conversationId;
        hideTypingIndicator();
        
        document.querySelectorAll('.sidebar-nav ul li').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector('[data-view="chat"]')?.classList.add('active');
        
        document.querySelectorAll('.content-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById('chatView')?.classList.add('active');
        
        setTimeout(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
        
    } catch (error) {
        console.error('Erro ao carregar conversa:', error);
        hideTypingIndicator();
        showToast('Erro ao carregar conversa', 'error');
    }
}

async function createNewConversation() {
    try {
        const data = await authenticatedFetch('/chat/conversations', {
            method: 'POST',
            body: JSON.stringify({ title: 'Nova conversa' })
        });
        
        currentConversationId = data.data.conversation_id;
        
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = `
                <div class="message welcome-message">
                    <div class="message-avatar">
                        <img src="/Images/infinity.svg" alt="IA">
                    </div>
                    <div class="message-content">
                        <p>Olá! Sou seu assistente de estudos. Como posso ajudar hoje?</p>
                        <p>Posso gerar perguntas personalizadas, explicar conceitos ou ajudar com suas dúvidas.</p>
                    </div>
                </div>
            `;
        }
        
        document.querySelectorAll('.sidebar-nav ul li').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector('[data-view="chat"]')?.classList.add('active');
        
        document.querySelectorAll('.content-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById('chatView')?.classList.add('active');
        
        loadConversations();
        showToast('Nova conversa criada!', 'success');
    } catch (error) {
        console.error('Erro ao criar conversa:', error);
        showToast('Erro ao criar conversa', 'error');
    }
}

// ===== FUNÇÕES DO CHAT =====
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const chatMessages = document.getElementById('chatMessages');
    
    if (!userInput || !chatMessages) return;
    
    const message = userInput.value.trim();
    if (!message && !currentAttachment) return;
    
    let messageHtml = '';
    
    if (message) {
        messageHtml = `<p>${message}</p>`;
    }
    
    if (currentAttachment) {
        const icon = currentAttachment.type === 'image' ? 'fa-image' 
                   : currentAttachment.type === 'audio' ? 'fa-microphone' : 'fa-file';
        
        messageHtml += `
            <div class="message-attachment">
                <i class="fas ${icon}"></i> 
                <span>${currentAttachment.name}</span>
                <small>(${(currentAttachment.size / 1024).toFixed(1)} KB)</small>
            </div>
        `;
    }
    
    addMessage(messageHtml, 'user');
    
    userInput.value = '';
    userInput.style.height = 'auto';
    
    showTypingIndicator();
    
    try {
        let response;
        
        if (currentAttachment && currentAttachment.file) {
            const formData = new FormData();
            formData.append('file', currentAttachment.file);
            formData.append('type', currentAttachment.type);
            if (currentConversationId) {
                formData.append('conversation_id', currentConversationId);
            }
            
            const token = getAuthToken();
            
            const uploadResponse = await fetch(`${API_BASE}/chat/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            const uploadData = await uploadResponse.json();
            
            if (!uploadData.success) {
                throw new Error(uploadData.message);
            }
            
            if (message) {
                response = await authenticatedFetch('/chat/messages', {
                    method: 'POST',
                    body: JSON.stringify({
                        conversation_id: currentConversationId,
                        content: message
                    })
                });
            } else {
                if (!currentConversationId && uploadData.data.conversation_id) {
                    currentConversationId = uploadData.data.conversation_id;
                }
                
                setTimeout(() => {
                    hideTypingIndicator();
                    let iaResponse = '';
                    if (currentAttachment.type === 'image') {
                        iaResponse = 'Recebi sua imagem! Posso analisar se precisar de ajuda com o conteúdo.';
                    } else if (currentAttachment.type === 'audio') {
                        iaResponse = 'Recebi seu áudio! Vou processar a mensagem.';
                    } else {
                        iaResponse = 'Recebi seu arquivo! Em breve poderei analisar o conteúdo.';
                    }
                    addMessage(iaResponse, 'ia');
                }, 1500);
                
                clearAttachment();
                return;
            }
        } else {
            response = await authenticatedFetch('/chat/messages', {
                method: 'POST',
                body: JSON.stringify({
                    conversation_id: currentConversationId,
                    content: message
                })
            });
        }
        
        hideTypingIndicator();
        
        if (response && response.data) {
            currentConversationId = response.data.conversation_id;
            
            if (response.data.ia_response) {
                addMessage(response.data.ia_response.content, 'ia');
                
                if (response.data.ia_response.generated_quiz) {
                    setTimeout(() => {
                        addMessage('Posso gerar algumas perguntas sobre esse assunto. Clique em "Perguntas Geradas" no menu!', 'ia');
                    }, 500);
                }
            }
            
            loadConversations();
        }
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        hideTypingIndicator();
        showToast(error.message || 'Erro ao enviar mensagem', 'error');
    }
    
    clearAttachment();
}

function addMessage(content, sender) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender === 'user' ? 'user-message' : ''}`;
    
    const avatar = sender === 'user' 
        ? '<i class="fas fa-user"></i>' 
        : '<img src="/Images/infinity.svg" alt="IA">';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">${content}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    setTimeout(() => {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
}

// ===== FUNÇÕES DO QUIZ =====
async function loadQuestions() {
    const questionsGrid = document.getElementById('questionsGrid');
    if (!questionsGrid) return;
    
    showLoading('Gerando perguntas personalizadas...');
    
    try {
        const data = await authenticatedFetch('/chat/generate-quiz', {
            method: 'POST',
            body: JSON.stringify({
                quantity: 5,
                conversation_id: currentConversationId
            })
        });
        
        currentQuestions = data.data.questions;
        
        renderQuestions(currentQuestions);
        showToast(`${data.data.count} perguntas geradas!`, 'success');
    } catch (error) {
        console.error('Erro ao gerar perguntas:', error);
        showToast('Erro ao gerar perguntas', 'error');
    } finally {
        hideLoading();
    }
}

function renderQuestions(questions) {
    const questionsGrid = document.getElementById('questionsGrid');
    if (!questionsGrid) return;
    
    questionsGrid.innerHTML = '';
    
    questions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.dataset.id = q.id;
        
        const optionsHtml = q.options.map(opt => {
            return `
                <label class="option">
                    <input type="radio" name="q${q.id}" value="${opt.id}">
                    <span class="option-text">${opt.text}</span>
                </label>
            `;
        }).join('');
        
        card.innerHTML = `
            <div class="question-header">
                <span class="question-category">${q.category}</span>
                <span class="question-difficulty">${q.difficulty}</span>
            </div>
            <div class="question-text">${index + 1}. ${q.question}</div>
            <div class="question-options">${optionsHtml}</div>
            <div class="question-footer">
                <button class="answer-btn" onclick="submitAnswer(${q.id})">
                    <i class="fas fa-check"></i> Verificar
                </button>
            </div>
        `;
        
        questionsGrid.appendChild(card);
    });
    
    updateQuestionsBadge(questions.length);
}

function updateQuestionsBadge(total) {
    const badge = document.getElementById('questionsBadge');
    if (badge) {
        badge.textContent = total;
    }
}

async function submitAnswer(questionId) {
    const question = currentQuestions.find(q => q.id === questionId);
    if (!question) return;
    
    const selectedOption = document.querySelector(`input[name="q${questionId}"]:checked`);
    if (!selectedOption) {
        showToast('Selecione uma opção primeiro!', 'warning');
        return;
    }
    
    const startTime = Date.now();
    
    try {
        showLoading('Verificando resposta...');
        
        const data = await authenticatedFetch('/chat/submit-answer', {
            method: 'POST',
            body: JSON.stringify({
                question_id: questionId,
                selected_option: parseInt(selectedOption.value),
                response_time_ms: Date.now() - startTime
            })
        });
        
        hideLoading();
        
        const correctOption = question.options.find(opt => opt.id === data.data.correct_option);
        
        showAnswerModal(question, data.data.is_correct, correctOption, data.data.explanation);
        
        document.querySelectorAll(`input[name="q${questionId}"]`).forEach(input => {
            input.disabled = true;
        });
        
        const answerBtn = document.querySelector(`.question-card[data-id="${questionId}"] .answer-btn`);
        if (answerBtn) {
            answerBtn.disabled = true;
            answerBtn.innerHTML = '<i class="fas fa-check"></i> Respondida';
        }
        
        showToast(data.data.is_correct ? 'Resposta correta! 🎉' : 'Resposta incorreta. Continue tentando! 💪', 
                 data.data.is_correct ? 'success' : 'error');
        
    } catch (error) {
        hideLoading();
        console.error('Erro ao enviar resposta:', error);
        showToast(error.message || 'Erro ao enviar resposta', 'error');
    }
}

// ===== FUNÇÕES DE ESTATÍSTICAS =====
async function renderStatistics() {
    try {
        showLoading('Carregando estatísticas...');
        
        const data = await authenticatedFetch('/chat/stats');
        const stats = data.data;
        
        hideLoading();
        
        const hitRate = stats.general?.avg_hit_rate || 0;
        updateProgressCircle(hitRate);
        
        const progressText = document.querySelector('.stat-card:first-child p');
        if (progressText) {
            const totalAnswers = stats.general?.total_answers || 0;
            const correctAnswers = stats.general?.correct_answers || 0;
            progressText.textContent = `${correctAnswers} acertos em ${totalAnswers} perguntas`;
        }
        
        if (stats.by_category && stats.by_category.length > 0) {
            updateCategoryBars(stats.by_category);
        } else {
            document.querySelectorAll('.subject-bar').forEach(bar => {
                bar.querySelector('.bar-fill').style.width = '0%';
                bar.querySelector('span:last-child').textContent = '0%';
            });
        }
        
        updateTimeStats(stats.daily);
        
        if (stats.profile) {
            let strengths = [];
            let weaknesses = [];
            
            if (typeof stats.profile.strengths === 'string') {
                try {
                    strengths = JSON.parse(stats.profile.strengths);
                } catch (e) {
                    strengths = [];
                }
            } else {
                strengths = stats.profile.strengths || [];
            }
            
            if (typeof stats.profile.weaknesses === 'string') {
                try {
                    weaknesses = JSON.parse(stats.profile.weaknesses);
                } catch (e) {
                    weaknesses = [];
                }
            } else {
                weaknesses = stats.profile.weaknesses || [];
            }
            
            updateStrengthsWeaknesses(strengths, weaknesses);
        }
        
        if (stats.daily && stats.daily.length > 0) {
            updateEvolutionChart(stats.daily);
        }
        
        if (stats.by_difficulty && stats.by_difficulty.length > 0) {
            updateDifficultyStats(stats.by_difficulty);
        }
        
    } catch (error) {
        hideLoading();
        console.error('Erro ao carregar estatísticas:', error);
        showToast('Erro ao carregar estatísticas', 'error');
    }
}

function updateProgressCircle(percentage) {
    const circle = document.querySelector('.progress-circle');
    if (!circle) return;
    
    const percent = Math.min(100, Math.max(0, parseFloat(percentage) || 0));
    
    circle.style.background = `conic-gradient(var(--primary-color) ${percent * 3.6}deg, var(--border-color) 0)`;
    circle.querySelector('span').textContent = `${Math.round(percent)}%`;
}

function updateCategoryBars(categories) {
    const categoryMap = {
        'Matemática': 'Matemática',
        'Português': 'Português',
        'Ciências': 'Ciências',
        'História': 'História',
        'Geografia': 'Geografia',
        'Literatura': 'Português'
    };
    
    document.querySelectorAll('.subject-bar').forEach(bar => {
        const barCategory = bar.querySelector('span:first-child').textContent;
        
        let categoryData = null;
        for (const [dbCategory, displayCategory] of Object.entries(categoryMap)) {
            if (displayCategory === barCategory) {
                categoryData = categories.find(c => c.category === dbCategory);
                if (categoryData) break;
            }
        }
        
        if (categoryData) {
            const percentage = parseFloat(categoryData.hit_rate) || 0;
            bar.querySelector('.bar-fill').style.width = `${percentage}%`;
            bar.querySelector('span:last-child').textContent = `${Math.round(percentage)}%`;
        } else {
            bar.querySelector('.bar-fill').style.width = '0%';
            bar.querySelector('span:last-child').textContent = '0%';
        }
    });
}

function updateTimeStats(daily) {
    const timeValues = document.querySelectorAll('.time-item .time-value');
    if (timeValues.length < 3) return;
    
    if (!daily || daily.length === 0) {
        timeValues[0].textContent = '0h 0m';
        timeValues[1].textContent = '0h 0m';
        timeValues[2].textContent = '0h 0m';
        return;
    }
    
    let today = 0, week = 0, total = 0;
    const todayDate = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    daily.forEach(day => {
        const minutes = parseInt(day.study_time_minutes) || 0;
        total += minutes;
        
        if (day.date === todayDate) {
            today = minutes;
        }
        
        const dayDate = new Date(day.date);
        if (dayDate >= weekAgo) {
            week += minutes;
        }
    });
    
    const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}h ${mins}m`;
    };
    
    timeValues[0].textContent = formatTime(today);
    timeValues[1].textContent = formatTime(week);
    timeValues[2].textContent = formatTime(total);
}

function updateStrengthsWeaknesses(strengths, weaknesses) {
    const strengthsList = document.querySelector('.strengths-list');
    const weaknessesList = document.querySelector('.weaknesses-list');
    
    if (strengthsList) {
        if (strengths && strengths.length > 0) {
            strengthsList.innerHTML = strengths.map(s => 
                `<li><i class="fas fa-check-circle"></i> ${s.category} (${s.hit_rate}%)</li>`
            ).join('');
        } else {
            strengthsList.innerHTML = '<li><i class="fas fa-check-circle"></i> Nenhum ponto forte identificado ainda</li>';
        }
    }
    
    if (weaknessesList) {
        if (weaknesses && weaknesses.length > 0) {
            weaknessesList.innerHTML = weaknesses.map(w => 
                `<li><i class="fas fa-exclamation-circle"></i> ${w.category} (${w.hit_rate}%)</li>`
            ).join('');
        } else {
            weaknessesList.innerHTML = '<li><i class="fas fa-exclamation-circle"></i> Nenhum ponto fraco identificado</li>';
        }
    }
}

function updateEvolutionChart(daily) {
    const chartContainer = document.querySelector('.mock-chart');
    if (!chartContainer) return;
    
    const last7Days = daily.slice(0, 7);
    const maxValue = Math.max(...last7Days.map(d => parseInt(d.questions_answered) || 0), 1);
    
    chartContainer.innerHTML = last7Days.reverse().map(day => {
        const date = new Date(day.date);
        const displayDate = `${date.getDate()}/${date.getMonth() + 1}`;
        const questions = parseInt(day.questions_answered) || 0;
        const correct = parseInt(day.correct_answers) || 0;
        const hitRate = questions > 0 ? (correct / questions * 100) : 0;
        const height = questions > 0 ? (questions / maxValue) * 150 : 20;
        
        return `
            <div class="chart-column" title="${displayDate}: ${questions} perguntas, ${Math.round(hitRate)}% acertos">
                <div class="chart-bar" style="height: ${height}px;">
                    <span class="chart-tooltip">${Math.round(hitRate)}%</span>
                </div>
                <span class="chart-label">${displayDate}</span>
            </div>
        `;
    }).join('');
}

function updateDifficultyStats(difficulties) {
    let section = document.querySelector('.difficulty-stats');
    
    if (!section) {
        section = document.createElement('div');
        section.className = 'stat-card difficulty-stats';
        section.innerHTML = `
            <div class="stat-header">
                <i class="fas fa-signal"></i>
                <h3>Desempenho por Dificuldade</h3>
            </div>
            <div class="difficulty-bars"></div>
        `;
        
        const statsGrid = document.querySelector('.stats-grid');
        if (statsGrid) {
            statsGrid.appendChild(section);
        }
    }
    
    const barsContainer = section.querySelector('.difficulty-bars');
    if (!barsContainer) return;
    
    const difficultyOrder = { 'Fácil': 1, 'Médio': 2, 'Difícil': 3 };
    
    const sortedDifficulties = [...difficulties].sort((a, b) => 
        difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]
    );
    
    if (sortedDifficulties.length === 0) {
        barsContainer.innerHTML = '<p class="no-data">Nenhum dado disponível</p>';
        return;
    }
    
    barsContainer.innerHTML = sortedDifficulties.map(diff => {
        const percentage = parseFloat(diff.hit_rate) || 0;
        const total = parseInt(diff.total_questions) || 0;
        const correct = parseInt(diff.correct_answers) || 0;
        
        const color = diff.difficulty === 'Fácil' ? 'var(--success-color)' 
                    : diff.difficulty === 'Médio' ? 'var(--warning-color)' 
                    : 'var(--error-color)';
        
        return `
            <div class="difficulty-bar">
                <span>${diff.difficulty}</span>
                <div class="bar">
                    <div class="bar-fill" style="width: ${percentage}%; background: ${color};"></div>
                </div>
                <span>${Math.round(percentage)}% (${correct}/${total})</span>
            </div>
        `;
    }).join('');
}

// ===== FUNÇÕES DE UPLOAD =====
function setupUploadListeners() {
    const imageInput = document.getElementById('imageInput');
    const fileInput = document.getElementById('fileInput');
    const imageAttachBtn = document.getElementById('imageAttachBtn');
    const fileAttachBtn = document.getElementById('fileAttachBtn');
    const removeBtn = document.getElementById('removeAttachmentBtn');
    
    if (imageAttachBtn && imageInput) {
        imageAttachBtn.addEventListener('click', () => imageInput.click());
    }
    
    if (fileAttachBtn && fileInput) {
        fileAttachBtn.addEventListener('click', () => fileInput.click());
    }
    
    async function handleFileSelect(input, type) {
        const file = input?.files[0];
        if (!file) return;
        
        if (file.size > 10 * 1024 * 1024) {
            showToast('Arquivo muito grande. Máximo 10MB.', 'error');
            input.value = '';
            return;
        }
        
        currentAttachment = { file, type, name: file.name, size: file.size };
        
        const preview = document.getElementById('previewFileName');
        if (preview) preview.textContent = file.name;
        
        const previewContainer = document.getElementById('attachmentPreview');
        if (previewContainer) previewContainer.classList.remove('hidden');
        
        showToast(`Arquivo anexado: ${file.name}`, 'info');
    }
    
    if (imageInput) {
        imageInput.addEventListener('change', (e) => handleFileSelect(e.target, 'image'));
    }
    
    if (fileInput) {
        fileInput.addEventListener('change', (e) => handleFileSelect(e.target, 'file'));
    }
    
    if (removeBtn) {
        removeBtn.addEventListener('click', clearAttachment);
    }
}

function clearAttachment() {
    currentAttachment = null;
    
    const preview = document.getElementById('attachmentPreview');
    if (preview) preview.classList.add('hidden');
    
    const imageInput = document.getElementById('imageInput');
    const fileInput = document.getElementById('fileInput');
    
    if (imageInput) imageInput.value = '';
    if (fileInput) fileInput.value = '';
}

// ===== ÁUDIO RECORDER =====
const AudioRecorder = {
    mediaRecorder: null,
    audioChunks: [],
    stream: null,
    isRecording: false,
    audioBlob: null,
    audioUrl: null,
    recordingStartTime: null,
    timerInterval: null,
    
    async init() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('Erro ao acessar microfone:', error);
            showToast('Não foi possível acessar o microfone', 'error');
            return false;
        }
    },
    
    setupEventListeners() {
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) this.audioChunks.push(event.data);
        };
        
        this.mediaRecorder.onstop = () => {
            this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            this.audioUrl = URL.createObjectURL(this.audioBlob);
            
            document.getElementById('sendRecordingBtn')?.classList.remove('hidden');
            document.getElementById('playRecordingBtn')?.classList.remove('hidden');
            document.getElementById('startRecordingBtn')?.classList.add('hidden');
            document.getElementById('stopRecordingBtn')?.classList.add('hidden');
        };
    },
    
    startRecording() {
        this.audioChunks = [];
        this.mediaRecorder.start();
        this.isRecording = true;
        this.recordingStartTime = Date.now();
        
        document.getElementById('startRecordingBtn')?.classList.add('hidden');
        document.getElementById('stopRecordingBtn')?.classList.remove('hidden');
        document.getElementById('cancelRecordingBtn')?.classList.remove('hidden');
        
        this.startTimer();
    },
    
    stopRecording() {
        this.mediaRecorder.stop();
        this.isRecording = false;
        this.stopTimer();
        this.stream.getTracks().forEach(track => track.stop());
    },
    
    cancelRecording() {
        this.mediaRecorder.stop();
        this.isRecording = false;
        this.audioChunks = [];
        this.stopTimer();
        this.hideRecorder();
    },
    
    playRecording() {
        const audio = document.getElementById('audioPlayer');
        audio.src = this.audioUrl;
        audio.play();
    },
    
    async sendRecording() {
        if (!this.audioBlob) return;
        
        const audioFile = new File([this.audioBlob], 'gravacao.webm', { type: 'audio/webm' });
        
        currentAttachment = {
            file: audioFile,
            type: 'audio',
            name: 'gravacao.webm',
            size: audioFile.size
        };
        
        await sendMessage();
        this.hideRecorder();
    },
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            if (!this.isRecording) return;
            
            const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            
            document.getElementById('recorderTimer').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    },
    
    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    },
    
    showRecorder() {
        document.getElementById('audioRecorder')?.classList.remove('hidden');
        document.getElementById('recorderTimer').textContent = '00:00';
    },
    
    hideRecorder() {
        document.getElementById('audioRecorder')?.classList.add('hidden');
        document.getElementById('startRecordingBtn')?.classList.remove('hidden');
        document.getElementById('stopRecordingBtn')?.classList.add('hidden');
        document.getElementById('playRecordingBtn')?.classList.add('hidden');
        document.getElementById('sendRecordingBtn')?.classList.add('hidden');
        document.getElementById('cancelRecordingBtn')?.classList.add('hidden');
    }
};

function setupAudioRecorder() {
    const audioRecordBtn = document.getElementById('audioRecordBtn');
    if (!audioRecordBtn) return;
    
    audioRecordBtn.addEventListener('click', async () => {
        if (await AudioRecorder.init()) {
            AudioRecorder.showRecorder();
        }
    });
    
    document.getElementById('startRecordingBtn')?.addEventListener('click', () => AudioRecorder.startRecording());
    document.getElementById('stopRecordingBtn')?.addEventListener('click', () => AudioRecorder.stopRecording());
    document.getElementById('playRecordingBtn')?.addEventListener('click', () => AudioRecorder.playRecording());
    document.getElementById('sendRecordingBtn')?.addEventListener('click', () => AudioRecorder.sendRecording());
    document.getElementById('cancelRecordingBtn')?.addEventListener('click', () => AudioRecorder.cancelRecording());
}

// ===== FUNÇÕES DE INTERFACE =====
function toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('active');
}

function switchView(viewId) {
    const navItems = document.querySelectorAll('.sidebar-nav ul li');
    const contentViews = document.querySelectorAll('.content-view');
    
    navItems.forEach(item => {
        const link = item.querySelector('a');
        if (link && link.getAttribute('href') === `#${viewId}`) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    contentViews.forEach(view => view.classList.remove('active'));
    document.getElementById(`${viewId}View`)?.classList.add('active');

    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('active');
    }

    if (viewId === 'questions') {
        loadQuestions();
    } else if (viewId === 'stats') {
        renderStatistics();
    }
}

function showAnswerModal(question, isCorrect, correctOption, explanation) {
    const modal = document.getElementById('answerModal');
    const modalBody = document.getElementById('answerModalBody');
    
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = `
        <div class="answer-result ${isCorrect ? 'correct' : 'incorrect'}">
            <i class="fas ${isCorrect ? 'fa-check-circle' : 'fa-times-circle'}" style="font-size: 48px;"></i>
            <h3>${isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}</h3>
            <p class="explanation">${explanation || question.explanation}</p>
            <p class="correct-answer">
                <strong>Resposta correta:</strong> ${correctOption.text}
            </p>
            ${!isCorrect ? '<p class="tip">Continue praticando! Você vai conseguir!</p>' : ''}
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function closeAnswerModal() {
    document.getElementById('answerModal')?.classList.add('hidden');
}

function showLoading(message = 'Carregando...') {
    const loading = document.getElementById('loadingState');
    const loadingMsg = document.getElementById('loadingMessage');
    
    if (loading && loadingMsg) {
        loadingMsg.textContent = message;
        loading.classList.remove('hidden');
    }
}

function hideLoading() {
    document.getElementById('loadingState')?.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    
    if (!toast || !toastMsg) return;
    
    toastMsg.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function newChat() {
    createNewConversation();
    switchView('chat');
}

// ===== SETUP INICIAL =====
function setupTextareaResize() {
    const userInput = document.getElementById('userInput');
    if (userInput) {
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    }
}

function setupEventListeners() {
    document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
    
    document.querySelectorAll('.sidebar-nav ul li').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const link = item.querySelector('a');
            if (link) {
                const viewId = link.getAttribute('href').replace('#', '');
                switchView(viewId);
            }
        });
    });

    document.getElementById('refreshQuestions')?.addEventListener('click', loadQuestions);
    document.getElementById('sendMessageBtn')?.addEventListener('click', sendMessage);
    
    const userInput = document.getElementById('userInput');
    if (userInput) {
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    document.getElementById('newChatBtn')?.addEventListener('click', newChat);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('closeModalBtn')?.addEventListener('click', closeAnswerModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('answerModal')) {
            closeAnswerModal();
        }
    });
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuthentication()) return;
    
    try {
        await loadConversations();
        
        setupEventListeners();
        setupUploadListeners();
        setupAudioRecorder();
        setupTextareaResize();
        
        const userData = getUserData();
        
        if (userData) {
            addMessage(`Bem-vindo de volta, ${userData.name}!`, 'ia');
        }
        
        console.log('Chat inicializado com sucesso');
    } catch (error) {
        console.error(' Erro na inicialização:', error);
        showToast('Erro ao carregar o chat', 'error');
    }
});

// ===== EXPORTAR FUNÇÕES GLOBAIS =====
window.submitAnswer = submitAnswer;
window.closeAnswerModal = closeAnswerModal;
window.loadConversation = loadConversation;
window.currentQuestions = [];
window.currentAttachment = null;
window.logout = logout;