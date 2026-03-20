<?php
namespace App\Middlewares;

class CorsMiddleware
{
    public function handle($request)
    {
        $allowedOrigins = explode(',', $_ENV['CORS_ALLOWED_ORIGINS'] ?? '');
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        if (in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Max-Age: 3600');
        }

        // Responde preflight requests
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit();
        }

        return $request;
    }
}