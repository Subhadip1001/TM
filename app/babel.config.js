module.exports = function(api) {
  api.cache(true);
  const plugins = [];

  // Strip console.log and debugging symbols in production
  if (process.env.NODE_ENV === 'production') {
    plugins.push('transform-remove-console');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins: plugins,
  };
};
