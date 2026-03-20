<?php
namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Database;

class AdminController
{
    private $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    public function dashboard()
    {
        // Estatísticas gerais
        $stats = $this->db->selectOne("SELECT * FROM admin_system_stats");
        
        // Últimos usuários
        $recentUsers = $this->db->selectAll(
            "SELECT id, name, email, status FROM users WHERE role = 'user' ORDER BY created_at DESC LIMIT 10"
        );
        
        // Atividades recentes
        $recentActivities = $this->db->selectAll(
            "SELECT * FROM admin_recent_activity LIMIT 20"
        );

        return Response::success('Dashboard carregado', [
            'stats' => $stats,
            'recent_users' => $recentUsers,
            'recent_activities' => $recentActivities
        ]);
    }

    public function listUsers()
    {
        $users = $this->db->selectAll(
            "SELECT * FROM admin_users_list ORDER BY created_at DESC"
        );

        return Response::success('Usuários carregados', $users);
    }

    public function getUser($id)
    {
        $user = $this->db->selectOne(
            "SELECT * FROM admin_user_details WHERE id = ?",
            [$id]
        );

        if (!$user) {
            return Response::notFound('Usuário não encontrado');
        }

        return Response::success('Usuário carregado', $user);
    }

    public function getMessages()
    {
        $messages = $this->db->selectAll(
            "SELECT 
                m.id,
                m.content,
                m.sender,
                m.message_type,
                m.file_url,
                m.file_name,
                m.created_at,
                u.name as user_name,
                u.email as user_email,
                c.title as conversation_title
             FROM messages m
             JOIN users u ON m.user_id = u.id
             LEFT JOIN conversations c ON m.conversation_id = c.id
             ORDER BY m.created_at DESC
             LIMIT 100"
        );

        // Contagem de mensagens por tipo
        $counts = $this->db->selectOne(
            "SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN message_type = 'text' THEN 1 END) as text_count,
                COUNT(CASE WHEN message_type = 'image' THEN 1 END) as image_count,
                COUNT(CASE WHEN message_type = 'audio' THEN 1 END) as audio_count,
                COUNT(CASE WHEN message_type = 'file' THEN 1 END) as file_count
             FROM messages"
        );

        return Response::success('Mensagens carregadas', [
            'messages' => $messages,
            'counts' => $counts
        ]);
    }

    public function getMedia()
    {
        $media = $this->db->selectAll(
            "SELECT 
                m.id,
                m.file_url,
                m.file_name,
                m.file_size,
                m.message_type,
                m.created_at,
                u.name as user_name,
                u.email as user_email
             FROM messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.message_type IN ('image', 'audio')
             ORDER BY m.created_at DESC"
        );

        // Agrupar por tipo
        $images = array_filter($media, fn($item) => $item['message_type'] === 'image');
        $audios = array_filter($media, fn($item) => $item['message_type'] === 'audio');

        return Response::success('Mídias carregadas', [
            'all' => $media,
            'images' => array_values($images),
            'audios' => array_values($audios),
            'total_images' => count($images),
            'total_audios' => count($audios)
        ]);
    }

    public function getMessageStats()
    {
        $stats = $this->db->selectOne(
            "SELECT 
                COUNT(*) as total_messages,
                COUNT(CASE WHEN created_at > CURRENT_DATE THEN 1 END) as today_messages,
                COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_messages,
                COUNT(CASE WHEN sender = 'ia' THEN 1 END) as ia_messages
             FROM messages"
        );

        return Response::success('Estatísticas de mensagens', $stats);
    }

    // ===== CRUD DE USUÁRIOS (já existente) =====
    public function createUser()
    {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $name = $data['name'] ?? '';
        $email = $data['email'] ?? '';
        $password = $data['password'] ?? '';
        $role = $data['role'] ?? 'user';
        $status = $data['status'] ?? 'active';

        if (empty($name) || empty($email) || empty($password)) {
            return Response::error('Nome, email e senha são obrigatórios');
        }

        $existing = $this->db->selectOne(
            "SELECT id FROM users WHERE email = ?",
            [$email]
        );

        if ($existing) {
            return Response::error('Email já cadastrado');
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $headers = getallheaders();
        $token = str_replace('Bearer ', '', $headers['Authorization'] ?? '');
        
        $admin = $this->db->selectOne(
            "SELECT user_id FROM sessions WHERE token = ? AND is_revoked = FALSE",
            [$token]
        );
        
        $adminId = $admin ? $admin['user_id'] : null;

        $userId = $this->db->insert('users', [
            'name' => $name,
            'email' => $email,
            'password' => $passwordHash,
            'role' => $role,
            'status' => $status,
            'created_by' => $adminId
        ]);

        return Response::success('Usuário criado com sucesso', ['id' => $userId], 201);
    }

    public function updateUser($id)
    {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $updates = [];
        $allowed = ['name', 'email', 'role', 'status'];
        
        foreach ($allowed as $field) {
            if (isset($data[$field])) {
                $updates[$field] = $data[$field];
            }
        }

        if (isset($data['password']) && !empty($data['password'])) {
            $updates['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        }

        if (empty($updates)) {
            return Response::error('Nenhum dado para atualizar');
        }

        if (isset($updates['email'])) {
            $existing = $this->db->selectOne(
                "SELECT id FROM users WHERE email = ? AND id != ?",
                [$updates['email'], $id]
            );
            
            if ($existing) {
                return Response::error('Email já está em uso por outro usuário');
            }
        }

        $headers = getallheaders();
        $token = str_replace('Bearer ', '', $headers['Authorization'] ?? '');
        
        $admin = $this->db->selectOne(
            "SELECT user_id FROM sessions WHERE token = ? AND is_revoked = FALSE",
            [$token]
        );
        
        $adminId = $admin ? $admin['user_id'] : null;

        $sets = [];
        $params = [];
        foreach ($updates as $field => $value) {
            $sets[] = "$field = ?";
            $params[] = $value;
        }
        $sets[] = "updated_by = ?";
        $params[] = $adminId;
        $sets[] = "updated_at = NOW()";
        
        $params[] = $id;
        
        $sql = "UPDATE users SET " . implode(', ', $sets) . " WHERE id = ?";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute($params);

        $this->db->insert('admin_logs', [
            'admin_id' => $adminId,
            'action_type' => 'UPDATE',
            'target_type' => 'user',
            'target_id' => $id,
            'new_values' => json_encode($updates)
        ]);

        return Response::success('Usuário atualizado');
    }

    public function toggleUserStatus($id)
    {
        $data = json_decode(file_get_contents('php://input'), true);
        $status = $data['status'] ?? null;

        if (!in_array($status, ['active', 'inactive', 'blocked'])) {
            return Response::error('Status inválido');
        }

        $current = $this->db->selectOne(
            "SELECT status FROM users WHERE id = ?",
            [$id]
        );

        if (!$current) {
            return Response::notFound('Usuário não encontrado');
        }

        $headers = getallheaders();
        $token = str_replace('Bearer ', '', $headers['Authorization'] ?? '');
        
        $admin = $this->db->selectOne(
            "SELECT user_id FROM sessions WHERE token = ? AND is_revoked = FALSE",
            [$token]
        );
        
        $adminId = $admin ? $admin['user_id'] : null;

        $this->db->getConnection()->prepare(
            "UPDATE users SET status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?"
        )->execute([$status, $adminId, $id]);

        $this->db->insert('admin_logs', [
            'admin_id' => $adminId,
            'action_type' => $status === 'blocked' ? 'BLOCK' : 'ACTIVATE',
            'target_type' => 'user',
            'target_id' => $id,
            'old_values' => json_encode(['status' => $current['status']]),
            'new_values' => json_encode(['status' => $status])
        ]);

        return Response::success('Status do usuário atualizado');
    }

    public function deleteUser($id)
    {
        $user = $this->db->selectOne(
            "SELECT role FROM users WHERE id = ?",
            [$id]
        );

        if (!$user) {
            return Response::notFound('Usuário não encontrado');
        }

        if ($user['role'] === 'admin') {
            return Response::error('Não é possível excluir um administrador');
        }

        $headers = getallheaders();
        $token = str_replace('Bearer ', '', $headers['Authorization'] ?? '');
        
        $admin = $this->db->selectOne(
            "SELECT s.user_id, u.email as admin_email 
             FROM sessions s 
             JOIN users u ON s.user_id = u.id 
             WHERE s.token = ? AND s.is_revoked = FALSE",
            [$token]
        );

        $this->db->insert('admin_logs', [
            'admin_id' => $admin ? $admin['user_id'] : null,
            'admin_email' => $admin ? $admin['admin_email'] : null,
            'action_type' => 'DELETE',
            'target_type' => 'user',
            'target_id' => $id,
            'old_values' => json_encode($user)
        ]);

        $this->db->getConnection()->prepare(
            "DELETE FROM users WHERE id = ? AND role = 'user'"
        )->execute([$id]);

        return Response::success('Usuário excluído');
    }

    public function getLogs()
    {
        $logs = $this->db->selectAll(
            "SELECT * FROM admin_action_logs LIMIT 100"
        );

        return Response::success('Logs carregados', $logs);
    }
}