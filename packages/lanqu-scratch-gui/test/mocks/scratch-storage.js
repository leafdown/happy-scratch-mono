/**
 * Test double for @scratch/scratch-storage: records web store registrations
 * without touching network or builtin asset loading.
 */
class ScratchStorage {
    constructor () {
        this.AssetType = {
            Project: 'Project',
            ImageVector: 'ImageVector',
            ImageBitmap: 'ImageBitmap',
            Sound: 'Sound'
        };
        this.DataFormat = {
            JSON: 'json',
            PNG: 'png',
            SVG: 'svg',
            WAV: 'wav'
        };
        this.addWebStore = jest.fn();
        this.builtinHelper = {_store: jest.fn()};
    }
}

module.exports = {ScratchStorage};
