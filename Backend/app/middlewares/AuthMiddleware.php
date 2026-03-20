<?php
namespace App\Middlewares;

use App\Helpers\JWT;
use App\Helpers\Response;
use App\Helpers\Database;

class AuthMiddleware
{
    public function handle($request)
    {
        $headers = getallheaders();
        $auth = $headers['Authorization'] ?? '';

        if (empty($auth)) {
            return Response::unauthorized('Token não fornecido');
        }

        $token = str_replace('Bearer ', '', $auth);
        
        // Valida o token
        $payload = JWT::validate($token);
        
        if (!$payload) {
            return Response::unauthorized('Token inválido ou expirado');
        }

        // Verifica se a sessão ainda é válida no banco
        $db = new Database();
        $session = $db->selectOne(
            "SELECT * FROM sessions WHERE token = ? AND is_revoked = FALSE AND expires_at > NOW()",
            [$token]
        );

        if (!$session) {
            return Response::unauthorized('Sessão inválida');
        }

        // Verifica se o usuário ainda existe e está ativo
        $user = $db->selectOne(
            "SELECT id, name, email, role FROM users WHERE id = ? AND status = 'active'",
            [$payload['user_id']]
        );

        if (!$user) {
            return Response::unauthorized('Usuário não encontrado ou inativo');
        }

        // Atualiza last_activity
        $db->getConnection()->prepare(
            "UPDATE sessions SET last_activity = NOW() WHERE id = ?"
        )->execute([$session['id']]);

        // Adiciona usuário ao request
        $request['user'] = [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role']
        ];
        
        return $request;
    }
}