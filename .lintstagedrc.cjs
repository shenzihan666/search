module.exports = {
  "*.{js,jsx,ts,tsx,json,css}": [
    "biome check --write --no-errors-on-unmatched",
  ],
  "*.{ts,tsx}": ["tsc-files --noEmit --pretty false"],
  "*.rs": ["rustfmt --edition 2021"],
};
