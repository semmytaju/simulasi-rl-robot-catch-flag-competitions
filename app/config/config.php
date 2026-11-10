<?php
/**
 * Konfigurasi Utama Aplikasi - RoboFlag AI
 * Simulasi Reinforcement Learning: simulasi Robot catch the flag competition (DQN)
 * Stack: PHP 8+, MySQL (db_robot_agent), HTML5, CSS3, JS ES6+, Three.js, TensorFlow.js, Web Workers
 */

if (!defined('APP_PATH')) {
    if (php_sapi_name() === 'cli' || empty($_SERVER['HTTP_HOST'])) {
        $folderName = basename(dirname(__DIR__, 2));
        define("APP_PATH", "http://localhost/" . $folderName);
    } else {
        $is_https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
        $protocol = $is_https ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'];
        $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
        $cleanDir = preg_replace('#/public$#', '', $scriptDir);
        define("APP_PATH", $protocol . $host . $cleanDir);
    }
}

if (!defined('BASEPATH')) {
    define('BASEPATH', dirname(__DIR__, 2));
}

define("HOST_DB", "localhost");
define("NAME_DB", "db_robot_agent");
define("USER_DB", "root");
define("PASS_DB", "");

define("APP_NAME", "RoboFlag AI — Kompetisi RL Robot Catch the Flag (DQN)");
define("APP_SHORT_NAME", "RoboFlag AI");
define("APP_DESC", "Simulasi Kompetisi Mahasiswa Reinforcement Learning (DQN): Robot 3D Catch the Flag, Lompat Box Penghalang & Arena 4 Sudut Random");
define("APP_VERSION", "3.0.0");
define("APP_AUTHOR", "Laboratorium Kecerdasan Buatan & Robotika");

define('APP_ENC_KEY', hash('sha256', 'ROBOFLAG_AI_RL_CTF_SECRET_KEY_2026', true));
define('APP_BIDX_KEY', hash('sha256', 'ROBOFLAG_AI_RL_CTF_BLIND_INDEX_2026', true));
