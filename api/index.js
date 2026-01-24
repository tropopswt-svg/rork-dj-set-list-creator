module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    name: 'DJ Set List Creator API',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      import: 'POST /api/import',
    },
  });
};
