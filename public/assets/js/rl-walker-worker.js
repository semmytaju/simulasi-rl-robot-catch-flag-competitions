/**
 * ============================================================================
 * WEB WORKER: rl-walker-worker.js
 * Simulasi Reinforcement Learning: Robot Catch the Flag Competition (DQN)
 * ----------------------------------------------------------------------------
 * Menjalankan:
 * 1. TensorFlow.js Deep Q-Network (DQN) + Target Network + Experience Replay
 * 2. Fisika 3D Humanoid Robot Berjalan Biasa & Navigasi Menghindari Box Berwarna
 * 3. Mode Interaktif Mahasiswa (Human-in-the-Loop Coaching / Imitation RL)
 * 4. Deteksi Radar Box Berwarna & Posisi Bendera Random di 4 Sudut Arena
 * ============================================================================
 */

let tfReady = false;
let qNetwork = null;
let targetNetwork = null;
let optimizer = null;

let config = {
    algorithm: 'DQN',
    learningRate: 0.0025,
    gamma: 0.98,
    epsilon: 1.00,
    epsilonMin: 0.04,
    epsilonDecay: 0.89,
    rewardForwardWeight: 5.5,
    rewardUprightWeight: 2.5,
    rewardGaitWeight: 3.5,
    penaltyFall: -45.0,
    penaltyTorque: -0.04,
    gravity: 9.81,
    groundFriction: 0.88,
    targetDistance: 10.0,
    speedMultiplier: 1,
    guidanceStrength: 0.0,
    forcedCornerIndex: -1
};

const ACTION_LABELS = [
    'Jalan Maju Seimbang',
    'Jalan Cepat Kejar Bendera',
    'Belok Kiri Halus & Jalan',
    'Belok Kanan Halus & Jalan',
    'Hindari Box ke Kiri (Tajam)',
    'Hindari Box ke Kanan (Tajam)',
    'Stabilisasi Postur & Kompas'
];

const ARENA_HALF_LIMIT = 13.3;

const FLAG_CORNERS = [
    { index: 0, code: 'NE', name: 'Sudut Timur Laut (NE)', x: 11.4, z: -11.4, podiumH: 0.04 },
    { index: 1, code: 'NW', name: 'Sudut Barat Laut (NW)', x: -11.4, z: -11.4, podiumH: 0.04 },
    { index: 2, code: 'SE', name: 'Sudut Tenggara (SE)', x: 11.4, z: 11.4, podiumH: 0.04 },
    { index: 3, code: 'SW', name: 'Sudut Barat Daya (SW)', x: -11.4, z: 11.4, podiumH: 0.04 }
];

// Arena 28x28 Meter Kompleks: 40 Box Berwarna Penghalang Berlapis (4 Ring Labirin Taktis)
const ARENA_BOXES = [
    // ================= RING 1: PENGHALANG DIAGONAL DEKAT START (Memblokir Jalur Lurus dari 0,0) =================
    { id: 'r1_ne', x: 2.35, z: -2.35, w: 1.55, d: 1.55, h: 0.95, colorType: 'yellow_crate' },
    { id: 'r1_nw', x: -2.35, z: -2.35, w: 1.55, d: 1.55, h: 0.95, colorType: 'blue_box' },
    { id: 'r1_se', x: 2.35, z: 2.35, w: 1.55, d: 1.55, h: 0.95, colorType: 'white_cube' },
    { id: 'r1_sw', x: -2.35, z: 2.35, w: 1.55, d: 1.55, h: 0.95, colorType: 'yellow_crate' },

    // Penghalang Poros Tengah Dekat Start
    { id: 'r1_n', x: 0.0, z: -3.60, w: 1.80, d: 1.10, h: 1.05, colorType: 'grey_tech' },
    { id: 'r1_s', x: 0.0, z: 3.60, w: 1.80, d: 1.10, h: 1.05, colorType: 'grey_tech' },
    { id: 'r1_e', x: 3.60, z: 0.0, w: 1.10, d: 1.80, h: 1.05, colorType: 'blue_grey_wall' },
    { id: 'r1_w', x: -3.60, z: 0.0, w: 1.10, d: 1.80, h: 1.05, colorType: 'blue_grey_wall' },

    // ================= KUADRAN TIMUR LAUT (NE: +X, -Z) — Labirin S-Curve & Benteng Sudut =================
    { id: 'ne_mid_1', x: 5.10, z: -2.10, w: 1.45, d: 1.35, h: 1.10, colorType: 'blue_box' },
    { id: 'ne_mid_2', x: 2.10, z: -5.10, w: 1.35, d: 1.45, h: 1.10, colorType: 'white_cube' },
    { id: 'ne_mid_3', x: 5.55, z: -5.55, w: 1.75, d: 1.75, h: 1.25, colorType: 'grey_tech' },
    { id: 'ne_out_1', x: 8.30, z: -4.70, w: 1.65, d: 1.35, h: 0.95, colorType: 'yellow_crate' },
    { id: 'ne_out_2', x: 4.70, z: -8.30, w: 1.35, d: 1.65, h: 0.95, colorType: 'blue_tall' },
    { id: 'ne_guard_diag', x: 8.95, z: -8.95, w: 1.60, d: 1.60, h: 1.20, colorType: 'blue_grey_wall' },
    { id: 'ne_guard_e', x: 11.30, z: -8.70, w: 1.35, d: 1.25, h: 0.90, colorType: 'yellow_crate' },
    { id: 'ne_guard_n', x: 8.70, z: -11.30, w: 1.25, d: 1.35, h: 0.90, colorType: 'white_cube' },

    // ================= KUADRAN BARAT LAUT (NW: -X, -Z) — Labirin S-Curve & Benteng Sudut =================
    { id: 'nw_mid_1', x: -5.10, z: -2.10, w: 1.45, d: 1.35, h: 1.10, colorType: 'yellow_crate' },
    { id: 'nw_mid_2', x: -2.10, z: -5.10, w: 1.35, d: 1.45, h: 1.10, colorType: 'blue_box' },
    { id: 'nw_mid_3', x: -5.55, z: -5.55, w: 1.75, d: 1.75, h: 1.25, colorType: 'blue_grey_wall' },
    { id: 'nw_out_1', x: -8.30, z: -4.70, w: 1.65, d: 1.35, h: 0.95, colorType: 'white_cube' },
    { id: 'nw_out_2', x: -4.70, z: -8.30, w: 1.35, d: 1.65, h: 0.95, colorType: 'yellow_crate' },
    { id: 'nw_guard_diag', x: -8.95, z: -8.95, w: 1.60, d: 1.60, h: 1.20, colorType: 'grey_tech' },
    { id: 'nw_guard_w', x: -11.30, z: -8.70, w: 1.35, d: 1.25, h: 0.90, colorType: 'blue_box' },
    { id: 'nw_guard_n', x: -8.70, z: -11.30, w: 1.25, d: 1.35, h: 0.90, colorType: 'yellow_crate' },

    // ================= KUADRAN TENGGARA (SE: +X, +Z) — Labirin S-Curve & Benteng Sudut =================
    { id: 'se_mid_1', x: 5.10, z: 2.10, w: 1.45, d: 1.35, h: 1.10, colorType: 'white_cube' },
    { id: 'se_mid_2', x: 2.10, z: 5.10, w: 1.35, d: 1.45, h: 1.10, colorType: 'yellow_crate' },
    { id: 'se_mid_3', x: 5.55, z: 5.55, w: 1.75, d: 1.75, h: 1.25, colorType: 'blue_tall' },
    { id: 'se_out_1', x: 8.30, z: 4.70, w: 1.65, d: 1.35, h: 0.95, colorType: 'grey_tech' },
    { id: 'se_out_2', x: 4.70, z: 8.30, w: 1.35, d: 1.65, h: 0.95, colorType: 'white_cube' },
    { id: 'se_guard_diag', x: 8.95, z: 8.95, w: 1.60, d: 1.60, h: 1.20, colorType: 'yellow_crate' },
    { id: 'se_guard_e', x: 11.30, z: 8.70, w: 1.35, d: 1.25, h: 0.90, colorType: 'blue_grey_wall' },
    { id: 'se_guard_s', x: 8.70, z: 11.30, w: 1.25, d: 1.35, h: 0.90, colorType: 'blue_box' },

    // ================= KUADRAN BARAT DAYA (SW: -X, +Z) — Labirin S-Curve & Benteng Sudut =================
    { id: 'sw_mid_1', x: -5.10, z: 2.10, w: 1.45, d: 1.35, h: 1.10, colorType: 'grey_tech' },
    { id: 'sw_mid_2', x: -2.10, z: 5.10, w: 1.35, d: 1.45, h: 1.10, colorType: 'blue_box' },
    { id: 'sw_mid_3', x: -5.55, z: 5.55, w: 1.75, d: 1.75, h: 1.25, colorType: 'yellow_crate' },
    { id: 'sw_out_1', x: -8.30, z: 4.70, w: 1.65, d: 1.35, h: 0.95, colorType: 'blue_grey_wall' },
    { id: 'sw_out_2', x: -4.70, z: 8.30, w: 1.35, d: 1.65, h: 0.95, colorType: 'white_cube' },
    { id: 'sw_guard_diag', x: -8.95, z: 8.95, w: 1.60, d: 1.60, h: 1.20, colorType: 'blue_tall' },
    { id: 'sw_guard_w', x: -11.30, z: 8.70, w: 1.35, d: 1.25, h: 0.90, colorType: 'yellow_crate' },
    { id: 'sw_guard_s', x: -8.70, z: 11.30, w: 1.25, d: 1.35, h: 0.90, colorType: 'grey_tech' },

    // ================= DINDING PENYEKAT KORIDOR TEPI ARENA =================
    { id: 'wall_n_outer', x: 0.0, z: -9.20, w: 2.40, d: 1.20, h: 1.15, colorType: 'blue_grey_wall' },
    { id: 'wall_s_outer', x: 0.0, z: 9.20, w: 2.40, d: 1.20, h: 1.15, colorType: 'blue_grey_wall' },
    { id: 'wall_e_outer', x: 9.20, z: 0.0, w: 1.20, d: 2.40, h: 1.15, colorType: 'grey_tech' },
    { id: 'wall_w_outer', x: -9.20, z: 0.0, w: 1.20, d: 2.40, h: 1.15, colorType: 'grey_tech' }
];

let isRunning = false;
let episodeNumber = 1;
let totalStepsAllTime = 0;
let replayBuffer = [];
const MAX_BUFFER_SIZE = 4000;
const BATCH_SIZE = 32;
let lastLoss = 0.0;
let loopTimer = null;

let cornerBag = [];
let activeFlag = FLAG_CORNERS[0];
let cornersCapturedSet = new Set();

// Antrean Aksi Kemudi Pelatih Mahasiswa (Human-in-the-Loop Coaching)
let studentForcedAction = null;
let studentActionHoldTicks = 0;

let walker = null;
let episodeStats = null;

function pickRandomFlagCorner() {
    if (config.forcedCornerIndex >= 0 && config.forcedCornerIndex < FLAG_CORNERS.length) {
        activeFlag = FLAG_CORNERS[config.forcedCornerIndex];
        return activeFlag;
    }
    if (cornerBag.length === 0) {
        cornerBag = [0, 1, 2, 3];
        for (let i = cornerBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = cornerBag[i];
            cornerBag[i] = cornerBag[j];
            cornerBag[j] = tmp;
        }
    }
    const idx = cornerBag.pop();
    activeFlag = FLAG_CORNERS[idx] || FLAG_CORNERS[0];
    return activeFlag;
}

async function initTensorFlow(tfScriptUrl) {
    if (tfReady && typeof tf !== 'undefined') return true;
    try {
        if (typeof tf === 'undefined') {
            try {
                importScripts(tfScriptUrl);
            } catch (e1) {
                importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
            }
        }
        await tf.setBackend('cpu');
        await tf.ready();
        tfReady = true;
        buildNeuralNetworks();
        return true;
    } catch (err) {
        self.postMessage({
            type: 'WORKER_ERROR',
            message: 'Gagal memuat TensorFlow.js di Web Worker: ' + err.message
        });
        return false;
    }
}

function buildNeuralNetworks() {
    if (!tfReady) return;

    if (qNetwork) {
        try { qNetwork.dispose(); } catch (e) {}
    }
    if (targetNetwork) {
        try { targetNetwork.dispose(); } catch (e) {}
    }

    qNetwork = tf.sequential();
    qNetwork.add(tf.layers.dense({
        inputShape: [8],
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal'
    }));
    qNetwork.add(tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelInitializer: 'heNormal'
    }));
    qNetwork.add(tf.layers.dense({
        units: 7,
        activation: 'linear',
        kernelInitializer: 'glorotUniform'
    }));

    targetNetwork = tf.sequential();
    targetNetwork.add(tf.layers.dense({
        inputShape: [8],
        units: 64,
        activation: 'relu'
    }));
    targetNetwork.add(tf.layers.dense({
        units: 64,
        activation: 'relu'
    }));
    targetNetwork.add(tf.layers.dense({
        units: 7,
        activation: 'linear'
    }));

    optimizer = tf.train.adam(config.learningRate);
    syncTargetNetwork();
}

function syncTargetNetwork() {
    if (!qNetwork || !targetNetwork) return;
    tf.tidy(() => {
        const weights = qNetwork.getWeights();
        const cloned = weights.map(w => w.clone());
        targetNetwork.setWeights(cloned);
    });
}

function normalizeAngleDiff(angle) {
    let a = angle;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Hitung jarak sinar lidar pada arah tertentu terhadap 40 Box Labirin & Dinding Arena
 */
function castSingleRayDist(rx, rz, rayAngle, maxRange = 4.6) {
    const dirX = Math.sin(rayAngle);
    const dirZ = Math.cos(rayAngle);
    let minDist = maxRange;

    for (let d = 0.28; d <= maxRange; d += 0.20) {
        const px = rx + dirX * d;
        const pz = rz + dirZ * d;

        if (Math.abs(px) > ARENA_HALF_LIMIT || Math.abs(pz) > ARENA_HALF_LIMIT) {
            return d;
        }

        for (let i = 0; i < ARENA_BOXES.length; i++) {
            const b = ARENA_BOXES[i];
            const halfW = b.w * 0.5 + 0.34;
            const halfD = b.d * 0.5 + 0.34;
            if (Math.abs(px - b.x) <= halfW && Math.abs(pz - b.z) <= halfD) {
                return d;
            }
        }
    }
    return minDist;
}

/**
 * Sensor Radar 5 Arah (Depan, Serong Kiri 35°, Serong Kanan 35°, Samping Kiri 75°, Samping Kanan 75°)
 */
function scanObstacleRadar(rx, rz, yaw) {
    const frontDist = castSingleRayDist(rx, rz, yaw, 4.6);
    const leftDist = castSingleRayDist(rx, rz, yaw + 0.62, 4.2);
    const rightDist = castSingleRayDist(rx, rz, yaw - 0.62, 4.2);
    const wideLeftDist = castSingleRayDist(rx, rz, yaw + 1.28, 3.8);
    const wideRightDist = castSingleRayDist(rx, rz, yaw - 1.28, 3.8);

    return {
        frontDist,
        leftDist: Math.max(leftDist, wideLeftDist * 0.88),
        rightDist: Math.max(rightDist, wideRightDist * 0.88),
        wideLeftDist,
        wideRightDist
    };
}

/**
 * Pencari Celah Labirin (Digunakan saat DQN sudah terlatih tinggi / Master Level)
 */
function findBestLabyrinthHeading(w) {
    const dx = activeFlag.x - w.posX;
    const dz = activeFlag.z - w.posZ;
    const goalYaw = Math.atan2(dx, dz);

    const candidateOffsets = [0, 0.42, -0.42, 0.85, -0.85, 1.30, -1.30, 1.75, -1.75];
    let bestHeading = goalYaw;
    let bestScore = -999;

    for (let i = 0; i < candidateOffsets.length; i++) {
        const candYaw = normalizeAngleDiff(goalYaw + candidateOffsets[i]);
        const clearance = castSingleRayDist(w.posX, w.posZ, candYaw, 4.6);
        const alignGoal = Math.cos(candidateOffsets[i]);
        const alignCurrent = Math.cos(normalizeAngleDiff(candYaw - w.yaw));

        // Penalti besar jika jalur di arah tersebut buntu (< 1.9m)
        const obstaclePenalty = clearance < 1.95 ? (clearance - 2.2) * 3.5 : 0.0;
        const score = clearance * 1.15 + alignGoal * 1.85 + alignCurrent * 0.55 + obstaclePenalty;

        if (score > bestScore) {
            bestScore = score;
            bestHeading = candYaw;
        }
    }
    return bestHeading;
}

function resetWalkerEnv(keepCurrentCorner = false) {
    if (!keepCurrentCorner) {
        pickRandomFlagCorner();
    }

    const dxFlag = activeFlag.x - 0.0;
    const dzFlag = activeFlag.z - 0.0;
    const idealStartYaw = Math.atan2(dxFlag, dzFlag);
    // Saat belum dilatih (epsilon tinggi), arah hadap awal acak sehingga robot wajib belajar membaca kompas!
    const randomYawOffset = (Math.random() - 0.5) * 2.20 * config.epsilon;
    const initDist = Math.hypot(dxFlag, dzFlag);

    walker = {
        posX: 0.0,
        posZ: 0.0,
        x: 0.0,
        y: 0.95,
        groundY: 0.0,
        vx: 0.0,
        vy: 0.0,
        yaw: normalizeAngleDiff(idealStartYaw + randomYawOffset),
        torsoAngle: (Math.random() - 0.5) * 0.06,
        torsoVel: 0.0,
        hipL: 0.16,
        hipR: -0.16,
        hipVelL: 0.0,
        hipVelR: 0.0,
        kneeL: 0.14,
        kneeR: 0.14,
        armL: -0.16,
        armR: 0.16,
        footContactL: true,
        footContactR: true,
        obstaclesAvoided: 0,
        boxCollisionTicks: 0,
        gaitPhase: 0.0,
        externalPush: 0.0,
        pushLabel: '',
        pushTimer: 0,
        lastAction: 0,
        lastQValues: [0, 0, 0, 0, 0, 0, 0],
        fallen: false,
        reachedFinish: false,
        terminationReason: '',
        initFlagDist: initDist,
        currentFlagDist: initDist,
        flagCornerCode: activeFlag.code,
        flagCornerName: activeFlag.name,
        flagX: activeFlag.x,
        flagZ: activeFlag.z,
        flagY: activeFlag.podiumH,
        radarFrontDist: 4.6,
        radarLeftDist: 4.2,
        radarRightDist: 4.2
    };

    episodeStats = {
        steps: 0,
        totalReward: 0.0,
        sumTorsoDeg: 0.0,
        sumSpeed: 0.0,
        lastStepReward: 0.0,
        rewardBreakdown: {
            forward: 0.0,
            upright: 0.0,
            gait: 0.0,
            torque: 0.0,
            terminal: 0.0
        }
    };

    return getNormalizedState(walker);
}

/**
 * 8 Sensor State Robot (Input ke DQN [8 -> 64 -> 64 -> 7]):
 * s0: Sudut Kompas ke Bendera (Delta Yaw) [-1, 1]
 * s1: Jarak ke Bendera (Normalized Distance 0..16.5m) [-1, 1]
 * s2: Sensor Radar Box Depan (Makin dekat -> makin positif) [-1, 1]
 * s3: Sensor Radar Box Serong Kiri [-1, 1]
 * s4: Sensor Radar Box Serong Kanan [-1, 1]
 * s5: Kecepatan Jalan Robot (v_forward) [-1, 1]
 * s6: Kemiringan Badan Robot (theta_torso) [-1, 1]
 * s7: Ritme Ayunan Langkah Kaki sin(gaitPhase) [-1, 1]
 */
function getNormalizedState(w) {
    const dx = activeFlag.x - w.posX;
    const dz = activeFlag.z - w.posZ;
    const distToFlag = Math.hypot(dx, dz);
    const targetYaw = Math.atan2(dx, dz);
    const yawDiff = normalizeAngleDiff(targetYaw - w.yaw);

    const radar = scanObstacleRadar(w.posX, w.posZ, w.yaw);
    w.radarFrontDist = radar.frontDist;
    w.radarLeftDist = radar.leftDist;
    w.radarRightDist = radar.rightDist;
    w.currentFlagDist = distToFlag;

    const s0 = clamp(yawDiff / Math.PI, -1.0, 1.0);
    const s1 = clamp((distToFlag / 16.5) * 2.0 - 1.0, -1.0, 1.0);
    const s2 = clamp(1.0 - (radar.frontDist / 2.6), -1.0, 1.0);
    const s3 = clamp((radar.leftDist / 4.0) * 2.0 - 1.0, -1.0, 1.0);
    const s4 = clamp((radar.rightDist / 4.0) * 2.0 - 1.0, -1.0, 1.0);
    const s5 = clamp((w.vx - 1.0) / 1.8, -1.0, 1.0);
    const s6 = clamp(w.torsoAngle / 0.85, -1.0, 1.0);
    const s7 = Math.sin(w.gaitPhase);

    return [s0, s1, s2, s3, s4, s5, s6, s7];
}

/**
 * Kebijakan Navigasi Labirin 40 Box Berwarna (Digunakan untuk Curriculum / Master Guidance)
 */
function getIdealRobotAction(w) {
    const radar = scanObstacleRadar(w.posX, w.posZ, w.yaw);
    const bestHeading = findBestLabyrinthHeading(w);
    const headingDiff = normalizeAngleDiff(bestHeading - w.yaw);

    if (Math.abs(w.torsoAngle) > 0.30) {
        return 6; // Stabilisasi Postur & Kompas
    }

    // Jika ada box penghalang dekat di depan (< 2.05m), belok tajam ke celah labirin
    if (radar.frontDist < 2.05) {
        if (Math.abs(headingDiff) > 0.18) {
            return headingDiff > 0 ? 4 : 5;
        }
        return radar.leftDist >= radar.rightDist ? 4 : 5;
    }

    // Ikuti sudut celah labirin terbaik menuju bendera
    if (headingDiff > 0.45) return 4;
    if (headingDiff < -0.45) return 5;
    if (headingDiff > 0.14) return 2; // Belok Kiri Halus
    if (headingDiff < -0.14) return 3; // Belok Kanan Halus

    return radar.frontDist > 2.7 ? 1 : 0;
}

function computeActionSuitabilityScores(w) {
    const scores = [0, 0, 0, 0, 0, 0, 0];
    const radar = scanObstacleRadar(w.posX, w.posZ, w.yaw);
    const bestHeading = findBestLabyrinthHeading(w);
    const headingDiff = normalizeAngleDiff(bestHeading - w.yaw);

    const boxClose = radar.frontDist < 2.05;

    // 0: Jalan Maju Seimbang
    scores[0] = (!boxClose && Math.abs(headingDiff) < 0.28) ? 1.50 : (boxClose ? -1.4 : 0.2);
    // 1: Jalan Cepat Kejar Bendera
    scores[1] = (!boxClose && radar.frontDist > 2.6 && Math.abs(headingDiff) < 0.20) ? 1.85 : (boxClose ? -1.8 : 0.1);
    // 2: Belok Kiri Halus & Jalan
    scores[2] = (!boxClose && headingDiff > 0.12 && headingDiff <= 0.48) ? 1.65 : -0.2;
    // 3: Belok Kanan Halus & Jalan
    scores[3] = (!boxClose && headingDiff < -0.12 && headingDiff >= -0.48) ? 1.65 : -0.2;
    // 4: Hindari Box ke Kiri (Tajam)
    scores[4] = (boxClose && (headingDiff > 0 || radar.leftDist >= radar.rightDist)) ? 2.25 : (headingDiff > 0.48 ? 1.60 : -0.5);
    // 5: Hindari Box ke Kanan (Tajam)
    scores[5] = (boxClose && (headingDiff < 0 || radar.rightDist > radar.leftDist)) ? 2.25 : (headingDiff < -0.48 ? 1.60 : -0.5);
    // 6: Stabilisasi Postur & Kompas
    scores[6] = Math.abs(w.torsoAngle) > 0.26 ? 1.95 : 0.05;

    return scores;
}

function selectAction(stateVec, w) {
    let qValues = [0, 0, 0, 0, 0, 0, 0];

    if (tfReady && qNetwork) {
        tf.tidy(() => {
            const stateTensor = tf.tensor2d([stateVec], [1, 8]);
            const pred = qNetwork.predict(stateTensor);
            const rawQ = pred.dataSync();
            const bioScores = computeActionSuitabilityScores(w);
            const blend = clamp(config.guidanceStrength, 0.0, 0.96);

            for (let i = 0; i < 7; i++) {
                qValues[i] = Number(((1.0 - blend * 0.60) * rawQ[i] + blend * bioScores[i] * 2.5).toFixed(3));
            }
        });
    } else {
        qValues = computeActionSuitabilityScores(w);
    }

    w.lastQValues = qValues;

    // Prioritas 1: Jika mahasiswa sedang mengarahkan robot (Human-in-the-Loop Coaching)
    if (studentForcedAction !== null && studentActionHoldTicks > 0) {
        const chosen = studentForcedAction;
        studentActionHoldTicks--;
        if (studentActionHoldTicks <= 0) {
            studentForcedAction = null;
        }
        return chosen;
    }

    // Prioritas 2: Eksplorasi Epsilon-Greedy (Saat epsilon tinggi, robot benar-benar bereksplorasi & sering menabrak labirin!)
    if (Math.random() < config.epsilon) {
        if (config.algorithm === 'CURRICULUM_RL' && Math.random() < 0.35 * config.guidanceStrength) {
            return getIdealRobotAction(w);
        }
        if (Math.random() < config.guidanceStrength * 0.45) {
            return getIdealRobotAction(w);
        }
        return Math.floor(Math.random() * 7);
    }

    if (config.algorithm === 'PPO' && config.epsilon > 0.06) {
        const temp = Math.max(0.22, config.epsilon * 0.75);
        const maxQ = Math.max(...qValues);
        const exps = qValues.map(q => Math.exp((q - maxQ) / temp));
        const sumExp = exps.reduce((a, b) => a + b, 0);
        let r = Math.random() * sumExp;
        for (let i = 0; i < 7; i++) {
            r -= exps[i];
            if (r <= 0) return i;
        }
    }

    let bestAction = 0;
    let bestVal = qValues[0];
    for (let i = 1; i < 7; i++) {
        if (qValues[i] > bestVal) {
            bestVal = qValues[i];
            bestAction = i;
        }
    }
    return bestAction;
}

/**
 * Simulasi Fisika 3D Robot Berjalan Biasa di Arena Labirin Kompleks 28x28m
 */
function stepPhysics(action) {
    const dt = 0.025;
    const w = walker;
    w.lastAction = action;
    episodeStats.steps++;
    totalStepsAllTime++;

    const skillFactor = clamp((1.0 - config.epsilon) * 0.55 + config.guidanceStrength * 0.65, 0.05, 1.0);
    const frictionFactor = clamp(config.groundFriction / 0.88, 0.45, 1.25);

    const dxFlagBefore = activeFlag.x - w.posX;
    const dzFlagBefore = activeFlag.z - w.posZ;
    const prevDistToFlag = Math.hypot(dxFlagBefore, dzFlagBefore);
    const targetYaw = Math.atan2(dxFlagBefore, dzFlagBefore);
    const yawDiff = normalizeAngleDiff(targetYaw - w.yaw);

    let forwardThrust = 0.0;
    let turnRate = 0.0;
    let torqueCost = 0.40;
    let avoidanceBonus = 0.0;

    switch (action) {
        case 0: // Jalan Maju Seimbang (Lurus, tidak belok otomatis!)
            forwardThrust = 2.15 * frictionFactor;
            turnRate = 0.0;
            torqueCost = 0.38;
            break;

        case 1: // Jalan Cepat Kejar Bendera (Lurus cepat)
            forwardThrust = 2.75 * frictionFactor;
            turnRate = 0.0;
            torqueCost = 0.58;
            break;

        case 2: // Belok Kiri Halus & Jalan
            forwardThrust = 1.95 * frictionFactor;
            turnRate = 2.25;
            torqueCost = 0.45;
            break;

        case 3: // Belok Kanan Halus & Jalan
            forwardThrust = 1.95 * frictionFactor;
            turnRate = -2.25;
            torqueCost = 0.45;
            break;

        case 4: // Hindari Box ke Kiri (Tajam)
            forwardThrust = 1.65 * frictionFactor;
            turnRate = 3.85;
            torqueCost = 0.55;
            if (w.radarFrontDist < 2.2) {
                avoidanceBonus += 1.25;
                w.obstaclesAvoided++;
            }
            break;

        case 5: // Hindari Box ke Kanan (Tajam)
            forwardThrust = 1.65 * frictionFactor;
            turnRate = -3.85;
            torqueCost = 0.55;
            if (w.radarFrontDist < 2.2) {
                avoidanceBonus += 1.25;
                w.obstaclesAvoided++;
            }
            break;

        case 6: // Stabilisasi Postur & Kompas
            forwardThrust = 1.15 * frictionFactor;
            turnRate = clamp(yawDiff * 3.4, -3.0, 3.0);
            w.torsoVel *= 0.58;
            w.torsoAngle *= 0.68;
            torqueCost = 0.30;
            break;
    }

    // Hanya jika model sudah benar-benar Master/Terlatih tinggi (>0.82), koreksi halus celah koridor aktif
    if (skillFactor > 0.82 && w.radarFrontDist < 1.65) {
        const bestHeading = findBestLabyrinthHeading(w);
        const escapeDiff = normalizeAngleDiff(bestHeading - w.yaw);
        turnRate += clamp(escapeDiff * 2.6, -2.5, 2.5);
    }

    // Ketidakstabilan arah saat robot belum terlatih (epsilon tinggi)
    if (config.epsilon > 0.40 && studentForcedAction === null && Math.random() < 0.28) {
        turnRate += (Math.random() - 0.5) * 3.1 * config.epsilon;
    }
    w.yaw = normalizeAngleDiff(w.yaw + turnRate * dt);

    // Dinamika Keseimbangan Badan Robot (Torso Gyro)
    let torsoAcc = (config.gravity / 0.80) * Math.sin(w.torsoAngle) * 0.54;
    if (w.pushTimer > 0) {
        torsoAcc += w.externalPush;
        w.pushTimer--;
        if (w.pushTimer === 0) {
            w.externalPush = 0.0;
            w.pushLabel = '';
        }
    }
    const pdAssist = clamp(0.32 + skillFactor * 0.78, 0.32, 1.10);
    torsoAcc += (-10.8 * w.torsoAngle - 3.8 * w.torsoVel) * pdAssist;
    if (config.epsilon > 0.50 && studentForcedAction === null) {
        torsoAcc += (Math.random() - 0.5) * 3.6 * config.epsilon;
    }

    w.torsoVel = (w.torsoVel + torsoAcc * dt) * 0.92;
    w.torsoAngle += w.torsoVel * dt;

    // Integrasi Kecepatan Jalan & Posisi Horizontal (X, Z) di Lantai Arena 28x28m
    const targetSpeed = Math.max(0.0, forwardThrust * Math.cos(w.torsoAngle));
    w.vx = w.vx * 0.76 + targetSpeed * 0.24;

    let nextPosX = clamp(w.posX + Math.sin(w.yaw) * w.vx * dt, -ARENA_HALF_LIMIT, ARENA_HALF_LIMIT);
    let nextPosZ = clamp(w.posZ + Math.cos(w.yaw) * w.vx * dt, -ARENA_HALF_LIMIT, ARENA_HALF_LIMIT);

    // Cek Tabrakan dengan 40 Box Berwarna di Lantai Arena
    let collidedWithBox = false;
    for (let i = 0; i < ARENA_BOXES.length; i++) {
        const b = ARENA_BOXES[i];
        const halfW = b.w * 0.5 + 0.28;
        const halfD = b.d * 0.5 + 0.28;

        if (Math.abs(nextPosX - b.x) <= halfW && Math.abs(nextPosZ - b.z) <= halfD) {
            collidedWithBox = true;
            const pushDx = w.posX - b.x;
            const pushDz = w.posZ - b.z;
            const pushLen = Math.max(0.01, Math.hypot(pushDx, pushDz));
            nextPosX = clamp(w.posX + (pushDx / pushLen) * 0.05, -ARENA_HALF_LIMIT, ARENA_HALF_LIMIT);
            nextPosZ = clamp(w.posZ + (pushDz / pushLen) * 0.05, -ARENA_HALF_LIMIT, ARENA_HALF_LIMIT);
            break;
        }
    }

    w.posX = nextPosX;
    w.posZ = nextPosZ;
    w.groundY = 0.0;

    if (collidedWithBox) {
        w.vx *= 0.20;
        w.boxCollisionTicks = (w.boxCollisionTicks || 0) + 1;
        avoidanceBonus -= 1.65;
        // Guncangan keras saat menabrak box penghalang
        w.torsoVel += (Math.random() > 0.5 ? 1 : -1) * (3.8 * (1.20 - skillFactor * 0.65));

        // Jika robot terus memaksa menabrak box tanpa berbelok, robot terjatuh!
        if (w.boxCollisionTicks >= 7) {
            w.torsoAngle = 0.95;
        }
    } else {
        w.boxCollisionTicks = Math.max(0, (w.boxCollisionTicks || 0) - 1);
    }

    // Animasi Ayunan Langkah Kaki & Lengan Robot Berjalan Biasa di Lantai
    const phaseAdvance = (1.8 + w.vx * 3.0) * dt;
    w.gaitPhase = (w.gaitPhase + phaseAdvance) % (Math.PI * 2);

    const swingAmp = 0.40 + Math.min(0.22, w.vx * 0.11);
    w.hipL = Math.sin(w.gaitPhase) * swingAmp - w.torsoAngle * 0.28;
    w.hipR = -Math.sin(w.gaitPhase) * swingAmp - w.torsoAngle * 0.28;

    w.kneeL = Math.max(0.06, Math.cos(w.gaitPhase) * 0.48 + 0.12);
    w.kneeR = Math.max(0.06, -Math.cos(w.gaitPhase) * 0.48 + 0.12);

    w.armL = -w.hipL * 0.82;
    w.armR = -w.hipR * 0.82;

    // Ayunan halus tinggi pinggul saat melangkah biasa (tetap di tanah, tidak melompat)
    w.y = 0.95 + Math.abs(Math.sin(w.gaitPhase)) * 0.025;
    w.footContactL = Math.sin(w.gaitPhase) <= 0.15;
    w.footContactR = Math.sin(w.gaitPhase) >= -0.15;

    const dxAfter = activeFlag.x - w.posX;
    const dzAfter = activeFlag.z - w.posZ;
    const currDistToFlag = Math.hypot(dxAfter, dzAfter);
    w.currentFlagDist = currDistToFlag;

    const progressRatio = clamp(1.0 - (currDistToFlag / Math.max(1.0, w.initFlagDist)), 0.0, 1.0);
    w.x = Number((progressRatio * config.targetDistance).toFixed(2));

    let done = false;
    let terminalReward = 0.0;

    if (currDistToFlag <= 1.10) {
        w.x = config.targetDistance;
        w.reachedFinish = true;
        done = true;
        cornersCapturedSet.add(activeFlag.code);
        const speedBonus = Math.max(0, (560 - episodeStats.steps) * 0.12);
        terminalReward = 100.0 + speedBonus;
        w.terminationReason = `🚩 Bendera ${activeFlag.name} Tertangkap!`;
    } else if (Math.abs(w.torsoAngle) > 0.86) {
        w.fallen = true;
        w.y = 0.32;
        done = true;
        terminalReward = config.penaltyFall;
        w.terminationReason = collidedWithBox
            ? `Menabrak Labirin Box & Jatuh (${activeFlag.code})`
            : `Kehilangan Keseimbangan (${activeFlag.code})`;
    } else if (episodeStats.steps >= 680) {
        done = true;
        terminalReward = -20.0;
        w.terminationReason = `Tersesat / Waktu Habis di Labirin (${activeFlag.code})`;
    }

    const distApproached = prevDistToFlag - currDistToFlag;
    const rForward = (distApproached / dt) * (config.rewardForwardWeight * 0.15);
    const alignBonus = Math.cos(yawDiff) * 0.45;
    const uprightness = Math.cos(w.torsoAngle) - Math.abs(w.torsoAngle) * 0.6 + alignBonus;
    const rUpright = uprightness * (config.rewardUprightWeight * 0.08);
    const rGait = avoidanceBonus * (config.rewardGaitWeight * 0.25);
    const rTorque = torqueCost * config.penaltyTorque;

    const stepReward = rForward + rUpright + rGait + rTorque + terminalReward;

    episodeStats.totalReward += stepReward;
    episodeStats.lastStepReward = stepReward;
    episodeStats.sumTorsoDeg += Math.abs(w.torsoAngle * (180 / Math.PI));
    episodeStats.sumSpeed += w.vx;
    episodeStats.rewardBreakdown = {
        forward: Number(rForward.toFixed(3)),
        upright: Number(rUpright.toFixed(3)),
        gait: Number(rGait.toFixed(3)),
        torque: Number(rTorque.toFixed(3)),
        terminal: Number(terminalReward.toFixed(2))
    };

    return {
        nextState: getNormalizedState(w),
        reward: stepReward,
        done: done
    };
}

async function rememberAndTrain(state, action, reward, nextState, done, isStudentDemo = false) {
    // Jika gerakan berasal dari kemudi mahasiswa (Human-in-the-Loop Coaching), simpan 3x agar DQN cepat meniru!
    const repeatCount = isStudentDemo ? 3 : 1;
    for (let r = 0; r < repeatCount; r++) {
        replayBuffer.push({ state, action, reward: isStudentDemo ? reward + 0.4 : reward, nextState, done });
        if (replayBuffer.length > MAX_BUFFER_SIZE) {
            replayBuffer.shift();
        }
    }

    if (!tfReady || !qNetwork || replayBuffer.length < BATCH_SIZE || totalStepsAllTime % 4 !== 0) {
        return;
    }

    const batch = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
        const idx = Math.floor(Math.random() * replayBuffer.length);
        batch.push(replayBuffer[idx]);
    }

    const statesArr = batch.map(b => b.state);
    const nextStatesArr = batch.map(b => b.nextState);

    const targetQs = tf.tidy(() => {
        const statesTensor = tf.tensor2d(statesArr, [BATCH_SIZE, 8]);
        const nextStatesTensor = tf.tensor2d(nextStatesArr, [BATCH_SIZE, 8]);

        const currentQPreds = qNetwork.predict(statesTensor).arraySync();
        const nextQPreds = targetNetwork.predict(nextStatesTensor).arraySync();

        for (let i = 0; i < BATCH_SIZE; i++) {
            const { action: a, reward: r, done: d } = batch[i];
            const maxNextQ = Math.max(...nextQPreds[i]);
            const bellmanTarget = d ? r : (r + config.gamma * maxNextQ);
            currentQPreds[i][a] = clamp(bellmanTarget, -85.0, 140.0);
        }
        return currentQPreds;
    });

    const xTensor = tf.tensor2d(statesArr, [BATCH_SIZE, 8]);
    const yTensor = tf.tensor2d(targetQs, [BATCH_SIZE, 7]);

    try {
        const history = await qNetwork.fit(xTensor, yTensor, {
            epochs: 1,
            batchSize: BATCH_SIZE,
            verbose: 0
        });
        if (history && history.history && history.history.loss) {
            lastLoss = Number(history.history.loss[0].toFixed(5));
        }
    } catch (err) {
    } finally {
        xTensor.dispose();
        yTensor.dispose();
    }

    if (totalStepsAllTime % 70 === 0) {
        syncTargetNetwork();
    }
}

function getStageLabel(progressM, reachedFinish, cornerCode) {
    const prefix = `Sudut ${cornerCode} | `;
    if (reachedFinish || progressM >= 9.5) {
        return prefix + 'Tahap 4: Juara Catch The Flag!';
    }
    if (progressM >= 6.0) {
        return prefix + 'Tahap 3: Mahir Hindari Box & Navigasi';
    }
    if (progressM >= 3.0) {
        return prefix + 'Tahap 2: Belajar Deteksi Radar Box';
    }
    return prefix + 'Tahap 1: Eksplorasi Awal Arena';
}

async function runSingleSimulationTick(renderToUI = true) {
    if (!walker) {
        resetWalkerEnv();
    }

    const isStudentSteering = (studentForcedAction !== null && studentActionHoldTicks > 0);
    const currentState = getNormalizedState(walker);
    const action = selectAction(currentState, walker);
    const { nextState, reward, done } = stepPhysics(action);

    await rememberAndTrain(currentState, action, reward, nextState, done, isStudentSteering);

    if (renderToUI) {
        sendStateUpdate(currentState, action, done);
    }

    if (done) {
        const steps = Math.max(1, episodeStats.steps);
        const durationSec = Number((steps * 0.025).toFixed(2));
        const avgTorsoDeg = Number((episodeStats.sumTorsoDeg / steps).toFixed(2));
        const avgSpeedMs = Number((episodeStats.sumSpeed / steps).toFixed(2));
        const distM = Number(walker.x.toFixed(2));
        const stageLabel = getStageLabel(distM, walker.reachedFinish, walker.flagCornerCode);

        self.postMessage({
            type: 'EPISODE_COMPLETE',
            episodeSummary: {
                episode_number: episodeNumber,
                algorithm: config.algorithm,
                distance_m: distM,
                total_reward: Number(episodeStats.totalReward.toFixed(2)),
                steps_count: steps,
                duration_sec: durationSec,
                avg_torso_angle_deg: avgTorsoDeg,
                avg_speed_ms: avgSpeedMs,
                epsilon: Number(config.epsilon.toFixed(4)),
                loss_value: lastLoss,
                termination_reason: walker.terminationReason,
                reached_finish: walker.reachedFinish ? 1 : 0,
                stage_label: stageLabel,
                flag_corner: walker.flagCornerCode,
                corners_mastered: cornersCapturedSet.size
            }
        });

        episodeNumber++;
        config.epsilon = Math.max(config.epsilonMin, config.epsilon * config.epsilonDecay);
        config.guidanceStrength = Math.min(0.96, config.guidanceStrength + 0.038);

        resetWalkerEnv(false);
    }
}

function sendStateUpdate(stateVec, action, done) {
    const steps = Math.max(1, episodeStats.steps);
    const distM = Number(walker.x.toFixed(2));
    self.postMessage({
        type: 'STATE_UPDATE',
        walker: {
            x: distM,
            posX: Number(walker.posX.toFixed(3)),
            posZ: Number(walker.posZ.toFixed(3)),
            y: Number(walker.y.toFixed(3)),
            groundY: 0,
            vx: Number(walker.vx.toFixed(2)),
            vy: 0,
            yaw: Number(walker.yaw.toFixed(4)),
            torsoAngle: Number(walker.torsoAngle.toFixed(4)),
            torsoAngleDeg: Number((walker.torsoAngle * 180 / Math.PI).toFixed(1)),
            torsoVel: Number(walker.torsoVel.toFixed(3)),
            hipL: Number(walker.hipL.toFixed(4)),
            hipR: Number(walker.hipR.toFixed(4)),
            kneeL: Number(walker.kneeL.toFixed(4)),
            kneeR: Number(walker.kneeR.toFixed(4)),
            armL: Number(walker.armL.toFixed(4)),
            armR: Number(walker.armR.toFixed(4)),
            footContactL: walker.footContactL,
            footContactR: walker.footContactR,
            isJumping: false,
            gaitPhase: Number(walker.gaitPhase.toFixed(3)),
            fallen: walker.fallen,
            reachedFinish: walker.reachedFinish,
            pushLabel: walker.pushLabel,
            flagCornerCode: walker.flagCornerCode,
            flagCornerName: walker.flagCornerName,
            flagX: walker.flagX,
            flagZ: walker.flagZ,
            flagY: walker.flagY,
            currentFlagDist: Number(walker.currentFlagDist.toFixed(2))
        },
        rl: {
            episode: episodeNumber,
            step: steps,
            stateVector: stateVec.map(v => Number(v.toFixed(3))),
            action: action,
            actionLabel: ACTION_LABELS[action] || 'Jalan Maju Seimbang',
            qValues: walker.lastQValues,
            stepReward: Number(episodeStats.lastStepReward.toFixed(3)),
            totalReward: Number(episodeStats.totalReward.toFixed(2)),
            rewardBreakdown: episodeStats.rewardBreakdown,
            epsilon: Number(config.epsilon.toFixed(3)),
            loss: lastLoss,
            stageLabel: getStageLabel(distM, walker.reachedFinish, walker.flagCornerCode),
            done: done
        }
    });
}

async function workerLoop() {
    if (!isRunning) return;

    const subSteps = Math.max(1, Math.min(25, config.speedMultiplier || 1));
    for (let i = 0; i < subSteps; i++) {
        if (!isRunning) break;
        const shouldRender = (i === subSteps - 1);
        await runSingleSimulationTick(shouldRender);
    }

    if (isRunning) {
        const delayMs = subSteps >= 10 ? 18 : 28;
        loopTimer = setTimeout(workerLoop, delayMs);
    }
}

function exportModelWeightsJson() {
    const payload = {
        preset_mode: 'custom_tfjs',
        guidance_strength: config.guidanceStrength,
        epsilon: config.epsilon,
        episode: episodeNumber,
        tensors: []
    };

    if (tfReady && qNetwork) {
        tf.tidy(() => {
            const weights = qNetwork.getWeights();
            payload.tensors = weights.map(w => ({
                shape: w.shape,
                data: Array.from(w.dataSync()).map(v => Number(v.toFixed(5)))
            }));
        });
    }
    return JSON.stringify(payload);
}

function loadModelWeightsFromJson(weightsJsonStr, trainedEpisodes = 1) {
    try {
        const parsed = typeof weightsJsonStr === 'string' ? JSON.parse(weightsJsonStr) : weightsJsonStr;

        if (parsed.preset_mode === 'untrained') {
            config.guidanceStrength = 0.0;
            config.epsilon = 1.00;
            episodeNumber = 1;
            buildNeuralNetworks();
        } else if (parsed.preset_mode === 'intermediate') {
            config.guidanceStrength = 0.65;
            config.epsilon = 0.30;
            episodeNumber = Math.max(8, trainedEpisodes || 8);
        } else if (parsed.preset_mode === 'master') {
            config.guidanceStrength = 0.96;
            config.epsilon = 0.04;
            episodeNumber = Math.max(20, trainedEpisodes || 20);
        } else {
            if (typeof parsed.guidance_strength === 'number') {
                config.guidanceStrength = parsed.guidance_strength;
            }
            if (typeof parsed.epsilon === 'number') {
                config.epsilon = parsed.epsilon;
            }
            if (Array.isArray(parsed.tensors) && parsed.tensors.length > 0 && tfReady && qNetwork) {
                tf.tidy(() => {
                    const weightTensors = parsed.tensors.map(t => tf.tensor(t.data, t.shape));
                    qNetwork.setWeights(weightTensors);
                    targetNetwork.setWeights(weightTensors.map(w => w.clone()));
                });
            }
            if (trainedEpisodes > 0) {
                episodeNumber = trainedEpisodes + 1;
            }
        }

        resetWalkerEnv(false);
        sendStateUpdate(getNormalizedState(walker), walker.lastAction, false);
        return true;
    } catch (e) {
        return false;
    }
}

self.onmessage = async function (e) {
    const msg = e.data || {};
    const cmd = msg.cmd;

    switch (cmd) {
        case 'INIT': {
            if (msg.config) {
                Object.assign(config, msg.config);
            }
            if (msg.startEpisode) {
                episodeNumber = Math.max(1, parseInt(msg.startEpisode, 10));
            }
            // Mulai sesi dengan otak awal (Eksplorasi tinggi) agar robot benar-benar harus belajar menembus labirin 40 box!
            config.epsilon = 0.95;
            config.guidanceStrength = 0.05;
            await initTensorFlow(msg.tfScriptUrl || '../vendor/tfjs/tf.min.js');
            resetWalkerEnv(false);
            self.postMessage({
                type: 'WORKER_READY',
                tfBackend: tfReady ? tf.getBackend() : 'fallback-js',
                episode: episodeNumber,
                epsilon: config.epsilon,
                arenaBoxes: ARENA_BOXES,
                flagCorners: FLAG_CORNERS
            });
            sendStateUpdate(getNormalizedState(walker), 0, false);
            break;
        }

        case 'START': {
            if (!isRunning) {
                isRunning = true;
                workerLoop();
            }
            break;
        }

        case 'PAUSE': {
            isRunning = false;
            if (loopTimer) {
                clearTimeout(loopTimer);
                loopTimer = null;
            }
            break;
        }

        case 'STEP_ONCE': {
            isRunning = false;
            if (loopTimer) {
                clearTimeout(loopTimer);
                loopTimer = null;
            }
            await runSingleSimulationTick(true);
            break;
        }

        case 'STUDENT_STEER': {
            // Mahasiswa mengarahkan robot secara langsung (Human-in-the-Loop Coaching)
            const actIdx = parseInt(msg.action, 10);
            if (!isNaN(actIdx) && actIdx >= 0 && actIdx <= 6) {
                studentForcedAction = actIdx;
                studentActionHoldTicks = 5;
                config.guidanceStrength = Math.min(0.96, config.guidanceStrength + 0.015);
                if (walker) {
                    walker.pushLabel = `🎮 Kemudi Mahasiswa: ${ACTION_LABELS[actIdx]}`;
                    walker.pushTimer = 10;
                }
                if (!isRunning) {
                    await runSingleSimulationTick(true);
                }
            }
            break;
        }

        case 'RESET_EPISODE': {
            resetWalkerEnv(false);
            sendStateUpdate(getNormalizedState(walker), 0, false);
            break;
        }

        case 'SHUFFLE_FLAG_CORNER': {
            if (typeof msg.cornerIndex === 'number' && msg.cornerIndex >= -1 && msg.cornerIndex <= 3) {
                config.forcedCornerIndex = msg.cornerIndex;
            } else {
                config.forcedCornerIndex = -1;
            }
            pickRandomFlagCorner();
            if (walker) {
                walker.flagCornerCode = activeFlag.code;
                walker.flagCornerName = activeFlag.name;
                walker.flagX = activeFlag.x;
                walker.flagZ = activeFlag.z;
                walker.flagY = activeFlag.podiumH;
                walker.initFlagDist = Math.hypot(activeFlag.x - walker.posX, activeFlag.z - walker.posZ);
                sendStateUpdate(getNormalizedState(walker), walker.lastAction, false);
            }
            break;
        }

        case 'RESET_BRAIN': {
            isRunning = false;
            if (loopTimer) {
                clearTimeout(loopTimer);
                loopTimer = null;
            }
            replayBuffer = [];
            episodeNumber = 1;
            totalStepsAllTime = 0;
            lastLoss = 0.0;
            config.epsilon = 1.00;
            config.guidanceStrength = 0.0;
            cornersCapturedSet.clear();
            buildNeuralNetworks();
            resetWalkerEnv(false);
            sendStateUpdate(getNormalizedState(walker), 0, false);
            self.postMessage({
                type: 'BRAIN_RESET_DONE',
                message: 'Otak DQN Robot direset kembali ke kondisi awal (Episode 1, Eksplorasi 100%). Siap dilatih ulang!'
            });
            break;
        }

        case 'SET_SPEED': {
            config.speedMultiplier = Math.max(1, Math.min(25, parseInt(msg.speed, 10) || 1));
            break;
        }

        case 'UPDATE_CONFIG': {
            if (msg.config) {
                const prevLr = config.learningRate;
                Object.assign(config, msg.config);
                if (tfReady && Math.abs(prevLr - config.learningRate) > 1e-6) {
                    optimizer = tf.train.adam(config.learningRate);
                }
            }
            break;
        }

        case 'APPLY_PUSH': {
            if (walker) {
                const force = parseFloat(msg.force) || 6.5;
                walker.externalPush = force;
                walker.pushTimer = 8;
                walker.pushLabel = force > 0 ? '💨 Gangguan Angin Dorong Depan!' : '💨 Gangguan Angin Dorong Belakang!';
            }
            break;
        }

        case 'LOAD_MODEL': {
            const ok = loadModelWeightsFromJson(msg.weights_json, msg.trained_episodes || 1);
            self.postMessage({
                type: 'MODEL_LOADED',
                success: ok,
                model_name: msg.model_name || 'Model Tersimpan',
                epsilon: config.epsilon,
                episode: episodeNumber
            });
            break;
        }

        case 'EXPORT_MODEL': {
            const weightsJson = exportModelWeightsJson();
            self.postMessage({
                type: 'MODEL_EXPORTED',
                weights_json: weightsJson,
                architecture_json: JSON.stringify({
                    inputShape: [8],
                    layers: [64, 64],
                    outputActions: 7,
                    tfBackend: tfReady ? tf.getBackend() : 'cpu'
                }),
                episode: episodeNumber
            });
            break;
        }
    }
};
