# PowerShell script to start the development server
Set-Location "d:\Users\Downloads\www-genshin-main\www-genshin-main"
$env:NODE_PATH = "C:\Program Files\nodejs"
& "C:\Program Files\nodejs\node.exe" "C:\Program Files\nodejs\node_modules\vite\bin\vite.js" --host --port 5173