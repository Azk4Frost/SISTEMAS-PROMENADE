@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 24 ou superior e abra este arquivo novamente.
  echo Download oficial: https://nodejs.org/
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0]) < 24) process.exit(1)"
if errorlevel 1 (
  echo A versao instalada do Node.js e antiga. Use Node.js 24 ou superior.
  pause
  exit /b 1
)
if not exist "server\index.js" (
  echo Extraia a pasta completa do projeto antes de iniciar.
  pause
  exit /b 1
)
echo PROMENADE HUB - modo local, sem login.
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
echo O servidor informara o endereco para abrir no navegador.
node server/index.js
if errorlevel 1 (
  echo O servidor nao iniciou corretamente. Confira a mensagem acima.
  pause
  exit /b 1
)
echo Servidor encerrado. Os dados continuam salvos no banco local.
pause
