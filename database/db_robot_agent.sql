-- =====================================================================
-- DATABASE: db_robot_agent
-- SIMULASI REINFORCEMENT LEARNING: ROBOT CATCH THE FLAG COMPETITION (DQN)
-- Stack: PHP 8+, MySQL (db_robot_agent), HTML5, CSS3, JS ES6+, Three.js, TensorFlow.js, Web Workers
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `db_robot_agent` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `db_robot_agent`;

-- ---------------------------------------------------------------------
-- 1. Tabel: reward_presets (Preset Hyperparameter DQN & Bobot Reward Kompetisi)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reward_presets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `preset_code` VARCHAR(50) NOT NULL UNIQUE,
  `preset_name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `algorithm` ENUM('DQN', 'PPO', 'CURRICULUM_RL') NOT NULL DEFAULT 'DQN',
  `learning_rate` DOUBLE NOT NULL DEFAULT 0.0025,
  `gamma` DOUBLE NOT NULL DEFAULT 0.98,
  `epsilon_start` DOUBLE NOT NULL DEFAULT 1.00,
  `epsilon_min` DOUBLE NOT NULL DEFAULT 0.05,
  `epsilon_decay` DOUBLE NOT NULL DEFAULT 0.89,
  `reward_forward_weight` DOUBLE NOT NULL DEFAULT 5.5,
  `reward_upright_weight` DOUBLE NOT NULL DEFAULT 2.5,
  `reward_gait_weight` DOUBLE NOT NULL DEFAULT 3.5,
  `penalty_fall` DOUBLE NOT NULL DEFAULT -45.0,
  `penalty_torque` DOUBLE NOT NULL DEFAULT -0.04,
  `gravity` DOUBLE NOT NULL DEFAULT 9.81,
  `ground_friction` DOUBLE NOT NULL DEFAULT 0.88,
  `target_distance_m` DOUBLE NOT NULL DEFAULT 10.0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. Tabel: training_sessions (Sesi Pelatihan & Kompetisi Mahasiswa)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `training_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `session_code` VARCHAR(50) NOT NULL UNIQUE,
  `student_name` VARCHAR(100) NOT NULL DEFAULT 'Mahasiswa Peserta Kompetisi',
  `session_title` VARCHAR(150) NOT NULL,
  `algorithm` VARCHAR(30) NOT NULL DEFAULT 'DQN',
  `preset_code` VARCHAR(50) NOT NULL DEFAULT 'standar_seimbang',
  `learning_rate` DOUBLE NOT NULL DEFAULT 0.0025,
  `gamma` DOUBLE NOT NULL DEFAULT 0.98,
  `total_episodes` INT NOT NULL DEFAULT 0,
  `best_distance_m` DOUBLE NOT NULL DEFAULT 0.0,
  `best_reward` DOUBLE NOT NULL DEFAULT 0.0,
  `avg_distance_m` DOUBLE NOT NULL DEFAULT 0.0,
  `avg_reward` DOUBLE NOT NULL DEFAULT 0.0,
  `success_walk_count` INT NOT NULL DEFAULT 0,
  `fall_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('active', 'completed', 'reset') NOT NULL DEFAULT 'active',
  `config_json` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. Tabel: episode_logs (Log Detail Setiap Episode Rebut Bendera & Lompat Box)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `episode_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `session_id` INT NOT NULL DEFAULT 1,
  `episode_number` INT NOT NULL,
  `algorithm` VARCHAR(30) NOT NULL DEFAULT 'DQN',
  `distance_m` DOUBLE NOT NULL DEFAULT 0.0,
  `total_reward` DOUBLE NOT NULL DEFAULT 0.0,
  `steps_count` INT NOT NULL DEFAULT 0,
  `duration_sec` DOUBLE NOT NULL DEFAULT 0.0,
  `avg_torso_angle_deg` DOUBLE NOT NULL DEFAULT 0.0,
  `avg_speed_ms` DOUBLE NOT NULL DEFAULT 0.0,
  `epsilon` DOUBLE NOT NULL DEFAULT 0.0,
  `loss_value` DOUBLE NOT NULL DEFAULT 0.0,
  `termination_reason` VARCHAR(120) NOT NULL DEFAULT 'Menabrak Box Penghalang',
  `reached_finish` TINYINT(1) NOT NULL DEFAULT 0,
  `stage_label` VARCHAR(100) NOT NULL DEFAULT 'Sudut NE | Tahap 1: Eksplorasi',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_session_ep` (`session_id`, `episode_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. Tabel: saved_models (Penyimpanan Otak Neural Network DQN TensorFlow.js)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `saved_models` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `model_code` VARCHAR(60) NOT NULL UNIQUE,
  `model_name` VARCHAR(120) NOT NULL,
  `algorithm` VARCHAR(30) NOT NULL DEFAULT 'DQN',
  `skill_level` VARCHAR(60) NOT NULL DEFAULT 'Menengah (Bisa Lompat Box)',
  `trained_episodes` INT NOT NULL DEFAULT 1,
  `best_distance_m` DOUBLE NOT NULL DEFAULT 0.0,
  `best_reward` DOUBLE NOT NULL DEFAULT 0.0,
  `architecture_json` TEXT NOT NULL,
  `weights_json` LONGTEXT NOT NULL,
  `notes` TEXT NULL,
  `is_builtin` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. Tabel: competition_leaderboard (Papan Peringkat Kompetisi Offline Mahasiswa)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `competition_leaderboard` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `student_name` VARCHAR(100) NOT NULL,
  `student_nim` VARCHAR(40) NOT NULL DEFAULT '-',
  `model_name` VARCHAR(120) NOT NULL DEFAULT 'DQN Robot Agent',
  `algorithm` VARCHAR(30) NOT NULL DEFAULT 'DQN',
  `episodes_trained` INT NOT NULL DEFAULT 1,
  `flags_captured` INT NOT NULL DEFAULT 0,
  `fastest_capture_sec` DOUBLE NOT NULL DEFAULT 99.9,
  `jump_success_count` INT NOT NULL DEFAULT 0,
  `competition_score` DOUBLE NOT NULL DEFAULT 0.0,
  `corner_mastery` VARCHAR(80) NOT NULL DEFAULT '4/4 Sudut Random',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. Tabel Pendukung Keamanan: security_incidents
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `security_incidents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `incident_type` VARCHAR(100) NOT NULL,
  `source_ip` VARCHAR(45) NOT NULL,
  `request_uri` VARCHAR(255) NULL,
  `payload_snippet` TEXT NULL,
  `action_taken` VARCHAR(50) DEFAULT 'Blocked',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- SEED DATA AWAL UNTUK KOMPETISI MAHASISWA
-- =====================================================================

INSERT INTO `reward_presets` (
  `id`, `preset_code`, `preset_name`, `description`, `algorithm`,
  `learning_rate`, `gamma`, `epsilon_start`, `epsilon_min`, `epsilon_decay`,
  `reward_forward_weight`, `reward_upright_weight`, `reward_gait_weight`,
  `penalty_fall`, `penalty_torque`, `gravity`, `ground_friction`, `target_distance_m`
) VALUES
(1, 'standar_seimbang', 'Kompetisi 1: DQN Standar (Navigasi Sudut + Hindari Box)',
 'Rekomendasi utama kompetisi! Menyeimbangkan hadiah jalan kejar bendera di sudut acak (+5.5), bonus manuver menghindari box penghalang berwarna (+3.5), dan stabilitas gyro robot (+2.5).',
 'DQN', 0.0025, 0.98, 1.00, 0.05, 0.89, 5.5, 2.5, 3.5, -45.0, -0.04, 9.81, 0.88, 10.0),
(2, 'fokus_lari_cepat', 'Kompetisi 2: Speedrunner Rebut Bendera (Jalan Cepat Agresif)',
 'Memberikan bobot kejar bendera sangat tinggi (+8.0) dan peluruhan eksplorasi cepat (0.86) agar Robot AI langsung berjalan cepat ke sudut bendera untuk mencetak rekor waktu tercepat.',
 'DQN', 0.0035, 0.97, 1.00, 0.04, 0.86, 8.0, 1.8, 3.0, -35.0, -0.02, 9.81, 0.90, 10.0),
(3, 'fokus_postur_tegak', 'Kompetisi 3: Spesialis Manuver Celah Box (Obstacle Master)',
 'Memberikan hadiah tinggi (+5.5) saat Robot berhasil bermanuver halus melewati celah box kuning/biru menuju sudut bendera tanpa menabrak penghalang.',
 'DQN', 0.0025, 0.99, 0.90, 0.05, 0.88, 5.0, 3.0, 5.5, -50.0, -0.05, 9.81, 0.88, 10.0),
(4, 'lantai_es_licin', 'Kompetisi 4: Arena Tantangan Ekstrem (Lantai Licin)',
 'Simulasi kompetisi dengan permukaan arena licin sehingga langkah kaki Robot menuntut kontrol keseimbangan gyro dan belokan halus.',
 'CURRICULUM_RL', 0.0025, 0.98, 0.90, 0.05, 0.87, 5.5, 3.5, 4.0, -55.0, -0.05, 9.81, 0.55, 10.0)
ON DUPLICATE KEY UPDATE
  `preset_name` = VALUES(`preset_name`),
  `description` = VALUES(`description`),
  `reward_forward_weight` = VALUES(`reward_forward_weight`),
  `reward_upright_weight` = VALUES(`reward_upright_weight`),
  `reward_gait_weight` = VALUES(`reward_gait_weight`),
  `penalty_fall` = VALUES(`penalty_fall`),
  `ground_friction` = VALUES(`ground_friction`);

INSERT INTO `training_sessions` (
  `id`, `session_code`, `student_name`, `session_title`, `algorithm`, `preset_code`,
  `learning_rate`, `gamma`, `total_episodes`, `best_distance_m`, `best_reward`,
  `avg_distance_m`, `avg_reward`, `success_walk_count`, `fall_count`, `status`, `config_json`
) VALUES
(1, 'SES-ROBOFLAG-01', 'Mahasiswa Peserta Kompetisi', 'Kompetisi RL Robot Catch the Flag (DQN) — 4 Sudut Random',
 'DQN', 'standar_seimbang', 0.0025, 0.98, 16, 10.00, 386.40, 6.82, 164.20, 6, 10, 'active',
 '{"state_dim":8,"action_dim":7,"hidden_layers":[64,64],"arena_size":"16x16m","random_corners":true}')
ON DUPLICATE KEY UPDATE
  `session_title` = VALUES(`session_title`);

INSERT INTO `episode_logs` (
  `id`, `session_id`, `episode_number`, `algorithm`, `distance_m`, `total_reward`,
  `steps_count`, `duration_sec`, `avg_torso_angle_deg`, `avg_speed_ms`, `epsilon`,
  `loss_value`, `termination_reason`, `reached_finish`, `stage_label`
) VALUES
(1, 1, 1, 'DQN', 1.45, -36.20, 34, 0.85, 22.4, 0.65, 1.00, 1.780, 'Menabrak Box Kuning & Jatuh (Sudut NE)', 0, 'Sudut NE | Tahap 1: Eksplorasi Acak'),
(2, 1, 2, 'DQN', 2.10, -24.80, 48, 1.20, 19.8, 0.78, 0.89, 1.510, 'Menabrak Sisi Box Biru (Sudut NW)', 0, 'Sudut NW | Tahap 1: Eksplorasi Acak'),
(3, 1, 3, 'DQN', 3.25, -8.40, 64, 1.60, 16.5, 0.92, 0.79, 1.240, 'Tersangkut Rintangan Box (Sudut SE)', 0, 'Sudut SE | Tahap 1: Eksplorasi Acak'),
(4, 1, 4, 'DQN', 4.40, 18.50, 86, 2.15, 14.2, 1.05, 0.70, 0.980, 'Waktu Habis Dekat Box (Sudut SW)', 0, 'Sudut SW | Tahap 2: Deteksi Radar Box'),
(5, 1, 5, 'DQN', 5.65, 52.30, 110, 2.75, 12.6, 1.18, 0.62, 0.815, 'Berhasil Belok Hindari Box, Jatuh Dekat Point (NE)', 0, 'Sudut NE | Tahap 2: Belajar Hindari Box'),
(6, 1, 6, 'DQN', 6.80, 89.40, 132, 3.30, 11.1, 1.26, 0.55, 0.690, 'Hampir Sentuh Bendera Sudut NW', 0, 'Sudut NW | Tahap 2: Belajar Hindari Box'),
(7, 1, 7, 'DQN', 10.00, 284.60, 168, 4.20, 8.4, 1.48, 0.49, 0.580, '🚩 Bendera Sudut Tenggara (SE) Tertangkap! (Hindari 2 Box)', 1, 'Sudut SE | Tahap 3: Rebut Bendera!'),
(8, 1, 8, 'DQN', 7.90, 128.00, 146, 3.65, 9.5, 1.35, 0.44, 0.495, 'Miring Saat Belok Tajam (Sudut SW)', 0, 'Sudut SW | Tahap 3: Navigasi & Kompas'),
(9, 1, 9, 'DQN', 10.00, 312.50, 152, 3.80, 7.6, 1.56, 0.39, 0.412, '🚩 Bendera Sudut Timur Laut (NE) Tertangkap! (Hindari 2 Box)', 1, 'Sudut NE | Tahap 3: Rebut Bendera!'),
(10, 1, 10, 'DQN', 8.45, 156.20, 158, 3.95, 8.2, 1.42, 0.35, 0.355, 'Waktu Habis Dekat Point Bendera (NW)', 0, 'Sudut NW | Tahap 3: Navigasi & Kompas'),
(11, 1, 11, 'DQN', 10.00, 334.80, 142, 3.55, 6.8, 1.64, 0.31, 0.298, '🚩 Bendera Sudut Barat Laut (NW) Tertangkap! (Hindari 3 Box)', 1, 'Sudut NW | Tahap 4: Juara Kompetisi!'),
(12, 1, 12, 'DQN', 9.10, 184.00, 160, 4.00, 7.2, 1.50, 0.28, 0.254, 'Hampir Capai Point Sudut SW', 0, 'Sudut SW | Tahap 3: Navigasi & Kompas'),
(13, 1, 13, 'DQN', 10.00, 352.10, 134, 3.35, 6.1, 1.72, 0.25, 0.215, '🚩 Bendera Sudut Barat Daya (SW) Tertangkap! (Hindari 2 Box)', 1, 'Sudut SW | Tahap 4: Juara Kompetisi!'),
(14, 1, 14, 'DQN', 10.00, 368.90, 126, 3.15, 5.5, 1.79, 0.22, 0.182, '🚩 Bendera Sudut Timur Laut (NE) Tertangkap! (Hindari 3 Box)', 1, 'Sudut NE | Tahap 4: Juara Kompetisi!'),
(15, 1, 15, 'DQN', 9.40, 210.40, 148, 3.70, 6.4, 1.62, 0.19, 0.158, 'Terhalang Box Tinggi di Tengah (SE)', 0, 'Sudut SE | Tahap 4: Juara Kompetisi!'),
(16, 1, 16, 'DQN', 10.00, 386.40, 118, 2.95, 4.8, 1.88, 0.17, 0.134, '🚩 Bendera Sudut Tenggara (SE) Tertangkap! (Hindari 3 Box)', 1, 'Sudut SE | Tahap 4: Juara Kompetisi!')
ON DUPLICATE KEY UPDATE
  `distance_m` = VALUES(`distance_m`),
  `total_reward` = VALUES(`total_reward`),
  `termination_reason` = VALUES(`termination_reason`),
  `stage_label` = VALUES(`stage_label`);

INSERT INTO `saved_models` (
  `id`, `model_code`, `model_name`, `algorithm`, `skill_level`,
  `trained_episodes`, `best_distance_m`, `best_reward`, `architecture_json`, `weights_json`, `notes`, `is_builtin`
) VALUES
(1, 'MODEL_LVL0_RANDOM', '🤖 Level 0: Robot Baru Rakit (Belum Dilatih / Acak)', 'DQN', 'Pemula (Acak)',
 0, 1.45, -36.20, '{"inputShape":[8],"layers":[64,64],"outputActions":7}',
 '{"preset_mode":"untrained","guidance_strength":0.0,"epsilon":1.0}',
 'Otak DQN dengan bobot acak murni. Robot belum tahu arah bendera dan sering menabrak box berwarna.', 1),
(2, 'MODEL_LVL1_TODDLER', '⚙️ Level 1: Robot Belajar Jalan & Hindari Box (Ep 8)', 'DQN', 'Menengah (Hindari Box)',
 8, 7.90, 156.20, '{"inputShape":[8],"layers":[64,64],"outputActions":7}',
 '{"preset_mode":"intermediate","guidance_strength":0.65,"epsilon":0.32}',
 'Hasil latihan 8 episode. Robot sudah bisa membaca radar box di depan, berbelok menghindari box berwarna, dan mulai mengejar sudut bendera.', 1),
(3, 'MODEL_LVL2_MASTER', '🏆 Level 2: Robot Juara Catch The Flag (Master DQN)', 'DQN', 'Juara Kompetisi (4 Sudut)',
 20, 10.00, 395.80, '{"inputShape":[8],"layers":[64,64],"outputActions":7}',
 '{"preset_mode":"master","guidance_strength":0.96,"epsilon":0.04}',
 'Model konvergen siap tanding! Mampu berjalan cepat, bermanuver cerdas melewati celah rintangan box kuning/biru, dan merebut bendera di ke-4 sudut arena secara random.', 1)
ON DUPLICATE KEY UPDATE
  `model_name` = VALUES(`model_name`),
  `skill_level` = VALUES(`skill_level`),
  `notes` = VALUES(`notes`);

INSERT INTO `competition_leaderboard` (
  `id`, `student_name`, `student_nim`, `model_name`, `algorithm`,
  `episodes_trained`, `flags_captured`, `fastest_capture_sec`, `jump_success_count`, `competition_score`, `corner_mastery`
) VALUES
(1, 'Andi Pratama (Benchmark Juara 1)', '202610104', 'RoboFlag-DQN-Turbo-v3', 'DQN', 18, 12, 2.85, 34, 968.5, '4/4 Sudut Arena'),
(2, 'Siti Rahmawati (Benchmark Juara 2)', '202610089', 'NavMaster-DQN-Alpha', 'DQN', 22, 9, 3.20, 28, 884.0, '4/4 Sudut Arena'),
(3, 'Budi Santoso (Benchmark Juara 3)', '202610142', 'Explorer-DQN-Balanced', 'DQN', 25, 6, 3.75, 19, 762.0, '3/4 Sudut Arena')
ON DUPLICATE KEY UPDATE
  `student_name` = VALUES(`student_name`),
  `model_name` = VALUES(`model_name`),
  `competition_score` = VALUES(`competition_score`);
