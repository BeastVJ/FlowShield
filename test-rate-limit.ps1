$body = @{
    key = "fs_a8ZJ_xgpae0VqdLsuNjyeY6EszBjrcnq"
    identifier = "test-user-123"
} | ConvertTo-Json

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Testing API Key Rate Limit" -ForegroundColor Cyan
Write-Host "  Policy: 5 req / 6000ms (Sliding Window)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

for ($i = 1; $i -le 6; $i++) {
    Write-Host "--- Request $i ---" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri http://localhost:3000/api/rate-limit/check -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
        $status = $response.StatusCode
        Write-Host "HTTP Status: $status" -ForegroundColor Green
        Write-Host $response.Content
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 429) {
            Write-Host "HTTP Status: $statusCode (RATE LIMITED!)" -ForegroundColor Red
        } else {
            Write-Host "HTTP Status: $statusCode" -ForegroundColor Red
        }
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        Write-Host $reader.ReadToEnd()
        $reader.Close()
    }
    Write-Host ""
    Start-Sleep -Milliseconds 500
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
