module.exports = {
  "env": {
    "browser": true,
    "node": true,
    "es6": true,
    "mocha": true,
  },
  "parserOptions": {
    "ecmaVersion": 2017,
  },
  "ecmaFeatures": {
    "jsx": true,
  },
  "rules": {
    "quotes": "error",
    "no-redeclare": 2,
    "no-shadow": 2,
    "semi": [2, "always"],
    "no-else-return": 2,
    "default-case": 2,
    "comma-dangle": [2, "always-multiline"],
    "no-dupe-keys": 2,
    "no-duplicate-case": 2,
    "no-func-assign": 2,
    "no-undef": "error",
    "no-unused-vars": "error",
  },
}
