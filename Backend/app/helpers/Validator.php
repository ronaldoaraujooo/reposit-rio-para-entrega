<?php
namespace App\Helpers;

class Validator
{
    private $errors = [];
    private $data = [];

    public function validate($data, $rules)
    {
        $this->data = $data;
        $this->errors = [];

        foreach ($rules as $field => $ruleString) {
            $rules = explode('|', $ruleString);
            
            foreach ($rules as $rule) {
                $this->applyRule($field, $rule);
            }
        }

        return empty($this->errors);
    }

    private function applyRule($field, $rule)
    {
        $params = [];
        
        if (strpos($rule, ':') !== false) {
            list($rule, $param) = explode(':', $rule);
            $params = explode(',', $param);
        }

        $value = $this->data[$field] ?? null;

        switch ($rule) {
            case 'required':
                if (empty($value)) {
                    $this->addError($field, "O campo {$field} é obrigatório");
                }
                break;

            case 'email':
                if (!empty($value) && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $this->addError($field, "O campo {$field} deve ser um email válido");
                }
                break;

            case 'min':
                $min = $params[0];
                if (strlen($value) < $min) {
                    $this->addError($field, "O campo {$field} deve ter no mínimo {$min} caracteres");
                }
                break;

            case 'max':
                $max = $params[0];
                if (strlen($value) > $max) {
                    $this->addError($field, "O campo {$field} deve ter no máximo {$max} caracteres");
                }
                break;

            case 'numeric':
                if (!is_numeric($value)) {
                    $this->addError($field, "O campo {$field} deve ser numérico");
                }
                break;

            case 'confirmed':
                $confirmation = $this->data[$field . '_confirmation'] ?? null;
                if ($value !== $confirmation) {
                    $this->addError($field, "A confirmação do campo {$field} não corresponde");
                }
                break;
        }
    }

    private function addError($field, $message)
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = [];
        }
        $this->errors[$field][] = $message;
    }

    public function getErrors()
    {
        return $this->errors;
    }
}