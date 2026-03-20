const API_BASE_URL = 'http://localhost:8080/api';
const ENDPOINTS = {
    LOGIN: '/auth/login',
    VERIFY_TOKEN: '/auth/verify'
};

// Configuração de redirecionamentos
const PAGES = {
    CHAT: '/Pages/chat.html',
    CRIAR_CONTA: '/Pages/CriarConta.html',
    RECUPERAR_SENHA: '/Pages/RecuperarSenha.html'
};

// Timeout para requisições 
const REQUEST_TIMEOUT = 15000;

// Elementos do DOM
const normalLoginBtn = document.getElementById('normalLoginBtn');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const normalLoginForm = document.getElementById('normalLoginForm');
const adminLoginForm = document.getElementById('adminLoginForm');
const submitNormalLogin = document.getElementById('submitNormalLogin');
const adminRedirectBtn = document.getElementById('adminRedirectBtn');
const loadingOverlay = document.getElementById('loadingOverlay');

// Inputs
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const rememberCheckbox = document.getElementById('remember');

// Mensagens de erro
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');

// ===== FUNÇÕES AUXILIARES =====
function redirectTo(page) {
    window.location.href = page;
}

function showLoading() {
    loadingOverlay.classList.remove('hidden');
    submitNormalLogin.disabled = true;
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    submitNormalLogin.disabled = false;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function clearErrors() {
    emailError.textContent = '';
    passwordError.textContent = '';
    emailInput.classList.remove('error');
    passwordInput.classList.remove('error');
}

function showError(input, errorElement, message) {
    input.classList.add('error');
    errorElement.textContent = message;
}

// ===== FUNÇÃO DE REQUISIÇÃO COM TIMEOUT =====
async function fetchWithTimeout(url, options, timeout = REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('Tempo limite excedido. O servidor não respondeu.');
        }
        throw error;
    }
}

// ===== VALIDAÇÃO DO FORMULÁRIO NORMAL =====
function validateNormalLogin() {
    let isValid = true;
    clearErrors();

    if (!emailInput.value.trim()) {
        showError(emailInput, emailError, 'O e-mail é obrigatório');
        isValid = false;
    } else if (!validateEmail(emailInput.value.trim())) {
        showError(emailInput, emailError, 'Digite um e-mail válido');
        isValid = false;
    }

    if (!passwordInput.value) {
        showError(passwordInput, passwordError, 'A senha é obrigatória');
        isValid = false;
    }

    return isValid;
}

// ===== LOGIN NORMAL COM BACKEND REAL =====
async function handleNormalLogin(event) {
    event.preventDefault();

    if (!validateNormalLogin()) {
        normalLoginForm.classList.add('shake');
        setTimeout(() => normalLoginForm.classList.remove('shake'), 300);
        return;
    }

    const loginData = {
        email: emailInput.value.trim(),
        password: passwordInput.value
        // 'remember' é controlado pelo backend via expires_at
    };

    showLoading();

    try {
        console.log('Enviando requisição para o backend:', `${API_BASE_URL}${ENDPOINTS.LOGIN}`);
        
        // Enviar requisição para o backend
        const response = await fetchWithTimeout(`${API_BASE_URL}${ENDPOINTS.LOGIN}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        // Verificar se a resposta é válida
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Servidor não encontrado. Verifique se o backend está rodando na porta 8080');
            }
            
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `Erro ${response.status}: ${response.statusText}`);
        }

        // Processar resposta
        const data = await response.json();

        // Validar estrutura da resposta
        if (!data || typeof data !== 'object') {
            throw new Error('Resposta inválida do servidor');
        }

        // Verificar sucesso do login
        if (!data.success) {
            throw new Error(data.message || 'E-mail ou senha incorretos');
        }

        // VERIFICAÇÃO DE SEGURANÇA: Impedir login de admin aqui
        if (data.data?.user?.role === 'admin') {
            throw new Error('Acesso negado. Use o login de administrador.');
        }

        // Login bem-sucedido para usuário normal
        console.log('Login realizado com sucesso:', data);

        // Salvar dados de autenticação
        if (data.data?.token) {
            if (rememberCheckbox.checked) {
                localStorage.setItem('authToken', data.data.token);
                localStorage.setItem('userEmail', loginData.email);
                localStorage.setItem('rememberEmail', loginData.email);
            } else {
                sessionStorage.setItem('authToken', data.data.token);
                localStorage.removeItem('rememberEmail');
            }

            // Salvar dados do usuário
            if (data.data?.user) {
                localStorage.setItem('userData', JSON.stringify(data.data.user));
            }
        }

        hideLoading();
        
        // Redirecionar para o chat
        redirectTo(PAGES.CHAT);

    } catch (error) {
        console.error('Erro no login:', error);
        
        // Tratamento de erros específicos
        if (error.message.includes('Failed to fetch') || error.message.includes('Servidor não encontrado')) {
            showError(emailInput, emailError, 'Não foi possível conectar ao servidor. Verifique se o backend está rodando na porta 8080');
        } else if (error.message.includes('Tempo limite excedido')) {
            showError(emailInput, emailError, 'O servidor demorou muito para responder. Tente novamente.');
        } else if (error.message.includes('Credenciais inválidas') || error.message.includes('E-mail ou senha incorretos')) {
            showError(passwordInput, passwordError, 'E-mail ou senha incorretos');
        } else if (error.message.includes('administrador')) {
            showError(emailInput, emailError, error.message);
        } else {
            showError(emailInput, emailError, error.message || 'Erro ao fazer login. Tente novamente.');
        }
        
        hideLoading();
    }
}

// ===== LOGIN ADMIN =====
function handleAdminLogin() {
    window.location.href = '../../Auth/LoginAuth/login.html';
}

// ===== VERIFICAR TOKEN SALVO =====
async function checkSavedToken() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const savedEmail = localStorage.getItem('rememberEmail');
    
    if (token) {
        try {
            showLoading();
            
            // Verificar token no backend
            const response = await fetchWithTimeout(`${API_BASE_URL}${ENDPOINTS.VERIFY_TOKEN}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Verificar se é admin (não deve estar aqui)
                if (data.data?.user?.role === 'admin') {
                    // Se for admin, limpar token e redirecionar para admin
                    localStorage.removeItem('authToken');
                    sessionStorage.removeItem('authToken');
                    window.location.href = '../../Auth/LoginAuth/login.html';
                    return;
                }
                
                // Token válido para usuário normal
                hideLoading();
                redirectTo(PAGES.CHAT);
                return;
            } else {
                // Token inválido, limpar
                localStorage.removeItem('authToken');
                sessionStorage.removeItem('authToken');
            }
            
        } catch (error) {
            console.error('Erro ao verificar token:', error);
            localStorage.removeItem('authToken');
            sessionStorage.removeItem('authToken');
        }
        
        hideLoading();
    }
    
    if (savedEmail) {
        emailInput.value = savedEmail;
        rememberCheckbox.checked = true;
    }
}

// ===== TOGGLE ENTRE TIPOS DE LOGIN =====
function toggleLoginType(type) {
    if (type === 'normal') {
        normalLoginBtn.classList.add('active');
        adminLoginBtn.classList.remove('active');
        normalLoginForm.classList.add('active');
        adminLoginForm.classList.remove('active');
    } else {
        adminLoginBtn.classList.add('active');
        normalLoginBtn.classList.remove('active');
        adminLoginForm.classList.add('active');
        normalLoginForm.classList.remove('active');
    }
    clearErrors();
}

// ===== EVENT LISTENERS =====
if (normalLoginBtn && adminLoginBtn) {
    normalLoginBtn.addEventListener('click', () => toggleLoginType('normal'));
    adminLoginBtn.addEventListener('click', () => toggleLoginType('admin'));
}

if (normalLoginForm) {
    normalLoginForm.addEventListener('submit', handleNormalLogin);
}

if (adminRedirectBtn) {
    adminRedirectBtn.addEventListener('click', handleAdminLogin);
}

// Limpar erros ao digitar
if (emailInput) {
    emailInput.addEventListener('input', () => {
        emailInput.classList.remove('error');
        if (emailError) emailError.textContent = '';
    });
}

if (passwordInput) {
    passwordInput.addEventListener('input', () => {
        passwordInput.classList.remove('error');
        if (passwordError) passwordError.textContent = '';
    });
}

// Tecla Enter no formulário
if (normalLoginForm) {
    normalLoginForm.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNormalLogin(e);
        }
    });
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    checkSavedToken();
});

// Exportar função redirectTo para uso global
window.redirectTo = redirectTo;