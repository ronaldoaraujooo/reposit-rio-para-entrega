<?php

if (php_sapi_name() == 'cli-server') {
    // Roteia arquivos estáticos
    $url = parse_url($_SERVER["REQUEST_URI"]);
    $file = __DIR__ . $url['path'];
    
    if (is_file($file)) {
        return false; 
    }
    
    // Redireciona tudo para api/index.php
    require_once __DIR__ . '/api/index.php';
}