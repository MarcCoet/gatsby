"use strict";

var _child_process = require("child_process");

var _hostedGitInfo = require("hosted-git-info");

var _hostedGitInfo2 = _interopRequireDefault(_hostedGitInfo);

var _fsExtra = require("fs-extra");

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*  weak */
let logger = console;

// Checks the existence of yarn package
// We use yarnpkg instead of yarn to avoid conflict with Hadoop yarn
// Refer to https://github.com/yarnpkg/yarn/issues/673
//
// Returns true if yarn exists, false otherwise
const shouldUseYarn = () => {
  try {
    (0, _child_process.execSync)(`yarnpkg --version`, { stdio: `ignore` });
    return true;
  } catch (e) {
    return false;
  }
};

// Executes `npm install` and `bower install` in rootPath.
//
// rootPath - String. Path to directory in which command will be executed.
// callback - Function. Takes stderr and stdout of executed process.
//
// Returns nothing.
const install = (rootPath, callback) => {
  const prevDir = process.cwd();
  logger.log(`Installing packages...`);
  process.chdir(rootPath);
  const installCmd = shouldUseYarn() ? `yarnpkg` : `npm install`;
  (0, _child_process.exec)(installCmd, (error, stdout, stderr) => {
    process.chdir(prevDir);
    if (stdout) console.log(stdout.toString());
    if (error !== null) {
      const msg = stderr.toString();
      callback(new Error(msg));
    }
    callback(null, stdout);
  });
};

const ignored = path => !/^\.(git|hg)$/.test(_path2.default.basename(path));

// Copy starter from file system.
//
// starterPath   - String, file system path from which files will be taken.
// rootPath     - String, directory to which starter files will be copied.
// callback     - Function.
//
// Returns nothing.
const copy = (starterPath, rootPath, callback) => {
  const copyDirectory = () => {
    _fsExtra2.default.copy(starterPath, rootPath, { filter: ignored }, error => {
      if (error !== null) return callback(new Error(error));
      logger.log(`Created starter directory layout`);
      install(rootPath, callback);
      return false;
    });
  };

  // Chmod with 755.
  // 493 = parseInt('755', 8)
  _fsExtra2.default.mkdirp(rootPath, { mode: 493 }, error => {
    if (error !== null) callback(new Error(error));
    return _fsExtra2.default.exists(starterPath, exists => {
      if (!exists) {
        const chmodError = `starter ${starterPath} doesn't exist`;
        return callback(new Error(chmodError));
      }
      logger.log(`Copying local starter to ${rootPath} ...`);

      copyDirectory();
      return true;
    });
  });
};

// Clones starter from URI.
//
// address     - String, URI. https:, github: or git: may be used.
// rootPath    - String, directory to which starter files will be copied.
// callback    - Function.
//
// Returns nothing.
const clone = (hostInfo, rootPath, callback) => {
  const url = hostInfo.git({ noCommittish: true });
  const branch = hostInfo.committish ? `-b ${hostInfo.committish}` : ``;

  logger.log(`Cloning git repo ${url} to ${rootPath}...`);
  const cmd = `git clone ${branch} ${url} ${rootPath} --single-branch`;

  (0, _child_process.exec)(cmd, (error, stdout, stderr) => {
    if (error !== null) {
      return callback(new Error(`Git clone error: ${stderr.toString()}`));
    }
    logger.log(`Created starter directory layout`);
    return _fsExtra2.default.remove(_path2.default.join(rootPath, `.git`), removeError => {
      if (error !== null) return callback(new Error(removeError));
      install(rootPath, callback);
      return true;
    });
  });
};

// Main function that clones or copies the starter.
//
// starter    - String, file system path or URI of starter.
// rootPath    - String, directory to which starter files will be copied.
// callback    - Function.
//
// Returns nothing.
const initStarter = (starter, options = {}) => new Promise((resolve, reject) => {
  const callback = (err, value) => err ? reject(err) : resolve(value);

  const cwd = process.cwd();
  const rootPath = options.rootPath || cwd;
  if (options.logger) logger = options.logger;

  if (_fsExtra2.default.existsSync(_path2.default.join(rootPath, `package.json`))) throw new Error(`Directory ${rootPath} is already an npm project`);

  const hostedInfo = _hostedGitInfo2.default.fromUrl(starter);

  if (hostedInfo) clone(hostedInfo, rootPath, callback);else copy(starter, rootPath, callback);
});

module.exports = initStarter;