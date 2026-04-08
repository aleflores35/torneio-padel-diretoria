// Test handler to diagnose Vercel Function issue
module.exports = (req, res) => {
  try {
    console.log('Handler invoked');

    // Try to load the app
    const app = require('../backend/server');
    console.log('App loaded successfully');

    // Call the app
    app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
