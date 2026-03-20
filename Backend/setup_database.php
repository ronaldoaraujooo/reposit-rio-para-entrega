<?php
require_once __DIR__ . '/vendor/autoload.php';

use Dotenv\Dotenv;

// Carrega variáveis de ambiente
if (file_exists(__DIR__ . '/.env')) {
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->load();
} else {
    die(" Arquivo .env não encontrado. Crie um arquivo .env baseado no .env.example\n");
}



try {
    // Validações iniciais
    $required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER'];
    foreach ($required as $field) {
        if (!isset($_ENV[$field]) || empty($_ENV[$field])) {
            throw new Exception("Variável {$field} não configurada no .env");
        }
    }

    echo "📡 Conectando ao PostgreSQL...\n";
    
    // Conecta ao PostgreSQL (sem selecionar banco específico)
    $dsn = sprintf(
        "pgsql:host=%s;port=%s",
        $_ENV['DB_HOST'],
        $_ENV['DB_PORT']
    );
    
    $pdo = new PDO(
        $dsn,
        $_ENV['DB_USER'],
        $_ENV['DB_PASS'] ?? '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
    
    echo " Conectado ao PostgreSQL com sucesso!\n\n";
    
    // Verifica se o banco já existe
    echo "Verificando banco de dados '{$_ENV['DB_NAME']}'...\n";
    
    $stmt = $pdo->query("SELECT 1 FROM pg_database WHERE datname = '" . $_ENV['DB_NAME'] . "'");
    $dbExists = $stmt->fetch();
    
    if (!$dbExists) {
        echo "Criando banco de dados...\n";
        $pdo->exec("CREATE DATABASE {$_ENV['DB_NAME']} ENCODING 'UTF8'");
        echo "Banco de dados '{$_ENV['DB_NAME']}' criado com sucesso!\n\n";
    } else {
        echo "Banco de dados '{$_ENV['DB_NAME']}' já existe.\n\n";
    }
    
    // Reconecta ao banco específico para criar as tabelas
    echo "Conectando ao banco '{$_ENV['DB_NAME']}'...\n";
    
    $dsn = sprintf(
        "pgsql:host=%s;port=%s;dbname=%s",
        $_ENV['DB_HOST'],
        $_ENV['DB_PORT'],
        $_ENV['DB_NAME']
    );
    
    $pdo = new PDO(
        $dsn,
        $_ENV['DB_USER'],
        $_ENV['DB_PASS'] ?? '',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    echo "Conectado ao banco '{$_ENV['DB_NAME']}'\n\n";
    
    // Verifica se o arquivo SQL existe
    $sqlFile = __DIR__ . '/database.pgsql.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("Arquivo database.pgsql.sql não encontrado na raiz do projeto");
    }
    
    // Lê e executa o script SQL
    echo "Executando script SQL...\n";
    $sql = file_get_contents($sqlFile);
    
    // Divide o script em comandos individuais
    $commands = array_filter(array_map('trim', explode(';', $sql)));
    $total = count($commands);
    $success = 0;
    $errors = 0;
    
    foreach ($commands as $index => $command) {
        if (!empty($command)) {
            try {
                $pdo->exec($command);
                $success++;
                echo "  ✓ [" . ($index + 1) . "/{$total}] " . substr($command, 0, 60) . "...\n";
            } catch (PDOException $e) {
                $errors++;
                echo "  ⚠ [" . ($index + 1) . "/{$total}] Aviso: " . $e->getMessage() . "\n";
            }
        }
    }
    
    
} catch (PDOException $e) {
    echo "\n Erro de banco de dados:\n";
    echo "   " . $e->getMessage() . "\n\n";
    echo "Verifique:\n";
    echo "  • Se o PostgreSQL está rodando\n";
    echo "  • Se as credenciais no .env estão corretas\n";
    echo "  • Se o host e porta estão acessíveis\n\n";
    
} catch (Exception $e) {
    echo "\n Erro: " . $e->getMessage() . "\n\n";
}