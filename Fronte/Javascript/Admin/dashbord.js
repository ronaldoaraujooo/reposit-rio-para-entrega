const API_BASE = 'http://localhost:8080/api';
let currentSection = 'dashboard';
let usersList = [];
let filteredUsers = [];


function getAuthToken() {
    return localStorage.getItem('authToken') || 
           sessionStorage.getItem('authToken') ||
           localStorage.getItem('adminToken') ||
           sessionStorage.getItem('adminToken');
}

function getUserData() {
    const userStr = localStorage.getItem('userData') || 
                    localStorage.getItem('adminUser') ||
                    sessionStorage.getItem('adminUser');
    
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function checkAdminAuth() {
    const token = getAuthToken();
    const user = getUserData();
    
    if (!token) {
        window.location.href = '../../Auth/LoginAuth/login.html';
        return false;
    }
    
    if (!user) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.role === 'admin') {
                localStorage.setItem('userData', JSON.stringify({
                    id: payload.user_id,
                    name: 'Administrador',
                    email: payload.email,
                    role: 'admin'
                }));
                return true;
            }
        } catch (e) {
            console.error('Erro ao decodificar token:', e);
        }
        
        window.location.href = '../../Auth/LoginAuth/login.html';
        return false;
    }
    
    if (user.role !== 'admin') {
        window.location.href = '../../Pages/login.html';
        return false;
    }
    
    return true;
}

// ===== REQUISIÇÕES AUTENTICADAS =====
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
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '../../Auth/LoginAuth/login.html';
}

// ===== FUNÇÕES DE INTERFACE =====
function toggleSection(sectionId, event) {
    if (event) {
        event.preventDefault();
    }
    
    // Atualiza menu ativo
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Se veio de um evento, ativa o item clicado
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        // Caso contrário, ativa pelo data-section
        document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
    }
    
    // Mostra seção correspondente
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Atualiza título
    const titles = {
        'dashboard': 'Dashboard',
        'usuarios': 'Gerenciar Usuários',
        'mensagens': 'Todas as Mensagens',
        'midias': 'Biblioteca de Mídias',
        'assinaturas': 'Gerenciar Assinaturas',
        'configuracoes': 'Configurações do Sistema'
    };
    
    document.querySelector('.content-header h1').textContent = titles[sectionId] || 'Dashboard';
    currentSection = sectionId;
    
    loadSectionData(sectionId);
}

// ===== CARREGAR DADOS DA SEÇÃO =====
async function loadSectionData(section) {
    try {
        switch(section) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'usuarios':
                await loadUsers();
                break;
            case 'mensagens':
                showNotification('Funcionalidade em desenvolvimento', 'info');
                break;
            case 'midias':
                showNotification('Funcionalidade em desenvolvimento', 'info');
                break;
            case 'assinaturas':
                showNotification('Funcionalidade em desenvolvimento', 'info');
                break;
            case 'configuracoes':
                showNotification('Funcionalidade em desenvolvimento', 'info');
                break;
        }
    } catch (error) {
        console.error(`Erro ao carregar ${section}:`, error);
        showNotification(`Erro ao carregar dados: ${error.message}`, 'error');
    }
}

// ===== DASHBOARD =====
async function loadDashboard() {
    try {
        const data = await authenticatedFetch('/admin/dashboard');
        const stats = data.data.stats || {};
        const recentUsers = data.data.recent_users || [];
        const recentActivities = data.data.recent_activities || [];
        
        updateStatCards(stats);
        updateRecentUsers(recentUsers);
        updateRecentActivities(recentActivities);
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        // Se falhar, tenta carregar apenas usuários como fallback
        const users = await authenticatedFetch('/admin/users');
        const stats = {
            total_users: users.data.length,
            answers_today: 0,
            messages_today: 0,
            active_users: users.data.filter(u => u.status === 'active').length
        };
        updateStatCards(stats);
        updateRecentUsers(users.data.slice(0, 5));
    }
}

function updateStatCards(stats) {
    const statValues = document.querySelectorAll('.stat-value');
    if (statValues.length >= 4) {
        statValues[0].textContent = stats.total_users || '0';
        statValues[1].textContent = stats.answers_today || '0';
        statValues[2].textContent = stats.messages_today || '0';
        statValues[3].textContent = stats.active_users || '0';
    }
}

function updateRecentUsers(users) {
    const tbody = document.querySelector('.recent-card:first-child tbody');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-table">Nenhum usuário cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.slice(0, 5).map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="status-badge ${user.status}">${user.status === 'active' ? 'Ativo' : (user.status === 'blocked' ? 'Bloqueado' : 'Inativo')}</span></td>
        </tr>
    `).join('');
}

function updateRecentActivities(activities) {
    const tbody = document.querySelector('.recent-card:last-child tbody');
    if (!tbody) return;
    
    if (activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-table">Nenhuma atividade recente</td></tr>';
        return;
    }
    
    tbody.innerHTML = activities.slice(0, 5).map(act => `
        <tr>
            <td>${act.user_name || 'Sistema'}</td>
            <td>${act.activity_type || act.action_type || 'Ação'}</td>
            <td><small>${new Date(act.created_at).toLocaleString()}</small></td>
        </tr>
    `).join('');
}

// ===== USUÁRIOS =====
async function loadUsers() {
    try {
        const data = await authenticatedFetch('/admin/users');
        usersList = data.data || [];
        filteredUsers = [...usersList];
        
        renderUsersTable(filteredUsers);
        
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        showNotification('Erro ao carregar usuários', 'error');
    }
}

function renderUsersTable(users) {
    const tbody = document.querySelector('#usuarios .data-table tbody');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-table">Nenhum usuário encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => {
        const statusClass = user.status === 'active' ? 'active' : 
                           (user.status === 'blocked' ? 'blocked' : 'inactive');
        const statusText = user.status === 'active' ? 'Ativo' : 
                          (user.status === 'blocked' ? 'Bloqueado' : 'Inativo');
        
        return `
        <tr>
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role || 'user'}">${user.role === 'admin' ? 'Admin' : 'Usuário'}</span></td>
            <td><span class="plan-badge basic">${user.plan || 'basic'}</span></td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="action-btn edit" onclick="openEditUserModal(${user.id})" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn view" onclick="viewUserDetails(${user.id})" title="Detalhes">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn ${user.status === 'blocked' ? 'activate' : 'block'}" 
                        onclick="toggleUserStatus(${user.id}, '${user.status || 'active'}')" 
                        title="${user.status === 'blocked' ? 'Ativar' : 'Bloquear'}">
                    <i class="fas ${user.status === 'blocked' ? 'fa-check-circle' : 'fa-ban'}"></i>
                </button>
                <button class="action-btn delete" onclick="deleteUser(${user.id})" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `}).join('');
}

// ===== FILTRAR USUÁRIOS =====
function filterUsers(searchTerm) {
    if (!searchTerm) {
        filteredUsers = [...usersList];
    } else {
        const term = searchTerm.toLowerCase();
        filteredUsers = usersList.filter(user => 
            user.name.toLowerCase().includes(term) || 
            user.email.toLowerCase().includes(term)
        );
    }
    renderUsersTable(filteredUsers);
}

// ===== VER DETALHES DO USUÁRIO =====
async function viewUserDetails(userId) {
    try {
        console.log('Visualizando detalhes do usuário:', userId);
        
        const data = await authenticatedFetch(`/admin/users/${userId}`);
        const user = data.data;
        
        // Remove modal existente se houver
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        
        // Formata dados com verificações de null/undefined
        const lastLogin = user.last_login ? new Date(user.last_login).toLocaleString() : 'Nunca';
        const created = new Date(user.created_at).toLocaleString();
        const totalQuiz = user.total_quiz_answers || 0;
        const totalCorrect = user.total_correct_answers || 0;
        const hitRate = user.overall_hit_rate ? parseFloat(user.overall_hit_rate).toFixed(2) : '0.00';
        const studyTime = user.total_study_time_minutes || 0;
        const studyHours = Math.floor(studyTime / 60);
        const studyMinutes = studyTime % 60;
        
        // Processa strengths/weaknesses (podem vir como string JSON ou null)
        let strengths = [];
        let weaknesses = [];
        
        if (user.strengths) {
            try {
                strengths = typeof user.strengths === 'string' ? JSON.parse(user.strengths) : user.strengths;
            } catch (e) {
                strengths = [];
            }
        }
        
        if (user.weaknesses) {
            try {
                weaknesses = typeof user.weaknesses === 'string' ? JSON.parse(user.weaknesses) : user.weaknesses;
            } catch (e) {
                weaknesses = [];
            }
        }
        
        // Processa category_stats
        let categoryStats = [];
        if (user.category_stats) {
            try {
                categoryStats = typeof user.category_stats === 'string' ? 
                    JSON.parse(user.category_stats) : user.category_stats;
            } catch (e) {
                categoryStats = [];
            }
        }
        
        // Processa recent_sessions
        let recentSessions = [];
        if (user.recent_sessions) {
            try {
                recentSessions = typeof user.recent_sessions === 'string' ? 
                    JSON.parse(user.recent_sessions) : user.recent_sessions;
            } catch (e) {
                recentSessions = [];
            }
        }
        
        // Cria o HTML do modal
        const modalHtml = `
            <div class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content large" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Detalhes do Usuário #${user.id}</h2>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="user-details-grid">
                            <div class="detail-row">
                                <strong>Nome:</strong> ${user.name}
                            </div>
                            <div class="detail-row">
                                <strong>Email:</strong> ${user.email}
                            </div>
                            <div class="detail-row">
                                <strong>Papel:</strong> <span class="role-badge ${user.role}">${user.role === 'admin' ? 'Admin' : 'Usuário'}</span>
                            </div>
                            <div class="detail-row">
                                <strong>Status:</strong> <span class="status-badge ${user.status}">${user.status === 'active' ? 'Ativo' : (user.status === 'blocked' ? 'Bloqueado' : 'Inativo')}</span>
                            </div>
                            <div class="detail-row">
                                <strong>Cadastro:</strong> ${created}
                            </div>
                            <div class="detail-row">
                                <strong>Último login:</strong> ${lastLogin}
                            </div>
                        </div>
                        
                        <h3>Estatísticas</h3>
                        <div class="stats-grid small">
                            <div class="stat-box">
                                <span class="stat-label">Total Quiz</span>
                                <span class="stat-number">${totalQuiz}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">Acertos</span>
                                <span class="stat-number">${totalCorrect}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">Taxa de Acerto</span>
                                <span class="stat-number">${hitRate}%</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">Tempo de Estudo</span>
                                <span class="stat-number">${studyHours}h ${studyMinutes}m</span>
                            </div>
                        </div>
                        
                        <h3>Forças e Fraquezas</h3>
                        <div class="strengths-weaknesses-grid">
                            <div class="strengths-section">
                                <h4>Forças</h4>
                                ${strengths.length > 0 ? 
                                    strengths.map(s => `
                                        <div class="strength-item">
                                            <i class="fas fa-check-circle" style="color: #10b981;"></i>
                                            ${s.category} (${s.hit_rate}%)
                                        </div>
                                    `).join('') : 
                                    '<p class="no-data">Nenhuma força identificada</p>'
                                }
                            </div>
                            <div class="weaknesses-section">
                                <h4>Fraquezas</h4>
                                ${weaknesses.length > 0 ? 
                                    weaknesses.map(w => `
                                        <div class="weakness-item">
                                            <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>
                                            ${w.category} (${w.hit_rate}%)
                                        </div>
                                    `).join('') : 
                                    '<p class="no-data">Nenhuma fraqueza identificada</p>'
                                }
                            </div>
                        </div>
                        
                        <h3>Desempenho por Categoria</h3>
                        <div class="category-stats">
                            ${Object.keys(categoryStats).length > 0 ? 
                                Object.entries(categoryStats).map(([cat, data]) => `
                                    <div class="category-item">
                                        <span class="category-name">${cat}</span>
                                        <div class="progress-container">
                                            <div class="progress-bar">
                                                <div class="progress-fill" style="width: ${data.hit_rate}%"></div>
                                            </div>
                                            <span class="category-percent">${data.hit_rate.toFixed(1)}% (${data.correct}/${data.total})</span>
                                        </div>
                                    </div>
                                `).join('') 
                                : '<p class="no-data">Nenhum dado de categoria disponível</p>'
                            }
                        </div>
                        
                        <h3>Últimas Sessões de Quiz</h3>
                        <div class="sessions-list">
                            ${recentSessions.length > 0 ?
                                recentSessions.map(session => `
                                    <div class="session-item">
                                        <span class="session-date">${new Date(session.date).toLocaleDateString()}</span>
                                        <span class="session-score">${session.correct}/${session.total} acertos</span>
                                        <span class="session-rate">${session.hit_rate.toFixed(1)}%</span>
                                    </div>
                                `).join('')
                                : '<p class="no-data">Nenhuma sessão encontrada</p>'
                            }
                        </div>
                        
                        <h3>Histórico de Ações (Admin)</h3>
                        <div class="admin-history">
                            ${user.admin_history && user.admin_history.length > 0 ?
                                user.admin_history.map(log => `
                                    <div class="history-item">
                                        <span class="history-date">${new Date(log.date).toLocaleString()}</span>
                                        <span class="history-admin">${log.admin_name}</span>
                                        <span class="history-action">${log.action}</span>
                                    </div>
                                `).join('')
                                : '<p class="no-data">Nenhuma ação registrada</p>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showNotification('Erro ao carregar detalhes do usuário', 'error');
    }
}

// ===== EDITAR USUÁRIO =====
async function openEditUserModal(userId) {
    try {
        let user = usersList.find(u => u.id === userId);
        
        if (!user) {
            const data = await authenticatedFetch(`/admin/users/${userId}`);
            user = data.data;
        }
        
        if (!user) {
            showNotification('Usuário não encontrado', 'error');
            return;
        }
        
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
        
        const modalHtml = `
            <div class="modal-overlay" onclick="closeModal(event)">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>Editar Usuário</h2>
                        <button class="modal-close" onclick="closeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="editUserForm" onsubmit="updateUser(event, ${userId})">
                            <div class="form-group">
                                <label>ID</label>
                                <input type="text" value="${user.id}" disabled class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Nome</label>
                                <input type="text" id="editName" value="${user.name}" required class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" id="editEmail" value="${user.email}" required class="form-control">
                            </div>
                            <div class="form-group">
                                <label>Papel</label>
                                <select id="editRole" class="form-control">
                                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>Usuário</option>
                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Status</label>
                                <select id="editStatus" class="form-control">
                                    <option value="active" ${user.status === 'active' ? 'selected' : ''}>Ativo</option>
                                    <option value="inactive" ${user.status === 'inactive' ? 'selected' : ''}>Inativo</option>
                                    <option value="blocked" ${user.status === 'blocked' ? 'selected' : ''}>Bloqueado</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Nova Senha (deixe em branco para não alterar)</label>
                                <input type="password" id="editPassword" placeholder="••••••" class="form-control">
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn-save">Salvar</button>
                                <button type="button" class="btn-cancel" onclick="closeModal()">Cancelar</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        console.error('Erro ao abrir edição:', error);
        showNotification('Erro ao carregar dados do usuário', 'error');
    }
}

async function updateUser(event, userId) {
    event.preventDefault();
    
    const name = document.getElementById('editName').value;
    const email = document.getElementById('editEmail').value;
    const role = document.getElementById('editRole').value;
    const status = document.getElementById('editStatus').value;
    const password = document.getElementById('editPassword').value;
    
    if (!name || !email) {
        showNotification('Nome e email são obrigatórios', 'error');
        return;
    }
    
    const updates = { name, email, role, status };
    if (password) {
        updates.password = password;
    }
    
    try {
        await authenticatedFetch(`/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        
        showNotification('Usuário atualizado com sucesso!', 'success');
        closeModal();
        loadUsers();
        
    } catch (error) {
        console.error('Erro ao atualizar:', error);
        showNotification(error.message || 'Erro ao atualizar usuário', 'error');
    }
}

async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    const action = newStatus === 'blocked' ? 'bloquear' : 'ativar';
    
    if (!confirm(`Deseja ${action} este usuário?`)) return;
    
    try {
        await authenticatedFetch(`/admin/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        
        showNotification(`Usuário ${action}do com sucesso!`, 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        showNotification(error.message || 'Erro ao alterar status', 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;
    
    try {
        await authenticatedFetch(`/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        showNotification('Usuário excluído com sucesso!', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showNotification(error.message || 'Erro ao excluir usuário', 'error');
    }
}

// ===== MENSAGENS =====
async function loadMessages() {
    try {
        showLoading('Carregando mensagens...');
        
        const data = await authenticatedFetch('/admin/mensagens');
        const messages = data.data.messages || [];
        const counts = data.data.counts || {};
        
        hideLoading();
        
        // Atualiza contadores no dashboard
        updateMessageCounts(counts);
        
        // Renderiza mensagens
        renderMessages(messages);
        
    } catch (error) {
        hideLoading();
        console.error('Erro ao carregar mensagens:', error);
        showNotification('Erro ao carregar mensagens', 'error');
    }
}

function updateMessageCounts(counts) {
    // Atualiza o card de mensagens no dashboard
    const messageStat = document.querySelectorAll('.stat-value')[2];
    if (messageStat) {
        messageStat.textContent = counts.total || '0';
    }
}

function renderMessages(messages) {
    const container = document.getElementById('mensagens');
    if (!container) return;
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="section-header">
                <h2>Todas as Mensagens</h2>
            </div>
            <div class="empty-state">
                <i class="fas fa-envelope-open-text"></i>
                <p>Nenhuma mensagem encontrada</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="section-header">
            <h2>Todas as Mensagens</h2>
            <div class="message-filters">
                <button class="filter-btn active" data-filter="all">Todas</button>
                <button class="filter-btn" data-filter="text">Texto</button>
                <button class="filter-btn" data-filter="image">Imagens</button>
                <button class="filter-btn" data-filter="audio">Áudios</button>
                <button class="filter-btn" data-filter="file">Arquivos</button>
            </div>
        </div>
        <div class="messages-grid" id="messagesGrid">
    `;
    
    messages.forEach(msg => {
        const date = new Date(msg.created_at).toLocaleString();
        const typeIcon = {
            'text': 'fa-comment',
            'image': 'fa-image',
            'audio': 'fa-microphone',
            'file': 'fa-file'
        }[msg.message_type] || 'fa-comment';
        
        html += `
            <div class="message-card" data-type="${msg.message_type}">
                <div class="message-header">
                    <div class="message-user">
                        <i class="fas fa-user-circle"></i>
                        <span>${msg.user_name}</span>
                    </div>
                    <span class="message-type"><i class="fas ${typeIcon}"></i> ${msg.message_type}</span>
                </div>
                <div class="message-body">
                    ${msg.message_type === 'image' ? 
                        `<img src="${msg.file_url}" alt="Imagem" class="message-image">` : 
                        msg.message_type === 'audio' ?
                        `<audio controls src="${msg.file_url}" class="message-audio"></audio>` :
                        `<p>${msg.content}</p>`
                    }
                </div>
                <div class="message-footer">
                    <span class="message-date">${date}</span>
                    ${msg.file_name ? `<span class="message-file">📎 ${msg.file_name}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Adiciona filtros
    setupMessageFilters();
}

function setupMessageFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            const cards = document.querySelectorAll('.message-card');
            
            cards.forEach(card => {
                if (filter === 'all' || card.dataset.type === filter) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });
}

// ===== MÍDIAS =====
async function loadMedia() {
    try {
        showLoading('Carregando mídias...');
        
        const data = await authenticatedFetch('/admin/midias');
        const images = data.data.images || [];
        const audios = data.data.audios || [];
        
        hideLoading();
        
        renderMedia(images, audios);
        
    } catch (error) {
        hideLoading();
        console.error('Erro ao carregar mídias:', error);
        showNotification('Erro ao carregar mídias', 'error');
    }
}

function renderMedia(images, audios) {
    const container = document.getElementById('midias');
    if (!container) return;
    
    const totalImages = images.length;
    const totalAudios = audios.length;
    
    let html = `
        <div class="section-header">
            <h2>Biblioteca de Mídias</h2>
            <div class="media-tabs">
                <button class="media-tab active" data-tab="images">Imagens (${totalImages})</button>
                <button class="media-tab" data-tab="audios">Áudios (${totalAudios})</button>
            </div>
        </div>
        
        <div class="media-tab-content active" id="images-tab">
            <div class="media-grid">
    `;
    
    if (images.length === 0) {
        html += '<div class="empty-state"><i class="fas fa-images"></i><p>Nenhuma imagem encontrada</p></div>';
    } else {
        images.forEach(img => {
            html += `
                <div class="media-card" onclick="viewMedia('${img.file_url}', 'image')">
                    <img src="${img.file_url}" alt="${img.file_name}" class="media-preview">
                    <div class="media-info">
                        <span class="media-name">${img.file_name}</span>
                        <span class="media-user">${img.user_name}</span>
                        <span class="media-date">${new Date(img.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
        });
    }
    
    html += `
            </div>
        </div>
        
        <div class="media-tab-content" id="audios-tab">
            <div class="media-grid">
    `;
    
    if (audios.length === 0) {
        html += '<div class="empty-state"><i class="fas fa-microphone"></i><p>Nenhum áudio encontrado</p></div>';
    } else {
        audios.forEach(audio => {
            html += `
                <div class="media-card audio">
                    <div class="audio-preview" onclick="playAudio('${audio.file_url}')">
                        <i class="fas fa-play-circle"></i>
                        <span>Ouvir áudio</span>
                    </div>
                    <div class="media-info">
                        <span class="media-name">${audio.file_name}</span>
                        <span class="media-user">${audio.user_name}</span>
                        <span class="media-date">${new Date(audio.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            `;
        });
    }
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Configura as abas
    setupMediaTabs();
}

function setupMediaTabs() {
    document.querySelectorAll('.media-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.media-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.media-tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });
}

function viewMedia(url, type) {
    // Abre a mídia em um modal
    const modalHtml = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content large" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Visualizar ${type === 'image' ? 'Imagem' : 'Mídia'}</h2>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${type === 'image' ? 
                        `<img src="${url}" style="max-width: 100%; max-height: 70vh;">` : 
                        `<video controls src="${url}" style="max-width: 100%; max-height: 70vh;"></video>`
                    }
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function playAudio(url) {
    const audio = new Audio(url);
    audio.play();
}

// ===== MELHORAR A BUSCA NO NAVBAR =====
function setupEnhancedSearch() {
    const searchInput = document.querySelector('.search-box input');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', debounce(async (e) => {
        const term = e.target.value.toLowerCase().trim();
        
        if (term.length < 2) {
            // Se menos de 2 caracteres, recarrega a seção atual
            loadSectionData(currentSection);
            return;
        }
        
        showLoading('Buscando...');
        
        try {
            if (currentSection === 'usuarios') {
                // Filtro local de usuários
                filterUsers(term);
            } else if (currentSection === 'mensagens') {
                // Busca mensagens
                const data = await authenticatedFetch('/admin/mensagens');
                const messages = data.data.messages || [];
                
                const filtered = messages.filter(msg => 
                    msg.content?.toLowerCase().includes(term) ||
                    msg.user_name?.toLowerCase().includes(term) ||
                    msg.user_email?.toLowerCase().includes(term)
                );
                
                renderMessages(filtered);
            } else if (currentSection === 'midias') {
                // Busca mídias
                const data = await authenticatedFetch('/admin/midias');
                const images = data.data.images || [];
                const audios = data.data.audios || [];
                
                const filteredImages = images.filter(img => 
                    img.file_name?.toLowerCase().includes(term) ||
                    img.user_name?.toLowerCase().includes(term)
                );
                
                const filteredAudios = audios.filter(audio => 
                    audio.file_name?.toLowerCase().includes(term) ||
                    audio.user_name?.toLowerCase().includes(term)
                );
                
                renderMedia(filteredImages, filteredAudios);
            }
            
            showNotification(`Resultados para: "${term}"`, 'info');
            
        } catch (error) {
            console.error('Erro na busca:', error);
        } finally {
            hideLoading();
        }
    }, 500));
}

// ===== ATUALIZAR LOAD SECTION DATA =====
// Substitua a função loadSectionData por esta:

async function loadSectionData(section) {
    try {
        switch(section) {
            case 'dashboard':
                await loadDashboard();
                break;
            case 'usuarios':
                await loadUsers();
                break;
            case 'mensagens':
                await loadMessages();
                break;
            case 'midias':
                await loadMedia();
                break;
            case 'assinaturas':
                showNotification('Funcionalidade em desenvolvimento', 'info');
                break;
            case 'configuracoes':
                showNotification('Funcionalidade em desenvolvimento', 'info');
                break;
        }
    } catch (error) {
        console.error(`Erro ao carregar ${section}:`, error);
        showNotification(`Erro ao carregar dados: ${error.message}`, 'error');
    }
}

// ===== SHOW/HIDE LOADING =====
function showLoading(message = 'Carregando...') {
    let loader = document.querySelector('.admin-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.className = 'admin-loader';
        loader.innerHTML = `
            <div class="loader-spinner"></div>
            <div class="loader-message"></div>
        `;
        document.body.appendChild(loader);
    }
    loader.querySelector('.loader-message').textContent = message;
    loader.classList.add('active');
}

function hideLoading() {
    const loader = document.querySelector('.admin-loader');
    if (loader) {
        loader.classList.remove('active');
    }
}

// ===== MODAL =====
function closeModal(event) {
    if (event && event.target.classList.contains('modal-overlay')) {
        event.target.remove();
    } else {
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    }
}

// ===== NOTIFICAÇÕES =====
function showNotification(message, type = 'info') {
    let notification = document.querySelector('.admin-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'admin-notification';
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.className = `admin-notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ===== DEBOUNCE =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Menu items
    document.querySelectorAll('.nav-item').forEach(item => {
        if (!item.classList.contains('logout-btn')) {
            item.addEventListener('click', (e) => {
                const section = item.dataset.section;
                if (section) {
                    toggleSection(section, e);
                }
            });
        }
    });
    
    // Logout
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Refresh button
    const refreshBtn = document.querySelector('.btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadSectionData(currentSection);
            showNotification('Dados atualizados!', 'success');
        });
    }
    
    // Search input
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            if (currentSection === 'usuarios') {
                filterUsers(e.target.value);
            }
        }, 500));
    }
    
    // "Ver todos" links
    document.querySelectorAll('.card-header a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
            if (section) {
                toggleSection(section, e);
            }
        });
    });
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAdminAuth()) return;
    
    const user = getUserData();
    if (user) {
        document.querySelector('.user-name').textContent = user.name || 'Admin';
        document.querySelector('.user-role').textContent = 'Administrador';
    }
    
    const today = new Date();
    const dateSpan = document.querySelector('.header-date span');
    if (dateSpan) {
        dateSpan.textContent = today.toLocaleDateString('pt-BR');
    }
    
    setupEventListeners();
    await loadDashboard();
});

// ===== EXPORTA FUNÇÕES GLOBAIS =====
window.openEditUserModal = openEditUserModal;
window.toggleUserStatus = toggleUserStatus;
window.viewUserDetails = viewUserDetails;
window.deleteUser = deleteUser;
window.updateUser = updateUser;
window.closeModal = closeModal;
window.toggleSection = toggleSection;
window.logout = logout;