const CONFIG = {
    API_URL: 'http://localhost:8080/api',
    DEV_MODE: true
};

// Armazenar token e usuário
function setAuth(token, user) {
    localStorage.setItem('authToken', token);
    localStorage.setItem('user', JSON.stringify(user));
}

function getAuthToken() {
    return localStorage.getItem('authToken');
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = '/Pages/login.html';
}

function isAuthenticated() {
    return !!getAuthToken();
}

function isAdmin() {
    const user = getUser();
    return user && user.role === 'admin';
}