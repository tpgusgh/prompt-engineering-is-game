// electron-builder afterSign hook (runs after the fuses are flipped, which
// would invalidate an earlier signature). CI builds have no Apple signing identity,
// and an Apple Silicon app whose bundle was modified after the Electron
// binary's own signature shows up as "damaged" once downloaded — so give it
// an ad-hoc signature (the usual "unidentified developer" prompt instead).
// A build with a real identity was already signed: left alone.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin' || process.env.CSC_IDENTITY_AUTO_DISCOVERY !== 'false') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};
