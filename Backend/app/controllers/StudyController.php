<?php
namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Validator;
use App\Models\Study;

class StudyController
{
    private $studyModel;

    public function __construct()
    {
        $this->studyModel = new Study();
    }

    public function index($request)
    {
        $userId = $request['user']['user_id'];
        $studies = $this->studyModel->findByUserId($userId);

        return Response::success('Estudos recuperados', [
            'studies' => $studies
        ]);
    }

    public function store($request)
    {
        $userId = $request['user']['user_id'];
        $data = json_decode(file_get_contents('php://input'), true);
        $data['user_id'] = $userId;

        $validator = new Validator();
        $rules = [
            'subject' => 'required|max:100',
            'duration' => 'required|numeric',
            'questions_answered' => 'numeric',
            'score' => 'numeric|min:0|max:100'
        ];

        if (!$validator->validate($data, $rules)) {
            return Response::validationError($validator->getErrors());
        }

        $studyId = $this->studyModel->create($data);

        if (!$studyId) {
            return Response::error('Erro ao salvar estudo', null, 500);
        }

        return Response::success('Estudo salvo com sucesso', [
            'study_id' => $studyId
        ], 201);
    }

    public function stats($request)
    {
        $userId = $request['user']['user_id'];
        $stats = $this->studyModel->getStats($userId);

        return Response::success('Estatísticas de estudo', [
            'stats' => $stats
        ]);
    }

    public function progress($request)
    {
        $userId = $request['user']['user_id'];
        $days = $_GET['days'] ?? 30;
        $progress = $this->studyModel->getProgress($userId, $days);

        return Response::success('Progresso de estudos', [
            'progress' => $progress
        ]);
    }
}