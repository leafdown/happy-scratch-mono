# scratch-gui Patches

Patches applied to `packages/scratch-gui/src/` for the @lanqu/scratch-gui B-plan port.
All patches follow the principle: **add optional prop/parameter, default behavior unchanged**.
Patch commits are prefixed `[patch]`... actually they use conventional `feat(scratch-gui):` scope.
To ease `git rebase upstream/main`, all patches are additive (new optional props/params only).

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
| — | `components/stage-wrapper/stage-wrapper.jsx` | Forward `stageHeaderConfig`/`controlsConfig` |

## Not applied (deferred / optional)
| ID | File | Customization | Reason |
|----|------|---------------|--------|
| P8 | `components/menu-bar/file-menu.jsx` | New/Save/Load buttons visibility + before hooks | FileMenu is a dropdown; easy-scratch3's standalone buttons don't map cleanly. Use `canManageFiles` (native) for whole-menu control. |
| — | `components/menu-bar/edit-menu.jsx` | Turbo mode visibility | Native `canChangeColorMode`-style prop not available; low priority |

## Known limitations
- `hideCatagorys`/`hideBlocks` take effect when blocks.jsx regenerates the toolbox (on target switch / project load). The initial toolbox (from `makeToolboxXML(true)` in reducers/toolbox.js) has no hideConfig. Hosts can force a refresh via `window.vm.emitWorkspaceUpdate()` once the VM is ready.

## Upgrade procedure
1. `git fetch upstream && git rebase upstream/main`
2. Conflicts concentrate on patch commits — resolve by re-applying the additive prop/param
3. `npm run build --workspace=@scratch/scratch-gui` to regenerate dist (clear `node_modules/.cache` if webpack caches stale modules)
4. `npm run build --workspace=@lanqu/scratch-gui` to verify wrapper still builds
5. Run playground (`npm start --workspace=@lanqu/scratch-gui`) and verify customizations
