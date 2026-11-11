$apiKey = "super-secret-key-123456789"
$baseUrl = "http://localhost:3000/vehiculos"
$headers = @{
    "x-api-key" = $apiKey
    "Content-Type" = "application/json"
}

Write-Host "1. Probando Health Check..." -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET | Format-List

Write-Host "`n2. Insertando vehículo..." -ForegroundColor Cyan
$body = @{ placaVeh="TEST-999"; marcaVeh="Honda"; anioFabVeh=2025; color="Negro"; propietario="Neo" } | ConvertTo-Json
$new = Invoke-RestMethod -Uri $baseUrl -Method POST -Body $body -Headers $headers
$new | Format-List

Write-Host "`n3. Listando vehículos..." -ForegroundColor Cyan
Invoke-RestMethod -Uri $baseUrl -Method GET -Headers $headers | Select-Object source, data | Format-List

Write-Host "`n4. Eliminando vehículo de prueba..." -ForegroundColor Cyan
$id = $new.data.id
Invoke-RestMethod -Uri "$baseUrl/$id" -Method DELETE -Headers $headers | Format-List