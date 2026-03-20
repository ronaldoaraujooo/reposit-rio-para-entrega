
CREATE DATABASE infinitia;

-- TABELA users (gerenciada pelo admin)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- hash gerado pelo backend
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    -- Estatísticas agregadas (para performance)
    total_quiz_answers INTEGER DEFAULT 0,
    total_correct_answers INTEGER DEFAULT 0,
    overall_hit_rate DECIMAL(5,2) DEFAULT 0,
    total_study_time_minutes INTEGER DEFAULT 0
);

-- TABELA sessions (autenticação)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('user', 'admin')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE
);

-- TABELA admin_logs (auditoria de ações)
CREATE TABLE admin_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    admin_email VARCHAR(100),
    action_type VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, BLOCK
    target_type VARCHAR(50) NOT NULL, -- user
    target_id INTEGER,
    target_email VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABELA conversations (chat)
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABELA messages (mensagens do chat)
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ia')),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'file', 'quiz_generated')),
    file_url TEXT,
    file_name VARCHAR(255),
    file_size INTEGER,
    audio_transcript TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABELA quiz_sessions (sessões de perguntas)
CREATE TABLE quiz_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generated_by VARCHAR(50) CHECK (generated_by IN ('user_request', 'weakness_detected', 'daily_suggestion')),
    target_weakness VARCHAR(100),
    recommended_difficulty VARCHAR(20) CHECK (recommended_difficulty IN ('Fácil', 'Médio', 'Difícil')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    total_questions INTEGER DEFAULT 0,
    answered_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0
);

-- TABELA quiz_questions (perguntas geradas pela IA)
CREATE TABLE quiz_questions (
    id SERIAL PRIMARY KEY,
    quiz_session_id INTEGER NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('Fácil', 'Médio', 'Difícil')),
    points INTEGER DEFAULT 10,
    options JSONB NOT NULL,
    correct_option_id INTEGER NOT NULL,
    explanation TEXT,
    ai_confidence DECIMAL(3,2),
    based_on_user_stats JSONB,
    question_order INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'skipped')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABELA quiz_answers (respostas dos usuários)
CREATE TABLE quiz_answers (
    id SERIAL PRIMARY KEY,
    quiz_question_id INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quiz_session_id INTEGER NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    selected_option_id INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    response_time_ms INTEGER,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABELA user_daily_stats (estatísticas diárias)
CREATE TABLE user_daily_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    chat_messages INTEGER DEFAULT 0,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    study_time_minutes INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
);

-- TABELA user_category_stats (estatísticas por categoria)
CREATE TABLE user_category_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    hit_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_questions > 0 
        THEN (correct_answers::DECIMAL / total_questions * 100) 
        ELSE 0 END
    ) STORED,
    easy_questions INTEGER DEFAULT 0,
    easy_correct INTEGER DEFAULT 0,
    medium_questions INTEGER DEFAULT 0,
    medium_correct INTEGER DEFAULT 0,
    hard_questions INTEGER DEFAULT 0,
    hard_correct INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    last_practiced TIMESTAMP,
    UNIQUE(user_id, category)
);

-- TABELA user_difficulty_stats (estatísticas por dificuldade)
CREATE TABLE user_difficulty_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('Fácil', 'Médio', 'Difícil')),
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    hit_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN total_questions > 0 
        THEN (correct_answers::DECIMAL / total_questions * 100) 
        ELSE 0 END
    ) STORED,
    UNIQUE(user_id, difficulty)
);

-- TABELA user_ai_profile (perfil para IA)
CREATE TABLE user_ai_profile (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    strengths JSONB DEFAULT '[]'::jsonb,
    weaknesses JSONB DEFAULT '[]'::jsonb,
    recommended_categories JSONB DEFAULT '[]'::jsonb,
    recommended_difficulty VARCHAR(20) DEFAULT 'Médio',
    overall_hit_rate DECIMAL(5,2) DEFAULT 0,
    total_questions_lifetime INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================
-- ÍNDICES (para performance)
-- ====================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_status ON users(role, status);

-- Sessions
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE is_revoked = FALSE;

-- Admin logs
CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id, created_at DESC);
CREATE INDEX idx_admin_logs_target ON admin_logs(target_type, target_id);

-- Chat
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);
CREATE INDEX idx_conversations_message_count ON conversations(message_count);

-- Quiz
CREATE INDEX idx_quiz_sessions_user ON quiz_sessions(user_id, created_at DESC);
CREATE INDEX idx_quiz_questions_session ON quiz_questions(quiz_session_id);
CREATE INDEX idx_quiz_answers_user ON quiz_answers(user_id, created_at DESC);
CREATE INDEX idx_quiz_answers_session ON quiz_answers(quiz_session_id);

-- Estatísticas
CREATE INDEX idx_user_category_stats_user ON user_category_stats(user_id);
CREATE INDEX idx_user_daily_stats_user ON user_daily_stats(user_id, date DESC);

-- ====================================================
-- VIEWS (consultas prontas para o backend)
-- ====================================================

-- View para dashboard do usuário
CREATE OR REPLACE VIEW user_dashboard AS
SELECT 
    u.id,
    u.name,
    u.overall_hit_rate,
    u.total_quiz_answers,
    u.total_correct_answers,
    u.total_study_time_minutes,
    up.strengths,
    up.weaknesses,
    up.recommended_categories,
    up.recommended_difficulty,
    (
        SELECT jsonb_agg(jsonb_build_object(
            'date', date,
            'questions', questions_answered,
            'correct', correct_answers,
            'hit_rate', CASE WHEN questions_answered > 0 
                            THEN (correct_answers::DECIMAL / questions_answered * 100)
                            ELSE 0 END
        ) ORDER BY date DESC)
        FROM user_daily_stats 
        WHERE user_id = u.id AND date > CURRENT_DATE - INTERVAL '7 days'
    ) as last_7_days,
    (
        SELECT jsonb_object_agg(category, jsonb_build_object(
            'total', total_questions,
            'correct', correct_answers,
            'hit_rate', hit_rate
        ))
        FROM user_category_stats 
        WHERE user_id = u.id
    ) as category_stats,
    (
        SELECT jsonb_object_agg(difficulty, jsonb_build_object(
            'total', total_questions,
            'correct', correct_answers,
            'hit_rate', hit_rate
        ))
        FROM user_difficulty_stats 
        WHERE user_id = u.id
    ) as difficulty_stats
FROM users u
LEFT JOIN user_ai_profile up ON u.id = up.user_id
WHERE u.role = 'user';

-- View para admin - lista de usuários
CREATE OR REPLACE VIEW admin_users_list AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    u.status,
    u.created_at,
    u.last_login,
    u.total_quiz_answers,
    u.overall_hit_rate,
    u.total_study_time_minutes,
    creator.name as created_by_name
FROM users u
LEFT JOIN users creator ON u.created_by = creator.id
WHERE u.role = 'user'
ORDER BY u.created_at DESC;

-- View para admin - estatísticas gerais
CREATE OR REPLACE VIEW admin_system_stats AS
SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'user') as total_users,
    (SELECT COUNT(*) FROM users WHERE role = 'user' AND status = 'active') as active_users,
    (SELECT COUNT(*) FROM users WHERE role = 'user' AND created_at > CURRENT_DATE - INTERVAL '7 days') as new_users_week,
    (SELECT COUNT(*) FROM quiz_answers WHERE created_at > CURRENT_DATE) as answers_today,
    (SELECT COUNT(*) FROM quiz_answers) as total_answers,
    (SELECT COALESCE(AVG(overall_hit_rate), 0) FROM users WHERE role = 'user' AND total_quiz_answers > 0) as avg_hit_rate,
    (
        SELECT jsonb_agg(jsonb_build_object(
            'category', category,
            'avg_hit_rate', avg_hit_rate
        ))
        FROM (
            SELECT category, AVG(hit_rate) as avg_hit_rate
            FROM user_category_stats
            GROUP BY category
        ) c
    ) as category_performance;

-- View para admin - detalhes de um usuário
CREATE OR REPLACE VIEW admin_user_details AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    u.status,
    u.created_at,
    u.last_login,
    u.total_quiz_answers,
    u.total_correct_answers,
    u.overall_hit_rate,
    u.total_study_time_minutes,
    creator.name as created_by_name,
    updater.name as updated_by_name,
    up.strengths,
    up.weaknesses,
    up.recommended_categories,
    up.recommended_difficulty,
    (
        SELECT jsonb_object_agg(category, jsonb_build_object(
            'total', total_questions,
            'correct', correct_answers,
            'hit_rate', hit_rate
        ))
        FROM user_category_stats 
        WHERE user_id = u.id
    ) as category_stats,
    (
        SELECT jsonb_agg(jsonb_build_object(
            'date', date,
            'questions', questions_answered,
            'correct', correct_answers
        ) ORDER BY date DESC)
        FROM user_daily_stats 
        WHERE user_id = u.id AND date > CURRENT_DATE - INTERVAL '30 days'
    ) as daily_evolution,
    (
        SELECT jsonb_agg(sub)
        FROM (
            SELECT jsonb_build_object(
                'id', qs.id,
                'date', qs.created_at,
                'total', qs.total_questions,
                'correct', qs.correct_answers,
                'hit_rate', CASE WHEN qs.total_questions > 0 
                               THEN (qs.correct_answers::DECIMAL / qs.total_questions * 100)
                               ELSE 0 END
            ) as data
            FROM quiz_sessions qs
            WHERE qs.user_id = u.id AND qs.status = 'completed'
            ORDER BY qs.created_at DESC
            LIMIT 10
        ) sub
    ) as recent_sessions
FROM users u
LEFT JOIN users creator ON u.created_by = creator.id
LEFT JOIN users updater ON u.updated_by = updater.id
LEFT JOIN user_ai_profile up ON u.id = up.user_id
WHERE u.role = 'user';

-- View para admin - logs de ações
CREATE OR REPLACE VIEW admin_action_logs AS
SELECT 
    al.created_at,
    admin.name as admin_name,
    admin.email as admin_email,
    al.action_type,
    al.target_type,
    al.target_email,
    al.old_values,
    al.new_values,
    al.ip_address
FROM admin_logs al
LEFT JOIN users admin ON al.admin_id = admin.id
ORDER BY al.created_at DESC
LIMIT 100;

-- View para admin - mensagens
CREATE OR REPLACE VIEW admin_messages AS
SELECT 
    m.id,
    m.content,
    m.sender,
    m.message_type,
    m.file_url,
    m.file_name,
    m.created_at,
    u.name as user_name,
    u.email as user_email,
    c.title as conversation_title
FROM messages m
JOIN users u ON m.user_id = u.id
LEFT JOIN conversations c ON m.conversation_id = c.id
ORDER BY m.created_at DESC;

-- View para admin - mídias
CREATE OR REPLACE VIEW admin_media AS
SELECT 
    m.id,
    m.file_url,
    m.file_name,
    m.file_size,
    m.message_type,
    m.created_at,
    u.name as user_name,
    u.email as user_email
FROM messages m
JOIN users u ON m.user_id = u.id
WHERE m.message_type IN ('image', 'audio')
ORDER BY m.created_at DESC;

-- ====================================================
-- FUNÇÕES (operações que o backend vai chamar)
-- ====================================================

-- Função para criar usuário (admin)
CREATE OR REPLACE FUNCTION create_user(
    p_admin_id INTEGER,
    p_name VARCHAR,
    p_email VARCHAR,
    p_password_hash VARCHAR,
    p_role VARCHAR DEFAULT 'user'
) RETURNS INTEGER AS $$
DECLARE
    v_user_id INTEGER;
    v_admin_email VARCHAR;
BEGIN
    SELECT email INTO v_admin_email FROM users WHERE id = p_admin_id;
    
    INSERT INTO users (name, email, password, role, created_by)
    VALUES (p_name, p_email, p_password_hash, p_role, p_admin_id)
    RETURNING id INTO v_user_id;
    
    INSERT INTO admin_logs (admin_id, admin_email, action_type, target_type, target_id, target_email, new_values)
    VALUES (p_admin_id, v_admin_email, 'CREATE', 'user', v_user_id, p_email, 
            jsonb_build_object('name', p_name, 'email', p_email, 'role', p_role));
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar usuário (admin)
CREATE OR REPLACE FUNCTION update_user(
    p_admin_id INTEGER,
    p_user_id INTEGER,
    p_changes JSONB
) RETURNS BOOLEAN AS $$
DECLARE
    v_old_values JSONB;
    v_admin_email VARCHAR;
    v_target_email VARCHAR;
BEGIN
    SELECT row_to_json(u) INTO v_old_values
    FROM (SELECT name, email, role, status FROM users WHERE id = p_user_id) u;
    
    SELECT email INTO v_admin_email FROM users WHERE id = p_admin_id;
    SELECT email INTO v_target_email FROM users WHERE id = p_user_id;
    
    UPDATE users SET
        name = COALESCE(p_changes->>'name', name),
        email = COALESCE(p_changes->>'email', email),
        role = COALESCE(p_changes->>'role', role),
        status = COALESCE(p_changes->>'status', status),
        updated_by = p_admin_id,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    INSERT INTO admin_logs (admin_id, admin_email, action_type, target_type, target_id, target_email, old_values, new_values)
    VALUES (p_admin_id, v_admin_email, 'UPDATE', 'user', p_user_id, v_target_email, v_old_values, p_changes);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Função para registrar resposta do quiz
CREATE OR REPLACE FUNCTION register_quiz_answer(
    p_user_id INTEGER,
    p_quiz_question_id INTEGER,
    p_selected_option INTEGER,
    p_response_time_ms INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_question RECORD;
    v_session_id INTEGER;
    v_is_correct BOOLEAN;
    v_points INTEGER;
    v_category VARCHAR;
    v_difficulty VARCHAR;
BEGIN
    SELECT qq.*, qs.id as session_id INTO v_question
    FROM quiz_questions qq
    JOIN quiz_sessions qs ON qq.quiz_session_id = qs.id
    WHERE qq.id = p_quiz_question_id AND qq.user_id = p_user_id;
    
    v_session_id := v_question.quiz_session_id;
    v_is_correct := (p_selected_option = v_question.correct_option_id);
    v_points := CASE WHEN v_is_correct THEN v_question.points ELSE 0 END;
    v_category := v_question.category;
    v_difficulty := v_question.difficulty;
    
    INSERT INTO quiz_answers (quiz_question_id, user_id, quiz_session_id, selected_option_id, is_correct, response_time_ms, points_earned)
    VALUES (p_quiz_question_id, p_user_id, v_session_id, p_selected_option, v_is_correct, p_response_time_ms, v_points);
    
    UPDATE quiz_questions SET status = 'answered' WHERE id = p_quiz_question_id;
    
    UPDATE quiz_sessions SET
        answered_questions = answered_questions + 1,
        correct_answers = correct_answers + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
        points_earned = points_earned + v_points,
        status = CASE WHEN answered_questions + 1 >= total_questions THEN 'completed' ELSE 'in_progress' END,
        completed_at = CASE WHEN answered_questions + 1 >= total_questions THEN NOW() ELSE NULL END
    WHERE id = v_session_id;
    
    RETURN jsonb_build_object(
        'is_correct', v_is_correct,
        'correct_option', v_question.correct_option_id,
        'explanation', v_question.explanation,
        'points_earned', v_points
    );
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar estatísticas após resposta
CREATE OR REPLACE FUNCTION update_stats_after_answer(
    p_user_id INTEGER,
    p_category VARCHAR,
    p_difficulty VARCHAR,
    p_is_correct BOOLEAN,
    p_response_time_ms INTEGER
) RETURNS VOID AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_correct_int INTEGER := CASE WHEN p_is_correct THEN 1 ELSE 0 END;
BEGIN
    -- Daily stats
    INSERT INTO user_daily_stats (user_id, date, questions_answered, correct_answers)
    VALUES (p_user_id, v_today, 1, v_correct_int)
    ON CONFLICT (user_id, date) DO UPDATE SET
        questions_answered = user_daily_stats.questions_answered + 1,
        correct_answers = user_daily_stats.correct_answers + v_correct_int;
    
    -- Category stats
    INSERT INTO user_category_stats (user_id, category, total_questions, correct_answers, last_practiced)
    VALUES (p_user_id, p_category, 1, v_correct_int, NOW())
    ON CONFLICT (user_id, category) DO UPDATE SET
        total_questions = user_category_stats.total_questions + 1,
        correct_answers = user_category_stats.correct_answers + v_correct_int,
        last_practiced = NOW();
    
    -- Difficulty stats
    INSERT INTO user_difficulty_stats (user_id, difficulty, total_questions, correct_answers)
    VALUES (p_user_id, p_difficulty, 1, v_correct_int)
    ON CONFLICT (user_id, difficulty) DO UPDATE SET
        total_questions = user_difficulty_stats.total_questions + 1,
        correct_answers = user_difficulty_stats.correct_answers + v_correct_int;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ====================================================
-- PERMISSÕES
-- ====================================================

GRANT ALL PRIVILEGES ON DATABASE infinitia TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- ====================================================
-- VERIFICAÇÃO FINAL
-- ====================================================

SELECT 'BANCO DE DADOS CRIADO COM SUCESSO!' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;