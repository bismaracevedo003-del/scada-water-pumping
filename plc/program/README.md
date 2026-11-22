# TIA Portal V19 project generation

## Requirements

- TIA Portal V19 with a valid **TIA Openness** license.
- PowerShell 5.1 or later.
- An S7-1200 CPU 1214C hardware catalog entry (order number `6ES7214-1AG40-0XB0`).

## Build

```powershell
cd plc\program
.\generate_tia_project.ps1
```

The script creates `plc/program/tia_export/SCADA_Water_Pumping.ap19`, imports every `.scl` file from `src/`, generates the blocks and compiles the PLC software. Use `-WithoutUI` for unattended builds.

The `.ap19` binary is intentionally ignored by Git: it is a licensed engineering artifact, not a reviewable source file. The `.scl` sources and the Ladder network description in `../documentation/ladder-blocks.md` are the versioned source of truth.

## Block list

| Block | Purpose |
| --- | --- |
| `DB10` | HMI/API tag interface (non-optimized for stable offsets) |
| `FB_AI_Scale` | 4-20 mA scaling and fault detection |
| `FB_Alarm` | Latch and acknowledge logic |
| `FB_PumpControl` | Manual/auto pump control and runtime counting |
| `OB1` | Cyclic coordination, alternation and physical I/O mapping |
| Instance DBs | One per FB call, including `TON_TIME` for jam detection |

## Not verified here

The script was written against the TIA V19 Openness PublicAPI but **was not executed** in this environment. Verify the generated project in TIA Portal and download it to PLCSIM/CPU before claiming hardware validation.

## Nota (ES)

Si no tienes licencia Openness, abre TIA Portal V19, crea un proyecto S7-1200 e importa los archivos `.scl` desde `src` mediante `External source files`; la documentación Ladder indica cómo recrear los bloques en LAD.
