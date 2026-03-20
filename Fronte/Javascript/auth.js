// Registro de usuário
async function registerUser(name, email, password) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (data.success) {
            setAuth(data.data.token, data.data.user);
            return { success: true, data: data.data };
        } else {
            return { success: false, message: data.message };
        }
    } catch (error) {
        console.error('Erro no registro:', error);
        return { success: false, message: 'Erro de conexão com o servidor' };
    }
}

// Login de usuário
async function loginUser(email, password) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            setAuth(data.data.token, data.data.user);
            return { success: true, data: data.data };
        } else {
            return { success: false, message: data.message };
        }
    } catch (error) {
        console.error('Erro no login:', error);
        return { success: false, message: 'Erro de conexão com o servidor' };
    }
}

// Login de admin
async function loginAdmin(email, password) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/auth/admin-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            setAuth(data.data.token, data.data.user);
            return { success: true, data: data.data };
        } else {
            return { success: false, message: data.message };
        }
    } catch (error) {
        console.error('Erro no login admin:', error);
        return { success: false, message: 'Erro de conexão com o servidor' };
    }
}

// Requisição autenticada
async function authenticatedFetch(url, options = {}) {
    const token = getAuthToken();
    
    if (!token) {
        logout();
        throw new Error('Não autenticado');
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };

    const response = await fetch(`${CONFIG.API_URL}${url}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        logout();
        throw new Error('Sessão expirada');
    }

    return response;
}