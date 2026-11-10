<?php
$diag = $data['db_diagnostics'] ?? [];
$presets = $data['presets'] ?? [];
$activeSession = $data['active_session'] ?? [];
$episodes = $data['episodes'] ?? [];
$savedModels = $data['saved_models'] ?? [];
$leaderboard = $data['leaderboard'] ?? [];
$defaultPreset = $presets[0] ?? [
    'preset_code' => 'standar_seimbang',
    'preset_name' => 'Kompetisi 1: DQN Standar (Navigasi Sudut + Hindari Box)',
    'description' => 'Menyeimbangkan hadiah jalan kejar bendera di sudut acak, manuver menghindari box penghalang berwarna, dan stabilitas gyro robot.',
    'algorithm' => 'DQN',
    'learning_rate' => 0.0025,
    'gamma' => 0.98,
    'epsilon_decay' => 0.89,
    'reward_forward_weight' => 5.5,
    'reward_upright_weight' => 2.5,
    'reward_gait_weight' => 3.5,
    'penalty_fall' => -45.0,
    'ground_friction' => 0.88,
    'gravity' => 9.81
];
?>
<!DOCTYPE html>
<html lang="id" data-bs-theme="dark">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($data['title']); ?></title>
    <link rel="stylesheet" href="<?php echo APP_PATH; ?>/public/assets/vendor/bootstrap/css/bootstrap.min.css">
    <link rel="stylesheet" href="<?php echo APP_PATH; ?>/public/assets/vendor/bootstrap-icons/bootstrap-icons.min.css">
    <style>
        :root {
            --bg-main: #090d16;
            --bg-panel: #111827;
            --bg-card: #1e293b;
            --border-soft: rgba(148, 163, 184, 0.16);
            --accent-cyan: #38bdf8;
            --accent-emerald: #10b981;
        }
        body {
            background-color: var(--bg-main);
            color: #e2e8f0;
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            overflow-x: hidden;
        }
        .navbar-lab {
            background: rgba(15, 23, 42, 0.94);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border-soft);
        }
        .panel-card {
            background: var(--bg-panel);
            border: 1px solid var(--border-soft);
            border-radius: 12px;
        }
        .sub-card {
            background: rgba(30, 41, 59, 0.65);
            border: 1px solid var(--border-soft);
            border-radius: 10px;
        }
        #threeCanvasContainer {
            width: 100%;
            height: 430px;
            background: linear-gradient(180deg, #3b82f6 0%, #93c5fd 55%, #1e293b 100%);
            border-radius: 10px;
            overflow: hidden;
            position: relative;
            cursor: grab;
            border: 2px solid rgba(56, 189, 248, 0.35);
        }
        #threeCanvasContainer:active {
            cursor: grabbing;
        }
        #simulationMainPanel.sim-panel-fullscreen,
        #simulationMainPanel:fullscreen,
        #simulationMainPanel:-webkit-full-screen {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            z-index: 9999 !important;
            margin: 0 !important;
            border-radius: 0 !important;
            background: #090d16 !important;
            display: flex !important;
            flex-direction: column !important;
            padding: 12px !important;
        }
        #simulationMainPanel.sim-panel-fullscreen #viewportWrapper,
        #simulationMainPanel:fullscreen #viewportWrapper,
        #simulationMainPanel:-webkit-full-screen #viewportWrapper {
            flex: 1 1 auto !important;
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
        }
        #simulationMainPanel.sim-panel-fullscreen #threeCanvasContainer,
        #simulationMainPanel:fullscreen #threeCanvasContainer,
        #simulationMainPanel:-webkit-full-screen #threeCanvasContainer {
            flex: 1 1 auto !important;
            height: 100% !important;
            min-height: 320px !important;
        }
        .hud-overlay-top {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            z-index: 10;
            pointer-events: none;
        }
        .hud-overlay-bottom {
            position: absolute;
            bottom: 10px;
            left: 10px;
            right: 10px;
            z-index: 10;
            pointer-events: none;
        }
        .hud-interactive {
            pointer-events: auto;
        }
        .sim-env-badge {
            background: linear-gradient(135deg, rgba(13, 71, 161, 0.92), rgba(2, 132, 199, 0.90));
            border: 1px solid rgba(125, 211, 252, 0.65);
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
            border-radius: 10px;
            padding: 5px 12px;
            color: #ffffff;
            font-weight: 700;
            font-size: 0.78rem;
            line-height: 1.15;
        }
        .hud-pill {
            background: rgba(15, 23, 42, 0.84);
            border: 1px solid rgba(56, 189, 248, 0.35);
            backdrop-filter: blur(6px);
            border-radius: 8px;
            padding: 4px 10px;
            font-size: 0.77rem;
        }
        .btn-emerald {
            background-color: #10b981;
            border-color: #059669;
            color: #052e16;
        }
        .btn-emerald:hover {
            background-color: #34d399;
            color: #022c22;
        }
        .text-emerald {
            color: #34d399 !important;
        }
        .sensor-bar-bg {
            height: 6px;
            background: rgba(148, 163, 184, 0.15);
            border-radius: 4px;
            overflow: hidden;
        }
        .formula-box {
            background: rgba(15, 23, 42, 0.9);
            border-left: 3px solid var(--accent-cyan);
            font-family: "JetBrains Mono", Consolas, monospace;
            font-size: 0.78rem;
        }
        .nav-tabs-lab .nav-link {
            color: #94a3b8;
            border: none;
            border-bottom: 2px solid transparent;
            padding: 0.5rem 0.65rem;
            font-size: 0.79rem;
            font-weight: 600;
        }
        .nav-tabs-lab .nav-link.active {
            color: #38bdf8;
            background: transparent;
            border-bottom-color: #38bdf8;
        }
        .table-episodes th, .table-episodes td {
            font-size: 0.76rem;
            vertical-align: middle;
            padding: 0.4rem 0.5rem;
        }
    </style>
</head>
<body>

<header class="navbar navbar-expand-lg navbar-lab py-2 sticky-top">
    <div class="container-fluid px-3">
        <div class="d-flex align-items-center gap-2">
            <div class="bg-info bg-opacity-10 border border-info border-opacity-25 rounded-3 p-2 d-flex align-items-center justify-content-center">
                <i class="bi bi-robot fs-4 text-info"></i>
            </div>
            <div>
                <div class="fw-bold text-white d-flex align-items-center gap-2" style="font-size: 1rem;">
                    <span>Simulasi RL Robot Catch the Flag Competition (DQN)</span>
                </div>
                <div class="text-secondary" style="font-size: 0.73rem;">
                    Arena Labirin 28x28m (40 Box Berwarna) &bull; Bendera 4 Sudut Random &bull; Kemudi Pelatih (WASD) &bull; TensorFlow.js DQN &bull; MySQL
                </div>
            </div>
        </div>

        <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mt-lg-0">
            <span id="workerStatusBadge" class="badge bg-warning-subtle text-warning border border-warning-subtle">
                <i class="bi bi-hourglass-split me-1"></i>Memuat DQN Worker...
            </span>

            <?php if (!empty($diag['is_connected'])): ?>
                <span class="badge bg-success-subtle text-success border border-success-subtle">
                    <i class="bi bi-database-check me-1"></i>MySQL: <?php echo htmlspecialchars($diag['database']); ?> (Online)
                </span>
            <?php else: ?>
                <form action="<?php echo APP_PATH; ?>/setup/init/" method="POST" class="d-inline">
                    <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($data['csrf_token']); ?>">
                    <button type="submit" class="btn btn-danger btn-sm py-0 px-2" style="font-size: 0.75rem;">
                        <i class="bi bi-magic me-1"></i>Inisialisasi Database db_robot_agent
                    </button>
                </form>
            <?php endif; ?>
        </div>
    </div>
</header>

<main class="container-fluid px-3 py-3">

    <div id="liveNotificationBanner" class="d-none"></div>

    <div class="row g-2 mb-3">
        <div class="col-6 col-md-3">
            <div class="panel-card p-2 px-3 d-flex align-items-center justify-content-between">
                <div>
                    <div class="text-secondary small" style="font-size: 0.71rem;">TOTAL EPISODE DILATIH</div>
                    <div id="kpiTotalEpisodes" class="fs-5 fw-bold text-white"><?php echo count($episodes); ?></div>
                </div>
                <i class="bi bi-arrow-repeat fs-3 text-info opacity-75"></i>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="panel-card p-2 px-3 d-flex align-items-center justify-content-between">
                <div>
                    <div class="text-secondary small" style="font-size: 0.71rem;">REKOR WAKTU REBUT BENDERA</div>
                    <div id="kpiBestDistance" class="fs-5 fw-bold text-emerald">2.95 dtk</div>
                </div>
                <i class="bi bi-stopwatch-fill fs-3 text-emerald opacity-75"></i>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="panel-card p-2 px-3 d-flex align-items-center justify-content-between">
                <div>
                    <div class="text-secondary small" style="font-size: 0.71rem;">SKOR KOMPETISI MAHASISWA</div>
                    <div id="kpiAvgDistance" class="fs-5 fw-bold text-warning">845 Poin</div>
                </div>
                <i class="bi bi-award-fill fs-3 text-warning opacity-75"></i>
            </div>
        </div>
        <div class="col-6 col-md-3">
            <div class="panel-card p-2 px-3 d-flex align-items-center justify-content-between">
                <div>
                    <div class="text-secondary small" style="font-size: 0.71rem;">BENDERA SUDUT TERTANGKAP</div>
                    <div id="kpiFinishCount" class="fs-5 fw-bold text-info"><?php echo (int)($activeSession['success_walk_count'] ?? 0); ?>x Bendera</div>
                </div>
                <i class="bi bi-flag-fill fs-3 text-danger opacity-75"></i>
            </div>
        </div>
    </div>

    <div class="row g-3">
        <div class="col-12 col-xl-7">

            <div id="simulationMainPanel" class="panel-card p-2 mb-3">
                <div id="viewportWrapper" class="position-relative">
                    <div class="hud-overlay-top d-flex flex-wrap justify-content-between align-items-start gap-2">
                        <div class="d-flex flex-wrap align-items-center gap-1">
                            <div class="sim-env-badge me-1">
                                <div>3D Simulation</div>
                                <div>Environment</div>
                            </div>
                            <div class="hud-pill">
                                <span class="text-secondary">Ep:</span>
                                <strong id="hudEpisode" class="text-info ms-1">1</strong>
                            </div>
                            <div class="hud-pill">
                                <span class="text-secondary">Progress:</span>
                                <strong id="hudDistance" class="text-emerald ms-1">0.00 / 10m</strong>
                            </div>
                            <div class="hud-pill">
                                <span class="text-secondary">Laju:</span>
                                <strong id="hudSpeed" class="text-white ms-1">0.00 m/s</strong>
                            </div>
                            <div class="hud-pill">
                                <span class="text-secondary">Sudut Bendera:</span>
                                <strong id="hudTorsoAngle" class="text-warning ms-1">NE (16.1m)</strong>
                            </div>
                            <div class="hud-pill">
                                <span class="text-secondary">&epsilon;:</span>
                                <strong id="hudEpsilon" class="text-info ms-1">100%</strong>
                            </div>
                            <div class="hud-pill">
                                <span class="text-secondary">Loss:</span>
                                <strong id="hudLoss" class="text-light ms-1">0.0000</strong>
                            </div>
                        </div>

                        <div class="d-flex flex-wrap align-items-center gap-1 hud-interactive">
                            <span id="hudStageBadge" class="badge bg-info text-dark fw-bold px-2 py-1">
                                Sudut NE | Tahap 1: Eksplorasi
                            </span>
                            <div class="btn-group btn-group-sm">
                                <button type="button" class="btn btn-dark border-secondary cam-btn active" data-cam="follow" title="Kamera Belakang Bahu Robot (Seperti Gambar)">3D Robot</button>
                                <button type="button" class="btn btn-dark border-secondary cam-btn" data-cam="side" title="Tampilan Samping">Samping</button>
                                <button type="button" class="btn btn-dark border-secondary cam-btn" data-cam="front" title="Kamera Depan Robot">Depan</button>
                                <button type="button" class="btn btn-dark border-secondary cam-btn" data-cam="overview" title="Lihat Seluruh Arena & 4 Sudut Bendera">Arena 4 Sudut</button>
                            </div>
                            <div class="hud-pill d-flex align-items-center gap-1 py-1 px-2">
                                <button type="button" id="btnZoomIn" class="btn btn-sm btn-outline-info py-0 px-1" title="Zoom In">
                                    <i class="bi bi-zoom-in"></i>
                                </button>
                                <input type="range" id="sliderZoom3D" class="form-range" min="35" max="250" step="5" value="100" style="width: 68px; height: 14px;" title="Zoom 3D">
                                <button type="button" id="btnZoomOut" class="btn btn-sm btn-outline-info py-0 px-1" title="Zoom Out">
                                    <i class="bi bi-zoom-out"></i>
                                </button>
                                <span id="zoomPercentLabel" class="text-info fw-bold font-monospace ms-1" style="font-size: 0.72rem; min-width: 36px;">100%</span>
                                <button type="button" id="btnZoomReset" class="btn btn-sm btn-outline-secondary py-0 px-1" title="Reset Kamera">
                                    <i class="bi bi-arrow-counterclockwise"></i>
                                </button>
                                <button type="button" id="btnToggleFullscreen" class="btn btn-sm btn-info text-dark fw-bold py-0 px-2 ms-1" title="Fullscreen">
                                    <i id="iconFullscreen" class="bi bi-arrows-fullscreen me-1"></i><span id="labelFullscreen"></span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div id="threeCanvasContainer"></div>

                    <div class="hud-overlay-bottom d-flex flex-wrap justify-content-between align-items-end gap-2">
                        <div class="hud-pill flex-grow-1" style="max-width: 340px;">
                            <div class="d-flex justify-content-between small mb-1" style="font-size: 0.7rem;">
                                <span>START TENGAH (0,0)</span>
                                <span id="hudPushStatus" class="badge bg-info text-dark d-none">🎮 ARAHAN PELATIH</span>
                                <span class="text-danger fw-bold">🚩 TARGET BENDERA SUDUT</span>
                            </div>
                            <div class="progress" style="height: 7px; background: rgba(255,255,255,0.12);">
                                <div id="hudTrackProgress" class="progress-bar bg-info" style="width: 0%;"></div>
                            </div>
                        </div>

                        <div class="d-flex flex-wrap align-items-center gap-1 hud-interactive">
                            <div class="hud-pill d-flex align-items-center gap-1 py-1 px-2 border-info">
                                <span class="text-info fw-bold me-1" style="font-size: 0.7rem;" title="Arahkan robot saat latihan agar DQN meniru manuver Anda (Human-in-the-Loop)">🎮 Kemudi Pelatih:</span>
                                <button type="button" class="btn btn-sm btn-outline-info py-0 px-2 btn-student-steer" data-action="4" title="Belok Kiri Hindari Box [Tombol A / Panah Kiri]">
                                    <i class="bi bi-arrow-counterclockwise"></i> Kiri [A]
                                </button>
                                <button type="button" class="btn btn-sm btn-info text-dark fw-bold py-0 px-2 btn-student-steer" data-action="1" title="Jalan Cepat Maju Kejar Bendera [Tombol W / Panah Atas]">
                                    <i class="bi bi-arrow-up"></i> Maju [W]
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-info py-0 px-2 btn-student-steer" data-action="5" title="Belok Kanan Hindari Box [Tombol D / Panah Kanan]">
                                    <i class="bi bi-arrow-clockwise"></i> Kanan [D]
                                </button>
                                <button type="button" class="btn btn-sm btn-outline-warning py-0 px-2 btn-student-steer" data-action="6" title="Stabilkan Postur &amp; Kunci Kompas Bendera [Tombol S / Panah Bawah]">
                                    <i class="bi bi-compass"></i> Kompas [S]
                                </button>
                            </div>
                            <button type="button" id="btnShuffleFlag" class="btn btn-sm btn-danger fw-semibold" title="Pindahkan Bendera ke Sudut Arena Lain Secara Random">
                                <i class="bi bi-flag-fill me-1"></i>Acak Sudut Bendera
                            </button>
                            <button type="button" id="btnPushForward" class="btn btn-sm btn-outline-light bg-dark bg-opacity-75" title="Uji Ketahanan Gyro Robot">
                                <i class="bi bi-wind me-1"></i>Uji Dorong
                            </button>
                        </div>
                    </div>
                </div>

                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2 pt-2 border-top border-secondary border-opacity-25 px-1">
                    <div class="d-flex flex-wrap align-items-center gap-1">
                        <button type="button" id="btnStartPause" class="btn btn-emerald fw-semibold px-3">
                            <i class="bi bi-play-fill me-1"></i>Mulai Latih Robot DQN
                        </button>
                        <button type="button" id="btnStepOnce" class="btn btn-outline-info btn-sm" title="Jalankan 1 langkah fisika & amati Q-Values">
                            <i class="bi bi-skip-end-fill me-1"></i>1 Langkah
                        </button>
                        <button type="button" id="btnResetEpisode" class="btn btn-outline-light btn-sm" title="Ulang posisi robot ke tengah & acak sudut bendera">
                            <i class="bi bi-arrow-counterclockwise me-1"></i>Ulang Posisi
                        </button>
                        <button type="button" id="btnResetBrain" class="btn btn-outline-danger btn-sm" title="Hapus seluruh memori DQN & mulai kompetisi dari Episode 1">
                            <i class="bi bi-trash3 me-1"></i>Reset Otak DQN
                        </button>
                    </div>

                    <div class="d-flex align-items-center gap-1">
                        <span class="text-secondary small me-1" style="font-size: 0.75rem;">Kecepatan Training:</span>
                        <div class="btn-group btn-group-sm">
                            <button type="button" class="btn btn-outline-secondary speed-btn active" data-speed="1">1x</button>
                            <button type="button" class="btn btn-outline-secondary speed-btn" data-speed="2">2x</button>
                            <button type="button" class="btn btn-outline-secondary speed-btn" data-speed="5">5x</button>
                            <button type="button" class="btn btn-outline-secondary speed-btn" data-speed="10">10x</button>
                            <button type="button" class="btn btn-outline-info speed-btn" data-speed="25" title="Training Cepat Kompetisi di Web Worker">25x Turbo</button>
                        </div>
                    </div>
                </div>

                <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2 pt-2 border-top border-secondary border-opacity-25 px-1">
                    <span class="text-secondary small" style="font-size: 0.75rem;">
                        <i class="bi bi-lightning-charge-fill text-warning me-1"></i><strong>Demo Instan Level Robot:</strong>
                    </span>
                    <div class="d-flex flex-wrap gap-1">
                        <button type="button" class="btn btn-sm btn-outline-secondary quick-skill-btn" data-model-code="MODEL_LVL0_RANDOM">
                            🤖 Level 0: Robot Baru Rakit (Acak)
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-info quick-skill-btn" data-model-code="MODEL_LVL1_TODDLER">
                            ⚙️ Level 1: Belajar Hindari Box (Ep 8)
                        </button>
                        <button type="button" class="btn btn-sm btn-outline-success quick-skill-btn" data-model-code="MODEL_LVL2_MASTER">
                            🏆 Level 2: Juara Catch The Flag (Master DQN)
                        </button>
                    </div>
                </div>
            </div>

            <div class="row g-2 mb-3">
                <div class="col-12 col-md-6">
                    <div class="panel-card p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="fw-bold text-info mb-0" style="font-size: 0.85rem;">
                                <i class="bi bi-radar me-1"></i>1. STATE (<var>s<sub>t</sub></var>) — 8 Sensor Radar &amp; Kompas
                            </h6>
                            <div class="d-flex gap-1">
                                <span id="footSensorLeft" class="badge bg-success-subtle text-success" style="font-size: 0.64rem;">Kaki Kiri: Pijak</span>
                                <span id="footSensorRight" class="badge bg-danger-subtle text-danger" style="font-size: 0.64rem;">Target: Bendera NE</span>
                            </div>
                        </div>
                        <p class="text-secondary mb-2" style="font-size: 0.72rem;">
                            Input sensor lidar/radar penghalang box &amp; kompas bendera ke jaringan DQN setiap 0.025 detik:
                        </p>

                        <?php
                        $sensorLabels = [
                            ['Sudut Kompas ke Bendera (&Delta;&psi;<sub>flag</sub>)', 'bg-warning'],
                            ['Jarak ke Sudut Bendera (d<sub>flag</sub>)', 'bg-emerald'],
                            ['Radar Jarak Box Depan (d<sub>box,front</sub>)', 'bg-danger'],
                            ['Radar Jarak Box Serong Kiri (d<sub>left</sub>)', 'bg-primary'],
                            ['Radar Jarak Box Serong Kanan (d<sub>right</sub>)', 'bg-primary'],
                            ['Kecepatan Jalan Robot (v<sub>walk</sub>)', 'bg-emerald'],
                            ['Sensor Gyro Kemiringan Badan (&theta;<sub>torso</sub>)', 'bg-info'],
                            ['Fase Langkah Kaki Bipedal (sin &phi;)', 'bg-info']
                        ];
                        foreach ($sensorLabels as $idx => [$label, $barColor]):
                        ?>
                        <div class="mb-1">
                            <div class="d-flex justify-content-between" style="font-size: 0.72rem;">
                                <span class="text-light"><?php echo $label; ?></span>
                                <code id="stateVal_<?php echo $idx; ?>" class="text-info">+0.00</code>
                            </div>
                            <div class="sensor-bar-bg">
                                <div id="stateBar_<?php echo $idx; ?>" class="<?php echo $barColor; ?> h-100" style="width: 50%; transition: width 0.08s;"></div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="col-12 col-md-6">
                    <div class="panel-card p-3 h-100">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <h6 class="fw-bold text-emerald mb-0" style="font-size: 0.85rem;">
                                <i class="bi bi-diagram-3-fill me-1"></i>2. OTAK DQN &amp; 7 AKSI JALAN ROBOT (<var>a<sub>t</sub></var>)
                            </h6>
                            <span class="badge bg-info-subtle text-info" style="font-size: 0.68rem;">DQN [8 &rarr; 64 &rarr; 64 &rarr; 7]</span>
                        </div>
                        <div class="small text-secondary mb-2" style="font-size: 0.72rem;">
                            Keputusan Aktif: <strong id="activeActionName" class="text-white">Jalan Maju Seimbang</strong>
                        </div>

                        <?php
                        $actionsList = [
                            '0. Jalan Maju Seimbang',
                            '1. Jalan Cepat Kejar Bendera [W]',
                            '2. Belok Kiri Halus & Jalan',
                            '3. Belok Kanan Halus & Jalan',
                            '4. Hindari Box ke Kiri (Tajam) [A]',
                            '5. Hindari Box ke Kanan (Tajam) [D]',
                            '6. Stabilisasi Postur & Kompas [S]'
                        ];
                        foreach ($actionsList as $aIdx => $aName):
                        ?>
                        <div id="actionRow_<?php echo $aIdx; ?>" class="p-1 rounded mb-1">
                            <div class="d-flex justify-content-between" style="font-size: 0.71rem;">
                                <span><?php echo $aName; ?></span>
                                <span class="font-monospace text-info">Q = <strong id="actionQ_<?php echo $aIdx; ?>">0.00</strong></span>
                            </div>
                            <div class="progress" style="height: 5px; background: rgba(255,255,255,0.08);">
                                <div id="actionBar_<?php echo $aIdx; ?>" class="progress-bar bg-secondary" style="width: 50%;"></div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>

            <div class="panel-card p-3">
                <div class="row g-2 align-items-center mb-2">
                    <div class="col-12 col-md-7">
                        <h6 class="fw-bold text-warning mb-0" style="font-size: 0.86rem;">
                            <i class="bi bi-graph-up-arrow me-1"></i>3. REWARD DQN (<var>r<sub>t</sub></var>) &amp; GRAFIK KECEPATAN REBUT BENDERA
                        </h6>
                        <div class="text-secondary" style="font-size: 0.72rem;">
                            Grafik progress merebut bendera di 4 sudut random (10m = Bendera Tertangkap!) dan total reward DQN:
                        </div>
                    </div>
                    <div class="col-12 col-md-5 text-md-end">
                        <span class="badge bg-dark border border-secondary text-light px-2 py-1" style="font-size: 0.74rem;">
                            Total Reward Episode Ini: <strong id="rewTotalEpisode" class="text-emerald ms-1">0.00</strong>
                        </span>
                    </div>
                </div>

                <div class="formula-box p-2 rounded mb-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                        <span class="text-secondary">r<sub>t</sub> = </span>
                        <span class="text-emerald" title="Hadiah Mendekati Sudut Bendera">KejarBendera(<strong id="rewForward">+0.00</strong>)</span> +
                        <span class="text-info" title="Hadiah Arah Kompas & Gyro Tegak">KompasGyro(<strong id="rewUpright">+0.00</strong>)</span> +
                        <span class="text-warning" title="Bonus Manuver Jalan Menghindari Box Penghalang">HindariBox(<strong id="rewGait">+0.00</strong>)</span>
                        <span class="text-danger" title="Penalti Energi Motor">Energi(<strong id="rewTorque">-0.00</strong>)</span>
                    </div>
                    <span class="badge bg-danger-subtle text-danger">🚩 Rebut Bendera = +100.0</span>
                </div>

                <div style="height: 215px;">
                    <canvas id="learningCurveChart"></canvas>
                </div>
            </div>

        </div>

        <div class="col-12 col-xl-5">
            <div class="panel-card p-3 h-100 d-flex flex-column">

                <ul class="nav nav-tabs nav-tabs-lab border-bottom border-secondary border-opacity-25 mb-3" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tabCompetition" type="button" role="tab">
                            <i class="bi bi-trophy-fill text-warning me-1"></i>Kompetisi
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabParams" type="button" role="tab">
                            <i class="bi bi-sliders me-1"></i>Parameter DQN
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabModels" type="button" role="tab">
                            <i class="bi bi-cpu me-1"></i>Otak Robot
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabLogs" type="button" role="tab">
                            <i class="bi bi-table me-1"></i>Log Episode
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" data-bs-toggle="tab" data-bs-target="#tabTheory" type="button" role="tab">
                            <i class="bi bi-mortarboard-fill me-1"></i>Panduan
                        </button>
                    </li>
                </ul>

                <div class="tab-content flex-grow-1">

                    <div class="tab-pane fade show active" id="tabCompetition" role="tabpanel">
                        <div class="sub-card p-3 mb-3 border-warning border-opacity-50">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <h6 class="fw-bold text-warning mb-0" style="font-size: 0.86rem;">
                                    <i class="bi bi-trophy-fill me-1"></i>Catat Skor Kompetisi Mahasiswa (Offline Leaderboard)
                                </h6>
                                <span class="badge bg-warning text-dark">Single Player</span>
                            </div>
                            <p class="text-secondary mb-2" style="font-size: 0.73rem;">
                                Latih Agent Robot DQN Anda secepat mungkin untuk melewati rintangan box berwarna dan menangkap bendera di 4 sudut random, lalu simpan rekor Anda ke <code>db_robot_agent.competition_leaderboard</code>:
                            </p>
                            <div class="row g-2 mb-2">
                                <div class="col-7">
                                    <input type="text" id="inputStudentName" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Nama Mahasiswa (misal: Rizky Pratama)">
                                </div>
                                <div class="col-5">
                                    <input type="text" id="inputStudentNim" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="NIM (misal: 20261055)">
                                </div>
                            </div>
                            <div class="mb-2">
                                <input type="text" id="inputCompModelName" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Nama Agent Robot (misal: CyberJump-DQN-v1)">
                            </div>
                            <button type="button" id="btnSubmitLeaderboard" class="btn btn-warning btn-sm w-100 fw-bold text-dark">
                                <i class="bi bi-flag-fill me-1"></i>Daftarkan Skor Robot Saya ke Papan Peringkat Kompetisi
                            </button>
                        </div>

                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="fw-bold text-light mb-0" style="font-size: 0.82rem;">
                                <i class="bi bi-bar-chart-steps text-info me-1"></i>Papan Peringkat (<code>db_robot_agent.competition_leaderboard</code>)
                            </h6>
                            <span class="text-secondary" style="font-size: 0.7rem;">4 Sudut Random</span>
                        </div>

                        <div class="table-responsive mb-3" style="max-height: 250px; overflow-y: auto;">
                            <table class="table table-dark table-hover table-bordered border-secondary border-opacity-25 table-episodes mb-0">
                                <thead class="table-active sticky-top">
                                    <tr>
                                        <th>Rank</th>
                                        <th>Mahasiswa &amp; Robot</th>
                                        <th>Bendera</th>
                                        <th>Tercepat</th>
                                        <th>Latihan</th>
                                        <th>Skor</th>
                                    </tr>
                                </thead>
                                <tbody id="leaderboardTableBody"></tbody>
                            </table>
                        </div>

                        <div class="sub-card p-2 px-3">
                            <div class="fw-bold text-info small mb-1" style="font-size: 0.76rem;">
                                <i class="bi bi-check2-circle me-1"></i>Kriteria Pemenang Kompetisi Catch the Flag:
                            </div>
                            <ul class="small text-secondary mb-0 ps-3" style="font-size: 0.72rem;">
                                <li><strong>Kecepatan Konvergensi DQN:</strong> Semakin cepat Robot pintar menangkap bendera dengan sedikit episode pelatihan.</li>
                                <li><strong>Penguasaan 4 Sudut Random:</strong> Bendera muncul acak di sudut <code>NE</code>, <code>NW</code>, <code>SE</code>, dan <code>SW</code>.</li>
                                <li><strong>Manuver Jalan Menghindari Box:</strong> Robot berjalan stabil mengelilingi box kuning/biru/putih tanpa menabrak atau terjatuh, ditambah bantuan arahan pelatih mahasiswa (<code>WASD</code>).</li>
                            </ul>
                        </div>
                    </div>

                    <div class="tab-pane fade" id="tabParams" role="tabpanel">
                        <div class="sub-card p-2 px-3 mb-3">
                            <label class="form-label small fw-bold text-info mb-1">
                                <i class="bi bi-journal-code me-1"></i>Pilih Strategi Kompetisi (<code>db_robot_agent.reward_presets</code>):
                            </label>
                            <select id="selectRewardPreset" class="form-select form-select-sm bg-dark text-white border-secondary mb-1">
                                <?php foreach ($presets as $p): ?>
                                    <option value="<?php echo htmlspecialchars($p['preset_code']); ?>">
                                        <?php echo htmlspecialchars($p['preset_name']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                            <div id="presetDescriptionText" class="text-secondary" style="font-size: 0.73rem;">
                                <?php echo htmlspecialchars($defaultPreset['description']); ?>
                            </div>
                        </div>

                        <div class="mb-2">
                            <label class="form-label small fw-semibold mb-1" style="font-size: 0.76rem;">Algoritma Reinforcement Learning:</label>
                            <select id="selectAlgorithm" class="form-select form-select-sm bg-dark text-white border-secondary">
                                <option value="DQN" selected>DQN (Deep Q-Network + Target Network + Replay) — Utama Kompetisi</option>
                                <option value="CURRICULUM_RL">Curriculum Guided DQN — Akselerasi Cepat Tangkap Bendera</option>
                                <option value="PPO">PPO / Stochastic Policy — Eksplorasi Sudut Halus</option>
                            </select>
                        </div>

                        <div class="sub-card p-2 px-3 mb-2">
                            <div class="fw-bold text-light small mb-2" style="font-size: 0.78rem;">
                                <i class="bi bi-gear-wide-connected text-info me-1"></i>Hyperparameter Deep Q-Network (TensorFlow.js)
                            </div>

                            <div class="mb-2">
                                <div class="d-flex justify-content-between small" style="font-size: 0.73rem;">
                                    <span>Learning Rate (&alpha;) — Kecepatan Belajar DQN</span>
                                    <strong id="valLR" class="text-info"><?php echo $defaultPreset['learning_rate']; ?></strong>
                                </div>
                                <input type="range" id="sliderLR" class="form-range" min="0.0005" max="0.01" step="0.0005" value="<?php echo $defaultPreset['learning_rate']; ?>">
                            </div>

                            <div class="mb-2">
                                <div class="d-flex justify-content-between small" style="font-size: 0.73rem;">
                                    <span>Discount Factor (&gamma;) — Fokus Target Bendera Jauh</span>
                                    <strong id="valGamma" class="text-info"><?php echo $defaultPreset['gamma']; ?></strong>
                                </div>
                                <input type="range" id="sliderGamma" class="form-range" min="0.80" max="0.99" step="0.01" value="<?php echo $defaultPreset['gamma']; ?>">
                            </div>

                            <div>
                                <div class="d-flex justify-content-between small" style="font-size: 0.73rem;">
                                    <span>Epsilon Decay — Laju Penurunan Eksplorasi Acak</span>
                                    <strong id="valEpsDecay" class="text-info"><?php echo $defaultPreset['epsilon_decay']; ?></strong>
                                </div>
                                <input type="range" id="sliderEpsDecay" class="form-range" min="0.80" max="0.98" step="0.01" value="<?php echo $defaultPreset['epsilon_decay']; ?>">
                            </div>
                        </div>

                        <div class="sub-card p-2 px-3 mb-2">
                            <div class="fw-bold text-light small mb-2" style="font-size: 0.78rem;">
                                <i class="bi bi-award text-warning me-1"></i>Reward Shaping (Navigasi Bendera &amp; Hindari Box)
                            </div>

                            <div class="mb-2">
                                <div class="d-flex justify-content-between small" style="font-size: 0.73rem;">
                                    <span>Bobot Hadiah Mendekati Sudut Bendera</span>
                                    <strong id="valRewForward" class="text-emerald"><?php echo $defaultPreset['reward_forward_weight']; ?></strong>
                                </div>
                                <input type="range" id="sliderRewForward" class="form-range" min="1.0" max="10.0" step="0.5" value="<?php echo $defaultPreset['reward_forward_weight']; ?>">
                            </div>

                            <div class="mb-2">
                                <div class="d-flex justify-content-between small" style="font-size: 0.73rem;">
                                    <span>Bobot Keseimbangan Gyro &amp; Kompas Sudut</span>
                                    <strong id="valRewUpright" class="text-emerald"><?php echo $defaultPreset['reward_upright_weight']; ?></strong>
                                </div>
                                <input type="range" id="sliderRewUpright" class="form-range" min="0.5" max="8.0" step="0.5" value="<?php echo $defaultPreset['reward_upright_weight']; ?>">
                            </div>

                            <div class="mb-2">
                                <div class="d-flex justify-content-between small" style="font-size: 0.73rem;">
                                    <span>Bobot Bonus Manuver Jalan Menghindari Box</span>
                                    <strong id="valRewGait" class="text-emerald"><?php echo $defaultPreset['reward_gait_weight']; ?></strong>
                                </div>
                                <input type="range" id="sliderRewGait" class="form-range" min="0.5" max="8.0" step="0.5" value="<?php echo $defaultPreset['reward_gait_weight']; ?>">
                            </div>

                            <div>
                                <div class="d-flex justify-content-between small" style="font-size: 0.73rem;">
                                    <span>Penalti Tabrak Box / Terjatuh</span>
                                    <strong id="valPenFall" class="text-danger"><?php echo $defaultPreset['penalty_fall']; ?></strong>
                                </div>
                                <input type="range" id="sliderPenFall" class="form-range" min="-100" max="-10" step="5" value="<?php echo $defaultPreset['penalty_fall']; ?>">
                            </div>
                        </div>

                        <div class="sub-card p-2 px-3 mb-3">
                            <div class="fw-bold text-light small mb-2" style="font-size: 0.78rem;">
                                <i class="bi bi-globe2 text-info me-1"></i>Fisika Lantai Arena &amp; Beban Gravitasi Kaki Robot
                            </div>
                            <div class="row g-2">
                                <div class="col-6">
                                    <div class="d-flex justify-content-between small" style="font-size: 0.72rem;">
                                        <span>Traksi Lantai</span>
                                        <strong id="valFriction" class="text-warning"><?php echo $defaultPreset['ground_friction']; ?></strong>
                                    </div>
                                    <input type="range" id="sliderFriction" class="form-range" min="0.35" max="1.00" step="0.05" value="<?php echo $defaultPreset['ground_friction']; ?>">
                                </div>
                                <div class="col-6">
                                    <div class="d-flex justify-content-between small" style="font-size: 0.72rem;">
                                        <span>Gravitasi Arena</span>
                                        <strong id="valGravity" class="text-warning"><?php echo $defaultPreset['gravity']; ?> m/s²</strong>
                                    </div>
                                    <input type="range" id="sliderGravity" class="form-range" min="4.50" max="14.0" step="0.1" value="<?php echo $defaultPreset['gravity']; ?>">
                                </div>
                            </div>
                        </div>

                        <button type="button" id="btnSavePresetDb" class="btn btn-outline-info btn-sm w-100 fw-semibold">
                            <i class="bi bi-floppy-fill me-1"></i>Simpan Konfigurasi ke MySQL (<code>db_robot_agent.reward_presets</code>)
                        </button>
                    </div>

                    <div class="tab-pane fade" id="tabModels" role="tabpanel">
                        <div class="sub-card p-3 mb-3">
                            <h6 class="fw-bold text-info mb-1" style="font-size: 0.84rem;">
                                <i class="bi bi-cloud-arrow-up-fill me-1"></i>Simpan Otak Robot DQN ke Database
                            </h6>
                            <p class="text-secondary mb-2" style="font-size: 0.73rem;">
                                Mengekspor tensor bobot jaringan saraf DQN dari Web Worker ke tabel <code>db_robot_agent.saved_models</code> agar bisa dipertandingkan kapan saja.
                            </p>
                            <div class="mb-2">
                                <input type="text" id="inputModelName" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Nama Model (misal: Robot DQN Juara 4 Sudut)">
                            </div>
                            <div class="mb-2">
                                <input type="text" id="inputModelNotes" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Catatan strategi hyperparameter mahasiswa">
                            </div>
                            <button type="button" id="btnSaveModelDb" class="btn btn-emerald btn-sm w-100 fw-semibold">
                                <i class="bi bi-database-fill-add me-1"></i>Simpan Bobot DQN ke MySQL (db_robot_agent)
                            </button>
                        </div>

                        <h6 class="fw-bold text-light mb-2" style="font-size: 0.82rem;">
                            <i class="bi bi-collection-fill text-info me-1"></i>Daftar Otak Robot Tersimpan (<code>db_robot_agent.saved_models</code>)
                        </h6>
                        <div id="savedModelsListContainer" style="max-height: 360px; overflow-y: auto;"></div>
                    </div>

                    <div class="tab-pane fade" id="tabLogs" role="tabpanel">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div>
                                <h6 class="fw-bold text-info mb-0" style="font-size: 0.84rem;">
                                    <i class="bi bi-journal-text me-1"></i>Log Episode Kompetisi (<code>db_robot_agent.episode_logs</code>)
                                </h6>
                                <div class="text-secondary" style="font-size: 0.72rem;">
                                    Mencatat sudut bendera random, jumlah manuver hindari box, waktu tempuh, dan status akhir setiap episode.
                                </div>
                            </div>
                        </div>

                        <div class="table-responsive" style="max-height: 460px; overflow-y: auto;">
                            <table class="table table-dark table-hover table-bordered border-secondary border-opacity-25 table-episodes mb-0">
                                <thead class="table-active sticky-top">
                                    <tr>
                                        <th>Ep</th>
                                        <th>Prog</th>
                                        <th>Reward</th>
                                        <th>Durasi</th>
                                        <th>&epsilon;</th>
                                        <th>Hasil &amp; Sudut Bendera</th>
                                        <th>Tahap</th>
                                    </tr>
                                </thead>
                                <tbody id="episodeLogsTableBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="tab-pane fade" id="tabTheory" role="tabpanel">
                        <div style="max-height: 500px; overflow-y: auto; padding-right: 4px;">
                            <div class="sub-card p-3 mb-2">
                                <h6 class="fw-bold text-info mb-1" style="font-size: 0.85rem;">
                                    1. Alur Prosedur Mahasiswa Melatih &amp; Mengarahkan Robot (Human-in-the-Loop RL)
                                </h6>
                                <p class="text-light small mb-2" style="font-size: 0.75rem; line-height: 1.5;">
                                    <strong>Apakah mahasiswa bisa mengarahkan robot? YA!</strong> Sistem ini menggabungkan <strong>Autonomous Deep Q-Network (DQN)</strong> dengan <strong>Interactive Student Coaching (Imitation + Experience Replay)</strong>:
                                </p>
                                <ol class="small text-secondary mb-0 ps-3" style="font-size: 0.74rem; line-height: 1.55;">
                                    <li><strong>Tahap 1 — Observasi &amp; Eksplorasi Awal:</strong> Klik <strong>Mulai Latih Robot DQN</strong> pada kecepatan <code>1x</code> atau <code>2x</code>. Pada awalnya nilai eksplorasi (<code>&epsilon;</code>) masih tinggi sehingga robot sering berjalan acak atau terhalang box berwarna.</li>
                                    <li><strong>Tahap 2 — Mahasiswa Mengarahkan Robot (Interactive Coaching):</strong> Saat robot hampir menabrak box kuning/biru atau salah arah, mahasiswa dapat menekan tombol keyboard <strong><code>W</code> (Jalan Maju)</strong>, <strong><code>A</code> (Hindari Box ke Kiri)</strong>, <strong><code>D</code> (Hindari Box ke Kanan)</strong>, atau <strong><code>S</code> (Stabilkan Kompas)</strong> — atau klik tombol <strong>🎮 Kemudi Pelatih</strong> di layar. Setiap arahan mahasiswa langsung dimasukkan <strong>3x lipat ke dalam Memori Experience Replay DQN</strong> sehingga jaringan saraf robot langsung meniru cara mahasiswa menghindari box!</li>
                                    <li><strong>Tahap 3 — Merancang Rumus Hadiah (Reward Shaping &amp; Hyperparameter):</strong> Buka tab <strong>Parameter DQN</strong> untuk mengatur bobot <em>Kejar Bendera</em>, <em>Kompas Gyro</em>, dan <em>Manuver Hindari Box</em>, lalu gunakan kecepatan <strong>10x / 25x Turbo</strong> agar robot berlatih ratusan langkah secara mandiri.</li>
                                    <li><strong>Tahap 4 — Evaluasi 4 Sudut Random &amp; Submit Skor:</strong> Uji robot tanpa bantuan tangan dengan menekan <strong>Acak Sudut Bendera</strong> (<code>NE</code>, <code>NW</code>, <code>SE</code>, <code>SW</code>). Simpan otak robot ke database dan daftarkan skor di tab <strong>Kompetisi</strong>!</li>
                                </ol>
                            </div>

                            <div class="sub-card p-3 mb-2">
                                <h6 class="fw-bold text-emerald mb-1" style="font-size: 0.85rem;">
                                    2. Persamaan Bellman pada Deep Q-Network (DQN)
                                </h6>
                                <p class="text-secondary small mb-1" style="font-size: 0.74rem;">
                                    Jaringan saraf <strong>TensorFlow.js</strong> memperbarui bobot menggunakan <em>Experience Replay</em> dan <em>Target Network</em> di dalam <strong>Web Worker</strong>:
                                </p>
                                <div class="formula-box p-2 rounded text-info mb-2">
                                    Q<sub>target</sub>(s, a) = r + &gamma; &middot; max<sub>a'</sub> Q<sub>&theta;<sup>&minus;</sup></sub>(s', a')
                                </div>
                                <div class="small text-secondary" style="font-size: 0.73rem;">
                                    &bull; <strong>s (8 Sensor):</strong> Kompas bendera, jarak bendera, radar box depan, radar serong kiri, radar serong kanan, kecepatan jalan, sudut gyro torso, fase langkah kaki.<br>
                                    &bull; <strong>a (7 Aksi Jalan):</strong> Jalan maju seimbang, jalan cepat kejar bendera, belok kiri/kanan halus, hindari box tajam kiri/kanan, stabilisasi kompas.<br>
                                    &bull; <strong>r (Reward):</strong> Mendekati bendera + manuver cerdas melewati celah box +100 saat bendera tertangkap.
                                </div>
                            </div>

                            <div class="sub-card p-3">
                                <h6 class="fw-bold text-warning mb-1" style="font-size: 0.85rem;">
                                    3. Tips Menang Kompetisi untuk Mahasiswa
                                </h6>
                                <div class="small text-secondary" style="font-size: 0.74rem; line-height: 1.55;">
                                    1. Pada 5 episode pertama (kecepatan <code>1x</code>), bantu arahkan robot melewati box dengan tombol <strong><code>A</code> / <code>D</code> / <code>W</code></strong> agar <em>Replay Buffer</em> langsung berisi contoh rute sukses.<br>
                                    2. Setelah itu, naikkan kecepatan ke <strong>25x Turbo</strong> dan atur <strong>Bobot Manuver Hindari Box</strong> di kisaran <code>3.5 - 5.5</code> agar robot mahir berbelok sendiri di ke-4 sudut.<br>
                                    3. Simpan model ke <code>db_robot_agent</code> dan catat rekor waktu tercepat Anda di papan peringkat!
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
</main>

<script>
window.BALANCE_AI_BOOT_DATA = <?php echo json_encode([
    'appPath' => APP_PATH,
    'csrfToken' => $data['csrf_token'] ?? '',
    'activeSession' => $activeSession,
    'presets' => $presets,
    'episodes' => $episodes,
    'savedModels' => $savedModels,
    'leaderboard' => $leaderboard
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
</script>
<script src="<?php echo APP_PATH; ?>/public/assets/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
<script src="<?php echo APP_PATH; ?>/public/assets/vendor/three/three.min.js?v=<?php echo time(); ?>"></script>
<script>
if (typeof THREE === 'undefined') {
    document.write('<script src="https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js"><\/script>');
}
</script>
<script src="<?php echo APP_PATH; ?>/public/assets/vendor/chartjs/chart.umd.min.js?v=<?php echo time(); ?>"></script>
<script src="<?php echo APP_PATH; ?>/public/assets/js/walker-3d-app.js?v=<?php echo time(); ?>"></script>
</body>
</html>
