import {useCallback, useContext, useState, useEffect} from 'react';
import {MenuRefContext} from '../contexts/menu-ref-context';

/**
 * Provides keyboard navigation and focus management logic for menu components.
 *
 * This hook encapsulates shared menu behavior such as:
 * - opening and closing menus
 * - moving focus between menu items with arrow keys
 * - handling Escape, Enter, and Tab behavior
 * - coordinating open menus via MenuRefContext
 * @param {object} params
 *  Parameters object
 * @param {{ current: HTMLElement | null }} params.menuRef
 *   Ref to the menu trigger or container element.
 * @param {Array<{ current: HTMLElement | null }>} params.itemRefs
 *   Refs for each focusable menu item, in display order.
 * @param {number} params.depth
 *   Nesting depth of the menu (1 = top-level menu).
 * @param {number} params.defaultIndexOnOpen
 *   Default menu item index to open to
 * @returns {object} An object containing the focused index, menu state, and keyboard handlers:
 *   - focusedIndex: number — Index of the currently focused menu item.
 *   - isExpanded: function() — Returns true if the menu is expanded.
 *   - handleKeyPress: function(KeyboardEvent) — Handler for key presses on the menu.
 *   - handleKeyPressOpenMenu: function(KeyboardEvent) — Handler for key presses when the menu is open.
 *   - handleOnOpen: function() — Function to open the menu.
 *   - handleOnClose: function() — Function to close the menu.
 */
export default function useMenuNavigation ({
    menuRef,
    itemRefs,
    depth,
    defaultIndexOnOpen = 0
}) {
    const menuContext = useContext(MenuRefContext);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    const refocusRef = useCallback(ref => {
        if (ref?.current) {
            ref.current.focus();
        }
    }, []);

    useEffect(() => {
        if (focusedIndex >= 0) {
            refocusRef(itemRefs[focusedIndex]);
        }
    }, [focusedIndex]);

    const isExpanded = useCallback(
        () => menuContext.isOpenMenu(menuRef),
        [menuContext, menuRef]
    );

    const handleOnOpen = useCallback(() => {
        if (menuContext.isOpenMenu(menuRef)) return;

        menuContext.push(menuRef, depth);
        setFocusedIndex(defaultIndexOnOpen);
    }, [menuContext, menuRef, depth]);

    const handleOnClose = useCallback(() => {
        setFocusedIndex(-1);
        menuContext.cut(menuRef);
        refocusRef(menuRef);
    }, [menuContext, menuRef, refocusRef]);

    const handleMove = useCallback(direction => {
        const nextIndex =
            (focusedIndex + direction + itemRefs.length) %
            itemRefs.length;

        setFocusedIndex(nextIndex);
    }, [focusedIndex, itemRefs, refocusRef]);

    const handleKeyPressOpenMenu = useCallback(e => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleMove(1);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleMove(-1);
        }
        if (e.key === 'ArrowLeft' || e.key === 'Escape') {
            e.preventDefault();
            handleOnClose();
        }
    }, [handleMove, handleOnClose, menuContext]);

    const handleKeyPress = useCallback(e => {
        if (isExpanded() && depth === 1 && e.key === 'Tab') {
            handleOnClose();
            menuContext.clear();
        }

        if (menuContext.isTopMenu(menuRef)) {
            handleKeyPressOpenMenu(e);
        } else if (!isExpanded() && (e.key === ' ' || (e.key === 'ArrowRight' && depth !== 1))) {
            e.preventDefault();
            handleOnOpen();
        }
    }, [
        depth,
        menuContext,
        menuRef,
        isExpanded,
        handleKeyPressOpenMenu,
        handleOnOpen,
        handleOnClose
    ]);

    return {
        focusedIndex,
        isExpanded,
        handleKeyPress,
        handleKeyPressOpenMenu,
        handleOnOpen,
        handleOnClose
    };
}
