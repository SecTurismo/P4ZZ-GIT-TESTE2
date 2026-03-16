<?php
/**
 * API Bridge for P4ZZ SYSTEM
 * Este arquivo processa as requisições do sistema e salva no banco de dados MySQL.
 */

// Configurações de Cabeçalho para CORS e JSON
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Se for acesso direto via URL (GET sem parâmetros ou ação inválida), finge que não existe (404)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && (!isset($_GET['action']) || empty($_GET['action']))) {
    header("HTTP/1.1 404 Not Found");
    echo "<html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>";
    exit;
}

header("Content-Type: application/json; charset=UTF-8");

// Se for uma requisição OPTIONS (pre-flight), encerra aqui
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit;
}

// --- CONFIGURAÇÕES DO BANCO DE DATOS ---
// Edite estas informações com os dados da sua HostGator
$host     = 'localhost';
$db_name  = 'nome_do_banco';
$username = 'usuario_db';
$password = 'senha_db';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db_name;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Cria a tabela de dados se não existir
    $pdo->exec("CREATE TABLE IF NOT EXISTS system_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id VARCHAR(50) NOT NULL,
        data_key VARCHAR(100) NOT NULL,
        data_value LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY tenant_key (tenant_id, data_key)
    )");

    // Cria a tabela de usuários se não existir
    $pdo->exec("CREATE TABLE IF NOT EXISTS system_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )");

} catch (PDOException $e) {
    echo json_encode(["error" => "Falha na conexão: " . $e->getMessage()]);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$tenant = isset($_GET['tenant']) ? $_GET['tenant'] : 'MASTER';
$key    = isset($_GET['key']) ? $_GET['key'] : '';

switch ($action) {
    case 'get':
        if (empty($key)) {
            echo json_encode(null);
            break;
        }
        $stmt = $pdo->prepare("SELECT data_value FROM system_data WHERE tenant_id = ? AND data_key = ?");
        $stmt->execute([$tenant, $key]);
        $row = $stmt->fetch();
        echo $row ? $row['data_value'] : json_encode(null);
        break;

    case 'set':
        $input = file_get_contents('php://input');
        if (empty($key) || empty($input)) {
            echo json_encode(["success" => false, "message" => "Dados inválidos"]);
            break;
        }
        $stmt = $pdo->prepare("INSERT INTO system_data (tenant_id, data_key, data_value) 
                               VALUES (?, ?, ?) 
                               ON DUPLICATE KEY UPDATE data_value = VALUES(data_value)");
        $success = $stmt->execute([$tenant, $key, $input]);
        echo json_encode(["success" => $success]);
        break;

    case 'get_users':
        $stmt = $pdo->query("SELECT data FROM system_users ORDER BY id DESC LIMIT 1");
        $row = $stmt->fetch();
        echo $row ? $row['data'] : json_encode([]);
        break;

    case 'get_pdf':
        $stmt = $pdo->prepare("SELECT data_value FROM system_data WHERE tenant_id = ? AND data_key = ?");
        $stmt->execute([$tenant, 'settings_' . $tenant]);
        $row = $stmt->fetch();
        if ($row) {
            $settings = json_decode($row['data_value'], true);
            if (isset($settings['qrCodeMenuPdf']) && !empty($settings['qrCodeMenuPdf'])) {
                $data = $settings['qrCodeMenuPdf'];
                if (preg_match('/^data:application\/pdf;base64,(.*)$/', $data, $matches)) {
                    header("Content-Type: application/pdf");
                    header("Content-Disposition: inline; filename=\"cardapio.pdf\"");
                    echo base64_decode($matches[1]);
                    exit;
                }
            }
        }
        header("HTTP/1.1 404 Not Found");
        echo "PDF não encontrado.";
        break;

    case 'redirect_master':
        $stmt = $pdo->prepare("SELECT data_value FROM system_data WHERE tenant_id = ? AND data_key = ?");
        $stmt->execute(['MASTER', 'settings_MASTER']);
        $row = $stmt->fetch();
        if ($row) {
            $settings = json_decode($row['data_value'], true);
            $url = isset($settings['qrCodeMasterUrl']) ? $settings['qrCodeMasterUrl'] : '';
            $expiration = isset($settings['qrCodeMasterExpiration']) ? $settings['qrCodeMasterExpiration'] : 'none';
            
            if (!empty($url)) {
                header("Location: " . $url);
                exit;
            }
        }
        echo "URL não configurada ou QR Code expirado.";
        break;

    case 'go':
        $stmt = $pdo->prepare("SELECT data_value FROM system_data WHERE tenant_id = ? AND data_key = ?");
        $stmt->execute([$tenant, 'settings_' . $tenant]);
        $row = $stmt->fetch();
        if ($row) {
            $settings = json_decode($row['data_value'], true);
            $type = isset($settings['qrRedirectType']) ? $settings['qrRedirectType'] : 'pdf';
            $url = isset($settings['qrRedirectUrl']) ? $settings['qrRedirectUrl'] : '';
            
            if ($type === 'url' && !empty($url)) {
                header("Location: " . $url);
                exit;
            } else if ($type === 'pdf') {
                // Redireciona para a ação get_pdf
                header("Location: api.php?action=get_pdf&tenant=" . $tenant);
                exit;
            }
        }
        echo "Redirecionamento não configurado.";
        break;

    case 'save_users':
        $input = file_get_contents('php://input');
        if (empty($input)) {
            echo json_encode(["success" => false]);
            break;
        }
        // Limpa tabela e insere o novo estado (ou apenas insere um novo registro de log)
        $pdo->exec("DELETE FROM system_users");
        $stmt = $pdo->prepare("INSERT INTO system_users (data) VALUES (?)");
        $success = $stmt->execute([$input]);
        echo json_encode(["success" => $success]);
        break;

    default:
        header("HTTP/1.1 404 Not Found");
        echo "<html><head><title>404 Not Found</title></head><body><h1>Not Found</h1><p>The requested URL was not found on this server.</p></body></html>";
        exit;
        break;
}
