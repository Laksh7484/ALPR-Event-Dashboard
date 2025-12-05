$content = Get-Content 'd:\Project\ALPR-Event-Dashboard\server\index.js' -Raw

# Replace all pool.query EXCEPT in queryWithRetry function and testDatabaseConnection
# We'll do this by replacing all, then putting back the two exceptions

# First, temporarily mark the exceptions
$content = $content -replace '(async function queryWithRetry[\s\S]*?return await )pool\.query\(queryText, params\);', '$1%%KEEP_POOL_QUERY%%('
$content = $content -replace '(async function testDatabaseConnection[\s\S]{1,500}const result = await )pool\.query\(''SELECT NOW', '$1%%KEEP_POOL_QUERY2%%(''SELECT NOW'

# Now replace all remaining pool.query with queryWithRetry
$content = $content -replace 'pool\.query\(', 'queryWithRetry('

# Restore the exceptions
$content = $content -replace '%%KEEP_POOL_QUERY%%\(', 'pool.query('
$content = $content -replace '%%KEEP_POOL_QUERY2%%\(', 'pool.query('

Set-Content 'd:\Project\ALPR-Event-Dashboard\server\index.js' -Value $content -NoNewline
Write-Host "Replacement complete!"
