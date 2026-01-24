# Guacamole Print Agent Diagnostic Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Guacamole Print Agent Diagnostics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if local print agent is running
Write-Host "`n1. Checking Local Print Agent Status:" -ForegroundColor Yellow
$port8181 = netstat -an | findstr ":8181"
if ($port8181) {
    Write-Host "✅ Port 8181 is listening" -ForegroundColor Green
    Write-Host $port8181 -ForegroundColor Gray
} else {
    Write-Host "❌ Port 8181 is NOT listening" -ForegroundColor Red
}

# Check health endpoint
try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:8181/health" -TimeoutSec 5
    Write-Host "✅ Health endpoint responding" -ForegroundColor Green
    Write-Host "   Status: $($healthResponse.status)" -ForegroundColor Gray
    Write-Host "   Timestamp: $($healthResponse.timestamp)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health endpoint not responding" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
}

# Check service status
Write-Host "`n2. Checking Windows Service Status:" -ForegroundColor Yellow
try {
    $service = Get-Service -Name "GuacamolePrintAgent" -ErrorAction SilentlyContinue
    if ($service) {
        Write-Host "Service Name: $($service.Name)" -ForegroundColor Gray
        Write-Host "Display Name: $($service.DisplayName)" -ForegroundColor Gray
        Write-Host "Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Red' })
        Write-Host "StartType: $($service.StartType)" -ForegroundColor Gray
    } else {
        Write-Host "❌ GuacamolePrintAgent service not found" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error checking service: $($_.Exception.Message)" -ForegroundColor Red
}

# Check processes using port 8181
Write-Host "`n3. Checking Processes on Port 8181:" -ForegroundColor Yellow
$processes = netstat -ano | findstr ":8181"
if ($processes) {
    foreach ($line in $processes) {
        if ($line -match '\s+(\d+)$') {
            $pid = $matches[1]
            try {
                $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
                Write-Host "✅ PID $pid - $($process.ProcessName)" -ForegroundColor Green
            } catch {
                Write-Host "⚠️ PID $pid - Process not accessible" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "❌ No processes found on port 8181" -ForegroundColor Red
}

# Check browser extension files
Write-Host "`n4. Checking Browser Extension Files:" -ForegroundColor Yellow
$extensionPath = "$PSScriptRoot\guacamole-extension"
if (Test-Path $extensionPath) {
    Write-Host "✅ Extension folder exists" -ForegroundColor Green
    
    $requiredFiles = @("manifest.json", "background.js", "content.js", "popup.html")
    foreach ($file in $requiredFiles) {
        $filePath = Join-Path $extensionPath $file
        if (Test-Path $filePath) {
            Write-Host "✅ $file exists" -ForegroundColor Green
        } else {
            Write-Host "❌ $file missing" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ Extension folder not found" -ForegroundColor Red
}

# Test WebSocket connection
Write-Host "`n5. Testing WebSocket Connection:" -ForegroundColor Yellow
try {
    $wsTest = New-Object System.Net.WebSockets.ClientWebSocket
    $uri = New-Object System.Uri("ws://localhost:8181/ws")
    $connectTask = $wsTest.ConnectAsync($uri, [System.Threading.CancellationToken]::None)
    $connectTask.Wait(5000) # Wait 5 seconds
    
    if ($wsTest.State -eq 'Open') {
        Write-Host "✅ WebSocket connection successful" -ForegroundColor Green
        
        # Test sending a message
        $testMessage = @{ type = "status_query"; messageId = "test_$(Get-Date -Format yyyyMMddHHmmss)" } | ConvertTo-Json
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($testMessage)
        $sendTask = $wsTest.SendAsync($buffer, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [System.Threading.CancellationToken]::None)
        $sendTask.Wait(3000)
        
        Write-Host "✅ Test message sent" -ForegroundColor Green
        $wsTest.CloseAsync()
    } else {
        Write-Host "❌ WebSocket connection failed" -ForegroundColor Red
        Write-Host "   State: $($wsTest.State)" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ WebSocket test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Check installed printers
Write-Host "`n6. Checking Available Printers:" -ForegroundColor Yellow
try {
    $printers = Get-WmiObject -Class Win32_Printer | Select-Object Name, Default
    if ($printers) {
        Write-Host "✅ Found $($printers.Count) printers:" -ForegroundColor Green
        foreach ($printer in $printers) {
            $status = if ($printer.Default) { " (Default)" } else { "" }
            Write-Host "   - $($printer.Name)$status" -ForegroundColor Gray
        }
    } else {
        Write-Host "❌ No printers found" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error checking printers: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Diagnostics Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Ensure the local print agent is running (service or direct executable)" -ForegroundColor Gray
Write-Host "2. Install the browser extension in Chrome/Edge" -ForegroundColor Gray
Write-Host "3. Test by opening the test HTML file: test-print-agent.html" -ForegroundColor Gray
Write-Host "4. Try printing from your Guacamole session" -ForegroundColor Gray