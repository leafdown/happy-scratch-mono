import PropTypes from 'prop-types';

const propTypes = {
    ref: PropTypes.shape({
        current: PropTypes.instanceOf(Element)
    })
};

export default propTypes;
