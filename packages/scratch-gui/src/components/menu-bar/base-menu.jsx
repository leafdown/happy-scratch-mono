import {MenuRefContext} from '../context-menu/menu-path-context';
import React from 'react';
import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';

/* Subclasses must implement (some optionally):
_______________________________________________
render
onSelectItem
define this.itemRefs
add onKeyDown={this.handleKeyPress}
and onParentKeyPress={this.handleKeyPress} for MenuItem elements

They should also receive:
______________________
onOpen,
onClose,
focusedRef,
depth
*/
export class BaseMenu extends React.PureComponent {
    constructor (props) {
        super(props);
        bindAll(this, [
            'onSelectItem',
            'handleKeyPress',
            'handleKeyPressOpenMenu',
            'handleMove',
            'handleOnOpen',
            'handleOnClose',
            'setFocusedRef'
        ]);
        
        this.state = {focusedIndex: -1, depth: -1};
        this.focusedRef = props.focusedRef || React.createRef();
    }

    static contextType = MenuRefContext;

    setFocusedRef (ref) {
        this.focusedRef = ref;
        if (ref && ref.current) ref.current.focus();
    }

    handleKeyPress (e) {
        if (this.props.depth === 1) {
            if (e.key === 'Tab') {
                this.handleOnClose();
            }
        }

        if (this.context.isTopMenu(this.props.focusedRef)) {
            this.handleKeyPressOpenMenu(e);
        } else if (!this.context.isOpenMenu(this.props.focusedRef) && (e.key === ' ' || e.key === 'ArrowRight')) {
            e.preventDefault();
            this.handleOnOpen();
        }
    }

    handleKeyPressOpenMenu (e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.handleMove(1);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.handleMove(-1);
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            this.onSelectItem();
        }
        if (e.key === 'ArrowLeft' || e.key === 'Escape') {
            e.preventDefault();
            this.handleOnClose();
        }
    }

    handleOnOpen () {
        if (this.context.isOpenMenu(this.props.focusedRef)) return;

        this.props.onOpen();
        this.setState({focusedIndex: 0}, () => {
            if (this.itemRefs[0] && this.itemRefs[0].current) this.itemRefs[0].current.focus();
        });

        this.context.push(this.props.focusedRef, this.props.depth);
    }

    handleMove (direction) {
        const newIndex = (this.state.focusedIndex + direction + this.itemRefs.length) % this.itemRefs.length;
        this.setState({focusedIndex: newIndex}, () => {
            this.setFocusedRef(this.itemRefs[newIndex]);
        });
    }

    onSelectItem () {
        // do nothing by default, change for items that don't expand
    }

    handleOnClose () {
        this.context.cut(this.props.focusedRef);
        this.setState({focusedIndex: -1}, () => {
            this.setFocusedRef(this.props.focusedRef);
        });

        this.props.onClose();
    }

}

BaseMenu.propTypes = {
    focusedRef: PropTypes.shape({current: PropTypes.instanceOf(Element)}),
    depth: PropTypes.number,
    onOpen: PropTypes.func,
    onClose: PropTypes.func
};

BaseMenu.defaultProps = {
    onClose: () => {}
};
