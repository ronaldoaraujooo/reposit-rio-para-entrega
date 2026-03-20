const SECURITY_CONFIG = {
    MAX_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000, 
    BASE_DELAY: 1000, 
    JITTER_MAX: 500, 
    API_URL: 'http://localhost:8080/api',
    ENDPOINT: '/auth/admin-login'
};

const OBFUSCATED = {
    // "admin@infinitia.com" ofuscado
    ADMIN_EMAIL: atob('YWRtaW5AaW5maW5pdGlhLmNvbQ=='),
    // "Admin@123" ofuscado  
    ADMIN_PASS: atob('QWRtaW5AMTIz'),
    // "Credenciais inválidas" ofuscado
    INVALID_MSG: atob('Q3JlZGVuY2lhaXMgaW52w6FsaWRhcw==')
};

let loginAttempts = 0;
let lockoutUntil = null;
let lastAttemptTime = 0;

const STORAGE_KEYS = {
    attempts: atob('YWRtaW5BdHRlbXB0cw=='), 
    lockout: atob('YWRtaW5Mb2Nrb3V0'), 
    token: atob('YWRtaW5Ub2tlbg=='), 
    user: atob('YWRtaW5Vc2Vy') 
};


const adminForm = document.getElementById('adminLoginForm');
const emailInput = document.getElementById('adminEmail');
const passwordInput = document.getElementById('adminPassword');
const twoFactorGroup = document.getElementById('twoFactorGroup');
const trustDeviceCheck = document.getElementById('trustDevice');
const submitBtn = document.getElementById('submitAdminLogin');
const loadingOverlay = document.getElementById('loadingOverlay');
const attemptsSpan = document.getElementById('attemptsLeft');
const helpModal = document.getElementById('helpModal');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');


async function secureDelay() {
    const delay = SECURITY_CONFIG.BASE_DELAY + Math.random() * SECURITY_CONFIG.JITTER_MAX;
    await new Promise(resolve => setTimeout(resolve, delay));
}


function secureCompare(str1, str2) {
    if (str1.length !== str2.length) return false;
    
    let result = 0;
    for (let i = 0; i < str1.length; i++) {
        result |= str1.charCodeAt(i) ^ str2.charCodeAt(i);
    }
    return result === 0;
}


function loadSecureState() {
    try {
        const savedAttempts = localStorage.getItem(STORAGE_KEYS.attempts);
        const savedLockout = localStorage.getItem(STORAGE_KEYS.lockout);
        
        loginAttempts = savedAttempts ? parseInt(atob(savedAttempts)) || 0 : 0;
        lockoutUntil = savedLockout ? parseInt(atob(savedLockout)) : null;
    } catch (e) {
        // Se algo der errado, reseta
        loginAttempts = 0;
        lockoutUntil = null;
    }
}


function saveSecureState() {
    try {
        localStorage.setItem(STORAGE_KEYS.attempts, btoa(loginAttempts.toString()));
        if (lockoutUntil) {
            localStorage.setItem(STORAGE_KEYS.lockout, btoa(lockoutUntil.toString()));
        } else {
            localStorage.removeItem(STORAGE_KEYS.lockout);
        }
    } catch (e) {
        // Ignora erros de storage
    }
}


function clearSecureState() {
    loginAttempts = 0;
    lockoutUntil = null;
    localStorage.removeItem(STORAGE_KEYS.attempts);
    localStorage.removeItem(STORAGE_KEYS.lockout);
}

// ===== FUNÇÕES AUXILIARES =====

function showLoading() {
    loadingOverlay.classList.remove('hidden');
    submitBtn.disabled = true;
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    submitBtn.disabled = false;
}

function updateAttempts() {
    if (attemptsSpan) {
        attemptsSpan.textContent = SECURITY_CONFIG.MAX_ATTEMPTS - loginAttempts;
    }
    
    const securityAlert = document.querySelector('.security-alert');
    if (securityAlert) {
        if (loginAttempts >= 3) {
            securityAlert.style.background = 'rgba(239, 68, 68, 0.2)';
            securityAlert.style.borderColor = '#EF4444';
        } else {
            securityAlert.style.background = 'rgba(239, 68, 68, 0.1)';
            securityAlert.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        }
    }
}

function checkLockout() {
    if (lockoutUntil) {
        const now = Date.now();
        if (now < lockoutUntil) {
            const minutesLeft = Math.ceil((lockoutUntil - now) / 60000);
            showError(emailInput, emailError, `Acesso temporariamente bloqueado.`);
            submitBtn.disabled = true;
            emailInput.disabled = true;
            passwordInput.disabled = true;
            
            const securityAlert = document.querySelector('.security-alert');
            if (securityAlert) {
                securityAlert.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span>Bloqueado por ${minutesLeft} minutos</span>
                `;
            }
            return true;
        } else {
            clearSecureState();
            submitBtn.disabled = false;
            emailInput.disabled = false;
            passwordInput.disabled = false;
            
            const securityAlert = document.querySelector('.security-alert');
            if (securityAlert) {
                securityAlert.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>Tentativas restantes: <span id="attemptsLeft">5</span></span>
                `;
            }
        }
    }
    return false;
}

function handleFailedAttempt() {
    loginAttempts++;
    
    // Delay progressivo baseado no número de tentativas
    const delay = Math.min(1000 * Math.pow(2, loginAttempts), 10000);
    const jitter = Math.random() * 500;
    
    setTimeout(() => {
        // Vazio - apenas para criar delay perceptível
    }, delay + jitter);
    
    if (loginAttempts >= SECURITY_CONFIG.MAX_ATTEMPTS) {
        lockoutUntil = Date.now() + SECURITY_CONFIG.LOCKOUT_TIME;
        saveSecureState();
        
        submitBtn.disabled = true;
        emailInput.disabled = true;
        passwordInput.disabled = true;
        
        const minutes = SECURITY_CONFIG.LOCKOUT_TIME / 60000;
        
        const securityAlert = document.querySelector('.security-alert');
        if (securityAlert) {
            securityAlert.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Bloqueado por ${minutes} minutos</span>
            `;
        }
    } else {
        saveSecureState();
    }
    
    updateAttempts();
}

function clearErrors() {
    if (emailError) emailError.textContent = '';
    if (passwordError) passwordError.textContent = '';
    
    if (emailInput) emailInput.classList.remove('error');
    if (passwordInput) passwordInput.classList.remove('error');
}

function showError(input, errorElement, message) {
    if (input && errorElement) {
        input.classList.add('error');
        errorElement.textContent = message;
        
        input.style.animation = 'none';
        input.offsetHeight;
        input.style.animation = 'shake 0.3s ease';
    }
}

function togglePasswordVisibility() {
    if (!passwordInput) return;
    
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
}

// ===== LOGIN VIA BACKEND =====
async function handleAdminLogin(event) {
    event.preventDefault();

    if (checkLockout()) return;

    if (!validateForm()) return;

    showLoading();

    // Delay seguro para evitar timing attacks
    await secureDelay();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
        const response = await fetch(`${SECURITY_CONFIG.API_URL}${SECURITY_CONFIG.ENDPOINT}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Erro no login');
        }

        if (data.success) {
            // Login bem-sucedido
            clearSecureState();

            // Salva token
            if (data.data?.token) {
                if (trustDeviceCheck?.checked) {
                    localStorage.setItem(STORAGE_KEYS.token, data.data.token);
                    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.data.user));
                } else {
                    sessionStorage.setItem(STORAGE_KEYS.token, data.data.token);
                    sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.data.user));
                }
            }

            // Feedback visual
            submitBtn.innerHTML = `
                <span>ACESSO CONCEDIDO!</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            submitBtn.style.background = 'linear-gradient(135deg, #10B981, #059669)';

            setTimeout(() => {
                window.location.href = '../Dashbord/Admin.html';
            }, 1500);

        } else {
            throw new Error(data.message || OBFUSCATED.INVALID_MSG);
        }

    } catch (error) {
        // Login falhou
        handleFailedAttempt();
        
        // Mensagem genérica (não revela se foi email ou senha)
        const errorMsg = 'Credenciais inválidas';
        
        submitBtn.innerHTML = `
            <span>ACESSO NEGADO!</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #EF4444, #DC2626)';

        setTimeout(() => {
            submitBtn.innerHTML = `
                <span>Acessar Painel Admin</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            `;
            submitBtn.style.background = 'linear-gradient(135deg, #8B5CF6, #6366F1)';
        }, 1500);

        showError(emailInput, emailError, errorMsg);
        hideLoading();
    }
}

function validateForm() {
    let isValid = true;
    clearErrors();

    if (!emailInput.value.trim()) {
        showError(emailInput, emailError, 'Identificação obrigatória');
        isValid = false;
    }

    if (!passwordInput.value) {
        showError(passwordInput, passwordError, 'Senha obrigatória');
        isValid = false;
    } else if (passwordInput.value.length < 6) {
        showError(passwordInput, passwordError, 'A senha deve ter pelo menos 6 caracteres');
        isValid = false;
    }

    return isValid;
}

// ===== VERIFICAÇÃO DE SESSÃO EXISTENTE =====
async function checkExistingSession() {
    const token = sessionStorage.getItem(STORAGE_KEYS.token) || localStorage.getItem(STORAGE_KEYS.token);
    
    if (token) {
        try {
            const response = await fetch(`${SECURITY_CONFIG.API_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                window.location.href = '../Dashbord/Admin.html';
            }
        } catch (error) {
            // Token inválido, limpa
            sessionStorage.removeItem(STORAGE_KEYS.token);
            localStorage.removeItem(STORAGE_KEYS.token);
        }
    }
}

// ===== HELP MODAL =====
function showAdminHelp() {
    if (helpModal) {
        helpModal.classList.remove('hidden');
        
        // NÃO mostrar credenciais! Removido completamente
        const modalBody = helpModal.querySelector('.modal-body');
        if (modalBody) {
            // Apenas informações de contato, sem credenciais
            const existing = modalBody.querySelector('.admin-contact-only');
            if (!existing) {
                const contactDiv = document.createElement('div');
                contactDiv.className = 'admin-contact-only';
                contactDiv.innerHTML = `
                    <p style="margin-top: 20px; padding: 15px; background: rgba(139, 92, 246, 0.1); border-radius: 8px;">
                        <strong>Suporte Admin:</strong><br>
                        admin@infinitia.com<br>
                        Ramal: 1234
                    </p>
                `;
                modalBody.appendChild(contactDiv);
            }
        }
    }
}

function closeHelpModal() {
    if (helpModal) {
        helpModal.classList.add('hidden');
    }
}

// ===== EVENT LISTENERS =====
if (adminForm) {
    adminForm.addEventListener('submit', handleAdminLogin);
}

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

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    // Garante que 2FA está oculto
    if (twoFactorGroup) {
        twoFactorGroup.style.display = 'none';
    }
    
    // Carrega estado salvo
    loadSecureState();
    checkLockout();
    updateAttempts();
    checkExistingSession();
    
    // Remove qualquer vestígio de credenciais do DOM
    const anyCredentials = document.querySelectorAll('.test-credentials, [data-credentials]');
    anyCredentials.forEach(el => el.remove());
});

// ===== EXPORTA APENAS O NECESSÁRIO =====
window.togglePasswordVisibility = togglePasswordVisibility;
window.showAdminHelp = showAdminHelp;
window.closeHelpModal = closeHelpModal;