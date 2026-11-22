param(
    [string]$ProjectPath = (Join-Path $PSScriptRoot 'tia_export'),
    [string]$ProjectName = 'SCADA_Water_Pumping',
    [switch]$WithoutUI
)

$ErrorActionPreference = 'Stop'

$api = 'C:\Program Files\Siemens\Automation\Portal V19\PublicAPI\V19\Siemens.Engineering.dll'
if (-not (Test-Path -LiteralPath $api)) {
    throw "TIA Portal V19 Openness API not found: $api"
}

Add-Type -Path $api

$mode = [Siemens.Engineering.TiaPortalMode]::WithUserInterface
if ($WithoutUI) {
    $mode = [Siemens.Engineering.TiaPortalMode]::WithoutUserInterface
}

$tia = [Siemens.Engineering.TiaPortal]::new($mode)
try {
    if (-not (Test-Path -LiteralPath $ProjectPath)) {
        New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null
    }

    if (Test-Path -LiteralPath (Join-Path $ProjectPath ($ProjectName + '.ap19'))) {
        $project = $tia.Projects.Open(Join-Path $ProjectPath ($ProjectName + '.ap19'))
    }
    else {
        $project = $tia.Projects.Create($ProjectPath, $ProjectName)
        $device = $project.Devices.CreateWithItem('OrderNumber:6ES7214-1AG40-0XB0', 'PLC_1', 'PLC_1')
        if ($null -eq $device) {
            throw 'Could not create S7-1200 CPU 1214C device. Check the Openness license and installed hardware catalog.'
        }
    }

    $plcSoftware = $null
    foreach ($item in $project.Devices[0].DeviceItems) {
        $candidate = $item.GetService([Siemens.Engineering.Plc.Software.PlcSoftware])
        if ($null -ne $candidate) {
            $plcSoftware = $candidate
            break
        }
    }

    if ($null -eq $plcSoftware) {
        throw 'PlcSoftware service not found in device PLC_1.'
    }

    $sourceGroup = $plcSoftware.ExternalSourceGroup.ExternalSources
    $sourceFiles = @(
        'DB10.scl',
        'FB_AI_Scale.scl',
        'FB_Alarm.scl',
        'FB_PumpControl.scl',
        'Instances.scl',
        'OB1.scl'
    )

    foreach ($file in $sourceFiles) {
        $fullPath = Join-Path (Join-Path $PSScriptRoot 'src') $file
        if (-not (Test-Path -LiteralPath $fullPath)) {
            throw "Missing source file: $fullPath"
        }
        $existing = $sourceGroup | Where-Object { $_.Name -eq $file }
        if ($null -ne $existing) {
            $existing.Delete()
        }
        $source = $sourceGroup.CreateFromFile($fullPath)
        $source.GenerateBlocksFromSource()
    }

    $plcSoftware.Compiler.Compile()
    $project.Save()

    Write-Output "TIA project ready: $ProjectPath\$ProjectName.ap19"
}
finally {
    $tia.Dispose()
}
