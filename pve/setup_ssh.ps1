$sshDir = "$env:USERPROFILE\.ssh"
if (-not (Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force
}
Copy-Item "pve\id_ed25519" -Destination "$sshDir\id_ed25519_pve" -Force
icacls "$sshDir\id_ed25519_pve" /inheritance:r /grant:r "${env:USERNAME}:F"

$configPath = "$sshDir\config"
$configContent = @"
Host pve
    HostName 172.16.1.54
    User root
    IdentityFile "$sshDir\id_ed25519_pve"
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
"@

[System.IO.File]::WriteAllText($configPath, $configContent)
Write-Output "Config file updated with UTF-8 encoding."
