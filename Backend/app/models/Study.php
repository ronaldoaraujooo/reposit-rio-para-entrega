<?php
namespace App\Models;

use App\Helpers\Database;

class Study
{
    private $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    public function create($data)
    {
        $sql = "INSERT INTO studies (user_id, subject, duration, questions_answered, score, notes, created_at) 
                VALUES (:user_id, :subject, :duration, :questions_answered, :score, :notes, NOW()) 
                RETURNING id";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute([
            'user_id' => $data['user_id'],
            'subject' => $data['subject'],
            'duration' => $data['duration'],
            'questions_answered' => $data['questions_answered'] ?? 0,
            'score' => $data['score'] ?? 0,
            'notes' => $data['notes'] ?? null
        ]);
        
        $result = $stmt->fetch();
        return $result['id'];
    }

    public function findByUserId($userId, $limit = 50)
    {
        $sql = "SELECT * FROM studies 
                WHERE user_id = :user_id 
                ORDER BY created_at DESC 
                LIMIT :limit";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->bindValue('user_id', $userId, \PDO::PARAM_INT);
        $stmt->bindValue('limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        
        return $stmt->fetchAll();
    }

    public function getStats($userId)
    {
        $sql = "SELECT 
                    COUNT(*) as total_studies,
                    COALESCE(SUM(questions_answered), 0) as total_questions,
                    COALESCE(AVG(score), 0) as avg_score,
                    MAX(created_at) as last_study
                FROM studies 
                WHERE user_id = :user_id";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        
        return $stmt->fetch();
    }

    public function getProgress($userId, $days = 30)
    {
        $sql = "SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as studies_count,
                    COALESCE(SUM(questions_answered), 0) as questions_count,
                    COALESCE(AVG(score), 0) as avg_score
                FROM studies 
                WHERE user_id = :user_id 
                    AND created_at >= (CURRENT_TIMESTAMP - (:days || ' days')::INTERVAL)
                GROUP BY DATE(created_at)
                ORDER BY date DESC";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->bindValue('user_id', $userId, \PDO::PARAM_INT);
        $stmt->bindValue('days', $days, \PDO::PARAM_INT);
        $stmt->execute();
        
        return $stmt->fetchAll();
    }

    public function getSubjectStats($userId)
    {
        $sql = "SELECT 
                    subject,
                    COUNT(*) as total_sessions,
                    AVG(duration) as avg_duration,
                    AVG(score) as avg_score,
                    SUM(questions_answered) as total_questions
                FROM studies 
                WHERE user_id = :user_id
                GROUP BY subject
                ORDER BY total_sessions DESC";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        
        return $stmt->fetchAll();
    }

    public function getRecentActivity($userId, $limit = 10)
    {
        $sql = "SELECT * FROM studies 
                WHERE user_id = :user_id 
                ORDER BY created_at DESC 
                LIMIT :limit";
        
        $stmt = $this->db->getConnection()->prepare($sql);
        $stmt->bindValue('user_id', $userId, \PDO::PARAM_INT);
        $stmt->bindValue('limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        
        return $stmt->fetchAll();
    }
}