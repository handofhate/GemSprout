# Remote Config

The `gemsprout1` Firebase Remote Config template is set up with these parameters. As of 2026-11-12, maintenance is off and the minimum build is `0`, so neither gate blocks users.

GemSprout uses Firebase Remote Config for two app-wide access controls. Defaults are deliberately non-blocking so a Remote Config outage does not lock out families.

| Parameter | Type | Default | Purpose |
| --- | --- | --- | --- |
| `maintenanceMode` | Boolean | `false` | Shows the maintenance screen when enabled. |
| `maintenanceTitle` | String | `Down for Maintenance` | Maintenance screen heading. |
| `maintenanceMessage` | String | `GemSprout is currently undergoing maintenance. Please check back soon.` | Maintenance screen explanation. |
| `minimumSupportedBuild` | Number | `0` | Minimum iOS build number allowed; `0` disables the version gate. |
| `minimumSupportedBuildTitle` | String | `Please Update GemSprout` | Required-update screen heading. |
| `minimumSupportedBuildMessage` | String | `An update is available! Please update the app to continue using GemSprout.` | Required-update explanation. |

The minimum is compared with the installed iOS `CFBundleVersion` (the Codemagic build number), not the marketing version. Set the threshold only after the replacement build is available to users. Web builds do not enforce the iOS build threshold. Maintenance mode takes precedence over the update gate. If a fresh Remote Config fetch fails, the app uses its cached values and otherwise fails open.

Both modes share one screen layout. Maintenance offers **Check Again**, which forces a Remote Config refresh; the update screen opens GemSprout's [App Store listing](https://apps.apple.com/us/app/gemsprout/id6760679496).
