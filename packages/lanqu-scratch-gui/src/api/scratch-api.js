/**
 * scratchApiHOC — a wrapper HOC injected into createStandaloneRoot's wrappers.
 *
 * Two responsibilities:
 *   1. (Stage 3) Register window.scratch.* imperative API after the GUI mounts,
 *      wiring it to the VM and redux store obtained via context.
 *   2. Pass through the patch-driven props (customButtons, blocksOptions, etc.)
 *      that the caller already injected via buildPatchProps.
 *
 * Stage 1: skeleton that registers a minimal window.scratch and stores the config
 * for later stages to expand.
 */
import React from 'react';

const scratchApiHOC = config => WrappedComponent => {
    class ScratchApiWrapper extends React.Component {
        componentDidMount () {
            window.scratch = window.scratch || {};
            // Stage 3 will populate the full API; for now mark readiness.
            window.scratch._config = config;
            if (config.handleVmInitialized) {
                // onVmInit prop (already passed through) sets window.vm via the host
                // config's handleVmInitialized callback in easy-scratch3.
            }
        }

        render () {
            return <WrappedComponent {...this.props} />;
        }
    }
    return ScratchApiWrapper;
};

export {
    scratchApiHOC
};
