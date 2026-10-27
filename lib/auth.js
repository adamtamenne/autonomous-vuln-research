// Auth guard for routes that require a logged-in session.
module.exports = function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.redirect('/');
  next();
};
