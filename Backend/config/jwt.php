<?php
namespace Config;

class JWT
{
    private static $secret;
    private static $expiration;

    public static function init()
    {
        self::$secret = $_ENV['JWT_SECRET'] ?? 'default_secret';
        self::$expiration = $_ENV['JWT_EXPIRATION'] ?? 86400;
    }

    public static function generate($payload)
    {
        self::init();
        
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode(array_merge($payload, [
            'iat' => time(),
            'exp' => time() + self::$expiration
        ]));

        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', 
            $base64UrlHeader . "." . $base64UrlPayload, 
            self::$secret, 
            true
        );
        
        $base64UrlSignature = self::base64UrlEncode($signature);
        
        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    public static function validate($token)
    {
        self::init();
        
        $parts = explode('.', $token);
        if (count($parts) != 3) {
            return false;
        }

        list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;

        $signature = self::base64UrlDecode($base64UrlSignature);
        
        $expectedSignature = hash_hmac('sha256', 
            $base64UrlHeader . "." . $base64UrlPayload, 
            self::$secret, 
            true
        );

        if (!hash_equals($expectedSignature, $signature)) {
            return false;
        }

        $payload = json_decode(self::base64UrlDecode($base64UrlPayload), true);
        
        if (!$payload || $payload['exp'] < time()) {
            return false;
        }

        return $payload;
    }

    private static function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode($data)
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}