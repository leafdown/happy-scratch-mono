# scratch-gui Patches

Patches applied to `packages/scratch-gui/src/` for the @lanqu/scratch-gui B-plan port.
All patches follow the principle: **add optional prop/parameter, default behavior unchanged**.
Patch commits are prefixed `[patch]`... actually they use conventional `feat(scratch-gui):` scope.
To ease upstream syncs (see `scripts/upgrade-from-upstream.sh`), all patches are additive (new optional props/params only).

## Applied patches

### MenuBar (stage 4)
| ID | File | Customization |
|----|------|---------------|
| P1 | `components/gui/gui.jsx` | Destructure `customButtons` + pass to MenuBar JSX |
| P2 | `components/gui/gui.jsx` | Destructure `menuBarStyle` + pass to MenuBar JSX |
| P6 | `components/menu-bar/menu-bar.jsx` | Add `style={menuBarStyle}` to root Box |
| P7 | `components/menu-bar/menu-bar.jsx` | `customButtons` propType + render slot (after first Divider) |

### Blocks / StageArea (stage 5)
| ID | File | Customization |
|----|------|---------------|
| P3 | `components/gui/gui.jsx` | Blocks `options` merge external `blocksOptions` (zoom.startScale) |
| P4 | `components/gui/gui.jsx` | Pass `blocksHideConfig` to Blocks |
| P5 | `components/gui/gui.jsx` | Pass `stageHeaderConfig`/`controlsConfig` to StageWrapper |
| P9 | `lib/make-toolbox-xml.js` | `hideConfig` 9th param, filter categories/blocks |
| P10 | `containers/blocks.jsx` | Forward `blocksHideConfig` to makeToolboxXML |
| P11 | `lib/layout-constants.js` | `setCustomLayout()` for stage size/scale override |
| P11b | `index-standalone.tsx` | Export `setCustomLayout` |
| P12 | `containers/controls.jsx` + `components/controls/controls.jsx` | Green flag/stop visibility + before hooks |
| P13 | `components/stage-header/stage-header.jsx` | Fullscreen button visibility + before hooks |
| P14 | `lib/cloud-manager-hoc.jsx` | Optional `cloudControl` override for projectId/username/enable/write, and reconnect on stale connection |
| P15 | `components/gui/gui.jsx` + `components/menu-bar/menu-bar.jsx` | Optional `onBeforeNewProject` hook, called after confirmation |
| P16 | `lib/sb-file-uploader-hoc.jsx` | Optional `onBeforeProjectUpload` / `onAfterProjectUpload` / `onProjectUploadFailed` hooks around a local project load |
| P17 | `components/menu-bar/file-menu.jsx` | New/Load/Save menu item visibility (`showNewButton` / `showLoadButton` / `showSaveButton`) |
| P18 | `components/menu-bar/edit-menu.jsx` | Turbo mode menu item visibility (`showTurboModeButton`) |
| P19 | `components/menu-bar/menu-bar.jsx` | Logo visibility (`showLogo`), help `onBeforeHelp` hook, save-to-computer `onBeforeSaveToComputer` hook |
| P20 | `components/menu-bar/account-menu.jsx` + `lib/account-menu-options.ts` | Avatar click override (`accountMenuOptions.onClick`) |
| — | `components/stage-wrapper/stage-wrapper.jsx` | Forward `stageHeaderConfig`/`controlsConfig` |

### Editor modes (stage 6)
| ID | File | Customization |
|----|------|---------------|
| P21 | `components/gui/gui.jsx` + `components/target-pane/target-pane.jsx` + `components/sprite-selector/*` + `components/stage-selector/stage-selector.jsx` | Optional `readOnly` prop: disables the sprite/backdrop add buttons, the delete/duplicate/export affordances, and the sprite property inputs. Block editing is locked by the wrapper passing `readOnly: true` into `blocksOptions` → scratch-blocks `inject()` |
| P22 | `components/gui/gui.jsx` | Optional `blocksOnly` prop: skips the whole stage-and-target aside so the blocks editor fills the window |

## Not applied (deferred / optional)
None currently.

## Known limitations
- `hideCatagorys`/`hideBlocks` only affect the toolbox after `blocks.jsx` regenerates it. The wrapper subscribes to the VM's `PROJECT_LOADED` event and calls `vm.emitWorkspaceUpdate()` when either list is non-empty, so the configuration applies once the project boots (and after every subsequent load).

## Upgrade procedure
1. `git fetch upstream --tags && git rebase v15.2.0` (use the latest upstream release tag)
2. Conflicts concentrate on patch commits — resolve by re-applying the additive prop/param
3. `npm run build --workspace=@scratch/scratch-gui` to regenerate dist (clear `node_modules/.cache` if webpack caches stale modules)
4. `npm run build --workspace=@lanqu/scratch-gui` to verify wrapper still builds
5. Run playground (`npm start --workspace=@lanqu/scratch-gui`) and verify customizations
