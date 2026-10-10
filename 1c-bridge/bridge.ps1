# ==============================================================================
# Шлюз синхронизации «ДомофонДар» - 1С:Предприятие 8.3
# Версия: 1.0.0
# Назначение: Автономный обмен данными между сайтом/приложением и информационной базой 1С
# ==============================================================================

param (
    [string]$Mode = "continuous" # Режимы: "test" (проверка), "once" (один прогон), "continuous" (постоянная работа)
)

# Устанавливаем кодировку UTF-8 для корректного вывода русских символов
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Включение современных протоколов шифрования TLS 1.2 / TLS 1.3 и доверия к SSL-сертификатам
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11 -bor [Net.SecurityProtocolType]::Tls
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { True }

$OutputEncoding = [System.Text.Encoding]::UTF8

# Определение директории расположения скрипта
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Путь к конфигурационному файлу
$ConfigFile = Join-Path $ScriptDir "config.json"

# Проверка наличия файла конфигурации
if (-not (Test-Path $ConfigFile)) {
    Write-Host "[ОШИБКА] Файл конфигурации config.json не найден в директории: $ScriptDir" -ForegroundColor Red
    exit 1
}

# Чтение и разбор JSON-конфигурации
try {
    $ConfigJson = Get-Content $ConfigFile -Raw -Encoding UTF8
    $Config = ConvertFrom-Json $ConfigJson
} catch {
    Write-Host "[ОШИБКА] Не удалось прочитать или разобрать файл config.json: $_" -ForegroundColor Red
    exit 1
}

# Функция записи сообщений в лог-файл и консоль
function Write-BridgeLog {
    param (
        [string]$Message,
        [string]$Level = "INFO",
        [ConsoleColor]$Color = [ConsoleColor]::White
    )
    $Timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $FormattedMessage = "[$Timestamp] [$Level] $Message"
    
    # Вывод в консоль с цветовым выделением
    Write-Host $FormattedMessage -ForegroundColor $Color
    
    # Запись в файл журнала, если включена опция
    if ($Config.logging.logToFile) {
        $LogFilePath = Join-Path $ScriptDir $Config.logging.logFilePath
        Add-Content -Path $LogFilePath -Value $FormattedMessage -Encoding UTF8
    }
}

Write-BridgeLog "Запуск шлюза ДомофонДар - 1С. Режим: $Mode" -Color Cyan

# ==============================================================================
# Загрузка C#-модуля OneCBridgeCore.cs через Add-Type
# ==============================================================================
$CsSourcePath = Join-Path $ScriptDir "OneCBridgeCore.cs"
if (-not (Test-Path $CsSourcePath)) {
    Write-BridgeLog "Файл OneCBridgeCore.cs не найден: $CsSourcePath" -Level "ERROR" -Color Red
    exit 1
}

try {
    Add-Type -Path $CsSourcePath -ReferencedAssemblies "Microsoft.CSharp"
    Write-BridgeLog "Движок интеграции 1С успешно инициализирован." -Color Green
    [OneCBridgeCore]::SetupSecurityProtocols()
} catch {
    Write-BridgeLog "Ошибка компиляции модуля C#: $_" -Level "ERROR" -Color Red
    exit 1
}

# ==============================================================================
# Функция проверки доступности сайта и API-ключа
# ==============================================================================
function Test-SiteConnection {
    $Url = "$($Config.site.url)/api/1c/pull-events?limit=1"
    $Headers = @{
        "x-1c-api-key" = $Config.site.apiKey
    }
    
    try {
        $Response = Invoke-RestMethod -Uri $Url -Method Get -Headers $Headers -TimeoutSec 10 -ErrorAction Stop
        Write-BridgeLog "Связь с сайтом $($Config.site.url) установлена успешно!" -Color Green
        return $true
    } catch {
        Write-BridgeLog "Не удалось подключиться к сайту $($Config.site.url): $_" -Level "WARN" -Color Yellow
        return $false
    }
}

# ==============================================================================
# Функция проверки подключения к 1С
# ==============================================================================
function Test-1CConnection {
    try {
        $Res = [OneCBridgeCore]::TestConnection(
            $Config.oneC.connectionType,
            $Config.oneC.fileBaseDirectory,
            $Config.oneC.serverCluster,
            $Config.oneC.serverBaseName,
            $Config.oneC.user,
            $Config.oneC.password
        )
        Write-BridgeLog $Res -Color Green
        return $true
    } catch {
        Write-BridgeLog "Ошибка подключения к 1С: $_" -Level "ERROR" -Color Red
        return $false
    }
}

# ==============================================================================
# Режим проверки связи (TEST)
# ==============================================================================
if ($Mode -eq "test") {
    Write-BridgeLog "--------------------------------------------------------" -Color Yellow
    Write-BridgeLog "Запуск комплексной проверки связи..." -Color Yellow
    
    $SiteOk = Test-SiteConnection
    $OneCOk = Test-1CConnection
    
    Write-BridgeLog "--------------------------------------------------------" -Color Yellow
    if ($SiteOk -and $OneCOk) {
        Write-BridgeLog "ИТОГ ПРОВЕРКИ: ВСЕ СИСТЕМЫ ГОТОВЫ К РАБОТЕ! (ОК)" -Color Green
    } else {
        Write-BridgeLog "ИТОГ ПРОВЕРКИ: Обнаружены проблемы с подключением. Проверьте параметры в config.json." -Level "WARN" -Color Yellow
    }
    exit 0
}

# ==============================================================================
# Основной цикл обмена данными (PULL, PROCESS, ACK, PUSH STOCK)
# ==============================================================================
Write-BridgeLog "Запуск рабочего процесса синхронизации..." -Color Cyan

$Global:V8Connection = $null

function Get-ActiveV8 {
    if ($null -eq $Global:V8Connection) {
        Write-BridgeLog "Открытие рабочей сессии с базой 1С..." -Color Yellow
        $Global:V8Connection = [OneCBridgeCore]::ConnectToOneC(
            $Config.oneC.connectionType,
            $Config.oneC.fileBaseDirectory,
            $Config.oneC.serverCluster,
            $Config.oneC.serverBaseName,
            $Config.oneC.user,
            $Config.oneC.password
        )
        Write-BridgeLog "Рабочая сессия 1С успешно открыта." -Color Green
    }
    return $Global:V8Connection
}

$LastStockSync = [DateTime]::MinValue

function Execute-SyncCycle {
    # 1. Запрос новых событий с сайта
    $PullUrl = "$($Config.site.url)/api/1c/pull-events"
    $Headers = @{
        "x-1c-api-key" = $Config.site.apiKey
    }
    
    $EventsResponse = $null
    try {
        $EventsResponse = Invoke-RestMethod -Uri $PullUrl -Method Get -Headers $Headers -TimeoutSec 15 -ErrorAction Stop
    } catch {
        Write-BridgeLog "Ошибка при опросе сайта: $_" -Level "WARN" -Color Yellow
        return
    }

    if ($EventsResponse -and $EventsResponse.events -and $EventsResponse.events.Count -gt 0) {
        $Count = $EventsResponse.events.Count
        Write-BridgeLog "Получено новых событий с сайта: $Count" -Color Cyan
        
        $V8 = Get-ActiveV8
        $AckList = @()

        foreach ($ev in $EventsResponse.events) {
            Write-BridgeLog "Обработка события #$($ev.id): Тип: $($ev.entity_type), Заявка ID: $($ev.entity_id)" -Color White
            
            $Payload = $ev.payload
            $CreatedDocNumber = ""
            
            try {
                if ($ev.entity_type -eq "request" -or $ev.entity_type -eq "act") {
                    $OrderType = $Payload.order_type
                    $City = if ($Payload.city) { $Payload.city } else { "Краснодар" }
                    $Street = if ($Payload.street) { $Payload.street } else { "" }
                    $House = if ($Payload.house) { $Payload.house } else { "" }
                    $Entrance = if ($Payload.entrance) { $Payload.entrance } else { "" }
                    $Apartment = if ($Payload.apartment) { $Payload.apartment } else { "" }
                    $ClientName = if ($Payload.name) { $Payload.name } else { "Абонент с сайта" }
                    $Phone = if ($Payload.phone) { $Payload.phone } else { "" }
                    $ClientComment = if ($Payload.client_comment) { $Payload.client_comment } else { "" }

                    if ($ev.entity_type -eq "act" -or $OrderType -in @("equipment_order", "tube", "keys", "installation")) {
                        # Это заказ оборудования или акт монтажа -> формируем состав номенклатуры
                        $ItemsData = ""
                        if ($Payload.items -and $Payload.items.Count -gt 0) {
                            $ItemsList = @()
                            foreach ($it in $Payload.items) {
                                $itName = $it.name
                                $itQty = if ($it.quantity) { $it.quantity } else { 1 }
                                $itPrice = if ($it.price) { $it.price } else { 0 }
                                $ItemsList += "$itName:::$itQty:::$itPrice"
                            }
                            $ItemsData = $ItemsList -join "###"
                        }

                        $CreatedDocNumber = [OneCBridgeCore]::CreateInstallationAct(
                            $V8,
                            $ClientName,
                            $Phone,
                            $City,
                            $Street,
                            $House,
                            $Entrance,
                            $Apartment,
                            $Config.oneC.defaultOrganization,
                            $Config.oneC.defaultWarehouse,
                            $Config.oneC.defaultPriceType,
                            $Payload.master_name,
                            $Payload.id,
                            $ItemsData,
                            $ClientComment
                        )
                        Write-BridgeLog "  -> В 1С успешно создан Акт установки/замены: $CreatedDocNumber (Жилец: $ClientName, Тел: $Phone, Адрес: $Street, д. $House, кв. $Apartment)" -Color Green
                    } else {
                        # Это ремонт без оборудования -> создаем Заказ-Наряд со всеми реквизитами
                        $CreatedDocNumber = [OneCBridgeCore]::CreateRepairOrder(
                            $V8,
                            $ClientName,
                            $Phone,
                            $City,
                            $Street,
                            $House,
                            $Entrance,
                            $Apartment,
                            $Payload.message,
                            $Payload.master_name,
                            $Payload.id,
                            $ClientComment
                        )
                        Write-BridgeLog "  -> В 1С успешно создан Заказ-Наряд: $CreatedDocNumber (Жилец: $ClientName, Тел: $Phone, Адрес: $Street, д. $House, кв. $Apartment)" -Color Green
                    }
                }

                $AckList += @{
                    eventId = $ev.id
                    status = "synced"
                    external1cId = $CreatedDocNumber
                }
            } catch {
                Write-BridgeLog "Ошибка создания документа в 1С для события #$($ev.id): $_" -Level "ERROR" -Color Red
                $AckList += @{
                    eventId = $ev.id
                    status = "failed"
                    errorMessage = "$_"
                }
            }
        }

        # Отправка квитанции сайту о проведенных документах
        if ($AckList.Count -gt 0) {
            try {
                $AckUrl = "$($Config.site.url)/api/1c/ack-events"
                $AckBody = @{ acks = $AckList } | ConvertTo-Json -Depth 5
                $AckRes = Invoke-RestMethod -Uri $AckUrl -Method Post -Headers $Headers -Body $AckBody -ContentType "application/json; charset=utf-8" -TimeoutSec 15
                Write-BridgeLog "Квитанции успешно отправлены сайту (обработано $($AckList.Count) событий)." -Color Green
            } catch {
                Write-BridgeLog "Ошибка отправки квитанций на сайт: $_" -Level "ERROR" -Color Red
            }
        }
    }

    # 2. Периодическая выгрузка актуальных остатков со склада 1С на сайт
    $Now = Get-Date
    $MinutesSinceLastStock = ($Now - $LastStockSync).TotalMinutes
    if ($MinutesSinceLastStock -ge $Config.site.syncStockIntervalMinutes -or $LastStockSync -eq [DateTime]::MinValue) {
        Write-BridgeLog "Считывание актуальных остатков со склада 1С ($($Config.oneC.defaultWarehouse))..." -Color Yellow
        try {
            $V8 = Get-ActiveV8
            $StockJson = [OneCBridgeCore]::GetStockJson($V8, $Config.oneC.defaultWarehouse)
            Write-BridgeLog "Остатки получены из 1С. Отправка на сайт..." -Color Yellow
            
            $PushStockUrl = "$($Config.site.url)/api/1c/push-stock"
            $StockBody = '{"warehouse":"' + $Config.oneC.defaultWarehouse + '","stocks":' + $StockJson + '}'
            
            $PushRes = Invoke-RestMethod -Uri $PushStockUrl -Method Post -Headers $Headers -Body $StockBody -ContentType "application/json; charset=utf-8" -TimeoutSec 20
            $Global:LastStockSync = $Now
            Write-BridgeLog "Остатки склада 1С успешно обновлены на сайте! (Обновлено товаров: $($StockArray.Count))" -Color Green
        } catch {
            Write-BridgeLog "Ошибка обновления остатков склада: $_" -Level "WARN" -Color Yellow
        }
    }
}

# Запуск в зависимости от выбранного режима
if ($Mode -eq "once") {
    Execute-SyncCycle
    Write-BridgeLog "Одиночный цикл синхронизации успешно завершен." -Color Green
} else {
    Write-BridgeLog "Шлюз запущен в постоянном режиме (интервал: $($Config.site.pollIntervalSeconds) сек). Для остановки нажмите Ctrl+C." -Color Cyan
    while ($true) {
        Execute-SyncCycle
        Start-Sleep -Seconds $Config.site.pollIntervalSeconds
    }
}
