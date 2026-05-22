@echo off
:: This script must be run as Administrator
:: It adds learnflow.intern to your Windows hosts file

set HOSTS_FILE=%windir%\System32\drivers\etc\hosts
set IP_ADDRESS=172.16.1.61
set HOSTNAME=learnflow.intern

echo Checking for Administrator privileges...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrator privileges confirmed.
) else (
    echo Failure: Current permissions inadequate. Please run this script as Administrator.
    pause
    exit /b 1
)

echo.
echo Adding %HOSTNAME% pointing to %IP_ADDRESS% in %HOSTS_FILE%...
findstr /C:"%HOSTNAME%" "%HOSTS_FILE%" >nul 2>&1
if %errorLevel% == 0 (
    echo The hostname %HOSTNAME% already exists in the hosts file.
) else (
    echo.>> "%HOSTS_FILE%"
    echo %IP_ADDRESS% %HOSTNAME%>> "%HOSTS_FILE%"
    echo Successfully added %HOSTNAME% to the hosts file.
)

echo.
echo You can now access LearnFlow at http://%HOSTNAME%/
pause
