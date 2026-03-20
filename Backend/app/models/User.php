<?php
namespace App\Models;

use App\Helpers\Database;

class User
{
    private $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    public function create($data)
    {
        $data['password'] = password_hash($data['password'], PASSWORD_BCRYPT);
        
        $sql = "INSERT INTO users (name, email, password, plan, created_at, updated_at) 
                VALUES (:name, :email, :password, :plan, NOW(), NOW()) 
                RETURNING id";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'plan' => $data['plan'] ?? 'basic'
        ]);
        
        $result = $stmt->fetch();
        return $result['id'];
    }

    public function findByEmail($email)
    {
        $sql = "SELECT * FROM users WHERE email = :email";
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute(['email' => $email]);
        return $stmt->fetch();
    }

    public function findById($id)
    {
        $sql = "SELECT id, name, email, plan, created_at, last_login 
                FROM users WHERE id = :id";
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function update($id, $data)
    {
        $fields = [];
        $params = ['id' => $id];
        
        foreach ($data as $key => $value) {
            $fields[] = "$key = :$key";
            $params[$key] = $value;
        }
        
        $sql = "UPDATE users SET " . implode(', ', $fields) . ", updated_at = NOW() 
                WHERE id = :id";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        return $stmt->execute($params);
    }

    public function updatePassword($id, $newPassword)
    {
        $hash = password_hash($newPassword, PASSWORD_BCRYPT);
        
        $sql = "UPDATE users SET password = :password, updated_at = NOW() 
                WHERE id = :id";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        return $stmt->execute([
            'id' => $id,
            'password' => $hash
        ]);
    }

    public function updateLastLogin($id)
    {
        $sql = "UPDATE users SET last_login = NOW() WHERE id = :id";
        $stmt = $this->db->getConnection()->prepare($sql);
        return $stmt->execute(['id' => $id]);
    }

    public function updatePlan($id, $plan)
    {
        $sql = "UPDATE users SET plan = :plan, updated_at = NOW() 
                WHERE id = :id";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        return $stmt->execute([
            'id' => $id,
            'plan' => $plan
        ]);
    }

    public function validatePassword($password, $hash)
    {
        return password_verify($password, $hash);
    }
}