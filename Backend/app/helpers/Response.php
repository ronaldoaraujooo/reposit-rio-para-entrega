<?php
namespace App\Helpers;

class Response
{
    public static function json($data, $statusCode = 200)
    {
        http_response_code($statusCode);
        header('Content-Type: application/json');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function success($message, $data = null, $statusCode = 200)
    {
        $response = [
            'success' => true,
            'message' => $message
        ];

        if ($data !== null) {
            $response['data'] = $data;
        }

        return self::json($response, $statusCode);
    }

    public static function error($message, $errors = null, $statusCode = 400)
    {
        $response = [
            'success' => false,
            'message' => $message
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return self::json($response, $statusCode);
    }

    public static function unauthorized($message = 'Não autorizado')
    {
        return self::error($message, null, 401);
    }

    public static function notFound($message = 'Recurso não encontrado')
    {
        return self::error($message, null, 404);
    }
}