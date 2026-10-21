/**
 * Unit tests run in Node against the wrapper sources. The editor bundle
 * (@scratch/scratch-gui/standalone) and scratch-storage are replaced with test
 * doubles so the tests do not depend on built packages or a browser.
 */
module.exports = {
    testEnvironment: 'node',
    testMatch: ['<rootDir>/test/**/*.test.js'],
    moduleFileExtensions: ['js', 'jsx'],
    moduleNameMapper: {
        '^@scratch/scratch-gui/standalone$': '<rootDir>/test/mocks/scratch-gui-standalone.js',
        '^@scratch/scratch-storage$': '<rootDir>/test/mocks/scratch-storage.js'
    },
    transform: {
        // Inline Babel options keep this file out of the webpack build config.
        '^.+\\.[jt]sx?$': ['babel-jest', {
            babelrc: false,
            configFile: false,
            presets: [
                ['@babel/preset-env', {targets: {node: 'current'}}],
                '@babel/preset-react'
            ]
        }]
    },
    reporters: [
        'default',
        ['jest-junit', {outputDirectory: 'test-results', outputName: 'junit.xml'}]
    ]
};
