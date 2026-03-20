<?php
namespace App\Controllers;

// Função de log simples para debug
function debug_log($message) {
    $logFile = __DIR__ . '/../../logs/debug.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

use App\Helpers\Response;
use App\Helpers\Database;
use App\Helpers\Validator;

class ChatController
{
    private $db;

    public function __construct()
    {
        $this->db = new Database();
    }

    public function createConversation($request)
    {
        $userId = $request['user']['id'];
        $data = json_decode(file_get_contents('php://input'), true);
        
        $title = $data['title'] ?? 'Nova conversa';

        $conversationId = $this->db->insert('conversations', [
            'user_id' => $userId,
            'title' => $title
        ]);

        return Response::success('Conversa criada', [
            'conversation_id' => $conversationId,
            'title' => $title
        ]);
    }

    public function getConversations($request)
    {
        $userId = $request['user']['id'];

        $conversations = $this->db->selectAll(
            "SELECT * FROM conversations 
             WHERE user_id = ? 
             ORDER BY created_at DESC",
            [$userId]
        );

        return Response::success('Conversas carregadas', $conversations);
    }

    public function sendMessage($request)
    {
        $userId = $request['user']['id'];
        $data = json_decode(file_get_contents('php://input'), true);
        
        $conversationId = $data['conversation_id'] ?? null;
        $content = $data['content'] ?? '';

        if (empty($content)) {
            return Response::error('Mensagem vazia');
        }

        // Se não tiver conversa, cria uma nova
        if (!$conversationId) {
            $conversationId = $this->db->insert('conversations', [
                'user_id' => $userId,
                'title' => substr($content, 0, 50)
            ]);
        }

        // Salva mensagem do usuário
        $this->db->insert('messages', [
            'conversation_id' => $conversationId,
            'user_id' => $userId,
            'content' => $content,
            'sender' => 'user',
            'message_type' => 'text'
        ]);

        // Atualiza contador de mensagens
        $this->db->getConnection()->prepare(
            "UPDATE conversations SET message_count = message_count + 1 WHERE id = ?"
        )->execute([$conversationId]);

        // Em produção, aqui você chamaria uma API de IA
        $iaResponse = $this->generateIAResponse($content, $userId);
        
        // Salva resposta da IA
        $this->db->insert('messages', [
            'conversation_id' => $conversationId,
            'user_id' => $userId,
            'content' => $iaResponse['message'],
            'sender' => 'ia',
            'message_type' => 'text'
        ]);

        // Atualiza estatísticas diárias
        $this->updateDailyStats($userId, 'chat');

        return Response::success('Mensagem enviada', [
            'conversation_id' => $conversationId,
            'user_message' => [
                'content' => $content,
                'timestamp' => date('Y-m-d H:i:s')
            ],
            'ia_response' => [
                'content' => $iaResponse['message'],
                'timestamp' => date('Y-m-d H:i:s'),
                'generated_quiz' => $iaResponse['quiz'] ?? null
            ]
        ]);
    }
public function uploadFile($request)
{
    $userId = $request['user']['id'];
    
    if (!isset($_FILES['file'])) {
        return Response::error('Nenhum arquivo enviado');
    }

    $file = $_FILES['file'];
    $type = $_POST['type'] ?? 'file';
    $conversationId = $_POST['conversation_id'] ?? null;

    // Validações
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'audio/webm', 'audio/mp3', 'audio/ogg'];
    $maxSize = 10 * 1024 * 1024; // 10MB

    if (!in_array($file['type'], $allowedTypes)) {
        return Response::error('Tipo de arquivo não permitido');
    }

    if ($file['size'] > $maxSize) {
        return Response::error('Arquivo muito grande. Máximo 10MB');
    }

    // Define o caminho absoluto para a pasta uploads
    $uploadDir = __DIR__ . '/../../uploads/';
    
    // Cria a pasta se não existir
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }

    // Gera nome único
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid() . '_' . time() . '.' . $extension;
    $uploadPath = $uploadDir . $filename;

    // Move arquivo
    if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
        error_log("Erro ao mover arquivo: " . print_r(error_get_last(), true));
        return Response::error('Erro ao salvar arquivo');
    }

    // Gera URL relativa para acesso
    $fileUrl = '/uploads/' . $filename;

    // Se veio de uma conversa, salva como mensagem
    if ($conversationId) {
        $messageType = $type === 'audio' ? 'audio' : (strpos($file['type'], 'image') === 0 ? 'image' : 'file');
        
        $this->db->insert('messages', [
            'conversation_id' => $conversationId,
            'user_id' => $userId,
            'content' => $type === 'audio' ? '🎤 Mensagem de áudio' : "📎 Arquivo: {$file['name']}",
            'sender' => 'user',
            'message_type' => $messageType,
            'file_url' => $fileUrl,
            'file_name' => $file['name'],
            'file_size' => $file['size']
        ]);

        if ($type === 'audio') {
            $this->db->getConnection()->prepare(
                "UPDATE messages SET audio_transcript = ? WHERE id = ?"
            )->execute(['[Transcrição simulada do áudio]', $this->db->lastInsertId()]);
        }
    }

    return Response::success('Arquivo enviado', [
        'file_url' => $fileUrl,
        'file_name' => $file['name'],
        'file_size' => $file['size'],
        'conversation_id' => $conversationId
    ]);
}

    public function getMessages($request, $conversationId)
    {
        $userId = $request['user']['id'];

        // Verifica se a conversa pertence ao usuário
        $conversation = $this->db->selectOne(
            "SELECT id FROM conversations WHERE id = ? AND user_id = ?",
            [$conversationId, $userId]
        );

        if (!$conversation) {
            return Response::notFound('Conversa não encontrada');
        }

        $messages = $this->db->selectAll(
            "SELECT * FROM messages 
             WHERE conversation_id = ? 
             ORDER BY created_at ASC",
            [$conversationId]
        );

        return Response::success('Mensagens carregadas', $messages);
    }

    public function generateQuiz($request)
    {
        $userId = $request['user']['id'];
        $data = json_decode(file_get_contents('php://input'), true);
        
        $quantity = $data['quantity'] ?? 5;
        $conversationId = $data['conversation_id'] ?? null;

        // Busca estatísticas do usuário para personalizar as perguntas
        $weaknesses = $this->getUserWeaknesses($userId);
        
        // Gera perguntas baseadas nas fraquezas
        $questions = $this->generateQuestions($userId, $weaknesses, $quantity);

        // Se veio de uma conversa, salva mensagem informando
        if ($conversationId) {
            $this->db->insert('messages', [
                'conversation_id' => $conversationId,
                'user_id' => $userId,
                'content' => '📝 Gerando perguntas personalizadas para você...',
                'sender' => 'ia',
                'message_type' => 'quiz_generated'
            ]);
        }

        return Response::success('Perguntas geradas', [
            'questions' => $questions,
            'count' => count($questions)
        ]);
    }

     public function submitAnswer($request) {

        $userId = $request['user']['id'];
        $data = json_decode(file_get_contents('php://input'), true);
        
        $questionId = $data['question_id'] ?? null;
        $selectedOption = $data['selected_option'] ?? null;
        $responseTimeMs = $data['response_time_ms'] ?? 0;

        if (!$questionId || !$selectedOption) {
            return Response::error('Dados incompletos');
        }

        // Busca a pergunta
        $question = $this->db->selectOne(
            "SELECT * FROM quiz_questions WHERE id = ? AND user_id = ?",
            [$questionId, $userId]
        );

        if (!$question) {
            return Response::notFound('Pergunta não encontrada');
        }


        // Verifica se já foi respondida
    $existing = $this->db->selectOne(
        "SELECT id FROM quiz_answers WHERE quiz_question_id = ? AND user_id = ?",
        [$questionId, $userId]
    );

    if ($existing) {
        return Response::error('Você já respondeu esta pergunta', null, 400);
    }

    $isCorrect = ($selectedOption == $question['correct_option_id']);
    $points = $isCorrect ? $question['points'] : 0;

    // Salva resposta
    $this->db->insert('quiz_answers', [
        'quiz_question_id' => $questionId,
        'user_id' => $userId,
        'quiz_session_id' => $question['quiz_session_id'],
        'selected_option_id' => $selectedOption,
        'is_correct' => $isCorrect ? 't' : 'f',
        'response_time_ms' => $responseTimeMs,
        'points_earned' => $points
    ]);

    // Atualiza pergunta
    $this->db->getConnection()->prepare(
        "UPDATE quiz_questions SET status = 'answered' WHERE id = ?"
    )->execute([$questionId]);

    
   // Atualiza sessão do quiz - VERSÃO SIMPLIFICADA
    $sessionUpdate = $this->db->getConnection()->prepare(
        "UPDATE quiz_sessions SET 
            answered_questions = answered_questions + 1,
            correct_answers = correct_answers + ?,
            points_earned = points_earned + ?
        WHERE id = ?"
    );
    
    $sessionUpdate->execute([$isCorrect ? 1 : 0, $points, $question['quiz_session_id']]);

    // Atualiza estatísticas
    $this->updateStatsAfterAnswer(
        $userId, 
        $question['category'], 
        $question['difficulty'], 
        $isCorrect, 
        $responseTimeMs
    );

    $this->updateAIProfile($userId);

    // Busca a opção correta para retornar
    $options = json_decode($question['options'], true);
    $correctOption = null;
    foreach ($options as $opt) {
        if ($opt['id'] == $question['correct_option_id']) {
            $correctOption = $opt;
            break;
        }
    }

    return Response::success('Resposta registrada', [
        'is_correct' => $isCorrect,
        'points_earned' => $points,
        'correct_option' => $question['correct_option_id'],
        'correct_option_text' => $correctOption['text'] ?? '',
        'explanation' => $question['explanation']
    ]);
    
    }

    public function getStats($request)
    {
        $userId = $request['user']['id'];

        // Estatísticas gerais
        $general = $this->db->selectOne(
            "SELECT 
                COUNT(DISTINCT qa.id) as total_answers,
                SUM(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) as correct_answers,
                COALESCE(AVG(ucs.hit_rate), 0) as avg_hit_rate,
                COUNT(DISTINCT c.id) as total_conversations,
                COUNT(DISTINCT m.id) as total_messages
             FROM users u
             LEFT JOIN conversations c ON u.id = c.user_id
             LEFT JOIN messages m ON u.id = m.user_id
             LEFT JOIN quiz_answers qa ON u.id = qa.user_id
             LEFT JOIN user_category_stats ucs ON u.id = ucs.user_id
             WHERE u.id = ?",
            [$userId]
        );

        // Estatísticas por categoria
        $byCategory = $this->db->selectAll(
            "SELECT * FROM user_category_stats WHERE user_id = ?",
            [$userId]
        );

        // Estatísticas por dificuldade
        $byDifficulty = $this->db->selectAll(
            "SELECT * FROM user_difficulty_stats WHERE user_id = ?",
            [$userId]
        );

        // Evolução diária (últimos 7 dias)
        $daily = $this->db->selectAll(
            "SELECT * FROM user_daily_stats 
             WHERE user_id = ? AND date > CURRENT_DATE - INTERVAL '7 days'
             ORDER BY date DESC",
            [$userId]
        );

        // Forças e fraquezas
        $profile = $this->db->selectOne(
            "SELECT strengths, weaknesses, recommended_categories FROM user_ai_profile WHERE user_id = ?",
            [$userId]
        );

        return Response::success('Estatísticas carregadas', [
            'general' => $general,
            'by_category' => $byCategory,
            'by_difficulty' => $byDifficulty,
            'daily' => $daily,
            'profile' => $profile
        ]);
    }

    
    private function generateIAResponse($message, $userId)
    {
        // Aqui  integraria com uma API de IA real (OpenAI, etc)
        
        $message = strtolower($message);
        $response = [
            'message' => 'Entendi sua pergunta! Como posso ajudar melhor?',
            'quiz' => null
        ];

        if (strpos($message, 'matemática') !== false || strpos($message, 'calculo') !== false) {
            $response['message'] = 'Vou gerar algumas questões de matemática para você praticar!';
            $response['quiz'] = true;
        } elseif (strpos($message, 'português') !== false || strpos($message, 'gramática') !== false) {
            $response['message'] = 'Ótimo! Vou preparar exercícios de português baseados no seu nível.';
            $response['quiz'] = true;
        } elseif (strpos($message, 'história') !== false) {
            $response['message'] = 'História é fascinante! Vou criar perguntas sobre os principais eventos.';
            $response['quiz'] = true;
        } else {
            $response['message'] = 'Interessante! Posso gerar perguntas sobre esse assunto ou você quer conversar mais?';
        }

        return $response;
    }

    private function getUserWeaknesses($userId)
    {
        $profile = $this->db->selectOne(
            "SELECT weaknesses FROM user_ai_profile WHERE user_id = ?",
            [$userId]
        );

        if ($profile && $profile['weaknesses']) {
            return json_decode($profile['weaknesses'], true);
        }

        // Se não tem perfil, retorna categorias padrão
        return [
            ['category' => 'Matemática', 'hit_rate' => 0],
            ['category' => 'Português', 'hit_rate' => 0]
        ];
    }

    private function generateQuestions($userId, $weaknesses, $quantity)
    {
        $questions = [];
        $categories = ['Matemática', 'Português', 'História', 'Ciências', 'Geografia'];
        
        // Se tem fraquezas, foca nelas
        if (!empty($weaknesses) && isset($weaknesses[0]['category'])) {
            $categories = array_column($weaknesses, 'category');
        }

        // Cria uma sessão de quiz
        $sessionId = $this->db->insert('quiz_sessions', [
            'user_id' => $userId,
            'generated_by' => 'user_request',
            'target_weakness' => $categories[0] ?? 'Matemática',
            'recommended_difficulty' => 'Médio',
            'total_questions' => $quantity
        ]);

        for ($i = 0; $i < $quantity; $i++) {
            $category = $categories[$i % count($categories)];
            $difficulty = $i < 2 ? 'Fácil' : ($i < 4 ? 'Médio' : 'Difícil');
            
            $question = $this->createQuestion($category, $difficulty, $i + 1);
            
            $questionId = $this->db->insert('quiz_questions', [
                'quiz_session_id' => $sessionId,
                'user_id' => $userId,
                'question_text' => $question['text'],
                'category' => $category,
                'difficulty' => $difficulty,
                'points' => $difficulty === 'Fácil' ? 5 : ($difficulty === 'Médio' ? 10 : 15),
                'options' => json_encode($question['options']),
                'correct_option_id' => $question['correct'],
                'explanation' => $question['explanation'],
                'ai_confidence' => 0.95,
                'based_on_user_stats' => json_encode(['weaknesses' => $weaknesses]),
                'question_order' => $i + 1
            ]);

            $questions[] = [
                'id' => $questionId,
                'question' => $question['text'],
                'category' => $category,
                'difficulty' => $difficulty,
                'options' => $question['options'],
                'explanation' => $question['explanation']
            ];
        }

        return $questions;
    }

   private function createQuestion($category, $difficulty, $index)
{
    // Base de perguntas simuladas
    $questions = [
        'Matemática' => [
            'Fácil' => [
                'text' => 'Quanto é 7 x 8?',
                'options' => [
                    ['id' => 1, 'text' => '48'],
                    ['id' => 2, 'text' => '56'],
                    ['id' => 3, 'text' => '64'],
                    ['id' => 4, 'text' => '72']
                ],
                'correct' => 2,
                'explanation' => '7 x 8 = 56'
            ],
            'Médio' => [
                'text' => 'Qual é a raiz quadrada de 144?',
                'options' => [
                    ['id' => 1, 'text' => '10'],
                    ['id' => 2, 'text' => '11'],
                    ['id' => 3, 'text' => '12'],
                    ['id' => 4, 'text' => '13']
                ],
                'correct' => 3,
                'explanation' => '12 x 12 = 144'
            ],
            'Difícil' => [
                'text' => 'Resolva a equação: 3x² - 12 = 0',
                'options' => [
                    ['id' => 1, 'text' => 'x = ±2'],
                    ['id' => 2, 'text' => 'x = ±3'],
                    ['id' => 3, 'text' => 'x = ±4'],
                    ['id' => 4, 'text' => 'x = ±6']
                ],
                'correct' => 1,
                'explanation' => '3x² = 12 → x² = 4 → x = ±2'
            ]
        ],
        'Português' => [
            'Fácil' => [
                'text' => 'Qual é o plural de "cidadão"?',
                'options' => [
                    ['id' => 1, 'text' => 'cidadãos'],
                    ['id' => 2, 'text' => 'cidadões'],
                    ['id' => 3, 'text' => 'cidadães'],
                    ['id' => 4, 'text' => 'cidadãos e cidadães']
                ],
                'correct' => 1,
                'explanation' => 'O plural de cidadão é cidadãos.'
            ],
            'Médio' => [
                'text' => 'Qual a classe gramatical de "felizmente"?',
                'options' => [
                    ['id' => 1, 'text' => 'Adjetivo'],
                    ['id' => 2, 'text' => 'Advérbio'],
                    ['id' => 3, 'text' => 'Substantivo'],
                    ['id' => 4, 'text' => 'Preposição']
                ],
                'correct' => 2,
                'explanation' => 'Felizmente é um advérbio de modo.'
            ]
        ],
        'História' => [
            'Fácil' => [
                'text' => 'Em que ano o Brasil foi descoberto?',
                'options' => [
                    ['id' => 1, 'text' => '1492'],
                    ['id' => 2, 'text' => '1500'],
                    ['id' => 3, 'text' => '1822'],
                    ['id' => 4, 'text' => '1889']
                ],
                'correct' => 2,
                'explanation' => 'O Brasil foi descoberto em 1500 por Pedro Álvares Cabral.'
            ]
        ],
        'Ciências' => [
            'Fácil' => [
                'text' => 'Qual a fórmula da água?',
                'options' => [
                    ['id' => 1, 'text' => 'CO2'],
                    ['id' => 2, 'text' => 'H2O'],
                    ['id' => 3, 'text' => 'O2'],
                    ['id' => 4, 'text' => 'NaCl']
                ],
                'correct' => 2,
                'explanation' => 'A água é formada por dois átomos de hidrogênio e um de oxigênio.'
            ]
        ],
        'Geografia' => [
            'Fácil' => [
                'text' => 'Qual a capital do Brasil?',
                'options' => [
                    ['id' => 1, 'text' => 'São Paulo'],
                    ['id' => 2, 'text' => 'Rio de Janeiro'],
                    ['id' => 3, 'text' => 'Brasília'],
                    ['id' => 4, 'text' => 'Salvador']
                ],
                'correct' => 3,
                'explanation' => 'Brasília é a capital federal desde 1960.'
            ]
        ]
    ];

    if (isset($questions[$category][$difficulty])) {
        return $questions[$category][$difficulty];
    }

    // Fallback
    return $questions['Matemática']['Fácil'];
}

    private function updateDailyStats($userId, $type)
    {
        $today = date('Y-m-d');
        
        if ($type === 'chat') {
            $this->db->getConnection()->prepare(
                "INSERT INTO user_daily_stats (user_id, date, chat_messages) 
                 VALUES (?, ?, 1)
                 ON CONFLICT (user_id, date) DO UPDATE SET
                 chat_messages = user_daily_stats.chat_messages + 1"
            )->execute([$userId, $today]);
        }
    }

private function updateStatsAfterAnswer($userId, $category, $difficulty, $isCorrect, $responseTime)
{
    $today = date('Y-m-d');
    $correctInt = $isCorrect ? 1 : 0;
    
    try {
        // 1. DAILY STATS
        $check = $this->db->selectOne(
            "SELECT id FROM user_daily_stats WHERE user_id = ? AND date = ?",
            [$userId, $today]
        );
        
        if ($check) {
            $this->db->getConnection()->prepare(
                "UPDATE user_daily_stats 
                 SET questions_answered = questions_answered + 1,
                     correct_answers = correct_answers + ?
                 WHERE user_id = ? AND date = ?"
            )->execute([$correctInt, $userId, $today]);
        } else {
            $this->db->getConnection()->prepare(
                "INSERT INTO user_daily_stats (user_id, date, questions_answered, correct_answers)
                 VALUES (?, ?, 1, ?)"
            )->execute([$userId, $today, $correctInt]);
        }
        
        // 2. CATEGORY STATS - COM DIFICULDADES
        $check = $this->db->selectOne(
            "SELECT id FROM user_category_stats WHERE user_id = ? AND category = ?",
            [$userId, $category]
        );
        
        // Define flags de dificuldade
        $easyFlag = ($difficulty === 'Fácil') ? 1 : 0;
        $mediumFlag = ($difficulty === 'Médio') ? 1 : 0;
        $hardFlag = ($difficulty === 'Difícil') ? 1 : 0;
        
        $easyCorrect = ($easyFlag && $isCorrect) ? 1 : 0;
        $mediumCorrect = ($mediumFlag && $isCorrect) ? 1 : 0;
        $hardCorrect = ($hardFlag && $isCorrect) ? 1 : 0;
        
        if ($check) {
            // UPDATE existente
            $stmt = $this->db->getConnection()->prepare(
                "UPDATE user_category_stats 
                 SET total_questions = total_questions + 1,
                     correct_answers = correct_answers + ?,
                     easy_questions = easy_questions + ?,
                     easy_correct = easy_correct + ?,
                     medium_questions = medium_questions + ?,
                     medium_correct = medium_correct + ?,
                     hard_questions = hard_questions + ?,
                     hard_correct = hard_correct + ?,
                     avg_response_time = (avg_response_time * (total_questions - 1) + ?) / total_questions,
                     last_practiced = NOW()
                 WHERE user_id = ? AND category = ?"
            );
            $stmt->execute([
                $correctInt,
                $easyFlag,
                $easyCorrect,
                $mediumFlag,
                $mediumCorrect,
                $hardFlag,
                $hardCorrect,
                $responseTime,
                $userId,
                $category
            ]);
        } else {
            // INSERT novo
            $stmt = $this->db->getConnection()->prepare(
                "INSERT INTO user_category_stats 
                    (user_id, category, total_questions, correct_answers,
                     easy_questions, easy_correct, medium_questions, medium_correct,
                     hard_questions, hard_correct, avg_response_time, last_practiced)
                 VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
            );
            $stmt->execute([
                $userId,
                $category,
                $correctInt,
                $easyFlag,
                $easyCorrect,
                $mediumFlag,
                $mediumCorrect,
                $hardFlag,
                $hardCorrect,
                $responseTime
            ]);
        }
        
        // 3. DIFFICULTY STATS
        $check = $this->db->selectOne(
            "SELECT id FROM user_difficulty_stats WHERE user_id = ? AND difficulty = ?",
            [$userId, $difficulty]
        );
        
        if ($check) {
            $this->db->getConnection()->prepare(
                "UPDATE user_difficulty_stats 
                 SET total_questions = total_questions + 1,
                     correct_answers = correct_answers + ?
                 WHERE user_id = ? AND difficulty = ?"
            )->execute([$correctInt, $userId, $difficulty]);
        } else {
            $this->db->getConnection()->prepare(
                "INSERT INTO user_difficulty_stats (user_id, difficulty, total_questions, correct_answers)
                 VALUES (?, ?, 1, ?)"
            )->execute([$userId, $difficulty, $correctInt]);
        }
        
        return true;
        
    } catch (Exception $e) {
        error_log("ERRO nas estatísticas: " . $e->getMessage());
        return false;
    }
}

private function updateAIProfile($userId)
{
    debug_log("--- updateAIProfile para user $userId ---");
    
    try {
        // Busca estatísticas por categoria
        $categories = $this->db->selectAll(
            "SELECT category, total_questions, correct_answers, 
                    (correct_answers::FLOAT / total_questions * 100) as hit_rate
             FROM user_category_stats 
             WHERE user_id = ? AND total_questions > 0",
            [$userId]
        );
        
        debug_log("Categorias encontradas: " . count($categories));

        $strengths = [];
        $weaknesses = [];

        foreach ($categories as $cat) {
            if ($cat['total_questions'] >= 3) {
                if ($cat['hit_rate'] >= 70) {
                    $strengths[] = [
                        'category' => $cat['category'],
                        'hit_rate' => round($cat['hit_rate'], 2)
                    ];
                } elseif ($cat['hit_rate'] <= 50) {
                    $weaknesses[] = [
                        'category' => $cat['category'],
                        'hit_rate' => round($cat['hit_rate'], 2)
                    ];
                }
            }
        }

        // Calcula overall
        $overall = $this->db->selectOne(
            "SELECT 
                COALESCE(AVG(correct_answers::FLOAT / total_questions * 100), 0) as avg_hit_rate,
                COALESCE(SUM(total_questions), 0) as total
             FROM user_category_stats 
             WHERE user_id = ?",
            [$userId]
        );

        // Verifica se já existe perfil
        $existing = $this->db->selectOne(
            "SELECT id FROM user_ai_profile WHERE user_id = ?",
            [$userId]
        );

        $strengthsJson = json_encode($strengths);
        $weaknessesJson = json_encode($weaknesses);
        $avgHitRate = $overall['avg_hit_rate'] ?? 0;
        $totalQuestions = $overall['total'] ?? 0;

        debug_log("Strengths: $strengthsJson");
        debug_log("Weaknesses: $weaknessesJson");
        debug_log("AvgHitRate: $avgHitRate, TotalQuestions: $totalQuestions");

        if ($existing) {
            debug_log("Atualizando perfil existente");
            $stmt = $this->db->getConnection()->prepare(
                "UPDATE user_ai_profile SET
                    strengths = ?,
                    weaknesses = ?,
                    overall_hit_rate = ?,
                    total_questions_lifetime = ?,
                    last_updated = NOW()
                WHERE user_id = ?"
            );
            $params = [$strengthsJson, $weaknessesJson, $avgHitRate, $totalQuestions, $userId];
            debug_log("UPDATE AI params: " . json_encode($params));
            $stmt->execute($params);
        } else {
            debug_log("Inserindo novo perfil");
            $stmt = $this->db->getConnection()->prepare(
                "INSERT INTO user_ai_profile 
                    (user_id, strengths, weaknesses, overall_hit_rate, total_questions_lifetime, last_updated)
                 VALUES (?, ?, ?, ?, ?, NOW())"
            );
            $params = [$userId, $strengthsJson, $weaknessesJson, $avgHitRate, $totalQuestions];
            debug_log("INSERT AI params: " . json_encode($params));
            $stmt->execute($params);
        }
        
        debug_log("updateAIProfile OK");
    } catch (Exception $e) {
        debug_log("ERRO em updateAIProfile: " . $e->getMessage());
    }
}
}