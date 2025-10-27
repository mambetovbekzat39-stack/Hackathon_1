<?php
header('Content-Type: text/plain; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Устанавливаем временную зону
date_default_timezone_set('Europe/Moscow');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Получаем данные
    $input = file_get_contents('php://input');
    parse_str($input, $data);
    
    if (isset($data['data'])) {
        $jsonData = json_decode($data['data'], true);
        
        if ($jsonData) {
            $command = $jsonData['command'];
            $clientTimestamp = $jsonData['client_timestamp'];
            $preciseTime = $jsonData['precise_time'];
            $clientTimeMillis = $jsonData['client_time_millis'];
            $timezone = $jsonData['timezone'];
            
            // Реальное время сервера
            $serverTime = time();
            $serverMicrotime = microtime(true);
            $serverDateTime = date('Y-m-d H:i:s');
            $serverDateTimeWithMicro = date('Y-m-d H:i:s') . '.' . sprintf("%06d", ($serverMicrotime - floor($serverMicrotime)) * 1000000);
            
            $log_file = 'voice_commands.log';
            
            // Формируем запись лога
            $log_entry = "=== ГОЛОСОВАЯ КОМАНДА ===\n";
            $log_entry .= "СЕРВЕРНОЕ ВРЕМЯ:\n";
            $log_entry .= "  Дата и время: " . $serverDateTime . "\n";
            $log_entry .= "  Точное время: " . $serverDateTimeWithMicro . "\n";
            $log_entry .= "  Timestamp: " . $serverTime . "\n";
            $log_entry .= "  Микросекунды: " . $serverMicrotime . "\n";
            $log_entry .= "  Таймзона: Europe/Moscow\n\n";
            
            $log_entry .= "КЛИЕНТСКОЕ ВРЕМЯ:\n";
            $log_entry .= "  Время клиента: " . $clientTimestamp . "\n";
            $log_entry .= "  Точное время: " . $preciseTime . "\n";
            $log_entry .= "  Milliseconds: " . $clientTimeMillis . "\n";
            $log_entry .= "  Таймзона: " . $timezone . "\n\n";
            
            $log_entry .= "ИНФОРМАЦИЯ О КОМАНДЕ:\n";
            $log_entry .= "  Команда: " . $command . "\n";
            $log_entry .= "  IP адрес: " . $_SERVER['REMOTE_ADDR'] . "\n";
            $log_entry .= "  User Agent: " . ($_SERVER['HTTP_USER_AGENT'] ?? 'неизвестно') . "\n";
            $log_entry .= "=== КОНЕЦ ЗАПИСИ ===\n\n";
            
            // Сохраняем в файл
            if (file_put_contents($log_file, $log_entry, FILE_APPEND | LOCK_EX)) {
                // Также выводим в консоль сервера
                error_log("VOICE: '$command' from {$_SERVER['REMOTE_ADDR']} at $serverDateTime");
                
                echo "OK: Команда получена и сохранена. Серверное время: $serverDateTime";
            } else {
                http_response_code(500);
                echo "ERROR: Не удалось сохранить команду";
            }
        } else {
            http_response_code(400);
            echo "ERROR: Неверный формат данных";
        }
    } else {
        http_response_code(400);
        echo "ERROR: Нет данных";
    }
} else {
    http_response_code(405);
    echo "ERROR: Разрешен только POST метод";
}
?>