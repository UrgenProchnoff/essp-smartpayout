// CommonJS entry point: unwraps the Babel `default` export so that
// `require('essp-smartpayout')` returns the SMARTPAYOUT class directly.
module.exports = require('./dist/module_smartpayout').default;
