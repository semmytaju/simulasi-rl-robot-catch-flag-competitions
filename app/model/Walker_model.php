<?php
/**
 * Model: Walker_model.php
 * Mengelola seluruh transaksi data MySQL (db_robot_agent) untuk
 * Simulasi Reinforcement Learning: Robot Catch the Flag Competition (DQN).
 */

class Walker_model {
    private Database $db;

    public function __construct() {
        $this->db = new Database();
        $this->ensureSchema();
    }

    public function ensureSchema(): void {
        if (!$this->db->isConnected()) {
            return;
        }
        $diag = $this->db->getDiagnostics();
        if (!$diag['is_schema_ready'] || $this->db->getTableRowCount('reward_presets') === 0) {
            $sqlFile = BASEPATH . '/database/db_robot_agent.sql';
            if (file_exists($sqlFile)) {
                $this->db->importSqlFile($sqlFile);
            }
        }
    }

    public function getDiagnostics(): array {
        return $this->db->getDiagnostics();
    }

    public function getPresets(): array {
        if (!$this->db->isConnected()) return [];
        $this->db->prepare("SELECT * FROM reward_presets ORDER BY id ASC");
        return $this->db->resultSet();
    }

    public function getActiveSession(): ?array {
        if (!$this->db->isConnected()) return null;
        $this->db->prepare("SELECT * FROM training_sessions ORDER BY id DESC LIMIT 1");
        $session = $this->db->single();
        if (!$session) {
            return $this->createNewSession([
                'student_name' => 'Mahasiswa Peserta Kompetisi',
                'session_title' => 'Kompetisi RL Robot Catch the Flag (DQN)',
                'algorithm' => 'DQN',
                'preset_code' => 'standar_seimbang',
                'learning_rate' => 0.0025,
                'gamma' => 0.98
            ]);
        }
        return $session;
    }

    public function getAllSessions(int $limit = 15): array {
        if (!$this->db->isConnected()) return [];
        $this->db->prepare("SELECT * FROM training_sessions ORDER BY id DESC LIMIT :lim");
        $this->db->bind(':lim', $limit);
        return $this->db->resultSet();
    }

    public function getSessionEpisodes(int $sessionId, int $limit = 150): array {
        if (!$this->db->isConnected()) return [];
        $this->db->prepare("SELECT * FROM episode_logs WHERE session_id = :sid ORDER BY episode_number ASC, id ASC LIMIT :lim");
        $this->db->bind(':sid', $sessionId);
        $this->db->bind(':lim', $limit);
        return $this->db->resultSet();
    }

    public function getSavedModels(): array {
        if (!$this->db->isConnected()) return [];
        $this->db->prepare("SELECT id, model_code, model_name, algorithm, skill_level, trained_episodes, best_distance_m, best_reward, architecture_json, weights_json, notes, is_builtin, created_at FROM saved_models ORDER BY is_builtin DESC, id DESC");
        return $this->db->resultSet();
    }

    public function getLeaderboard(int $limit = 20): array {
        if (!$this->db->isConnected() || !$this->db->hasTable('competition_leaderboard')) return [];
        $this->db->prepare("SELECT * FROM competition_leaderboard ORDER BY competition_score DESC, flags_captured DESC, fastest_capture_sec ASC LIMIT :lim");
        $this->db->bind(':lim', $limit);
        return $this->db->resultSet();
    }

    public function submitLeaderboardEntry(array $payload): array {
        if (!$this->db->isConnected()) {
            return ['success' => false, 'message' => 'Database tidak terhubung'];
        }

        $studentName = trim((string)($payload['student_name'] ?? 'Mahasiswa AI')) ?: 'Mahasiswa AI';
        $studentNim = trim((string)($payload['student_nim'] ?? '-')) ?: '-';
        $modelName = trim((string)($payload['model_name'] ?? 'DQN Robot Agent')) ?: 'DQN Robot Agent';
        $algorithm = strtoupper(trim((string)($payload['algorithm'] ?? 'DQN')));
        $episodesTrained = max(1, (int)($payload['episodes_trained'] ?? 1));
        $flagsCaptured = max(0, (int)($payload['flags_captured'] ?? 0));
        $fastestSec = round(max(0.5, (float)($payload['fastest_capture_sec'] ?? 9.99)), 2);
        $jumpCount = max(0, (int)($payload['jump_success_count'] ?? 0));
        $score = round((float)($payload['competition_score'] ?? 0.0), 1);
        $cornerMastery = trim((string)($payload['corner_mastery'] ?? '4/4 Sudut Arena'));

        $this->db->prepare("INSERT INTO competition_leaderboard
            (student_name, student_nim, model_name, algorithm, episodes_trained, flags_captured, fastest_capture_sec, jump_success_count, competition_score, corner_mastery)
            VALUES (:name, :nim, :model, :algo, :eps, :flags, :fast, :jumps, :score, :corners)");
        $this->db->bind(':name', $studentName);
        $this->db->bind(':nim', $studentNim);
        $this->db->bind(':model', $modelName);
        $this->db->bind(':algo', $algorithm);
        $this->db->bind(':eps', $episodesTrained);
        $this->db->bind(':flags', $flagsCaptured);
        $this->db->bind(':fast', $fastestSec);
        $this->db->bind(':jumps', $jumpCount);
        $this->db->bind(':score', $score);
        $this->db->bind(':corners', $cornerMastery);
        $ok = $this->db->execute();

        return [
            'success' => $ok,
            'leaderboard' => $this->getLeaderboard(20)
        ];
    }

    public function getModelByIdOrCode(string $identifier): ?array {
        if (!$this->db->isConnected()) return null;
        if (is_numeric($identifier)) {
            $this->db->prepare("SELECT * FROM saved_models WHERE id = :id LIMIT 1");
            $this->db->bind(':id', (int)$identifier);
        } else {
            $this->db->prepare("SELECT * FROM saved_models WHERE model_code = :code LIMIT 1");
            $this->db->bind(':code', $identifier);
        }
        return $this->db->single();
    }

    public function createNewSession(array $data): ?array {
        if (!$this->db->isConnected()) return null;

        $code = 'SES-' . strtoupper(substr(md5(uniqid((string)mt_rand(), true)), 0, 8));
        $studentName = trim((string)($data['student_name'] ?? 'Mahasiswa Peserta Kompetisi')) ?: 'Mahasiswa Peserta Kompetisi';
        $title = trim((string)($data['session_title'] ?? 'Kompetisi Robot Catch the Flag Baru')) ?: 'Kompetisi Robot Catch the Flag Baru';
        $algorithm = strtoupper(trim((string)($data['algorithm'] ?? 'DQN')));
        if (!in_array($algorithm, ['DQN', 'PPO', 'CURRICULUM_RL'], true)) {
            $algorithm = 'DQN';
        }
        $presetCode = trim((string)($data['preset_code'] ?? 'standar_seimbang'));
        $lr = (float)($data['learning_rate'] ?? 0.0025);
        $gamma = (float)($data['gamma'] ?? 0.98);
        $configJson = json_encode([
            'state_dim' => 8,
            'action_dim' => 7,
            'hidden_layers' => [64, 64],
            'target_distance_m' => 10.0
        ]);

        $this->db->prepare("INSERT INTO training_sessions 
            (session_code, student_name, session_title, algorithm, preset_code, learning_rate, gamma, total_episodes, best_distance_m, best_reward, avg_distance_m, avg_reward, success_walk_count, fall_count, status, config_json)
            VALUES (:code, :student, :title, :algo, :preset, :lr, :gamma, 0, 0, 0, 0, 0, 0, 0, 'active', :cfg)");
        $this->db->bind(':code', $code);
        $this->db->bind(':student', $studentName);
        $this->db->bind(':title', $title);
        $this->db->bind(':algo', $algorithm);
        $this->db->bind(':preset', $presetCode);
        $this->db->bind(':lr', $lr);
        $this->db->bind(':gamma', $gamma);
        $this->db->bind(':cfg', $configJson);
        $this->db->execute();

        $newId = (int)$this->db->lastInsertId();
        $this->db->prepare("SELECT * FROM training_sessions WHERE id = :id LIMIT 1");
        $this->db->bind(':id', $newId);
        return $this->db->single();
    }

    public function recordEpisode(array $payload): array {
        if (!$this->db->isConnected()) {
            return ['success' => false, 'message' => 'Database belum terhubung'];
        }

        $sessionId = (int)($payload['session_id'] ?? 1);
        $episodeNumber = (int)($payload['episode_number'] ?? 1);
        $algorithm = strtoupper(trim((string)($payload['algorithm'] ?? 'DQN')));
        $distanceM = round((float)($payload['distance_m'] ?? 0.0), 2);
        $totalReward = round((float)($payload['total_reward'] ?? 0.0), 2);
        $stepsCount = (int)($payload['steps_count'] ?? 0);
        $durationSec = round((float)($payload['duration_sec'] ?? 0.0), 2);
        $avgTorsoDeg = round((float)($payload['avg_torso_angle_deg'] ?? 0.0), 2);
        $avgSpeedMs = round((float)($payload['avg_speed_ms'] ?? 0.0), 2);
        $epsilon = round((float)($payload['epsilon'] ?? 0.0), 4);
        $lossValue = round((float)($payload['loss_value'] ?? 0.0), 5);
        $reason = trim((string)($payload['termination_reason'] ?? 'Menabrak Box Penghalang'));
        $reachedFinish = !empty($payload['reached_finish']) ? 1 : 0;
        $stageLabel = trim((string)($payload['stage_label'] ?? 'Sudut NE | Tahap 1: Eksplorasi'));

        $this->db->prepare("INSERT INTO episode_logs 
            (session_id, episode_number, algorithm, distance_m, total_reward, steps_count, duration_sec, avg_torso_angle_deg, avg_speed_ms, epsilon, loss_value, termination_reason, reached_finish, stage_label)
            VALUES (:sid, :ep, :algo, :dist, :rew, :steps, :dur, :torso, :spd, :eps, :loss, :reason, :fin, :stage)");
        $this->db->bind(':sid', $sessionId);
        $this->db->bind(':ep', $episodeNumber);
        $this->db->bind(':algo', $algorithm);
        $this->db->bind(':dist', $distanceM);
        $this->db->bind(':rew', $totalReward);
        $this->db->bind(':steps', $stepsCount);
        $this->db->bind(':dur', $durationSec);
        $this->db->bind(':torso', $avgTorsoDeg);
        $this->db->bind(':spd', $avgSpeedMs);
        $this->db->bind(':eps', $epsilon);
        $this->db->bind(':loss', $lossValue);
        $this->db->bind(':reason', $reason);
        $this->db->bind(':fin', $reachedFinish);
        $this->db->bind(':stage', $stageLabel);
        $this->db->execute();

        $insertedId = (int)$this->db->lastInsertId();

        $this->recalculateSessionStats($sessionId);

        $this->db->prepare("SELECT * FROM training_sessions WHERE id = :sid LIMIT 1");
        $this->db->bind(':sid', $sessionId);
        $updatedSession = $this->db->single();

        return [
            'success' => true,
            'episode_id' => $insertedId,
            'session' => $updatedSession
        ];
    }

    public function recalculateSessionStats(int $sessionId): void {
        if (!$this->db->isConnected()) return;

        $this->db->prepare("SELECT 
                COUNT(*) AS cnt,
                COALESCE(MAX(distance_m), 0) AS max_dist,
                COALESCE(MAX(total_reward), 0) AS max_rew,
                COALESCE(AVG(distance_m), 0) AS avg_dist,
                COALESCE(AVG(total_reward), 0) AS avg_rew,
                COALESCE(SUM(CASE WHEN reached_finish = 1 THEN 1 ELSE 0 END), 0) AS win_cnt,
                COALESCE(SUM(CASE WHEN reached_finish = 0 THEN 1 ELSE 0 END), 0) AS fall_cnt
            FROM episode_logs WHERE session_id = :sid");
        $this->db->bind(':sid', $sessionId);
        $agg = $this->db->single();

        if ($agg) {
            $this->db->prepare("UPDATE training_sessions SET
                total_episodes = :cnt,
                best_distance_m = :max_dist,
                best_reward = :max_rew,
                avg_distance_m = :avg_dist,
                avg_reward = :avg_rew,
                success_walk_count = :win_cnt,
                fall_count = :fall_cnt
                WHERE id = :sid");
            $this->db->bind(':cnt', (int)$agg['cnt']);
            $this->db->bind(':max_dist', round((float)$agg['max_dist'], 2));
            $this->db->bind(':max_rew', round((float)$agg['max_rew'], 2));
            $this->db->bind(':avg_dist', round((float)$agg['avg_dist'], 2));
            $this->db->bind(':avg_rew', round((float)$agg['avg_rew'], 2));
            $this->db->bind(':win_cnt', (int)$agg['win_cnt']);
            $this->db->bind(':fall_cnt', (int)$agg['fall_cnt']);
            $this->db->bind(':sid', $sessionId);
            $this->db->execute();
        }
    }

    public function clearSessionEpisodes(int $sessionId): bool {
        if (!$this->db->isConnected()) return false;
        $this->db->prepare("DELETE FROM episode_logs WHERE session_id = :sid");
        $this->db->bind(':sid', $sessionId);
        $this->db->execute();

        $this->db->prepare("UPDATE training_sessions SET 
            total_episodes = 0, best_distance_m = 0, best_reward = 0,
            avg_distance_m = 0, avg_reward = 0, success_walk_count = 0, fall_count = 0
            WHERE id = :sid");
        $this->db->bind(':sid', $sessionId);
        return $this->db->execute();
    }

    public function saveModel(array $payload): array {
        if (!$this->db->isConnected()) {
            return ['success' => false, 'message' => 'Database tidak terhubung'];
        }

        $modelCode = 'MDL-' . strtoupper(substr(md5(uniqid((string)mt_rand(), true)), 0, 8));
        $modelName = trim((string)($payload['model_name'] ?? 'Model Robot Mahasiswa')) ?: 'Model Robot Mahasiswa';
        $algorithm = strtoupper(trim((string)($payload['algorithm'] ?? 'DQN')));
        $trainedEpisodes = (int)($payload['trained_episodes'] ?? 1);
        $bestDistance = round((float)($payload['best_distance_m'] ?? 0.0), 2);
        $bestReward = round((float)($payload['best_reward'] ?? 0.0), 2);
        $archJson = (string)($payload['architecture_json'] ?? '{"inputShape":[8],"layers":[64,64],"outputActions":7}');
        $weightsJson = (string)($payload['weights_json'] ?? '{}');
        $notes = trim((string)($payload['notes'] ?? 'Disimpan dari pelatihan Robot Catch the Flag (DQN TensorFlow.js Web Worker).'));

        if ($bestDistance >= 9.0) {
            $skillLevel = 'Juara Kompetisi (4 Sudut)';
        } elseif ($bestDistance >= 4.5) {
            $skillLevel = 'Menengah (Bisa Lompat Box)';
        } else {
            $skillLevel = 'Pemula (Eksplorasi)';
        }

        $this->db->prepare("INSERT INTO saved_models 
            (model_code, model_name, algorithm, skill_level, trained_episodes, best_distance_m, best_reward, architecture_json, weights_json, notes, is_builtin)
            VALUES (:code, :name, :algo, :skill, :eps, :dist, :rew, :arch, :weights, :notes, 0)");
        $this->db->bind(':code', $modelCode);
        $this->db->bind(':name', $modelName);
        $this->db->bind(':algo', $algorithm);
        $this->db->bind(':skill', $skillLevel);
        $this->db->bind(':eps', $trainedEpisodes);
        $this->db->bind(':dist', $bestDistance);
        $this->db->bind(':rew', $bestReward);
        $this->db->bind(':arch', $archJson);
        $this->db->bind(':weights', $weightsJson);
        $this->db->bind(':notes', $notes);
        $ok = $this->db->execute();

        return [
            'success' => $ok,
            'model_id' => (int)$this->db->lastInsertId(),
            'model_code' => $modelCode,
            'models' => $this->getSavedModels()
        ];
    }

    public function deleteModel(int $id): array {
        if (!$this->db->isConnected()) {
            return ['success' => false, 'message' => 'Database tidak terhubung'];
        }
        $this->db->prepare("DELETE FROM saved_models WHERE id = :id AND is_builtin = 0");
        $this->db->bind(':id', $id);
        $this->db->execute();
        return [
            'success' => true,
            'models' => $this->getSavedModels()
        ];
    }

    public function updatePreset(array $payload): array {
        if (!$this->db->isConnected()) {
            return ['success' => false, 'message' => 'Database tidak terhubung'];
        }

        $presetCode = trim((string)($payload['preset_code'] ?? 'standar_seimbang'));
        $lr = (float)($payload['learning_rate'] ?? 0.0025);
        $gamma = (float)($payload['gamma'] ?? 0.98);
        $wForward = (float)($payload['reward_forward_weight'] ?? 5.5);
        $wUpright = (float)($payload['reward_upright_weight'] ?? 2.5);
        $wGait = (float)($payload['reward_gait_weight'] ?? 3.5);
        $pFall = (float)($payload['penalty_fall'] ?? -45.0);
        $pTorque = (float)($payload['penalty_torque'] ?? -0.04);
        $gravity = (float)($payload['gravity'] ?? 9.81);
        $friction = (float)($payload['ground_friction'] ?? 0.88);

        $this->db->prepare("UPDATE reward_presets SET
            learning_rate = :lr,
            gamma = :gamma,
            reward_forward_weight = :wf,
            reward_upright_weight = :wu,
            reward_gait_weight = :wg,
            penalty_fall = :pf,
            penalty_torque = :pt,
            gravity = :grav,
            ground_friction = :fric
            WHERE preset_code = :code");
        $this->db->bind(':lr', $lr);
        $this->db->bind(':gamma', $gamma);
        $this->db->bind(':wf', $wForward);
        $this->db->bind(':wu', $wUpright);
        $this->db->bind(':wg', $wGait);
        $this->db->bind(':pf', $pFall);
        $this->db->bind(':pt', $pTorque);
        $this->db->bind(':grav', $gravity);
        $this->db->bind(':fric', $friction);
        $this->db->bind(':code', $presetCode);
        $this->db->execute();

        return [
            'success' => true,
            'presets' => $this->getPresets()
        ];
    }
}
