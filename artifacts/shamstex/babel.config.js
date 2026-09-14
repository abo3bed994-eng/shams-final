module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === "production" || process.env.EAS_BUILD === "true";
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: isProduction
      ? [["transform-remove-console", { exclude: ["error", "warn"] }]]
      : [],
  };
};
