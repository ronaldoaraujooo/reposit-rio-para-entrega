const signupForm = document.getElementById('signupForm');
const fullNameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const termsCheckbox = document.getElementById('terms');
const submitBtn = document.getElementById('submitSignup');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Elementos de erro
const fullNameError = document.getElementById('fullNameError');
const emailError = document.getElementById('emailError');
const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');

// Elemento de força da senha
const strengthBar = document.querySelector('.strength-bar');

// ===== FUNÇÕES AUXILIARES =====
function redirectTo(page) {
    window.location.href = page;
}

function showLoading() {
    loadingOverlay.classList.remove('hidden');
    submitBtn.disabled = true;
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    submitBtn.disabled = false;
}

function showToast(message, type = 'error') {
    toastMessage.textContent = message;
    toast.classList.remove('hidden', 'success', 'error');
    toast.classList.add(type);
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 5000);
}

function clearErrors() {
    [fullNameError, emailError, passwordError, confirmPasswordError].forEach(el => {
        if (el) el.textContent = '';
    });
    
    [fullNameInput, emailInput, passwordInput, confirmPasswordInput].forEach(input => {
        if (input) input.classList.remove('error');
    });
}

function showError(input, errorElement, message) {
    if (input && errorElement) {
        input.classList.add('error');
        errorElement.textContent = message;
    }
}

// ===== VALIDAÇÕES =====
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;
    
    return strength;
}

function updatePasswordStrength(password) {
    if (!strengthBar) return;
    
    const strength = validatePasswordStrength(password);
    
    strengthBar.classList.remove('weak', 'medium', 'strong');
    
    if (password.length === 0) {
        strengthBar.style.width = '0';
    } else if (strength <= 2) {
        strengthBar.classList.add('weak');
    } else if (strength <= 4) {
        strengthBar.classList.add('medium');
    } else {
        strengthBar.classList.add('strong');
    }
}

function validateForm() {
    let isValid = true;
    clearErrors();

    // Validar nome completo
    if (!fullNameInput.value.trim()) {
        showError(fullNameInput, fullNameError, 'Nome completo é obrigatório');
        isValid = false;
    } else if (fullNameInput.value.trim().length < 3) {
        showError(fullNameInput, fullNameError, 'Nome deve ter pelo menos 3 caracteres');
        isValid = false;
    }

    // Validar email
    if (!emailInput.value.trim()) {
        showError(emailInput, emailError, 'E-mail é obrigatório');
        isValid = false;
    } else if (!validateEmail(emailInput.value.trim())) {
        showError(emailInput, emailError, 'Digite um e-mail válido');
        isValid = false;
    }

    // Validar senha
    if (!passwordInput.value) {
        showError(passwordInput, passwordError, 'Senha é obrigatória');
        isValid = false;
    } else if (passwordInput.value.length < 6) {
        showError(passwordInput, passwordError, 'Senha deve ter no mínimo 6 caracteres');
        isValid = false;
    }

    // Validar confirmação de senha
    if (!confirmPasswordInput.value) {
        showError(confirmPasswordInput, confirmPasswordError, 'Confirme sua senha');
        isValid = false;
    } else if (passwordInput.value !== confirmPasswordInput.value) {
        showError(confirmPasswordInput, confirmPasswordError, 'As senhas não coincidem');
        isValid = false;
    }

    // Validar termos
    if (!termsCheckbox.checked) {
        showToast('Você precisa aceitar os termos de uso', 'error');
        isValid = false;
    }

    return isValid;
}

// ===== HANDLER PRINCIPAL =====
async function handleSignup(event) {
    event.preventDefault();

    if (!validateForm()) {
        signupForm.classList.add('shake');
        setTimeout(() => signupForm.classList.remove('shake'), 300);
        return;
    }

    showLoading();

    try {
        // Usar a função registerUser do auth.js
        const result = await registerUser(
            fullNameInput.value.trim(),
            emailInput.value.trim().toLowerCase(),
            passwordInput.value
        );

        if (result.success) {
            // Sucesso no cadastro
            showToast('Conta criada com sucesso! Redirecionando...', 'success');
            
            // Aguardar um pouco para mostrar o toast
            setTimeout(() => {
                // Redirecionar para o chat (já está logado)
                window.location.href = '/Pages/chat.html';
            }, 2000);
        } else {
            hideLoading();
            if (result.message.includes('Email já cadastrado')) {
                showError(emailInput, emailError, 'Este e-mail já está cadastrado');
                showToast('E-mail já cadastrado. Faça login ou use outro e-mail.', 'error');
            } else {
                showToast(result.message || 'Erro ao criar conta. Tente novamente.', 'error');
            }
        }
    } catch (error) {
        console.error('Erro no cadastro:', error);
        hideLoading();
        showToast(error.message || 'Erro ao criar conta. Tente novamente.', 'error');
    }
}

// ===== TOGGLE PASSWORD VISIBILITY =====
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    
    // Atualizar ícone
    const button = input.nextElementSibling;
    if (button) {
        if (type === 'text') {
            button.style.color = 'var(--primary-color)';
        } else {
            button.style.color = 'var(--text-secondary)';
        }
    }
}

// ===== EVENT LISTENERS =====
if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
}

// Validação em tempo real
if (fullNameInput) {
    fullNameInput.addEventListener('input', () => {
        fullNameInput.classList.remove('error');
        if (fullNameError) fullNameError.textContent = '';
    });
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
        updatePasswordStrength(passwordInput.value);
    });
}

if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', () => {
        confirmPasswordInput.classList.remove('error');
        if (confirmPasswordError) confirmPasswordError.textContent = '';
    });
}

// Verificar autenticação ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    // Se já estiver logado, redireciona para o chat
    if (isAuthenticated && isAuthenticated()) {
        window.location.href = '/Pages/chat.html';
    }
    
    // Verificar se veio com parâmetro de redirecionamento
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('from') === 'login') {
        const email = localStorage.getItem('signupEmail');
        if (email) {
            emailInput.value = email;
            localStorage.removeItem('signupEmail');
        }
    }
});

// Exportar funções para uso global
window.redirectTo = redirectTo;
window.togglePassword = togglePassword;