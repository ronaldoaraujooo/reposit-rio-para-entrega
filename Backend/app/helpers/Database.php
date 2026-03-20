<?php
namespace App\Helpers;

use PDO;
use Config\Database as DB;

class Database
{
    private $db;
    private $connection;

    public function __construct()
    {
        $this->db = DB::getInstance();
        $this->connection = $this->db->getConnection();
    }

    public function getConnection()
    {
        return $this->connection;
    }

    public function selectOne($sql, $params = [])
    {
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch();
    }

    public function selectAll($sql, $params = [])
    {
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function insert($table, $data)
    {
        $fields = array_keys($data);
        $placeholders = array_map(function($field) {
            return ':' . $field;
        }, $fields);
        
        $sql = "INSERT INTO {$table} (" . implode(', ', $fields) . ") 
                VALUES (" . implode(', ', $placeholders) . ") 
                RETURNING id";
        
        $stmt = $this->connection->prepare($sql);
        $stmt->execute($data);
        
        $result = $stmt->fetch();
        return $result['id'];
    }

    public function lastInsertId($name = null)
    {
        return $this->connection->lastInsertId($name);
    }

    public function update($table, $data, $where, $whereParams = [])
    {
        $fields = array_keys($data);
        $set = implode(' = ?, ', $fields) . ' = ?';
        
        $sql = "UPDATE {$table} SET {$set} WHERE {$where}";
        $params = array_merge(array_values($data), $whereParams);
        
        $stmt = $this->connection->prepare($sql);
        return $stmt->execute($params);
    }

    public function delete($table, $where, $params = [])
    {
        $sql = "DELETE FROM {$table} WHERE {$where}";
        $stmt = $this->connection->prepare($sql);
        return $stmt->execute($params);
    }

    public function beginTransaction()
    {
        return $this->connection->beginTransaction();
    }

    public function commit()
    {
        return $this->connection->commit();
    }

    public function rollback()
    {
        return $this->connection->rollback();
    }
}