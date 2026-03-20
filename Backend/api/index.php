<?php

// Ativar logs de erro
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../logs/php_errors.log');

// Carrega autoload
require_once __DIR__ . '/../vendor/autoload.php';


use Dotenv\Dotenv;


// Carrega variáveis de ambiente
$dotenv = Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}


// Roteamento simples
$uri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];

// Remove query string e base path
$uri = strtok($uri, '?');
$uri = str_replace('/api', '', $uri);
$uri = trim($uri, '/');

// Log para debug (opcional)
error_log("URI acessada: " . $uri);

try {
    // ===== ROTAS PÚBLICAS =====
    if ($uri === 'auth/register' && $method === 'POST') {
        $controller = new App\Controllers\AuthController();
        $controller->register();
    }
    elseif ($uri === 'auth/login' && $method === 'POST') {
        $controller = new App\Controllers\AuthController();
        $controller->login();
    }
    elseif ($uri === 'auth/admin-login' && $method === 'POST') {
        $controller = new App\Controllers\AuthController();
        $controller->adminLogin();
    }
    elseif ($uri === 'auth/verify' && $method === 'GET') {
        $controller = new App\Controllers\AuthController();
        $controller->verify();
    }
    
    // ===== ROTAS DO CHAT (protegidas) =====
    elseif ($uri === 'chat/conversations' && $method === 'GET') {
        $middleware = new App\Middlewares\AuthMiddleware();
        $request = $middleware->handle([]);
        if ($request instanceof App\Helpers\Response) return $request;
        
        $controller = new App\Controllers\ChatController();
        $controller->getConversations($request);
    }
    elseif ($uri === 'chat/conversations' && $method === 'POST') {
        $middleware = new App\Middlewares\AuthMiddleware();
        $request = $middleware->handle([]);
        if ($request instanceof App\Helpers\Response) return $request;
        
        $controller = new App\Controllers\ChatController();
        $controller->createConversation($request);
    }
    elseif (preg_match('/^chat\/messages\/(\d+)$/', $uri, $matches) && $method === 'GET') {
        $middleware = new App\Middlewares\AuthMiddleware();
        $request = $middleware->handle([]);
        if ($request instanceof App\Helpers\Response) return $request;
        
        $controller = new App\Controllers\ChatController();
        $controller->getMessages($request, $matches[1]);
    }
    elseif ($uri === 'chat/messages' && $method === 'POST') {
        $middleware = new App\Middlewares\AuthMiddleware();
        $request = $middleware->handle([]);
        if ($request instanceof App\Helpers\Response) return $request;
        
        $controller = new App\Controllers\ChatController();
        $controller->sendMessage($request);
    }
    elseif ($uri === 'chat/upload' && $method === 'POST') {
        $middleware = new App\Middlewares\AuthMiddleware();
        $request = $middleware->handle([]);
        if ($request instanceof App\Helpers\Response) return $request;
        
        $controller = new App\Controllers\ChatController();
        $controller->uploadFile($request);
    }
    elseif ($uri === 'chat/generate-quiz' && $method === 'POST') {
        $middleware = new App\Middlewares\AuthMiddleware();
        $request = $middleware->handle([]);
        if ($request instanceof App\Helpers\Response) return $request;
        
        $controller = new App\Controllers\ChatController();
        $controller->generateQuiz($request);
    }
    elseif ($uri === 'chat/submit-answer' && $method === 'POST') {
        $middleware = new App\Middlewares\AuthMiddleware();
        $request = $middleware->handle([]);
        if ($request instanceof App\Helpers\Response) return $request;
        
        $controller = new App\Controllers\ChatController();
        $controller->submitAnswer($request);
    }
    elseif ($uri === 'chat/stats' && $method === 'GET') {
        $middleware = new App\Middlewares\AuthMiddleware();
        $request = $middleware->handle([]);
        if ($request instanceof App\Helpers\Response) return $request;
        
        $controller = new App\Controllers\ChatController();
        $controller->getStats($request);
    }
    elseif ($uri === 'admin/dashboard' && $method === 'GET') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->dashboard();
}
elseif ($uri === 'admin/users' && $method === 'GET') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->listUsers();
}
elseif (preg_match('/^admin\/users\/(\d+)$/', $uri, $matches) && $method === 'GET') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->getUser($matches[1]);
}
elseif ($uri === 'admin/users' && $method === 'POST') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->createUser();
}
elseif (preg_match('/^admin\/users\/(\d+)$/', $uri, $matches) && $method === 'PUT') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->updateUser($matches[1]);
}
elseif (preg_match('/^admin\/users\/(\d+)\/status$/', $uri, $matches) && $method === 'PATCH') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->toggleUserStatus($matches[1]);
}
elseif (preg_match('/^admin\/users\/(\d+)$/', $uri, $matches) && $method === 'DELETE') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->deleteUser($matches[1]);
}
elseif ($uri === 'admin/logs' && $method === 'GET') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->getLogs();
}
elseif ($uri === 'admin/mensagens' && $method === 'GET') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->getMessages();
}
elseif ($uri === 'admin/mensagens/stats' && $method === 'GET') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->getMessageStats();
}

// ===== ROTAS DE MÍDIAS =====
elseif ($uri === 'admin/midias' && $method === 'GET') {
    $middleware = new App\Middlewares\AuthMiddleware();
    $request = $middleware->handle([]);
    if ($request instanceof App\Helpers\Response) return $request;
    
    if ($request['user']['role'] !== 'admin') {
        return Response::unauthorized('Acesso restrito a administradores');
    }
    
    $controller = new App\Controllers\AdminController();
    $controller->getMedia();
}
    
    // ===== ROTA NÃO ENCONTRADA =====
    else {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Rota não encontrada: ' . $uri
        ]);
    }
    
} catch (Exception $e) {
    $code = $e->getCode();
    
    if (is_numeric($code) && $code >= 100 && $code < 600) {
        http_response_code((int)$code);
    } else {
        // Se não for um código HTTP válido, usa 500
        http_response_code(500);
    }
    
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}