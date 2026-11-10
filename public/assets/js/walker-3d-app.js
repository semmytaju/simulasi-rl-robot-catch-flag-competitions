/**
 * ============================================================================
 * FRONTEND APPLICATION: walker-3d-app.js (ES6+)
 * Simulasi Reinforcement Learning: Robot Catch the Flag Competition (DQN)
 * ----------------------------------------------------------------------------
 * Mengintegrasikan:
 * - Three.js High-Detail Sci-Fi Humanoid Robot (Tanpa Tanda Salib, Jalan Biasa)
 * - Arena 3D Menantang dengan Box Berwarna Penghalang & Pohon-Pohon Outdoor
 * - Bendera Merah Muncul Secara Random di 4 Sudut Arena (NE, NW, SE, SW)
 * - Mode Interaktif Mahasiswa: Kemudi Pelatih (WASD / Tombol Arah) + Auto DQN
 * - Sinkronisasi Real-Time dengan PHP 8+ & MySQL (db_robot_agent)
 * ============================================================================
 */

class BipedalWalkerLabApp {
    constructor(bootData) {
        this.appPath = bootData.appPath || '';
        this.csrfToken = bootData.csrfToken || '';
        this.activeSession = bootData.activeSession || { id: 1, best_distance_m: 0 };
        this.presets = bootData.presets || [];
        this.episodes = bootData.episodes || [];
        this.savedModels = bootData.savedModels || [];
        this.leaderboard = bootData.leaderboard || [];

        this.worker = null;
        this.isTraining = false;
        this.cameraMode = 'follow';
        this.orbitYawOffset = 0.0;
        this.orbitPitchOffset = 0.0;
        this.panOffsetX = 0.0;
        this.panOffsetY = 0.0;
        this.zoomPercent = 100;
        this.cameraZoom = 1.0;

        this.currentPose = {
            x: 0, posX: 0, posZ: 0, y: 0.95, groundY: 0,
            vx: 0, vy: 0, yaw: 0.78,
            torsoAngle: 0, torsoAngleDeg: 0, torsoVel: 0,
            hipL: 0.16, hipR: -0.16,
            kneeL: 0.14, kneeR: 0.14,
            armL: -0.16, armR: 0.16,
            footContactL: true, footContactR: true,
            isJumping: false,
            fallen: false, reachedFinish: false, pushLabel: '',
            flagCornerCode: 'NE', flagCornerName: 'Sudut Timur Laut (NE)',
            flagX: 11.4, flagZ: -11.4, flagY: 0.04, currentFlagDist: 16.12
        };
        this.targetPose = { ...this.currentPose };
        this.prevFootContactL = true;
        this.prevFootContactR = true;
        this.footstepRipples = [];
        this.cloudsList = [];
        this.treesList = [];
        this.clockTime = 0;

        this.bestDistanceRecord = parseFloat(this.activeSession.best_distance_m || 0);
        this.learningChart = null;

        this.ensureThreeAndInit();
        this.initLearningChart();
        this.initWebWorker();
        this.bindUIEvents();
        this.renderEpisodesTable();
        this.renderModelsList();
        this.renderLeaderboardTable();
        this.updateSessionSummaryCards();
    }

    ensureThreeAndInit() {
        if (typeof THREE !== 'undefined' && THREE.WebGLRenderer) {
            this.initThreeScene();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.150.1/build/three.min.js';
        script.onload = () => this.initThreeScene();
        document.head.appendChild(script);
    }

    /**
     * 1. INISIALISASI SCENE 3D THREE.JS (LANGIT CERAH, POHON LUAR ARENA, BOX BERWARNA, & ROBOT SCI-FI)
     */
    initThreeScene() {
        this.container = document.getElementById('threeCanvasContainer');
        if (!this.container || typeof THREE === 'undefined') return;

        const width = this.container.clientWidth || 820;
        const height = this.container.clientHeight || 430;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x5698e8);
        this.scene.fog = new THREE.FogExp2(0x8ec5fc, 0.0075);

        this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 220);
        this.camera.position.set(-2.5, 2.35, 3.2);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.container.innerHTML = '';
        this.container.appendChild(this.renderer.domElement);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
        this.scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3f6212, 0.68);
        hemiLight.position.set(0, 28, 0);
        this.scene.add(hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
        this.dirLight.position.set(14, 24, 16);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 70;
        this.dirLight.shadow.camera.left = -18;
        this.dirLight.shadow.camera.right = 18;
        this.dirLight.shadow.camera.top = 18;
        this.dirLight.shadow.camera.bottom = -18;
        this.scene.add(this.dirLight);

        const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.62);
        rimLight.position.set(-10, 8, -10);
        this.scene.add(rimLight);

        this.buildExteriorParkAndTrees();
        this.buildTrainingTrack();
        this.buildHumanoidCharacter();
        this.buildTargetFlagMesh();

        let isDragging = false;
        let isPanning = false;
        let prevX = 0, prevY = 0;
        let prevPinchDist = null;
        const domElem = this.renderer.domElement;

        domElem.addEventListener('contextmenu', (e) => e.preventDefault());
        domElem.addEventListener('mousedown', (e) => {
            isDragging = true;
            isPanning = (e.button === 2 || e.shiftKey);
            prevX = e.clientX;
            prevY = e.clientY;
        });
        window.addEventListener('mouseup', () => {
            isDragging = false;
            isPanning = false;
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - prevX;
            const dy = e.clientY - prevY;
            prevX = e.clientX;
            prevY = e.clientY;
            if (isPanning) {
                this.panOffsetX = Math.max(-8.0, Math.min(8.0, this.panOffsetX - dx * 0.012));
                this.panOffsetY = Math.max(-0.8, Math.min(2.8, this.panOffsetY + dy * 0.010));
            } else {
                this.orbitYawOffset = Math.max(-3.14, Math.min(3.14, this.orbitYawOffset - dx * 0.007));
                this.orbitPitchOffset = Math.max(-0.30, Math.min(1.15, this.orbitPitchOffset + dy * 0.006));
            }
        });

        domElem.addEventListener('wheel', (e) => {
            e.preventDefault();
            const step = e.deltaY < 0 ? 12 : -12;
            this.setZoomPercent(this.zoomPercent + step);
        }, { passive: false });

        domElem.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                prevPinchDist = Math.hypot(dx, dy);
            } else if (e.touches.length === 1) {
                isDragging = true;
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
            }
        }, { passive: true });

        domElem.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2 && prevPinchDist !== null) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const delta = (dist - prevPinchDist) * 0.45;
                prevPinchDist = dist;
                this.setZoomPercent(this.zoomPercent + delta);
            } else if (e.touches.length === 1 && isDragging) {
                const dx = e.touches[0].clientX - prevX;
                const dy = e.touches[0].clientY - prevY;
                prevX = e.touches[0].clientX;
                prevY = e.touches[0].clientY;
                this.orbitYawOffset = Math.max(-3.14, Math.min(3.14, this.orbitYawOffset - dx * 0.007));
                this.orbitPitchOffset = Math.max(-0.30, Math.min(1.15, this.orbitPitchOffset + dy * 0.006));
            }
        }, { passive: true });

        domElem.addEventListener('touchend', () => {
            prevPinchDist = null;
            isDragging = false;
        });

        window.addEventListener('resize', () => this.onWindowResize());

        this.animateThree();
    }

    /**
     * Bangun Lanskap Hijau, Pagar Luar, Awan Putih, dan Pohon-Pohon 3D di Luar Environment
     */
    buildExteriorParkAndTrees() {
        const exteriorGroup = new THREE.Group();

        const grassGeo = new THREE.PlaneGeometry(180, 180);
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.92 });
        const grassMesh = new THREE.Mesh(grassGeo, grassMat);
        grassMesh.rotation.x = -Math.PI / 2;
        grassMesh.position.set(0, -0.58, 0);
        grassMesh.receiveShadow = true;
        exteriorGroup.add(grassMesh);

        const trenchGeo = new THREE.PlaneGeometry(35.5, 35.5);
        const trenchMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
        const trenchMesh = new THREE.Mesh(trenchGeo, trenchMat);
        trenchMesh.rotation.x = -Math.PI / 2;
        trenchMesh.position.set(0, -0.55, 0);
        exteriorGroup.add(trenchMesh);

        const trenchGrid = new THREE.GridHelper(35.2, 36, 0xeab308, 0x334155);
        trenchGrid.position.set(0, -0.53, 0);
        exteriorGroup.add(trenchGrid);

        const fenceMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
        const borderDist = 17.8;

        const wallNorth = new THREE.Mesh(new THREE.BoxGeometry(36.0, 0.85, 0.28), wallMat);
        wallNorth.position.set(0, -0.18, -borderDist);
        const wallSouth = new THREE.Mesh(new THREE.BoxGeometry(36.0, 0.85, 0.28), wallMat);
        wallSouth.position.set(0, -0.18, borderDist);
        const wallEast = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 36.0), wallMat);
        wallEast.position.set(borderDist, -0.18, 0);
        const wallWest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, 36.0), wallMat);
        wallWest.position.set(-borderDist, -0.18, 0);
        exteriorGroup.add(wallNorth, wallSouth, wallEast, wallWest);

        for (let i = -16; i <= 16; i += 3.2) {
            const postN = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.25, 0.14), fenceMat);
            postN.position.set(i, 0.0, -borderDist + 0.2);
            const postS = postN.clone();
            postS.position.set(i, 0.0, borderDist - 0.2);
            const postE = postN.clone();
            postE.position.set(borderDist - 0.2, 0.0, i);
            const postW = postN.clone();
            postW.position.set(-borderDist + 0.2, 0.0, i);
            exteriorGroup.add(postN, postS, postE, postW);
        }

        const treePositions = [
            [-20.5, -20.0, 1.25], [-14.5, -21.2, 1.05], [-8.2, -20.8, 1.35], [-1.5, -21.0, 1.15], [5.5, -20.8, 1.20], [12.2, -20.5, 1.10], [19.8, -19.8, 1.30],
            [-21.2, -13.5, 1.15], [-20.5, -6.5, 1.30], [-21.0, 0.5, 1.05], [-20.5, 7.5, 1.25], [-21.2, 14.5, 1.15],
            [21.0, -13.2, 1.20], [20.4, -6.2, 1.05], [21.2, 1.2, 1.35], [20.6, 8.2, 1.15], [21.0, 15.0, 1.25],
            [-19.5, 20.8, 1.25], [-12.8, 20.5, 1.10], [-5.5, 21.2, 1.30], [2.5, 20.9, 1.05], [10.2, 21.2, 1.20], [18.5, 20.6, 1.30],
            [-26.5, -25.0, 1.55], [-15.0, -26.5, 1.45], [0.0, -26.0, 1.60], [15.0, -25.8, 1.50], [26.5, -24.5, 1.45],
            [-27.0, 0.0, 1.50], [27.0, 1.5, 1.55], [-25.5, 25.5, 1.45], [25.5, 26.0, 1.50]
        ];

        treePositions.forEach(([tx, tz, scale], idx) => {
            const tree = this.createStylized3DTree(scale, idx);
            tree.position.set(tx, -0.58, tz);
            exteriorGroup.add(tree);
            this.treesList.push(tree);
        });

        const cloudCoords = [
            [-18, 13.5, -28, 1.4], [6, 14.8, -30, 1.6], [24, 12.8, -24, 1.3],
            [-26, 13.2, 8, 1.35], [28, 14.0, 10, 1.5], [-8, 15.2, 28, 1.45]
        ];
        cloudCoords.forEach(([cx, cy, cz, cScale]) => {
            const cloud = this.createFluffyCloud(cScale);
            cloud.position.set(cx, cy, cz);
            exteriorGroup.add(cloud);
            this.cloudsList.push(cloud);
        });

        this.scene.add(exteriorGroup);
    }

    createStylized3DTree(scale = 1.0, variant = 0) {
        const treeGroup = new THREE.Group();

        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
        const leafColors = [0x15803d, 0x16a34a, 0x22c55e, 0x4d7c0f];
        const leafMatMain = new THREE.MeshStandardMaterial({
            color: leafColors[variant % leafColors.length],
            roughness: 0.65
        });
        const leafMatLight = new THREE.MeshStandardMaterial({
            color: 0x4ade80,
            roughness: 0.6
        });

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.75, 10), trunkMat);
        trunk.position.y = 0.875;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const crownCenter = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 14), leafMatMain);
        crownCenter.scale.set(1.15, 0.92, 1.15);
        crownCenter.position.set(0, 2.15, 0);
        crownCenter.castShadow = true;
        treeGroup.add(crownCenter);

        const crownLeft = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 12), leafMatMain);
        crownLeft.position.set(-0.62, 1.88, 0.22);
        treeGroup.add(crownLeft);

        const crownRight = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 12), leafMatLight);
        crownRight.position.set(0.58, 1.95, -0.18);
        treeGroup.add(crownRight);

        const crownTop = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 12), leafMatLight);
        crownTop.position.set(0.08, 2.75, 0.05);
        treeGroup.add(crownTop);

        treeGroup.scale.set(scale, scale, scale);
        return treeGroup;
    }

    createFluffyCloud(scale = 1.0) {
        const cloudGroup = new THREE.Group();
        const cloudMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.86
        });

        const parts = [
            [0, 0, 0, 1.4, 0.85, 1.0],
            [-1.1, -0.15, 0.1, 1.0, 0.7, 0.85],
            [1.15, -0.1, -0.1, 1.05, 0.72, 0.9],
            [0.35, 0.45, 0, 0.95, 0.75, 0.85]
        ];
        parts.forEach(([px, py, pz, sx, sy, sz]) => {
            const puff = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 12), cloudMat);
            puff.position.set(px, py, pz);
            puff.scale.set(sx, sy, sz);
            cloudGroup.add(puff);
        });

        cloudGroup.scale.set(scale, scale, scale);
        return cloudGroup;
    }

    /**
     * Bangun Platform Arena Luas 28x28m, 4 Titik Sudut Bendera, & 40 Box Berwarna Labirin Berlapis
     */
    buildTrainingTrack() {
        const arenaGroup = new THREE.Group();

        const baseSlabGeo = new THREE.BoxGeometry(28.2, 0.52, 28.2);
        const baseSlabMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.45,
            metalness: 0.35
        });
        const baseSlab = new THREE.Mesh(baseSlabGeo, baseSlabMat);
        baseSlab.position.set(0, -0.28, 0);
        baseSlab.receiveShadow = true;
        arenaGroup.add(baseSlab);

        const rimStripMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.65
        });
        const rimN = new THREE.Mesh(new THREE.BoxGeometry(28.26, 0.05, 0.08), rimStripMat);
        rimN.position.set(0, -0.02, -14.1);
        const rimS = rimN.clone();
        rimS.position.set(0, -0.02, 14.1);
        const rimE = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 28.26), rimStripMat);
        rimE.position.set(14.1, -0.02, 0);
        const rimW = rimE.clone();
        rimW.position.set(-14.1, -0.02, 0);
        arenaGroup.add(rimN, rimS, rimE, rimW);

        const tileMatEven = new THREE.MeshStandardMaterial({
            color: 0x4b5e78,
            roughness: 0.38,
            metalness: 0.18
        });
        const tileMatOdd = new THREE.MeshStandardMaterial({
            color: 0x3f516b,
            roughness: 0.42,
            metalness: 0.18
        });
        const tileGeo = new THREE.BoxGeometry(0.97, 0.04, 0.97);

        for (let ix = -14; ix < 14; ix++) {
            for (let iz = -14; iz < 14; iz++) {
                const isEven = ((ix + iz) % 2 === 0);
                const tile = new THREE.Mesh(tileGeo, isEven ? tileMatEven : tileMatOdd);
                tile.position.set(ix + 0.5, -0.02, iz + 0.5);
                tile.receiveShadow = true;
                arenaGroup.add(tile);
            }
        }

        const surfaceGrid = new THREE.GridHelper(28, 28, 0x93c5fd, 0x7dd3fc);
        surfaceGrid.position.set(0, 0.003, 0);
        surfaceGrid.material.opacity = 0.38;
        surfaceGrid.material.transparent = true;
        arenaGroup.add(surfaceGrid);

        // Zona Start Tengah (0, 0)
        const startPadGeo = new THREE.RingGeometry(0.55, 0.72, 32);
        const startPadMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide
        });
        const startPad = new THREE.Mesh(startPadGeo, startPadMat);
        startPad.rotation.x = -Math.PI / 2;
        startPad.position.set(0, 0.008, 0);
        arenaGroup.add(startPad);

        const startLabel = this.createTextSprite('START ROBOT (0,0)', '#38bdf8');
        startLabel.position.set(0, 0.32, 0);
        arenaGroup.add(startLabel);

        // 4 Landasan Sudut Bendera Rata Lantai di Ujung Arena 28x28m (NE, NW, SE, SW)
        const cornerPads = [
            { x: 11.4, z: -11.4, label: 'POINT SUDUT NE' },
            { x: -11.4, z: -11.4, label: 'POINT SUDUT NW' },
            { x: 11.4, z: 11.4, label: 'POINT SUDUT SE' },
            { x: -11.4, z: 11.4, label: 'POINT SUDUT SW' }
        ];
        const padMat = new THREE.MeshStandardMaterial({
            color: 0x1d4ed8,
            emissive: 0x2563eb,
            emissiveIntensity: 0.38,
            roughness: 0.3
        });
        cornerPads.forEach(cp => {
            const padMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.04, 24), padMat);
            padMesh.position.set(cp.x, 0.02, cp.z);
            arenaGroup.add(padMesh);

            const cLbl = this.createTextSprite(cp.label, '#93c5fd');
            cLbl.position.set(cp.x, 0.38, cp.z);
            cLbl.scale.set(1.05, 0.26, 1);
            arenaGroup.add(cLbl);
        });

        // 40 Box Berwarna sebagai Penghalang Labirin Kompleks
        this.obstacleBoxesGroup = new THREE.Group();
        arenaGroup.add(this.obstacleBoxesGroup);

        const defaultBoxes = [
            { id: 'r1_ne', x: 2.35, z: -2.35, w: 1.55, d: 1.55, h: 0.95, colorType: 'yellow_crate' },
            { id: 'r1_nw', x: -2.35, z: -2.35, w: 1.55, d: 1.55, h: 0.95, colorType: 'blue_box' },
            { id: 'r1_se', x: 2.35, z: 2.35, w: 1.55, d: 1.55, h: 0.95, colorType: 'white_cube' },
            { id: 'r1_sw', x: -2.35, z: 2.35, w: 1.55, d: 1.55, h: 0.95, colorType: 'yellow_crate' },

            { id: 'r1_n', x: 0.0, z: -3.60, w: 1.80, d: 1.10, h: 1.05, colorType: 'grey_tech' },
            { id: 'r1_s', x: 0.0, z: 3.60, w: 1.80, d: 1.10, h: 1.05, colorType: 'grey_tech' },
            { id: 'r1_e', x: 3.60, z: 0.0, w: 1.10, d: 1.80, h: 1.05, colorType: 'blue_grey_wall' },
            { id: 'r1_w', x: -3.60, z: 0.0, w: 1.10, d: 1.80, h: 1.05, colorType: 'blue_grey_wall' },

            { id: 'ne_mid_1', x: 5.10, z: -2.10, w: 1.45, d: 1.35, h: 1.10, colorType: 'blue_box' },
            { id: 'ne_mid_2', x: 2.10, z: -5.10, w: 1.35, d: 1.45, h: 1.10, colorType: 'white_cube' },
            { id: 'ne_mid_3', x: 5.55, z: -5.55, w: 1.75, d: 1.75, h: 1.25, colorType: 'grey_tech' },
            { id: 'ne_out_1', x: 8.30, z: -4.70, w: 1.65, d: 1.35, h: 0.95, colorType: 'yellow_crate' },
            { id: 'ne_out_2', x: 4.70, z: -8.30, w: 1.35, d: 1.65, h: 0.95, colorType: 'blue_tall' },
            { id: 'ne_guard_diag', x: 8.95, z: -8.95, w: 1.60, d: 1.60, h: 1.20, colorType: 'blue_grey_wall' },
            { id: 'ne_guard_e', x: 11.30, z: -8.70, w: 1.35, d: 1.25, h: 0.90, colorType: 'yellow_crate' },
            { id: 'ne_guard_n', x: 8.70, z: -11.30, w: 1.25, d: 1.35, h: 0.90, colorType: 'white_cube' },

            { id: 'nw_mid_1', x: -5.10, z: -2.10, w: 1.45, d: 1.35, h: 1.10, colorType: 'yellow_crate' },
            { id: 'nw_mid_2', x: -2.10, z: -5.10, w: 1.35, d: 1.45, h: 1.10, colorType: 'blue_box' },
            { id: 'nw_mid_3', x: -5.55, z: -5.55, w: 1.75, d: 1.75, h: 1.25, colorType: 'blue_grey_wall' },
            { id: 'nw_out_1', x: -8.30, z: -4.70, w: 1.65, d: 1.35, h: 0.95, colorType: 'white_cube' },
            { id: 'nw_out_2', x: -4.70, z: -8.30, w: 1.35, d: 1.65, h: 0.95, colorType: 'yellow_crate' },
            { id: 'nw_guard_diag', x: -8.95, z: -8.95, w: 1.60, d: 1.60, h: 1.20, colorType: 'grey_tech' },
            { id: 'nw_guard_w', x: -11.30, z: -8.70, w: 1.35, d: 1.25, h: 0.90, colorType: 'blue_box' },
            { id: 'nw_guard_n', x: -8.70, z: -11.30, w: 1.25, d: 1.35, h: 0.90, colorType: 'yellow_crate' },

            { id: 'se_mid_1', x: 5.10, z: 2.10, w: 1.45, d: 1.35, h: 1.10, colorType: 'white_cube' },
            { id: 'se_mid_2', x: 2.10, z: 5.10, w: 1.35, d: 1.45, h: 1.10, colorType: 'yellow_crate' },
            { id: 'se_mid_3', x: 5.55, z: 5.55, w: 1.75, d: 1.75, h: 1.25, colorType: 'blue_tall' },
            { id: 'se_out_1', x: 8.30, z: 4.70, w: 1.65, d: 1.35, h: 0.95, colorType: 'grey_tech' },
            { id: 'se_out_2', x: 4.70, z: 8.30, w: 1.35, d: 1.65, h: 0.95, colorType: 'white_cube' },
            { id: 'se_guard_diag', x: 8.95, z: 8.95, w: 1.60, d: 1.60, h: 1.20, colorType: 'yellow_crate' },
            { id: 'se_guard_e', x: 11.30, z: 8.70, w: 1.35, d: 1.25, h: 0.90, colorType: 'blue_grey_wall' },
            { id: 'se_guard_s', x: 8.70, z: 11.30, w: 1.25, d: 1.35, h: 0.90, colorType: 'blue_box' },

            { id: 'sw_mid_1', x: -5.10, z: 2.10, w: 1.45, d: 1.35, h: 1.10, colorType: 'grey_tech' },
            { id: 'sw_mid_2', x: -2.10, z: 5.10, w: 1.35, d: 1.45, h: 1.10, colorType: 'blue_box' },
            { id: 'sw_mid_3', x: -5.55, z: 5.55, w: 1.75, d: 1.75, h: 1.25, colorType: 'yellow_crate' },
            { id: 'sw_out_1', x: -8.30, z: 4.70, w: 1.65, d: 1.35, h: 0.95, colorType: 'blue_grey_wall' },
            { id: 'sw_out_2', x: -4.70, z: 8.30, w: 1.35, d: 1.65, h: 0.95, colorType: 'white_cube' },
            { id: 'sw_guard_diag', x: -8.95, z: 8.95, w: 1.60, d: 1.60, h: 1.20, colorType: 'blue_tall' },
            { id: 'sw_guard_w', x: -11.30, z: 8.70, w: 1.35, d: 1.25, h: 0.90, colorType: 'yellow_crate' },
            { id: 'sw_guard_s', x: -8.70, z: 11.30, w: 1.25, d: 1.35, h: 0.90, colorType: 'grey_tech' },

            { id: 'wall_n_outer', x: 0.0, z: -9.20, w: 2.40, d: 1.20, h: 1.15, colorType: 'blue_grey_wall' },
            { id: 'wall_s_outer', x: 0.0, z: 9.20, w: 2.40, d: 1.20, h: 1.15, colorType: 'blue_grey_wall' },
            { id: 'wall_e_outer', x: 9.20, z: 0.0, w: 1.20, d: 2.40, h: 1.15, colorType: 'grey_tech' },
            { id: 'wall_w_outer', x: -9.20, z: 0.0, w: 1.20, d: 2.40, h: 1.15, colorType: 'grey_tech' }
        ];

        this.populateArenaObstacleBoxes(defaultBoxes);

        this.scene.add(arenaGroup);
    }

    populateArenaObstacleBoxes(boxesList) {
        if (!this.obstacleBoxesGroup || !Array.isArray(boxesList)) return;
        while (this.obstacleBoxesGroup.children.length > 0) {
            this.obstacleBoxesGroup.remove(this.obstacleBoxesGroup.children[0]);
        }
        boxesList.forEach(b => {
            const boxMeshGroup = this.createColoredObstacleBox(b);
            this.obstacleBoxesGroup.add(boxMeshGroup);
        });
    }

    createColoredObstacleBox(b) {
        const grp = new THREE.Group();
        grp.position.set(b.x, b.h * 0.5, b.z);

        let mainColor = 0x2563eb;
        let seamColor = 0x1e3a8a;
        let hasGlowStrip = false;

        if (b.colorType === 'yellow_crate') {
            mainColor = 0xeab308;
            seamColor = 0xa16207;
        } else if (b.colorType === 'white_cube') {
            mainColor = 0xe2e8f0;
            seamColor = 0x94a3b8;
        } else if (b.colorType === 'grey_tech') {
            mainColor = 0x64748b;
            seamColor = 0x334155;
            hasGlowStrip = true;
        } else if (b.colorType === 'blue_grey_wall') {
            mainColor = 0x3b82f6;
            seamColor = 0x1e293b;
            hasGlowStrip = true;
        } else if (b.colorType === 'blue_box' || b.colorType === 'blue_tall') {
            mainColor = 0x2563eb;
            seamColor = 0x172554;
        }

        const boxGeo = new THREE.BoxGeometry(b.w, b.h, b.d);
        const boxMat = new THREE.MeshStandardMaterial({
            color: mainColor,
            roughness: 0.42,
            metalness: 0.12
        });
        const mesh = new THREE.Mesh(boxGeo, boxMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        grp.add(mesh);

        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        const edgesMat = new THREE.LineBasicMaterial({ color: seamColor });
        const wire = new THREE.LineSegments(edgesGeo, edgesMat);
        grp.add(wire);

        const seamMat = new THREE.MeshBasicMaterial({ color: seamColor });
        const hSeam = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.01, 0.02, b.d + 0.01), seamMat);
        const vSeamX = new THREE.Mesh(new THREE.BoxGeometry(0.02, b.h + 0.01, b.d + 0.01), seamMat);
        const vSeamZ = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.01, b.h + 0.01, 0.02), seamMat);
        grp.add(hSeam, vSeamX, vSeamZ);

        if (hasGlowStrip) {
            const glowMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                emissive: 0x0ea5e9,
                emissiveIntensity: 0.85
            });
            const glowBand = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.02, 0.04, b.d + 0.02), glowMat);
            glowBand.position.y = -b.h * 0.12;
            grp.add(glowBand);
        }

        return grp;
    }

    createTextSprite(text, colorHex = '#ffffff') {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(6, 6, 244, 52);
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, 244, 52);

        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = colorHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 33);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.15, 0.30, 1);
        return sprite;
    }

    /**
     * Bangun Bendera Merah Segitiga (Red Pennant Flag) yang Muncul di Sudut Random
     */
    buildTargetFlagMesh() {
        this.targetFlagGroup = new THREE.Group();

        const poleGeo = new THREE.CylinderGeometry(0.03, 0.035, 1.85, 14);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.35, roughness: 0.4 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 0.925;
        pole.castShadow = true;
        this.targetFlagGroup.add(pole);

        const flagShape = new THREE.Shape();
        flagShape.moveTo(0, 0);
        flagShape.lineTo(0.75, 0.21);
        flagShape.lineTo(0, 0.44);
        flagShape.closePath();

        const extrudeSettings = { depth: 0.025, bevelEnabled: false };
        const flagGeo = new THREE.ExtrudeGeometry(flagShape, extrudeSettings);
        const flagMat = new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0xdc2626,
            emissiveIntensity: 0.42,
            roughness: 0.35,
            side: THREE.DoubleSide
        });
        this.redPennantMesh = new THREE.Mesh(flagGeo, flagMat);
        this.redPennantMesh.position.set(0.02, 1.36, -0.012);
        this.redPennantMesh.castShadow = true;
        this.targetFlagGroup.add(this.redPennantMesh);

        const ringGeo = new THREE.RingGeometry(0.42, 0.65, 32);
        this.flagBeaconMat = new THREE.MeshBasicMaterial({
            color: 0xef4444,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });
        this.flagBeaconRing = new THREE.Mesh(ringGeo, this.flagBeaconMat);
        this.flagBeaconRing.rotation.x = -Math.PI / 2;
        this.flagBeaconRing.position.y = 0.02;
        this.targetFlagGroup.add(this.flagBeaconRing);

        const flagLabel = this.createTextSprite('🚩 TARGET BENDERA', '#f87171');
        flagLabel.position.set(0.20, 2.08, 0);
        flagLabel.scale.set(1.25, 0.32, 1);
        this.targetFlagGroup.add(flagLabel);

        this.targetFlagGroup.position.set(5.8, 0.04, -5.8);
        this.scene.add(this.targetFlagGroup);
    }

    /**
     * ========================================================================
     * BANGUN KARAKTER ROBOT HUMANOID SCI-FI (TANPA TANDA SALIB DI DADA/PUNGGUNG):
     * - Armor Putih Glossy (#f8fafc) + Rangka Sendi Karbon Hitam (#0f172a)
     * - Helm Putih Aerodinamis dengan Visor Hitam & Mata LED Biru Cyan (#38bdf8)
     * - Cincin LED Bulat di Telinga, Bahu, Siku, Lutut, Pergelangan Kaki, & Inti Bulat Dada
     * ========================================================================
     */
    buildHumanoidCharacter() {
        this.humanoidRoot = new THREE.Group();
        this.humanoidRoot.position.set(0, 0.95, 0);

        const armorWhiteMat = new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.22,
            metalness: 0.20
        });
        const carbonJointMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.42,
            metalness: 0.55
        });
        const darkMetalMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.35,
            metalness: 0.65
        });
        const royalBlueMat = new THREE.MeshStandardMaterial({
            color: 0x2563eb,
            emissive: 0x1d4ed8,
            emissiveIntensity: 0.30,
            roughness: 0.28
        });
        const neonCyanMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.95
        });

        this.chestCoreMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0ea5e9,
            emissiveIntensity: 0.95
        });

        this.footMatLeft = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85 });
        this.footMatRight = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.85 });

        // 1. GRUP PINGGUL & TORSO ARMOR ROBOT
        this.upperBodyGroup = new THREE.Group();
        this.humanoidRoot.add(this.upperBodyGroup);

        const pelvisCore = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.14, 0.31), carbonJointMat);
        this.upperBodyGroup.add(pelvisCore);

        const pelvisArmor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.34), armorWhiteMat);
        pelvisArmor.position.set(0, 0.01, 0);
        pelvisArmor.castShadow = true;
        this.upperBodyGroup.add(pelvisArmor);

        for (let seg = 0; seg < 3; seg++) {
            const spineSeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.115, 0.11, 0.048, 16),
                seg % 2 === 0 ? carbonJointMat : darkMetalMat
            );
            spineSeg.scale.set(0.88, 1.0, 1.18);
            spineSeg.position.set(0, 0.11 + seg * 0.055, 0);
            spineSeg.castShadow = true;
            this.upperBodyGroup.add(spineSeg);
        }

        // Torso Dada & Punggung Putih Bersih (Tanpa Garis Silang / Salib)
        const chestArmor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.40), armorWhiteMat);
        chestArmor.position.set(0, 0.40, 0);
        chestArmor.castShadow = true;
        this.upperBodyGroup.add(chestArmor);

        const shoulderPadL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.12), armorWhiteMat);
        shoulderPadL.position.set(0, 0.53, -0.18);
        shoulderPadL.rotation.x = 0.22;
        const shoulderPadR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.12), armorWhiteMat);
        shoulderPadR.position.set(0, 0.53, 0.18);
        shoulderPadR.rotation.x = -0.22;
        this.upperBodyGroup.add(shoulderPadL, shoulderPadR);

        // Indikator Lingkaran Cincin Bulat Sci-Fi di Dada & Punggung (Bukan Garis Silang)
        const frontCoreRing = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 12, 24), this.chestCoreMat);
        frontCoreRing.rotation.y = Math.PI / 2;
        frontCoreRing.position.set(0.142, 0.42, 0);
        this.upperBodyGroup.add(frontCoreRing);

        const backCoreRing = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 12, 24), this.chestCoreMat);
        backCoreRing.rotation.y = Math.PI / 2;
        backCoreRing.position.set(-0.142, 0.42, 0);
        this.upperBodyGroup.add(backCoreRing);

        // 2. LEHER MEKANIS & HELM ROBOT PUTIH
        const neckCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.05, 16), carbonJointMat);
        neckCollar.position.set(0, 0.56, 0);
        this.upperBodyGroup.add(neckCollar);

        const neckPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.10, 16), darkMetalMat);
        neckPiston.position.set(0, 0.61, 0);
        this.upperBodyGroup.add(neckPiston);

        this.headGroup = new THREE.Group();
        this.headGroup.position.set(0, 0.76, 0);

        const helmetDome = new THREE.Mesh(new THREE.SphereGeometry(0.155, 24, 24), armorWhiteMat);
        helmetDome.scale.set(1.08, 1.10, 0.96);
        helmetDome.castShadow = true;
        this.headGroup.add(helmetDome);

        const chinGuard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.22), armorWhiteMat);
        chinGuard.position.set(0.03, -0.07, 0);
        this.headGroup.add(chinGuard);

        const visorBlackMat = new THREE.MeshStandardMaterial({
            color: 0x050811,
            roughness: 0.08,
            metalness: 0.85
        });
        const visorShield = new THREE.Mesh(new THREE.SphereGeometry(0.148, 20, 20), visorBlackMat);
        visorShield.scale.set(1.05, 0.62, 0.92);
        visorShield.position.set(0.028, 0.01, 0);
        this.headGroup.add(visorShield);

        const eyeGeo = new THREE.BoxGeometry(0.02, 0.026, 0.048);
        const eyeL = new THREE.Mesh(eyeGeo, neonCyanMat);
        eyeL.position.set(0.168, 0.02, -0.055);
        const eyeR = new THREE.Mesh(eyeGeo, neonCyanMat);
        eyeR.position.set(0.168, 0.02, 0.055);
        this.headGroup.add(eyeL, eyeR);

        const rearHeadPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.075, 0.09), carbonJointMat);
        rearHeadPanel.position.set(-0.155, 0.02, 0);
        const rearHeadLed = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.055), neonCyanMat);
        rearHeadLed.position.set(-0.158, 0.02, 0);
        this.headGroup.add(rearHeadPanel, rearHeadLed);

        const earDiscGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.03, 16);
        const earRingGeo = new THREE.TorusGeometry(0.038, 0.007, 10, 24);

        const earPodL = new THREE.Mesh(earDiscGeo, darkMetalMat);
        earPodL.rotation.x = Math.PI / 2;
        earPodL.position.set(-0.01, 0.01, -0.148);
        const earRingL = new THREE.Mesh(earRingGeo, neonCyanMat);
        earRingL.position.set(-0.01, 0.01, -0.164);

        const earPodR = new THREE.Mesh(earDiscGeo, darkMetalMat);
        earPodR.rotation.x = Math.PI / 2;
        earPodR.position.set(-0.01, 0.01, 0.148);
        const earRingR = new THREE.Mesh(earRingGeo, neonCyanMat);
        earRingR.position.set(-0.01, 0.01, 0.164);

        this.headGroup.add(earPodL, earRingL, earPodR, earRingR);
        this.upperBodyGroup.add(this.headGroup);

        // 3. HALO INDIKATOR STATUS AI DI ATAS KEPALA ROBOT
        const haloGeo = new THREE.TorusGeometry(0.17, 0.014, 12, 32);
        this.balanceIndicatorMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        this.balanceHalo = new THREE.Mesh(haloGeo, this.balanceIndicatorMat);
        this.balanceHalo.rotation.x = Math.PI / 2;
        this.balanceHalo.position.set(0, 1.02, 0);
        this.upperBodyGroup.add(this.balanceHalo);

        // 4. LENGAN ROBOT KIRI & KANAN
        const leftArm = this.createDetailedRobotArm(armorWhiteMat, carbonJointMat, royalBlueMat, neonCyanMat, -1);
        this.leftArmGroup = leftArm.shoulderGroup;
        this.leftElbowGroup = leftArm.elbowGroup;
        this.leftArmGroup.position.set(0, 0.48, -0.245);
        this.upperBodyGroup.add(this.leftArmGroup);

        const rightArm = this.createDetailedRobotArm(armorWhiteMat, carbonJointMat, royalBlueMat, neonCyanMat, 1);
        this.rightArmGroup = rightArm.shoulderGroup;
        this.rightElbowGroup = rightArm.elbowGroup;
        this.rightArmGroup.position.set(0, 0.48, 0.245);
        this.upperBodyGroup.add(this.rightArmGroup);

        // 5. KAKI ROBOT KIRI & KANAN
        const leftLeg = this.createDetailedRobotLeg(armorWhiteMat, carbonJointMat, royalBlueMat, neonCyanMat, this.footMatLeft, -1);
        this.leftHipGroup = leftLeg.hipGroup;
        this.leftKneeGroup = leftLeg.kneeGroup;
        this.leftAnkleGroup = leftLeg.ankleGroup;
        this.leftHipGroup.position.set(0, -0.04, -0.12);
        this.humanoidRoot.add(this.leftHipGroup);

        const rightLeg = this.createDetailedRobotLeg(armorWhiteMat, carbonJointMat, royalBlueMat, neonCyanMat, this.footMatRight, 1);
        this.rightHipGroup = rightLeg.hipGroup;
        this.rightKneeGroup = rightLeg.kneeGroup;
        this.rightAnkleGroup = rightLeg.ankleGroup;
        this.rightHipGroup.position.set(0, -0.04, 0.12);
        this.humanoidRoot.add(this.rightHipGroup);

        // 6. GARIS LASER BIRU DI BAWAH KAKI ROBOT
        this.comRingMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });

        this.comFloorRing = new THREE.Group();
        const laserLineGeo = new THREE.PlaneGeometry(0.95, 0.045);
        const laserLine = new THREE.Mesh(laserLineGeo, this.comRingMat);
        laserLine.rotation.x = -Math.PI / 2;

        const outerGlowRing = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.30, 32), this.comRingMat);
        outerGlowRing.rotation.x = -Math.PI / 2;

        this.comFloorRing.add(laserLine, outerGlowRing);
        this.comFloorRing.position.set(0, 0.01, 0);
        this.scene.add(this.comFloorRing);

        this.scene.add(this.humanoidRoot);
    }

    createDetailedRobotArm(armorWhiteMat, carbonJointMat, royalBlueMat, neonCyanMat, sideSign) {
        const shoulderGroup = new THREE.Group();

        const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 16), carbonJointMat);
        shoulderBall.castShadow = true;
        shoulderGroup.add(shoulderBall);

        const shoulderLedRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 10, 24), neonCyanMat);
        shoulderLedRing.position.set(0, 0, sideSign * 0.055);
        shoulderGroup.add(shoulderLedRing);

        const upperArmArmor = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.048, 0.21, 16), armorWhiteMat);
        upperArmArmor.position.set(0, -0.13, 0);
        upperArmArmor.castShadow = true;
        shoulderGroup.add(upperArmArmor);

        const elbowGroup = new THREE.Group();
        elbowGroup.position.set(0, -0.25, 0);
        shoulderGroup.add(elbowGroup);

        const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 14), carbonJointMat);
        elbowGroup.add(elbowJoint);

        const elbowLedRing = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.007, 10, 20), neonCyanMat);
        elbowLedRing.position.set(0, 0, sideSign * 0.042);
        elbowGroup.add(elbowLedRing);

        const foreArmArmor = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.040, 0.21, 16), armorWhiteMat);
        foreArmArmor.position.set(0, -0.115, 0);
        foreArmArmor.castShadow = true;
        elbowGroup.add(foreArmArmor);

        const gauntletLed = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), neonCyanMat);
        gauntletLed.position.set(-0.042, -0.06, sideSign * 0.02);
        elbowGroup.add(gauntletLed);

        const wristCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.045, 14), royalBlueMat);
        wristCuff.position.set(0, -0.215, 0);
        elbowGroup.add(wristCuff);

        const handPalm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.038), carbonJointMat);
        handPalm.position.set(0.008, -0.26, 0);
        elbowGroup.add(handPalm);

        elbowGroup.rotation.z = 0.38;

        return { shoulderGroup, elbowGroup };
    }

    createDetailedRobotLeg(armorWhiteMat, carbonJointMat, royalBlueMat, neonCyanMat, sensorSoleMat, sideSign) {
        const hipGroup = new THREE.Group();

        const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), carbonJointMat);
        hipGroup.add(hipJoint);

        const thighArmor = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.38, 0.145), armorWhiteMat);
        thighArmor.position.set(0, -0.21, 0);
        thighArmor.castShadow = true;
        hipGroup.add(thighArmor);

        const thighSideLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.30, 0.152), carbonJointMat);
        thighSideLine.position.set(0, -0.21, 0);
        hipGroup.add(thighSideLine);

        const kneeGroup = new THREE.Group();
        kneeGroup.position.set(0, -0.44, 0);
        hipGroup.add(kneeGroup);

        const kneeCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.13, 16), carbonJointMat);
        kneeCyl.rotation.x = Math.PI / 2;
        kneeGroup.add(kneeCyl);

        const kneeLedRing = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.008, 10, 24), neonCyanMat);
        kneeLedRing.position.set(0, 0, sideSign * 0.068);
        kneeGroup.add(kneeLedRing);

        const shinArmor = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.36, 0.13), armorWhiteMat);
        shinArmor.position.set(0, -0.21, 0);
        shinArmor.castShadow = true;
        kneeGroup.add(shinArmor);

        const shinDamper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.34, 14), carbonJointMat);
        shinDamper.position.set(0.04, -0.21, 0);
        kneeGroup.add(shinDamper);

        const ankleGroup = new THREE.Group();
        ankleGroup.position.set(0, -0.42, 0);
        kneeGroup.add(ankleGroup);

        const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.050, 14, 14), carbonJointMat);
        ankleGroup.add(ankleJoint);

        const ankleLedRing = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 10, 20), neonCyanMat);
        ankleLedRing.position.set(0, 0, sideSign * 0.052);
        ankleGroup.add(ankleLedRing);

        const bootUpper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.072, 0.13), armorWhiteMat);
        bootUpper.position.set(0.05, -0.02, 0);
        bootUpper.castShadow = true;
        ankleGroup.add(bootUpper);

        const bootBlueTrim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.024, 0.136), royalBlueMat);
        bootBlueTrim.position.set(0.05, -0.042, 0);
        ankleGroup.add(bootBlueTrim);

        const bootSole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.026, 0.138), carbonJointMat);
        bootSole.position.set(0.05, -0.062, 0);
        ankleGroup.add(bootSole);

        const sensorGlowSole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.11), sensorSoleMat);
        sensorGlowSole.position.set(0.05, -0.072, 0);
        ankleGroup.add(sensorGlowSole);

        return { hipGroup, kneeGroup, ankleGroup };
    }

    spawnFootstepRipple(xPos, yPos, zPos, colorHex, maxScale = 1.0) {
        if (!this.scene) return;
        const geo = new THREE.RingGeometry(0.06, 0.14, 24);
        const mat = new THREE.MeshBasicMaterial({
            color: colorHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.88
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(xPos, yPos + 0.015, zPos);
        this.scene.add(mesh);
        this.footstepRipples.push({ mesh, scale: maxScale, opacity: 0.88 });
    }

    animateThree() {
        requestAnimationFrame(() => this.animateThree());
        if (!this.renderer || !this.scene || !this.camera) return;

        this.clockTime += 0.045;

        const lerp = 0.30;
        this.currentPose.x += (this.targetPose.x - this.currentPose.x) * lerp;
        this.currentPose.posX += ((this.targetPose.posX || 0) - this.currentPose.posX) * lerp;
        this.currentPose.posZ += ((this.targetPose.posZ || 0) - this.currentPose.posZ) * lerp;
        this.currentPose.y += (this.targetPose.y - this.currentPose.y) * lerp;

        let diffYaw = (this.targetPose.yaw || 0) - this.currentPose.yaw;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
        this.currentPose.yaw += diffYaw * lerp;

        this.currentPose.torsoAngle += (this.targetPose.torsoAngle - this.currentPose.torsoAngle) * lerp;
        this.currentPose.hipL += (this.targetPose.hipL - this.currentPose.hipL) * lerp;
        this.currentPose.hipR += (this.targetPose.hipR - this.currentPose.hipR) * lerp;
        this.currentPose.kneeL += (this.targetPose.kneeL - this.currentPose.kneeL) * lerp;
        this.currentPose.kneeR += (this.targetPose.kneeR - this.currentPose.kneeR) * lerp;
        this.currentPose.armL += (this.targetPose.armL - this.currentPose.armL) * lerp;
        this.currentPose.armR += (this.targetPose.armR - this.currentPose.armR) * lerp;

        if (this.targetFlagGroup) {
            const fx = typeof this.targetPose.flagX === 'number' ? this.targetPose.flagX : 5.8;
            const fz = typeof this.targetPose.flagZ === 'number' ? this.targetPose.flagZ : -5.8;
            const fy = typeof this.targetPose.flagY === 'number' ? this.targetPose.flagY : 0.04;
            this.targetFlagGroup.position.set(fx, fy, fz);

            if (this.redPennantMesh) {
                this.redPennantMesh.rotation.y = Math.sin(this.clockTime * 3.2) * 0.18;
            }
            if (this.flagBeaconRing) {
                const pulse = 1.0 + Math.sin(this.clockTime * 4.0) * 0.18;
                this.flagBeaconRing.scale.set(pulse, pulse, 1);
            }
        }

        this.cloudsList.forEach((c, idx) => {
            c.position.x += Math.sin(this.clockTime * 0.25 + idx) * 0.004;
        });

        if (this.humanoidRoot) {
            this.humanoidRoot.position.set(this.currentPose.posX, this.currentPose.y, this.currentPose.posZ);
            this.humanoidRoot.rotation.y = this.currentPose.yaw - Math.PI / 2;

            this.upperBodyGroup.rotation.z = -this.currentPose.torsoAngle;
            if (this.headGroup) {
                this.headGroup.rotation.z = this.currentPose.torsoAngle * 0.35;
            }

            this.leftHipGroup.rotation.z = this.currentPose.hipL;
            this.rightHipGroup.rotation.z = this.currentPose.hipR;
            this.leftKneeGroup.rotation.z = -this.currentPose.kneeL;
            this.rightKneeGroup.rotation.z = -this.currentPose.kneeR;

            if (this.leftAnkleGroup && this.rightAnkleGroup) {
                this.leftAnkleGroup.rotation.z = -(this.currentPose.hipL - this.currentPose.kneeL) * 0.65;
                this.rightAnkleGroup.rotation.z = -(this.currentPose.hipR - this.currentPose.kneeR) * 0.65;
            }

            this.leftArmGroup.rotation.z = this.currentPose.armL;
            this.rightArmGroup.rotation.z = this.currentPose.armR;
            if (this.leftElbowGroup && this.rightElbowGroup) {
                this.leftElbowGroup.rotation.z = Math.max(0.20, 0.45 + this.currentPose.armL * 0.50);
                this.rightElbowGroup.rotation.z = Math.max(0.20, 0.45 + this.currentPose.armR * 0.50);
            }

            if (this.comFloorRing) {
                this.comFloorRing.position.set(
                    this.currentPose.posX,
                    0.012,
                    this.currentPose.posZ
                );
                this.comFloorRing.rotation.y = this.currentPose.yaw - Math.PI / 2;
            }

            if (this.targetPose.footContactL && !this.prevFootContactL && !this.targetPose.fallen) {
                this.spawnFootstepRipple(this.currentPose.posX, 0, this.currentPose.posZ, 0x38bdf8, 1.0);
            }
            if (this.targetPose.footContactR && !this.prevFootContactR && !this.targetPose.fallen) {
                this.spawnFootstepRipple(this.currentPose.posX, 0, this.currentPose.posZ, 0x10b981, 1.0);
            }
            this.prevFootContactL = this.targetPose.footContactL;
            this.prevFootContactR = this.targetPose.footContactR;

            const absTilt = Math.abs(this.currentPose.torsoAngle);
            let statusHex = 0x38bdf8;
            let emissiveHex = 0x0ea5e9;
            if (this.targetPose.fallen) {
                statusHex = 0xef4444;
                emissiveHex = 0xdc2626;
            } else if (this.targetPose.reachedFinish) {
                statusHex = 0x22c55e;
                emissiveHex = 0x16a34a;
            } else if (absTilt > 0.28) {
                statusHex = 0xf59e0b;
                emissiveHex = 0xd97706;
            }
            this.chestCoreMat.color.setHex(statusHex);
            this.chestCoreMat.emissive.setHex(emissiveHex);
            this.balanceIndicatorMat.color.setHex(statusHex);
            if (this.comRingMat) this.comRingMat.color.setHex(statusHex);
        }

        for (let i = this.footstepRipples.length - 1; i >= 0; i--) {
            const rp = this.footstepRipples[i];
            rp.scale += 0.08;
            rp.opacity -= 0.035;
            rp.mesh.scale.set(rp.scale, rp.scale, 1);
            rp.mesh.material.opacity = Math.max(0, rp.opacity);
            if (rp.opacity <= 0) {
                this.scene.remove(rp.mesh);
                rp.mesh.geometry.dispose();
                rp.mesh.material.dispose();
                this.footstepRipples.splice(i, 1);
            }
        }

        const targetZoomFactor = 100.0 / Math.max(25, Math.min(300, this.zoomPercent));
        this.cameraZoom += (targetZoomFactor - this.cameraZoom) * 0.20;

        let lookAtX = this.currentPose.posX + this.panOffsetX;
        let lookAtY = this.currentPose.y + 0.15 + this.panOffsetY;
        let lookAtZ = this.currentPose.posZ;
        let camX, camY, camZ;

        if (this.cameraMode === 'side') {
            const radius = 4.2 * this.cameraZoom;
            camX = lookAtX + Math.cos(this.currentPose.yaw + this.orbitYawOffset) * radius;
            camY = Math.max(0.45, lookAtY + 0.55 * this.cameraZoom + this.orbitPitchOffset * 1.8);
            camZ = lookAtZ - Math.sin(this.currentPose.yaw + this.orbitYawOffset) * radius;
        } else if (this.cameraMode === 'front') {
            const radius = 3.8 * this.cameraZoom;
            camX = lookAtX + Math.sin(this.currentPose.yaw + this.orbitYawOffset) * radius;
            camY = Math.max(0.45, lookAtY + 0.65 * this.cameraZoom + this.orbitPitchOffset * 1.8);
            camZ = lookAtZ + Math.cos(this.currentPose.yaw + this.orbitYawOffset) * radius;
        } else if (this.cameraMode === 'overview') {
            lookAtX = 0.0 + this.panOffsetX;
            lookAtY = 0.5 + this.panOffsetY;
            lookAtZ = 0.0;
            const radius = 25.5 * this.cameraZoom;
            camX = Math.sin(this.orbitYawOffset + 0.6) * radius;
            camY = Math.max(2.5, 14.8 * this.cameraZoom + this.orbitPitchOffset * 5.5);
            camZ = Math.cos(this.orbitYawOffset + 0.6) * radius;
        } else {
            const radius = 3.85 * this.cameraZoom;
            const behindAngle = this.currentPose.yaw + Math.PI - 0.38 + this.orbitYawOffset;
            camX = lookAtX + Math.sin(behindAngle) * radius;
            camY = Math.max(0.35, lookAtY + (0.68 + this.orbitPitchOffset * 1.8) * this.cameraZoom);
            camZ = lookAtZ + Math.cos(behindAngle) * radius;

            lookAtX += Math.sin(this.currentPose.yaw) * 0.85;
            lookAtZ += Math.cos(this.currentPose.yaw) * 0.85;
        }

        this.camera.position.x += (camX - this.camera.position.x) * 0.18;
        this.camera.position.y += (camY - this.camera.position.y) * 0.18;
        this.camera.position.z += (camZ - this.camera.position.z) * 0.18;
        this.camera.lookAt(lookAtX, lookAtY, lookAtZ);

        this.renderer.render(this.scene, this.camera);
    }

    setZoomPercent(newPercent) {
        const clamped = Math.round(Math.max(35, Math.min(250, newPercent)));
        this.zoomPercent = clamped;
        const slider = document.getElementById('sliderZoom3D');
        if (slider) slider.value = clamped;
        this.setText('zoomPercentLabel', `${clamped}%`);
    }

    resetCameraAndZoom() {
        this.orbitYawOffset = 0.0;
        this.orbitPitchOffset = 0.0;
        this.panOffsetX = 0.0;
        this.panOffsetY = 0.0;
        this.setZoomPercent(100);
    }

    async toggleFullscreenPanel() {
        const panel = document.getElementById('simulationMainPanel');
        if (!panel) return;

        const isNativeFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        const isCssFs = panel.classList.contains('sim-panel-fullscreen');

        if (isNativeFs || isCssFs) {
            panel.classList.remove('sim-panel-fullscreen');
            if (isNativeFs) {
                try {
                    if (document.exitFullscreen) {
                        await document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        await document.webkitExitFullscreen();
                    }
                } catch (e) {}
            }
            this.syncFullscreenUI(false);
        } else {
            panel.classList.add('sim-panel-fullscreen');
            try {
                if (panel.requestFullscreen) {
                    await panel.requestFullscreen();
                } else if (panel.webkitRequestFullscreen) {
                    await panel.webkitRequestFullscreen();
                }
            } catch (e) {}
            this.syncFullscreenUI(true);
        }

        setTimeout(() => this.onWindowResize(), 50);
        setTimeout(() => this.onWindowResize(), 200);
    }

    syncFullscreenUI(isActive) {
        const btn = document.getElementById('btnToggleFullscreen');
        const icon = document.getElementById('iconFullscreen');
        const label = document.getElementById('labelFullscreen');
        if (btn) {
            btn.className = isActive
                ? 'btn btn-sm btn-warning text-dark fw-bold py-0 px-2 ms-1'
                : 'btn btn-sm btn-info text-dark fw-bold py-0 px-2 ms-1';
        }
        if (icon) {
            icon.className = isActive ? 'bi bi-fullscreen-exit me-1' : 'bi bi-arrows-fullscreen me-1';
        }
        if (label) {
            label.textContent = '';
        }
    }

    onWindowResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const w = this.container.clientWidth || 820;
        const h = this.container.clientHeight || 430;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    initLearningChart() {
        const ctx = document.getElementById('learningCurveChart');
        if (!ctx || typeof Chart === 'undefined') return;

        const labels = this.episodes.map(e => `Ep ${e.episode_number}`);
        const distData = this.episodes.map(e => parseFloat(e.distance_m));
        const rewData = this.episodes.map(e => parseFloat(e.total_reward));

        this.learningChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'bar',
                        label: 'Progress Rebut Bendera (10m = Tertangkap!)',
                        data: distData,
                        backgroundColor: 'rgba(56, 189, 248, 0.55)',
                        borderColor: '#38bdf8',
                        borderWidth: 1,
                        borderRadius: 4,
                        yAxisID: 'yDist'
                    },
                    {
                        type: 'line',
                        label: 'Total Reward DQN',
                        data: rewData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        borderWidth: 2.5,
                        pointRadius: 3,
                        tension: 0.3,
                        yAxisID: 'yRew'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1', font: { size: 11 } }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
                        grid: { color: 'rgba(148, 163, 184, 0.08)' }
                    },
                    yDist: {
                        type: 'linear',
                        position: 'left',
                        min: 0,
                        max: 11,
                        title: { display: true, text: 'Progress Bendera (0 - 10m)', color: '#38bdf8' },
                        ticks: { color: '#38bdf8' },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    },
                    yRew: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'Total Reward DQN', color: '#10b981' },
                        ticks: { color: '#10b981' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    initWebWorker() {
        const workerUrl = `${this.appPath}/public/assets/js/rl-walker-worker.js?v=${Date.now()}`;
        const tfUrl = `${this.appPath}/public/assets/vendor/tfjs/tf.min.js`;

        this.worker = new Worker(workerUrl);
        this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);

        const nextEpisodeNum = (this.episodes.length > 0)
            ? (Math.max(...this.episodes.map(ep => parseInt(ep.episode_number, 10))) + 1)
            : 1;

        this.worker.postMessage({
            cmd: 'INIT',
            tfScriptUrl: tfUrl,
            startEpisode: nextEpisodeNum,
            config: this.readCurrentConfigFromUI()
        });
    }

    handleWorkerMessage(data) {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'WORKER_READY': {
                const badge = document.getElementById('workerStatusBadge');
                if (badge) {
                    badge.className = 'badge bg-success-subtle text-success border border-success-subtle';
                    badge.innerHTML = `<i class="bi bi-cpu-fill me-1"></i>DQN Worker Aktif (${data.tfBackend.toUpperCase()})`;
                }
                if (Array.isArray(data.arenaBoxes)) {
                    this.populateArenaObstacleBoxes(data.arenaBoxes);
                }
                break;
            }

            case 'STATE_UPDATE': {
                this.targetPose = { ...data.walker };
                this.updateLiveTelemetryUI(data.walker, data.rl);
                break;
            }

            case 'EPISODE_COMPLETE': {
                const ep = data.episodeSummary;
                this.onEpisodeFinished(ep);
                break;
            }

            case 'BRAIN_RESET_DONE': {
                this.showToast('Otak DQN Direset', data.message, 'info');
                break;
            }

            case 'MODEL_LOADED': {
                this.showToast(
                    'Otak Robot Dimuat',
                    `Berhasil memuat "${data.model_name}" ke jaringan saraf DQN (Epsilon: ${Number(data.epsilon).toFixed(2)}).`,
                    'success'
                );
                break;
            }

            case 'MODEL_EXPORTED': {
                this.persistExportedModelToMySQL(data);
                break;
            }

            case 'WORKER_ERROR': {
                this.showToast('Peringatan Worker', data.message, 'danger');
                break;
            }
        }
    }

    updateLiveTelemetryUI(w, rl) {
        this.setText('hudEpisode', rl.episode);
        this.setText('hudDistance', `${w.x.toFixed(2)} / 10m`);
        this.setText('hudSpeed', `${w.vx.toFixed(2)} m/s`);
        this.setText('hudTorsoAngle', `${w.flagCornerCode || 'NE'} (${(w.currentFlagDist || 0).toFixed(1)}m)`);
        this.setText('hudEpsilon', `${(rl.epsilon * 100).toFixed(0)}%`);
        this.setText('hudLoss', rl.loss.toFixed(4));
        this.setText('hudStageBadge', rl.stageLabel);

        const progressPct = Math.min(100, Math.max(0, (w.x / 10.0) * 100));
        const trackBar = document.getElementById('hudTrackProgress');
        if (trackBar) {
            trackBar.style.width = `${progressPct.toFixed(1)}%`;
        }

        const pushBadge = document.getElementById('hudPushStatus');
        if (pushBadge) {
            if (w.pushLabel) {
                pushBadge.textContent = w.pushLabel;
                pushBadge.classList.remove('d-none');
            } else {
                pushBadge.classList.add('d-none');
            }
        }

        const s = rl.stateVector || [0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < 8; i++) {
            const val = s[i] || 0;
            const bar = document.getElementById(`stateBar_${i}`);
            const valEl = document.getElementById(`stateVal_${i}`);
            if (bar) {
                const pct = Math.min(100, Math.max(5, ((val + 1) / 2) * 100));
                bar.style.width = `${pct.toFixed(0)}%`;
            }
            if (valEl) {
                valEl.textContent = val >= 0 ? `+${val.toFixed(2)}` : val.toFixed(2);
            }
        }

        const footLBadge = document.getElementById('footSensorLeft');
        const footRBadge = document.getElementById('footSensorRight');
        if (footLBadge) {
            footLBadge.className = 'badge bg-success-subtle text-success border border-success-subtle';
            footLBadge.textContent = w.footContactL ? 'Kaki Kiri: Menapak' : 'Kaki Kiri: Melangkah';
        }
        if (footRBadge) {
            footRBadge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
            footRBadge.textContent = `Target: Bendera ${w.flagCornerCode || 'NE'}`;
        }

        this.setText('activeActionName', rl.actionLabel);
        const qVals = rl.qValues || [0, 0, 0, 0, 0, 0, 0];
        const minQ = Math.min(...qVals, -2);
        const maxQ = Math.max(...qVals, 2);
        const spanQ = Math.max(0.5, maxQ - minQ);

        for (let a = 0; a < 7; a++) {
            const q = qVals[a] || 0;
            const pct = Math.min(100, Math.max(6, ((q - minQ) / spanQ) * 100));
            const row = document.getElementById(`actionRow_${a}`);
            const bar = document.getElementById(`actionBar_${a}`);
            const txt = document.getElementById(`actionQ_${a}`);

            if (row) {
                row.className = (a === rl.action)
                    ? 'p-1 rounded bg-info bg-opacity-10 border border-info border-opacity-50 mb-1'
                    : 'p-1 rounded mb-1';
            }
            if (bar) {
                bar.style.width = `${pct.toFixed(0)}%`;
                bar.className = (a === rl.action) ? 'progress-bar bg-info' : 'progress-bar bg-secondary';
            }
            if (txt) {
                txt.textContent = q.toFixed(2);
            }
        }

        const rb = rl.rewardBreakdown || { forward: 0, upright: 0, gait: 0, torque: 0, terminal: 0 };
        this.setText('rewForward', (rb.forward >= 0 ? '+' : '') + rb.forward.toFixed(2));
        this.setText('rewUpright', (rb.upright >= 0 ? '+' : '') + rb.upright.toFixed(2));
        this.setText('rewGait', (rb.gait >= 0 ? '+' : '') + rb.gait.toFixed(2));
        this.setText('rewTorque', rb.torque.toFixed(2));
        this.setText('rewTotalEpisode', rl.totalReward.toFixed(2));
    }

    async onEpisodeFinished(ep) {
        if (ep.distance_m > this.bestDistanceRecord) {
            this.bestDistanceRecord = ep.distance_m;
        }

        this.episodes.push(ep);
        if (this.learningChart) {
            this.learningChart.data.labels.push(`Ep ${ep.episode_number}`);
            this.learningChart.data.datasets[0].data.push(ep.distance_m);
            this.learningChart.data.datasets[1].data.push(ep.total_reward);
            this.learningChart.update('none');
        }

        this.renderEpisodesTable();
        this.updateSessionSummaryCards();

        try {
            const response = await fetch(`${this.appPath}/landing/api/record_episode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.activeSession.id || 1,
                    ...ep
                })
            });
            const res = await response.json();
            if (res && res.success && res.session) {
                this.activeSession = res.session;
                this.updateSessionSummaryCards();
            }
        } catch (err) {
            console.warn('Gagal menyimpan log episode ke MySQL:', err);
        }
    }

    readCurrentConfigFromUI() {
        return {
            algorithm: this.getVal('selectAlgorithm', 'DQN'),
            learningRate: parseFloat(this.getVal('sliderLR', 0.0025)),
            gamma: parseFloat(this.getVal('sliderGamma', 0.98)),
            epsilonDecay: parseFloat(this.getVal('sliderEpsDecay', 0.89)),
            rewardForwardWeight: parseFloat(this.getVal('sliderRewForward', 5.5)),
            rewardUprightWeight: parseFloat(this.getVal('sliderRewUpright', 2.5)),
            rewardGaitWeight: parseFloat(this.getVal('sliderRewGait', 3.5)),
            penaltyFall: parseFloat(this.getVal('sliderPenFall', -45.0)),
            groundFriction: parseFloat(this.getVal('sliderFriction', 0.88)),
            gravity: parseFloat(this.getVal('sliderGravity', 9.81))
        };
    }

    bindUIEvents() {
        const btnStartPause = document.getElementById('btnStartPause');
        if (btnStartPause) {
            btnStartPause.addEventListener('click', () => {
                this.isTraining = !this.isTraining;
                if (this.isTraining) {
                    this.worker.postMessage({ cmd: 'START' });
                    btnStartPause.className = 'btn btn-warning fw-semibold px-3';
                    btnStartPause.innerHTML = '<i class="bi bi-pause-fill me-1"></i>Jeda Latihan';
                } else {
                    this.worker.postMessage({ cmd: 'PAUSE' });
                    btnStartPause.className = 'btn btn-emerald fw-semibold px-3';
                    btnStartPause.innerHTML = '<i class="bi bi-play-fill me-1"></i>Mulai Latih Robot DQN';
                }
            });
        }

        const btnStepOnce = document.getElementById('btnStepOnce');
        if (btnStepOnce) {
            btnStepOnce.addEventListener('click', () => {
                this.isTraining = false;
                if (btnStartPause) {
                    btnStartPause.className = 'btn btn-emerald fw-semibold px-3';
                    btnStartPause.innerHTML = '<i class="bi bi-play-fill me-1"></i>Mulai Latih Robot DQN';
                }
                this.worker.postMessage({ cmd: 'STEP_ONCE' });
            });
        }

        const btnResetEpisode = document.getElementById('btnResetEpisode');
        if (btnResetEpisode) {
            btnResetEpisode.addEventListener('click', () => {
                this.worker.postMessage({ cmd: 'RESET_EPISODE' });
            });
        }

        // Tombol Kemudi Pelatih Mahasiswa (Human-in-the-Loop Coaching)
        document.querySelectorAll('.btn-student-steer').forEach(btn => {
            btn.addEventListener('click', () => {
                const act = parseInt(btn.getAttribute('data-action'), 10);
                if (!isNaN(act)) {
                    this.worker.postMessage({ cmd: 'STUDENT_STEER', action: act });
                }
            });
        });

        // Keyboard WASD / Arrow Keys agar Mahasiswa Bisa Mengarahkan Robot Secara Langsung!
        window.addEventListener('keydown', (e) => {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

            if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.worker.postMessage({ cmd: 'STUDENT_STEER', action: 1 });
            } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
                e.preventDefault();
                this.worker.postMessage({ cmd: 'STUDENT_STEER', action: 4 });
            } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
                e.preventDefault();
                this.worker.postMessage({ cmd: 'STUDENT_STEER', action: 5 });
            } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
                e.preventDefault();
                this.worker.postMessage({ cmd: 'STUDENT_STEER', action: 6 });
            }
        });

        const btnShuffleFlag = document.getElementById('btnShuffleFlag');
        if (btnShuffleFlag) {
            btnShuffleFlag.addEventListener('click', () => {
                this.worker.postMessage({ cmd: 'SHUFFLE_FLAG_CORNER', cornerIndex: -1 });
                this.showToast('Bendera Diacak', 'Posisi bendera dipindahkan secara acak ke sudut arena baru!', 'info');
            });
        }

        const btnResetBrain = document.getElementById('btnResetBrain');
        if (btnResetBrain) {
            btnResetBrain.addEventListener('click', async () => {
                this.isTraining = false;
                if (btnStartPause) {
                    btnStartPause.className = 'btn btn-emerald fw-semibold px-3';
                    btnStartPause.innerHTML = '<i class="bi bi-play-fill me-1"></i>Mulai Latih Robot DQN';
                }
                this.worker.postMessage({ cmd: 'RESET_BRAIN' });

                try {
                    await fetch(`${this.appPath}/landing/api/clear_episodes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: this.activeSession.id || 1 })
                    });
                    this.episodes = [];
                    this.bestDistanceRecord = 0;
                    if (this.learningChart) {
                        this.learningChart.data.labels = [];
                        this.learningChart.data.datasets[0].data = [];
                        this.learningChart.data.datasets[1].data = [];
                        this.learningChart.update();
                    }
                    this.renderEpisodesTable();
                    this.updateSessionSummaryCards();
                } catch (e) {}
            });
        }

        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const spd = parseInt(btn.getAttribute('data-speed'), 10) || 1;
                this.worker.postMessage({ cmd: 'SET_SPEED', speed: spd });
            });
        });

        document.querySelectorAll('.cam-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.cameraMode = btn.getAttribute('data-cam') || 'follow';
                this.orbitYawOffset = 0;
                this.orbitPitchOffset = 0;
                this.panOffsetX = 0;
                this.panOffsetY = 0;
            });
        });

        const btnZoomIn = document.getElementById('btnZoomIn');
        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => {
                this.setZoomPercent(this.zoomPercent + 20);
            });
        }
        const btnZoomOut = document.getElementById('btnZoomOut');
        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => {
                this.setZoomPercent(this.zoomPercent - 20);
            });
        }
        const sliderZoom3D = document.getElementById('sliderZoom3D');
        if (sliderZoom3D) {
            sliderZoom3D.addEventListener('input', () => {
                this.setZoomPercent(parseFloat(sliderZoom3D.value) || 100);
            });
        }
        const btnZoomReset = document.getElementById('btnZoomReset');
        if (btnZoomReset) {
            btnZoomReset.addEventListener('click', () => {
                this.resetCameraAndZoom();
            });
        }
        const btnToggleFullscreen = document.getElementById('btnToggleFullscreen');
        if (btnToggleFullscreen) {
            btnToggleFullscreen.addEventListener('click', () => {
                this.toggleFullscreenPanel();
            });
        }

        const onFullscreenChange = () => {
            const panel = document.getElementById('simulationMainPanel');
            const isNativeFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
            if (!isNativeFs && panel && panel.classList.contains('sim-panel-fullscreen')) {
                panel.classList.remove('sim-panel-fullscreen');
                this.syncFullscreenUI(false);
            } else if (isNativeFs) {
                this.syncFullscreenUI(true);
            }
            setTimeout(() => this.onWindowResize(), 60);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);

        const btnPushForward = document.getElementById('btnPushForward');
        if (btnPushForward) {
            btnPushForward.addEventListener('click', () => {
                this.worker.postMessage({ cmd: 'APPLY_PUSH', force: 7.5 });
            });
        }

        document.querySelectorAll('.quick-skill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.getAttribute('data-model-code');
                const found = this.savedModels.find(m => m.model_code === code);
                if (found) {
                    this.loadSavedModelIntoWorker(found);
                } else {
                    const fallbackMode = code === 'MODEL_LVL0_RANDOM' ? 'untrained'
                        : (code === 'MODEL_LVL1_TODDLER' ? 'intermediate' : 'master');
                    this.worker.postMessage({
                        cmd: 'LOAD_MODEL',
                        model_name: btn.textContent.trim(),
                        trained_episodes: fallbackMode === 'master' ? 20 : (fallbackMode === 'intermediate' ? 8 : 0),
                        weights_json: JSON.stringify({ preset_mode: fallbackMode })
                    });
                }
            });
        });

        const selectPreset = document.getElementById('selectRewardPreset');
        if (selectPreset) {
            selectPreset.addEventListener('change', () => {
                const code = selectPreset.value;
                const preset = this.presets.find(p => p.preset_code === code);
                if (preset) {
                    this.applyPresetToSliders(preset);
                }
            });
        }

        const sliderIds = [
            ['sliderLR', 'valLR', ''],
            ['sliderGamma', 'valGamma', ''],
            ['sliderEpsDecay', 'valEpsDecay', ''],
            ['sliderRewForward', 'valRewForward', ''],
            ['sliderRewUpright', 'valRewUpright', ''],
            ['sliderRewGait', 'valRewGait', ''],
            ['sliderPenFall', 'valPenFall', ''],
            ['sliderFriction', 'valFriction', ''],
            ['sliderGravity', 'valGravity', ' m/s²']
        ];

        sliderIds.forEach(([sId, vId, suffix]) => {
            const el = document.getElementById(sId);
            if (el) {
                el.addEventListener('input', () => {
                    this.setText(vId, el.value + suffix);
                    this.worker.postMessage({
                        cmd: 'UPDATE_CONFIG',
                        config: this.readCurrentConfigFromUI()
                    });
                });
            }
        });

        const selectAlgo = document.getElementById('selectAlgorithm');
        if (selectAlgo) {
            selectAlgo.addEventListener('change', () => {
                this.worker.postMessage({
                    cmd: 'UPDATE_CONFIG',
                    config: this.readCurrentConfigFromUI()
                });
            });
        }

        const btnSavePresetDb = document.getElementById('btnSavePresetDb');
        if (btnSavePresetDb) {
            btnSavePresetDb.addEventListener('click', async () => {
                const cfg = this.readCurrentConfigFromUI();
                const presetCode = this.getVal('selectRewardPreset', 'standar_seimbang');
                try {
                    const resp = await fetch(`${this.appPath}/landing/api/update_preset`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            preset_code: presetCode,
                            learning_rate: cfg.learningRate,
                            gamma: cfg.gamma,
                            reward_forward_weight: cfg.rewardForwardWeight,
                            reward_upright_weight: cfg.rewardUprightWeight,
                            reward_gait_weight: cfg.rewardGaitWeight,
                            penalty_fall: cfg.penaltyFall,
                            ground_friction: cfg.groundFriction,
                            gravity: cfg.gravity
                        })
                    });
                    const res = await resp.json();
                    if (res.success) {
                        this.presets = res.presets || this.presets;
                        this.showToast('Tersimpan di MySQL', `Konfigurasi reward "${presetCode}" berhasil diperbarui di database db_robot_agent.`, 'success');
                    }
                } catch (e) {
                    this.showToast('Gagal Menyimpan', 'Tidak dapat menghubungi server database.', 'danger');
                }
            });
        }

        const btnSaveModelDb = document.getElementById('btnSaveModelDb');
        if (btnSaveModelDb) {
            btnSaveModelDb.addEventListener('click', () => {
                this.worker.postMessage({ cmd: 'EXPORT_MODEL' });
            });
        }

        const btnSubmitLeaderboard = document.getElementById('btnSubmitLeaderboard');
        if (btnSubmitLeaderboard) {
            btnSubmitLeaderboard.addEventListener('click', () => {
                this.submitCurrentScoreToLeaderboard();
            });
        }
    }

    applyPresetToSliders(p) {
        const setSlider = (id, labelId, val, suffix = '') => {
            const el = document.getElementById(id);
            if (el) el.value = val;
            this.setText(labelId, val + suffix);
        };

        const algoEl = document.getElementById('selectAlgorithm');
        if (algoEl && p.algorithm) algoEl.value = p.algorithm;

        setSlider('sliderLR', 'valLR', p.learning_rate);
        setSlider('sliderGamma', 'valGamma', p.gamma);
        setSlider('sliderEpsDecay', 'valEpsDecay', p.epsilon_decay);
        setSlider('sliderRewForward', 'valRewForward', p.reward_forward_weight);
        setSlider('sliderRewUpright', 'valRewUpright', p.reward_upright_weight);
        setSlider('sliderRewGait', 'valRewGait', p.reward_gait_weight);
        setSlider('sliderPenFall', 'valPenFall', p.penalty_fall);
        setSlider('sliderFriction', 'valFriction', p.ground_friction);
        setSlider('sliderGravity', 'valGravity', p.gravity, ' m/s²');

        const descEl = document.getElementById('presetDescriptionText');
        if (descEl) descEl.textContent = p.description || '';

        this.worker.postMessage({
            cmd: 'UPDATE_CONFIG',
            config: this.readCurrentConfigFromUI()
        });
        this.showToast('Preset Kompetisi Diterapkan', `Mengaktifkan "${p.preset_name}"`, 'info');
    }

    async persistExportedModelToMySQL(exportData) {
        const nameInput = document.getElementById('inputModelName');
        const notesInput = document.getElementById('inputModelNotes');
        const modelName = (nameInput && nameInput.value.trim())
            ? nameInput.value.trim()
            : `Robot DQN Mahasiswa (Episode ${exportData.episode})`;
        const notes = (notesInput && notesInput.value.trim())
            ? notesInput.value.trim()
            : 'Bobot jaringan saraf DQN disimpan dari simulasi Kompetisi Robot Catch the Flag.';

        const bestRew = this.episodes.length > 0
            ? Math.max(...this.episodes.map(e => parseFloat(e.total_reward || 0)))
            : 0;

        try {
            const resp = await fetch(`${this.appPath}/landing/api/save_model`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_name: modelName,
                    algorithm: this.getVal('selectAlgorithm', 'DQN'),
                    trained_episodes: exportData.episode,
                    best_distance_m: this.bestDistanceRecord,
                    best_reward: bestRew,
                    architecture_json: exportData.architecture_json,
                    weights_json: exportData.weights_json,
                    notes: notes
                })
            });
            const res = await resp.json();
            if (res.success) {
                this.savedModels = res.models || this.savedModels;
                this.renderModelsList();
                if (nameInput) nameInput.value = '';
                this.showToast('Model Tersimpan di MySQL', `Otak Robot "${modelName}" berhasil disimpan ke tabel saved_models (db_robot_agent).`, 'success');
            }
        } catch (err) {
            this.showToast('Gagal Menyimpan Model', err.message, 'danger');
        }
    }

    async submitCurrentScoreToLeaderboard() {
        const studentName = this.getVal('inputStudentName', '').trim() || 'Mahasiswa Peserta AI';
        const studentNim = this.getVal('inputStudentNim', '').trim() || '-';
        const modelName = this.getVal('inputCompModelName', '').trim() || 'RoboFlag-DQN-Agent';

        const totalEp = Math.max(1, this.episodes.length);
        const winEpisodes = this.episodes.filter(e => parseInt(e.reached_finish, 10) === 1);
        const flagsCaptured = winEpisodes.length;
        const fastestSec = winEpisodes.length > 0
            ? Math.min(...winEpisodes.map(e => parseFloat(e.duration_sec || 9.99)))
            : 9.99;
        const bestRew = this.episodes.length > 0
            ? Math.max(...this.episodes.map(e => parseFloat(e.total_reward || 0)))
            : 0;

        const compScore = Math.max(
            50,
            flagsCaptured * 85 + Math.max(0, bestRew * 1.4) + Math.max(0, (12 - fastestSec) * 25)
        ).toFixed(1);

        try {
            const resp = await fetch(`${this.appPath}/landing/api/submit_leaderboard`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_name: studentName,
                    student_nim: studentNim,
                    model_name: modelName,
                    algorithm: this.getVal('selectAlgorithm', 'DQN'),
                    episodes_trained: totalEp,
                    flags_captured: flagsCaptured,
                    fastest_capture_sec: fastestSec,
                    jump_success_count: flagsCaptured * 2,
                    competition_score: compScore,
                    corner_mastery: flagsCaptured >= 4 ? '4/4 Sudut Arena' : `${Math.min(4, Math.max(1, flagsCaptured))}/4 Sudut Arena`
                })
            });
            const res = await resp.json();
            if (res && res.success) {
                this.leaderboard = res.leaderboard || this.leaderboard;
                this.renderLeaderboardTable();
                this.showToast(
                    'Skor Kompetisi Tercatat!',
                    `Selamat ${studentName}! Skor kompetisi Anda (${compScore} Poin | ${flagsCaptured}x Bendera) tersimpan di db_robot_agent.`,
                    'success'
                );
            }
        } catch (err) {
            this.showToast('Gagal Simpan Skor', err.message, 'danger');
        }
    }

    renderLeaderboardTable() {
        const tbody = document.getElementById('leaderboardTableBody');
        if (!tbody) return;

        if (!this.leaderboard || this.leaderboard.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-3">Belum ada skor kompetisi tercatat.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.leaderboard.map((row, idx) => {
            const rankBadge = idx === 0 ? '🥇 1' : (idx === 1 ? '🥈 2' : (idx === 2 ? '🥉 3' : `#${idx + 1}`));
            return `
                <tr>
                    <td class="fw-bold text-warning">${rankBadge}</td>
                    <td>
                        <div class="fw-semibold text-white">${this.escapeHtml(row.student_name)}</div>
                        <div class="text-secondary" style="font-size: 0.68rem;">NIM: ${this.escapeHtml(row.student_nim)} &bull; ${this.escapeHtml(row.model_name)}</div>
                    </td>
                    <td class="text-emerald fw-bold">${row.flags_captured}x 🚩</td>
                    <td class="text-info">${parseFloat(row.fastest_capture_sec).toFixed(2)}s</td>
                    <td>${row.episodes_trained} Ep</td>
                    <td class="fw-bold text-warning">${parseFloat(row.competition_score).toFixed(1)}</td>
                </tr>
            `;
        }).join('');
    }

    loadSavedModelIntoWorker(modelRow) {
        if (!modelRow) return;
        this.worker.postMessage({
            cmd: 'LOAD_MODEL',
            model_name: modelRow.model_name,
            trained_episodes: parseInt(modelRow.trained_episodes, 10) || 1,
            weights_json: modelRow.weights_json
        });
    }

    renderEpisodesTable() {
        const tbody = document.getElementById('episodeLogsTableBody');
        if (!tbody) return;

        if (!this.episodes || this.episodes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-secondary py-3">Belum ada episode tercatat. Klik <strong>Mulai Latih Robot DQN</strong> untuk memulai kompetisi!</td></tr>`;
            return;
        }

        const recent = [...this.episodes].reverse().slice(0, 35);
        tbody.innerHTML = recent.map(ep => {
            const isFinish = parseInt(ep.reached_finish, 10) === 1;
            const badgeClass = isFinish
                ? 'badge bg-success-subtle text-success border border-success-subtle'
                : 'badge bg-danger-subtle text-danger border border-danger-subtle';
            const dist = parseFloat(ep.distance_m).toFixed(2);
            const rew = parseFloat(ep.total_reward).toFixed(1);
            const eps = (parseFloat(ep.epsilon) * 100).toFixed(0);
            return `
                <tr>
                    <td class="fw-bold text-info">#${ep.episode_number}</td>
                    <td><span class="fw-semibold text-white">${dist}m</span></td>
                    <td class="${parseFloat(ep.total_reward) >= 0 ? 'text-emerald' : 'text-danger'} fw-semibold">${rew}</td>
                    <td>${ep.steps_count} (${parseFloat(ep.duration_sec || 0).toFixed(1)}s)</td>
                    <td>${eps}%</td>
                    <td><span class="${badgeClass}">${this.escapeHtml(ep.termination_reason)}</span></td>
                    <td class="small text-secondary">${this.escapeHtml(ep.stage_label || '')}</td>
                </tr>
            `;
        }).join('');
    }

    renderModelsList() {
        const container = document.getElementById('savedModelsListContainer');
        if (!container) return;

        if (!this.savedModels || this.savedModels.length === 0) {
            container.innerHTML = `<div class="text-secondary small text-center py-3">Belum ada model tersimpan.</div>`;
            return;
        }

        container.innerHTML = this.savedModels.map(m => {
            const isBuiltin = parseInt(m.is_builtin, 10) === 1;
            return `
                <div class="p-2 rounded border border-secondary border-opacity-25 bg-dark bg-opacity-50 mb-2 d-flex align-items-center justify-content-between gap-2">
                    <div class="overflow-hidden">
                        <div class="fw-semibold text-white small text-truncate">${this.escapeHtml(m.model_name)}</div>
                        <div class="text-secondary" style="font-size: 0.73rem;">
                            <span class="badge bg-info-subtle text-info me-1">${this.escapeHtml(m.algorithm)}</span>
                            Ep: <strong>${m.trained_episodes}</strong> | Progress: <strong>${parseFloat(m.best_distance_m).toFixed(2)}/10m</strong>
                        </div>
                        <div class="text-secondary text-truncate" style="font-size: 0.71rem;">${this.escapeHtml(m.notes || '')}</div>
                    </div>
                    <div class="d-flex gap-1 flex-shrink-0">
                        <button type="button" class="btn btn-sm btn-outline-info py-1 px-2 btn-load-model" data-id="${m.id}" title="Muat Otak Robot Ini">
                            <i class="bi bi-upload me-1"></i>Muat
                        </button>
                        ${!isBuiltin ? `
                        <button type="button" class="btn btn-sm btn-outline-danger py-1 px-2 btn-del-model" data-id="${m.id}" title="Hapus Model">
                            <i class="bi bi-trash"></i>
                        </button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.btn-load-model').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.getAttribute('data-id'), 10);
                const found = this.savedModels.find(x => parseInt(x.id, 10) === id);
                if (found) this.loadSavedModelIntoWorker(found);
            });
        });

        container.querySelectorAll('.btn-del-model').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'), 10);
                try {
                    const resp = await fetch(`${this.appPath}/landing/api/delete_model`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model_id: id })
                    });
                    const res = await resp.json();
                    if (res.success) {
                        this.savedModels = res.models || [];
                        this.renderModelsList();
                    }
                } catch (e) {}
            });
        });
    }

    updateSessionSummaryCards() {
        const totalEp = this.episodes.length;
        const winEpisodes = this.episodes.filter(e => parseInt(e.reached_finish, 10) === 1);
        const finishCount = winEpisodes.length;
        const fastestSec = winEpisodes.length > 0
            ? Math.min(...winEpisodes.map(e => parseFloat(e.duration_sec || 9.99)))
            : 0;
        const bestRew = totalEp > 0
            ? Math.max(...this.episodes.map(e => parseFloat(e.total_reward || 0)))
            : 0;
        const compScore = totalEp > 0
            ? Math.max(0, finishCount * 85 + Math.max(0, bestRew * 1.4)).toFixed(0)
            : 0;

        this.setText('kpiTotalEpisodes', totalEp);
        this.setText('kpiBestDistance', finishCount > 0 ? `${fastestSec.toFixed(2)} dtk` : `${this.bestDistanceRecord.toFixed(1)}/10m`);
        this.setText('kpiAvgDistance', `${compScore} Poin`);
        this.setText('kpiFinishCount', `${finishCount}x Bendera`);
    }

    setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    getVal(id, fallback) {
        const el = document.getElementById(id);
        return el ? el.value : fallback;
    }

    escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    showToast(title, message, type = 'info') {
        const box = document.getElementById('liveNotificationBanner');
        if (!box) return;
        const colorMap = {
            success: 'border-success text-success bg-success',
            danger: 'border-danger text-danger bg-danger',
            info: 'border-info text-info bg-info'
        };
        const cls = colorMap[type] || colorMap.info;
        box.className = `alert bg-opacity-10 border ${cls} py-2 px-3 mb-2 d-flex align-items-center justify-content-between small`;
        box.innerHTML = `<div><strong class="me-2">${this.escapeHtml(title)}:</strong><span class="text-light">${this.escapeHtml(message)}</span></div>`;
        box.classList.remove('d-none');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (window.BALANCE_AI_BOOT_DATA) {
        window.walkerLabApp = new BipedalWalkerLabApp(window.BALANCE_AI_BOOT_DATA);
    }
});
