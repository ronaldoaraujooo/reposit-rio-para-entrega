<?php
namespace App\Middlewares;

use App\Helpers\Response;

class RateLimitMiddleware
{
    private $limit;
    private $timeWindow = 60; 

    public function __construct()
    {
        $this->limit = $_ENV['RATE_LIMIT'] ?? 100;
    }

    public function handle($request)
    {
        $ip = $_SERVER['REMOTE_ADDR'];
        $key = "rate_limit:{$ip}";
        $current = $_SESSION[$key] ?? ['count' => 0, 'reset' => time() + $this->timeWindow];

        // Reset se passou do tempo
        if (time() > $current['reset']) {
            $current = ['count' => 0, 'reset' => time() + $this->timeWindow];
        }

        $current['count']++;

        // Salva na sessão 
        $_SESSION[$key] = $current;

        // Headers de rate limit
        header('X-RateLimit-Limit: ' . $this->limit);
        header('X-RateLimit-Remaining: ' . max(0, $this->limit - $current['count']));
        header('X-RateLimit-Reset: ' . $current['reset']);

        if ($current['count'] > $this->limit) {
            return Response::error('Muitas requisições. Tente novamente em alguns instantes.', null, 429);
        }

        return $request;
    }
}