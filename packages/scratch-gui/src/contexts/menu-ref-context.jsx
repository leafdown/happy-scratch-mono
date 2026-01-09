import React, {useCallback, useMemo, useState} from 'react';
import PropTypes from 'prop-types';

export const MenuRefContext = React.createContext(null);

export const MenuRefProvider = ({children}) => {
    const [refStack, setRefStack] = useState([]);

    const cut = useCallback(ref => {
        setRefStack(prev => {
            const index = prev.indexOf(ref);
            if (index === -1) return prev;
            return prev.slice(0, index);
        });
    }, []);

    const push = useCallback((ref, depth) => {
        setRefStack(prev => {
            let next = prev;

            if (depth <= prev.length) {
                const cutRef = prev[depth - 1];
                const index = prev.indexOf(cutRef);
                if (index !== -1) {
                    next = prev.slice(0, index);
                }
            }

            return [...next, ref];
        });
    }, []);

     
    const pop = useCallback(() => {
        setRefStack(prev => prev.slice(0, prev.length - 1));
    }, []);

    const clear = useCallback(() => {
        setRefStack([]);
    }, []);

    const bottomMenu = useMemo(() => (refStack.length > 0 ? refStack[0] : null), [refStack]);

    const isTopMenu = useCallback(ref => (refStack.length > 0 &&
        refStack[refStack.length - 1] === ref), [refStack]);

    const isOpenMenu = useCallback(ref => (refStack.includes(ref)), [refStack]);

    const value = useMemo(() => ({
        refStack,
        push,
        pop,
        cut,
        clear,
        isTopMenu,
        isOpenMenu,
        bottomMenu
    }), [
        refStack,
        push,
        pop,
        cut,
        clear,
        isTopMenu,
        isOpenMenu,
        bottomMenu
    ]);

    return (
        <MenuRefContext.Provider value={value}>
            {children}
        </MenuRefContext.Provider>
    );
};

MenuRefProvider.propTypes = {
    children: PropTypes.node
};
