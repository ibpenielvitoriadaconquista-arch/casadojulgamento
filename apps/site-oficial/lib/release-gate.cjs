'use strict';

// Fail closed: only the explicitly approved Production deployment may expose
// links to the external paid checkout. Preview/local environments stay closed.
function salesReleaseEnabled(env = process.env) {
  return env.VERCEL_ENV === 'production' && env.CDJ_SALES_RELEASE_APPROVED === 'true';
}

module.exports = { salesReleaseEnabled };
