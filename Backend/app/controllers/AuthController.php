<?php
namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Database;
use App\Helpers\JWT;

class AuthController
{
    private $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    public function register()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $name = $data['name'] ?? '';
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($name) || empty($email) || empty($password)) {
            return Response::error('Todos os campos são obrigatórios');
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return Response::error('Email inválido');
        }

        if (strlen($password) < 6) {
            return Response::error('A senha deve ter no mínimo 6 caracteres');
        }

        $existing = $this->db->selectOne(
            "SELECT id FROM users WHERE email = ?",
            [$email]
        );

        if ($existing) {
            return Response::error('Email já cadastrado');
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $userId = $this->db->insert('users', [
            'name' => $name,
            'email' => $email,
            'password' => $passwordHash,
            'role' => 'user',
            'status' => 'active'
        ]);

        if (!$userId) {
            return Response::error('Erro ao criar usuário', null, 500);
        }

        $token = JWT::generate([
            'user_id' => $userId,
            'email' => $email,
            'role' => 'user'
        ]);

        $this->db->insert('sessions', [
            'user_id' => $userId,
            'token' => $token,
            'token_type' => 'user',
            'expires_at' => date('Y-m-d H:i:s', time() + $_ENV['JWT_EXPIRATION']),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        return Response::success('Usuário criado com sucesso', [
            'user' => [
                'id' => $userId,
                'name' => $name,
                'email' => $email
            ],
            'token' => $token
        ], 201);
    }

    public function login()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($email) || empty($password)) {
            return Response::error('Email e senha obrigatórios');
        }

        $user = $this->db->selectOne(
            "SELECT * FROM users WHERE email = ? AND role = 'user'",
            [$email]
        );

        if (!$user) {
            return Response::unauthorized('Credenciais inválidas');
        }

        if ($user['status'] !== 'active') {
            return Response::error('Usuário bloqueado. Contate o administrador.');
        }

        if (!password_verify($password, $user['password'])) {
            return Response::unauthorized('Credenciais inválidas');
        }

        $token = JWT::generate([
            'user_id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role']
        ]);

        $this->db->getConnection()->prepare(
            "UPDATE sessions SET is_revoked = TRUE WHERE user_id = ? AND token_type = 'user'"
        )->execute([$user['id']]);

        $this->db->insert('sessions', [
            'user_id' => $user['id'],
            'token' => $token,
            'token_type' => 'user',
            'expires_at' => date('Y-m-d H:i:s', time() + $_ENV['JWT_EXPIRATION']),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        $this->db->getConnection()->prepare(
            "UPDATE users SET last_login = NOW() WHERE id = ?"
        )->execute([$user['id']]);

        return Response::success('Login realizado', [
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email']
            ],
            'token' => $token
        ]);
    }

    public function adminLogin()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';

        if (empty($email) || empty($password)) {
            return Response::error('Email e senha obrigatórios');
        }

        // 1. VERIFICA RATE LIMIT
        $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        $rateCheck = $this->checkRateLimit($ip);
        
        if (!$rateCheck['allowed']) {
            return Response::error(
                "Muitas tentativas. Aguarde {$rateCheck['minutes']} minutos.", 
                null, 
                429
            );
        }

        // 2. DELAY ARTIFICIAL PARA EVITAR TIMING ATTACKS
        usleep(rand(300000, 600000)); // 300-600ms

        // 3. CREDENCIAIS FIXAS DO .ENV
        $adminEmail = $_ENV['ADMIN_EMAIL'] ?? 'admin@infinitia.com';
        $adminPassword = $_ENV['ADMIN_PASSWORD'] ?? 'Admin@123';

        // 4. COMPARAÇÃO SEGURA
        $emailMatch = hash_equals($adminEmail, $email);
        $passwordMatch = hash_equals($adminPassword, $password);

        if (!$emailMatch || !$passwordMatch) {
            $this->incrementRateLimit($ip);
            $this->logAdminAttempt($email, $ip, false);
            return Response::unauthorized('Credenciais inválidas');
        }

        // 5. LOGIN BEM-SUCEDIDO
        $this->clearRateLimit($ip);
        $this->logAdminAttempt($email, $ip, true);

        // Busca ou cria admin no banco
        $admin = $this->db->selectOne(
            "SELECT * FROM users WHERE email = ? AND role = 'admin'",
            [$email]
        );

        if (!$admin) {
            $adminId = $this->db->insert('users', [
                'name' => 'Administrador',
                'email' => $email,
                'password' => password_hash($adminPassword, PASSWORD_BCRYPT),
                'role' => 'admin',
                'status' => 'active'
            ]);

            $admin = [
                'id' => $adminId,
                'name' => 'Administrador',
                'email' => $email,
                'role' => 'admin'
            ];
        }

        // Gera token
        $token = JWT::generate([
            'user_id' => $admin['id'],
            'email' => $admin['email'],
            'role' => 'admin'
        ]);

        // Revoga sessões antigas
        $this->db->getConnection()->prepare(
            "UPDATE sessions SET is_revoked = TRUE WHERE user_id = ? AND token_type = 'admin'"
        )->execute([$admin['id']]);

        // Salva nova sessão
        $this->db->insert('sessions', [
            'user_id' => $admin['id'],
            'token' => $token,
            'token_type' => 'admin',
            'expires_at' => date('Y-m-d H:i:s', time() + $_ENV['JWT_EXPIRATION']),
            'ip_address' => $ip,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        // Atualiza last_login
        $this->db->getConnection()->prepare(
            "UPDATE users SET last_login = NOW() WHERE id = ?"
        )->execute([$admin['id']]);

        return Response::success('Login admin realizado', [
            'user' => [
                'id' => $admin['id'],
                'name' => $admin['name'],
                'email' => $admin['email'],
                'role' => 'admin'
            ],
            'token' => $token
        ]);
    }

    /* Verifica rate limit por IP */
    private function checkRateLimit($ip)
    {
        $maxAttempts = 5;
        $timeWindow = 900; // 15 minutos em segundos

        // Tenta criar tabela de rate limit se não existir
        try {
            $this->db->getConnection()->exec("
                CREATE TABLE IF NOT EXISTS rate_limits (
                    id SERIAL PRIMARY KEY,
                    ip_address VARCHAR(45) NOT NULL,
                    attempts INTEGER DEFAULT 1,
                    first_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(ip_address)
                )
            ");
        } catch (\Exception $e) {
            // Tabela já existe, ignorar
        }

        // Busca registros deste IP
        $record = $this->db->selectOne(
            "SELECT * FROM rate_limits WHERE ip_address = ?",
            [$ip]
        );

        if (!$record) {
            return ['allowed' => true, 'minutes' => 0];
        }

        // Verifica se o tempo já passou
        $timePassed = time() - strtotime($record['first_attempt']);
        
        if ($timePassed > $timeWindow) {
            // Reset após o tempo
            $this->db->getConnection()->prepare(
                "DELETE FROM rate_limits WHERE ip_address = ?"
            )->execute([$ip]);
            return ['allowed' => true, 'minutes' => 0];
        }

        if ($record['attempts'] >= $maxAttempts) {
            $minutesLeft = ceil(($timeWindow - $timePassed) / 60);
            return ['allowed' => false, 'minutes' => $minutesLeft];
        }

        return ['allowed' => true, 'minutes' => 0];
    }

    private function incrementRateLimit($ip)
    {
        try {
            // Tenta inserir novo registro
            $this->db->getConnection()->prepare(
                "INSERT INTO rate_limits (ip_address, attempts) VALUES (?, 1)
                 ON CONFLICT (ip_address) DO UPDATE SET
                 attempts = rate_limits.attempts + 1,
                 last_attempt = CURRENT_TIMESTAMP"
            )->execute([$ip]);
        } catch (\Exception $e) {
            // Fallback se não tiver ON CONFLICT (PostgreSQL mais antigo)
            $existing = $this->db->selectOne(
                "SELECT * FROM rate_limits WHERE ip_address = ?",
                [$ip]
            );
            
            if ($existing) {
                $this->db->getConnection()->prepare(
                    "UPDATE rate_limits SET attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP 
                     WHERE ip_address = ?"
                )->execute([$ip]);
            } else {
                $this->db->insert('rate_limits', [
                    'ip_address' => $ip,
                    'attempts' => 1
                ]);
            }
        }
    }

    
    private function clearRateLimit($ip)
    {
        $this->db->getConnection()->prepare(
            "DELETE FROM rate_limits WHERE ip_address = ?"
        )->execute([$ip]);
    }

    private function logAdminAttempt($email, $ip, $success)
    {
        $logFile = __DIR__ . '/../../logs/admin.log';
        $logDir = dirname($logFile);
        
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        $logEntry = json_encode([
            'timestamp' => date('Y-m-d H:i:s'),
            'email' => $email,
            'ip' => $ip,
            'success' => $success,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ]) . PHP_EOL;

        file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }

    public function logout()
    {
        $headers = getallheaders();
        $token = str_replace('Bearer ', '', $headers['Authorization'] ?? '');

        if ($token) {
            $this->db->getConnection()->prepare(
                "UPDATE sessions SET is_revoked = TRUE WHERE token = ?"
            )->execute([$token]);
        }

        return Response::success('Logout realizado');
    }

    public function verify()
    {
        $headers = getallheaders();
        $token = str_replace('Bearer ', '', $headers['Authorization'] ?? '');

        if (!$token) {
            return Response::unauthorized('Token não fornecido');
        }

        $payload = JWT::validate($token);
        
        if (!$payload) {
            return Response::unauthorized('Token inválido');
        }

        $session = $this->db->selectOne(
            "SELECT * FROM sessions WHERE token = ? AND is_revoked = FALSE AND expires_at > NOW()",
            [$token]
        );

        if (!$session) {
            return Response::unauthorized('Sessão inválida');
        }

        $user = $this->db->selectOne(
            "SELECT id, name, email, role FROM users WHERE id = ? AND status = 'active'",
            [$payload['user_id']]
        );

        if (!$user) {
            return Response::unauthorized('Usuário não encontrado');
        }

        return Response::success('Token válido', ['user' => $user]);
    }
}