import keyMirror from 'keymirror';

/**
 * Names for each state of the stage size toggle
 * @enum {string}
 */
const STAGE_SIZE_MODES = keyMirror({
    /**
     * The "large stage" button is pressed; the user would like a large stage.
     */
    large: null,

    /**
     * The "small stage" button is pressed; the user would like a small stage.
     */
    small: null
});

/**
 * Names for each stage render size
 * @enum {string}
 */
const STAGE_DISPLAY_SIZES = keyMirror({
    /**
     * Large stage with wide browser
     */
    large: null,

    /**
     * Large stage with narrow browser
     */
    largeConstrained: null,

    /**
     * Small stage (ignores browser width)
     */
    small: null
});

// zoom level to start with
let BLOCKS_DEFAULT_SCALE = 0.675;

const STAGE_DISPLAY_SCALES = {};
STAGE_DISPLAY_SCALES[STAGE_DISPLAY_SIZES.large] = 1; // large mode, wide browser (standard)
STAGE_DISPLAY_SCALES[STAGE_DISPLAY_SIZES.largeConstrained] = 0.85; // large mode but narrow browser
STAGE_DISPLAY_SCALES[STAGE_DISPLAY_SIZES.small] = 0.5; // small mode, regardless of browser size

const layoutConstants = {
    standardStageWidth: 480,
    standardStageHeight: 360,
    fullSizeMinWidth: 1096,
    fullSizePaintMinWidth: 1250
};

/**
 * Override default layout constants. Called once at startup by the
 * @lanqu/scratch-gui wrapper (driven by scratchConfig.stageArea / blocks.scale).
 * No-op when not called — preserves official defaults.
 */
const setCustomLayout = ({blocksScale, stageScale, stageWidth, stageHeight} = {}) => {
    if (typeof blocksScale === 'number') {
        BLOCKS_DEFAULT_SCALE = blocksScale;
    }
    if (typeof stageScale === 'number') {
        STAGE_DISPLAY_SCALES[STAGE_DISPLAY_SIZES.large] = stageScale;
    }
    if (typeof stageWidth === 'number') {
        layoutConstants.standardStageWidth = stageWidth;
    }
    if (typeof stageHeight === 'number') {
        layoutConstants.standardStageHeight = stageHeight;
    }
};

export default layoutConstants;

export {
    BLOCKS_DEFAULT_SCALE,
    STAGE_DISPLAY_SCALES,
    STAGE_DISPLAY_SIZES,
    STAGE_SIZE_MODES,
    setCustomLayout
};

