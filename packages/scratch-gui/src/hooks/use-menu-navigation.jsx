import {useCallback, useContext, useState, useRef} from 'react';
import {MenuRefContext} from '../contexts/menu-ref-context';
import {KEY} from '../lib/navigation-keys';

// for all items of menu, to be found via the custom algorithm
const MENU_ITEM_SELECTOR = '[data-menu-item="true"]';
// wrapper prop should only be used for wrappers of an expandable menu,
// where the submenu containings its items are its sibling, instead of child
const MENU_ITEM_WRAPPER_SELECTOR = '[data-menu-item-wrapper="true"]';

/**
 * Custom hook for keyboard navigation and focus management in menu components.
 *
 * This hook provides:
 * - Opening and closing menus, remembering state
 * - Handling Escape, Enter, Space, Arrow and Tab keys
 * - Coordinating nested open menus via MenuRefContext
 * - Automatically focusing the first or default menu item on open
 *
 * STEPS TO USE IT:
 * 1. In the top-level menu trigger (button/div/...) pass:
 * - onClick={handleOnOpen}
 * - ref={menuRef}
 * - onKeyDown={handleKeyDown}
 * - tabIndex={0} or {-1} depending on the kind of focusability we want
 * - aria-expanded={isExpanded()} (and use it wherever else needed)
 * - for menu items pass onKeyDown={handleKeyDownOpenMenu}
 * 2. For the sake of consistent code structure, it is recommended for the core menus (depth 1)
 * to nest the submenu as a child of the button.
 * 3. Data-menu-item and data-menu-item-wrapper
 * - For nested submenus, you could use either a standalone button with menu items as children
 * and give it data-menu-item(=true) prop or
 * - Give data-menu-item-wrapper to the wrapper and data-menu-item to the button directly inside it.
 * See SettingsMenu -> LanguageMenu | PreferenceMenu logic for reference
 * @param {object} params
 *   Parameters object
 * @param {number} params.depth
 *   Nesting depth of the menu (1 = top-level menu).
 * @param {number} [params.defaultIndexOnOpen]
 *   Default menu item index to focus when opening the menu.
 * @returns {object} An object containing the menu state and keyboard handlers:
 *   - menuRef: reference to element to be used in component
 *   - focusedIndex: number — Index of the currently focused menu item.
 *   - isExpanded: function() — Returns true if the menu is expanded.
 *   - handleKeyDown: function(KeyboardEvent) — Handles key presses on the menu.
 *   - handleKeyDownOpenMenu: function(KeyboardEvent) — Handles key presses when the menu is open.
 *   - handleOnOpen: function() — Function to open the menu.
 *   - handleOnClose: function() — Function to close the menu.
 */
export default function useMenuNavigation ({
    depth,
    defaultIndexOnOpen = 0
}) {
    const menuRef = useRef(null);
    const menuContext = useContext(MenuRefContext);
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // BFS to find first children with attribute
    const findDirectSubitems = () => {
        if (!menuRef?.current) return [];
        const directSubitems = [];
        const root = menuRef.current;
        const children = [...root.children];

        while (children.length > 0) {
            // if child is a menu item itself
            const element = children.shift();
            if (element.matches(MENU_ITEM_SELECTOR)) {
                // Skip original starting element if we went back to the wrapper
                if (!(menuRef.current.matches(MENU_ITEM_WRAPPER_SELECTOR) &&
                    Array.from(menuRef.current.children).includes(element))) {
                    directSubitems.push([element, element]);
                }
                continue;
            }
            if (element.matches(MENU_ITEM_WRAPPER_SELECTOR)) {
                const wrappedItems = Array.from(element.children).filter(child =>
                    child.matches(MENU_ITEM_SELECTOR)
                );
                wrappedItems.forEach(child => {
                    directSubitems.push([element, child]);
                });
            } else {
                children.push(...element.children);
            }
        }

        return directSubitems;
    };

    const isExpanded = useCallback(
        () => menuContext.isOpenMenu(menuRef),
        [menuContext, menuRef]
    );

    const refocusIndex = useCallback(index => {
        const items = findDirectSubitems(menuRef);
        if (items?.[index]) {
            items[index][0].focus();
            setFocusedIndex(index);
        }
    }, [menuRef]);

    const handleOnOpen = useCallback(() => {
        if (menuContext.isOpenMenu(menuRef)) return;

        menuContext.openInnerMenu(menuRef, depth);

        // Wait for the UI to be rendered before interacting with the DOM
        requestAnimationFrame(() => {
            refocusIndex(defaultIndexOnOpen);
        });
    }, [menuContext, menuRef, depth, defaultIndexOnOpen]);

    const handleOnClose = useCallback(() => {
        setFocusedIndex(-1);
        menuContext.closeMenuByRef(menuRef);
        menuRef?.current?.focus();
    }, [menuContext, menuRef]);

    const handleMove = useCallback(direction => {
        const items = findDirectSubitems(menuRef);
        if (!items?.length) return;

        const nextIndex = (focusedIndex + direction + items.length) % items.length;
        refocusIndex(nextIndex);
    }, [focusedIndex, menuRef, refocusIndex]);

    const handleKeyDownOpenMenu = useCallback(e => {
        const items = findDirectSubitems(menuRef);

        // Logic for vertical menus, will need to change when implementing for vertical
        switch (e.key) {
        case KEY.ARROW_DOWN:
            e.preventDefault();
            handleMove(1);
            break;
        case KEY.ARROW_UP:
            e.preventDefault();
            handleMove(-1);
            break;
        case KEY.ESCAPE:
        case KEY.ARROW_LEFT:
            e.preventDefault();
            handleOnClose();
            break;
        case KEY.ENTER:
            e.preventDefault();
            e.stopPropagation();
            // TODO: update how to recognize item to be clicked from parent
            if (items[focusedIndex]?.[0] === items[focusedIndex]?.[1]) {
                items[focusedIndex]?.[1].click();
            }
            break;
        }

    }, [handleMove, handleOnClose, focusedIndex]);

    const handleKeyDown = useCallback(e => {
        if (isExpanded() && e.key === KEY.TAB) {
            handleOnClose();
            menuContext.closeAllMenus();
            return;
        }

        if (menuContext.isInnermostMenu(menuRef)) {
            handleKeyDownOpenMenu(e);
        } else if (!isExpanded() && (e.key === KEY.ENTER || e.key === KEY.SPACE ||
            (e.key === KEY.ARROW_RIGHT && depth !== 1))) {
            e.preventDefault();
            handleOnOpen();
        }
    }, [
        depth,
        menuContext,
        menuRef,
        isExpanded,
        handleKeyDownOpenMenu,
        handleOnOpen,
        handleOnClose
    ]);

    return {
        menuRef,
        focusedIndex,
        isExpanded,
        handleKeyDown,
        handleKeyDownOpenMenu,
        handleOnOpen,
        handleOnClose
    };
}
