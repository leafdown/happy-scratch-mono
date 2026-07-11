# scratch-gui Patches

Patches applied to `packages/scratch-gui/src/` for the @lanqu/scratch-gui B-plan port.
All patches follow the principle: **add optional prop/parameter, default behavior unchanged**.
Patch commits are prefixed `[patch]` to ease `git rebase upstream/main`.

## Patch index

| ID | File | Customization | Default behavior |
|----|------|---------------|------------------|
| P1 | `components/gui/gui.jsx` | Destructure `customButtons` + pass to MenuBar JSX | undefined → no custom buttons rendered |
| P2 | `components/gui/gui.jsx` | Destructure `menuBarStyle` + pass to MenuBar JSX | undefined → no inline style |
| P6 | `components/menu-bar/menu-bar.jsx` | Add `style={menuBarStyle}` to root Box | undefined → no inline style |
| P7 | `components/menu-bar/menu-bar.jsx` | Add `customButtons` propType + render slot (after first Divider, before Tutorials) | undefined/empty → no buttons rendered |
| P1/P2 propTypes | `components/gui/gui.jsx` | Declare `customButtons`, `menuBarStyle` in GUIComponent.propTypes | — |

## Pending patches (not yet applied)

| ID | File | Customization |
|----|------|---------------|
| P3 | `components/gui/gui.jsx` | Blocks `options` merge external `blocksOptions` (zoom.startScale) |
| P4 | `components/gui/gui.jsx` | Pass `blocksHideConfig` to Blocks |
| P5 | `components/gui/gui.jsx` | Pass `stageHeaderConfig`/`controlsConfig` to StageHeader/Controls |
| P8 | `components/menu-bar/file-menu.jsx` | New/Save/Load buttons visibility + before hooks |
| P9 | `lib/make-toolbox-xml.js` | `hideConfig` 9th param, filter categories/blocks |
| P10 | `containers/blocks.jsx` | Pass `blocksHideConfig` to makeToolboxXML |
| P11 | `lib/layout-constants.js` | `setCustomLayout()` for blocks scale / stage size |
| P12 | `containers/controls.jsx` | Green flag/stop visibility + before hooks |
| P13 | `components/stage-header/stage-header.jsx` | Fullscreen button visibility + before hooks |
| — | `components/menu-bar/edit-menu.jsx` | Turbo mode visibility |

## Upgrade procedure

1. `git fetch upstream && git rebase upstream/main`
2. Conflicts concentrate on `[patch]` commits — resolve by re-applying the prop addition
3. `npm run build --workspace=@scratch/scratch-gui` to regenerate dist
4. `npm run build --workspace=@lanqu/scratch-gui` to verify wrapper still builds
5. Run playground (`npm start --workspace=@lanqu/scratch-gui`) and verify customizations still work
