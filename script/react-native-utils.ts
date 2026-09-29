import * as fs from "fs";
import * as chalk from "chalk";
import * as path from "path";
import * as childProcess from "child_process";
import { coerce, compare, valid } from "semver";
import { fileDoesNotExistOrIsDirectory, fileExists } from "./utils/file-utils";

const g2js = require("gradle-to-js/lib/parser");

export function isValidVersion(version: string): boolean {
  return !!valid(version) || /^\d+\.\d+$/.test(version);
}

export async function runHermesEmitBinaryCommand(
    bundleName: string,
    outputFolder: string,
    sourcemapOutput: string,
    extraHermesFlags: string[],
    hermesCommand: string
): Promise<void> {
  const hermesArgs: string[] = [];
  const envNodeArgs: string = process.env.CODE_PUSH_NODE_ARGS;

  if (typeof envNodeArgs !== "undefined") {
    Array.prototype.push.apply(hermesArgs, envNodeArgs.trim().split(/\s+/));
  }

  Array.prototype.push.apply(hermesArgs, [
    "-emit-binary",
    "-out",
    path.join(outputFolder, bundleName + ".hbc"),
    path.join(outputFolder, bundleName),
    ...extraHermesFlags,
  ]);

  if (sourcemapOutput) {
    hermesArgs.push("-output-source-map");
  }

  console.log(chalk.cyan("Converting JS bundle to byte code via Hermes, running command:\n"));
  const hermesProcess = childProcess.spawn(hermesCommand, hermesArgs);
  console.log(`${hermesCommand} ${hermesArgs.join(" ")}`);

  return new Promise<void>((resolve, reject) => {
    hermesProcess.stdout.on("data", (data: Buffer) => {
      console.log(data.toString().trim());
    });

    hermesProcess.stderr.on("data", (data: Buffer) => {
      console.error(data.toString().trim());
    });

    hermesProcess.on("close", (exitCode: number, signal: string) => {
      if (exitCode !== 0) {
        reject(new Error(`"hermes" command failed (exitCode=${exitCode}, signal=${signal}).`));
      }
      // Copy HBC bundle to overwrite JS bundle
      const source = path.join(outputFolder, bundleName + ".hbc");
      const destination = path.join(outputFolder, bundleName);
      fs.copyFile(source, destination, (err) => {
        if (err) {
          console.error(err);
          reject(new Error(`Copying file ${source} to ${destination} failed. "hermes" previously exited with code ${exitCode}.`));
        }
        fs.unlink(source, (err) => {
          if (err) {
            console.error(err);
            reject(err);
          }
          resolve(null as void);
        });
      });
    });
  }).then(() => {
    if (!sourcemapOutput) {
      // skip source map compose if source map is not enabled
      return;
    }

    const composeSourceMapsPath = getComposeSourceMapsPath();
    if (!composeSourceMapsPath) {
      throw new Error("react-native compose-source-maps.js scripts is not found");
    }

    const jsCompilerSourceMapFile = path.join(outputFolder, bundleName + ".hbc" + ".map");
    if (!fs.existsSync(jsCompilerSourceMapFile)) {
      throw new Error(`sourcemap file ${jsCompilerSourceMapFile} is not found`);
    }

    return new Promise((resolve, reject) => {
      const composeSourceMapsArgs = [composeSourceMapsPath, sourcemapOutput, jsCompilerSourceMapFile, "-o", sourcemapOutput];

      // https://github.com/facebook/react-native/blob/master/react.gradle#L211
      // https://github.com/facebook/react-native/blob/master/scripts/react-native-xcode.sh#L178
      // packager.sourcemap.map + hbc.sourcemap.map = sourcemap.map
      const composeSourceMapsProcess = childProcess.spawn("node", composeSourceMapsArgs);
      console.log(`${composeSourceMapsPath} ${composeSourceMapsArgs.join(" ")}`);

      composeSourceMapsProcess.stdout.on("data", (data: Buffer) => {
        console.log(data.toString().trim());
      });

      composeSourceMapsProcess.stderr.on("data", (data: Buffer) => {
        console.error(data.toString().trim());
      });

      composeSourceMapsProcess.on("close", (exitCode: number, signal: string) => {
        if (exitCode !== 0) {
          reject(new Error(`"compose-source-maps" command failed (exitCode=${exitCode}, signal=${signal}).`));
        }

        // Delete the HBC sourceMap, otherwise it will be included in 'code-push' bundle as well
        fs.unlink(jsCompilerSourceMapFile, (err) => {
          if (err) {
            console.error(err);
            reject(err);
          }

          resolve(null);
        });
      });
    });
  });
}

function parseBuildGradleFile(gradleFile: string) {
  let buildGradlePath: string = path.join("android", "app");
  if (gradleFile) {
    buildGradlePath = gradleFile;
  }
  if (fs.lstatSync(buildGradlePath).isDirectory()) {
    buildGradlePath = path.join(buildGradlePath, "build.gradle");
  }

  if (fileDoesNotExistOrIsDirectory(buildGradlePath)) {
    throw new Error(`Unable to find gradle file "${buildGradlePath}".`);
  }

  return g2js.parseFile(buildGradlePath).catch(() => {
    throw new Error(`Unable to parse the "${buildGradlePath}" file. Please ensure it is a well-formed Gradle file.`);
  });
}

async function getHermesCommandFromGradle(gradleFile: string): Promise<string> {
  const buildGradle: any = await parseBuildGradleFile(gradleFile);
  const hermesCommandProperty: any = Array.from(buildGradle["project.ext.react"] || []).find((prop: string) =>
    prop.trim().startsWith("hermesCommand:")
  );
  if (hermesCommandProperty) {
    return hermesCommandProperty.replace("hermesCommand:", "").trim().slice(1, -1);
  } else {
    return "";
  }
}

export type HermesMarker = "on" | "off" | "absent";

// Legacy template (react-native <= 0.70): android/app/build.gradle has project.ext.react = [ enableHermes: true|false ]
export async function getAndroidLegacyHermesMarker(gradleFile: string): Promise<HermesMarker> {
  const buildGradle: any = await parseBuildGradleFile(gradleFile);
  const lines: string[] = Array.from(buildGradle["project.ext.react"] || []);
  if (lines.some((line: string) => /^enableHermes\s{0,}:\s{0,}true/.test(line))) {
    return "on";
  }
  if (lines.some((line: string) => /^enableHermes\s{0,}:\s{0,}false/.test(line))) {
    return "off";
  }
  return "absent";
}

export function getAndroidHermesEnabled(gradleFile: string): Promise<boolean> {
  return getAndroidLegacyHermesMarker(gradleFile).then((marker: HermesMarker) => marker === "on");
}

// Modern template (react-native >= 0.71): android/gradle.properties has hermesEnabled=true|false (or react.hermesEnabled).
// Mirrors Project.isHermesEnabled in @react-native/gradle-plugin: only an explicit "false" turns Hermes off.
export function getGradlePropertiesPath(gradleFile: string): string {
  let appDirectory: string = gradleFile || path.join("android", "app");
  if (!fileDoesNotExistOrIsDirectory(appDirectory)) {
    // a build.gradle file was given, not the app directory
    appDirectory = path.dirname(appDirectory);
  }
  // Gradle reads gradle.properties from the root project, i.e. the folder holding settings.gradle(.kts).
  // Walk up from the app module; fall back to the app module's parent (the standard android/ layout).
  let directory = path.resolve(appDirectory);
  for (let depth = 0; depth < 5; depth++) {
    if (fileExists(path.join(directory, "settings.gradle")) || fileExists(path.join(directory, "settings.gradle.kts"))) {
      return path.relative(process.cwd(), path.join(directory, "gradle.properties")) || "gradle.properties";
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
  return path.join(appDirectory, "..", "gradle.properties");
}

export function getAndroidGradlePropertiesHermesMarker(gradleFile: string): HermesMarker {
  const propertiesPath = getGradlePropertiesPath(gradleFile);
  if (!fileExists(propertiesPath)) {
    return "absent";
  }
  const properties = parsePropertiesFile(fs.readFileSync(propertiesPath, "utf8"));
  const value = properties.has("hermesEnabled") ? properties.get("hermesEnabled") : properties.get("react.hermesEnabled");
  if (value === undefined) {
    return "absent";
  }
  switch (value.trim().toLowerCase()) {
    case "true":
      return "on";
    case "false":
      return "off";
    default:
      return "absent"; // the gradle plugin treats anything else as "not set"
  }
}

function parsePropertiesFile(contents: string): Map<string, string> {
  const properties = new Map<string, string>();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) {
      continue;
    }
    const separator = line.search(/[=:]/);
    if (separator === -1) {
      continue;
    }
    properties.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return properties;
}

const PODFILE_HERMES_TRUE = /([^#\n]*:?hermes_enabled(\s+|\n+)?(=>|:)(\s+|\n+)?true)/; // unchanged legacy check
const PODFILE_HERMES_FALSE = /:?hermes_enabled(\s+|\n+)?(=>|:)(\s+|\n+)?false/;

function readPodfile(podFile: string): string {
  let podPath = path.join("ios", "Podfile");
  if (podFile) {
    podPath = podFile;
  }
  if (fileDoesNotExistOrIsDirectory(podPath)) {
    throw new Error(`Unable to find Podfile file "${podPath}".`);
  }
  return fs.readFileSync(podPath).toString();
}

export function getiOSPodfileHermesMarker(podFile: string): HermesMarker {
  const podFileContents = readPodfile(podFile);
  if (PODFILE_HERMES_TRUE.test(podFileContents)) {
    return "on";
  }
  const withoutComments = podFileContents
    .split(/\r?\n/)
    .map((line: string) => line.replace(/#(?!\{).*$/, "")) // "#{...}" is Ruby interpolation, not a comment
    .join("\n");
  if (PODFILE_HERMES_FALSE.test(withoutComments)) {
    return "off";
  }
  return "absent";
}

export function getiOSHermesEnabled(podFile: string): boolean {
  return getiOSPodfileHermesMarker(podFile) === "on";
}

function getPodfilePath(podFile: string): string {
  return podFile || path.join("ios", "Podfile");
}

// A Podfile can compute :hermes_enabled (Expo: podfile_properties['expo.jsEngine'], a Ruby variable, USE_HERMES=0),
// which the regexes cannot see. Two cheap, opt-out-only signals next to the Podfile say the app was built without Hermes:
//   - Podfile.properties.json (Expo prebuild) with "expo.jsEngine": "jsc"
//   - Podfile.lock without the hermes-engine pod (every Hermes build since react-native 0.70 has it)
// Returns the reason when JSC is detected, otherwise null. Never turns Hermes on.
export function getiOSNoHermesEvidence(podFile: string): string | null {
  const podDirectory = path.dirname(getPodfilePath(podFile));
  const propertiesPath = path.join(podDirectory, "Podfile.properties.json");
  if (fileExists(propertiesPath)) {
    try {
      const properties = JSON.parse(fs.readFileSync(propertiesPath, "utf8"));
      if (properties && String(properties["expo.jsEngine"]).toLowerCase() === "jsc") {
        return `${propertiesPath} sets expo.jsEngine to jsc`;
      }
    } catch (error) {
      // unreadable properties file: no evidence either way
    }
  }
  const lockPath = path.join(podDirectory, "Podfile.lock");
  if (fileExists(lockPath) && !/^\s*-\s*"?hermes-engine\b/m.test(fs.readFileSync(lockPath, "utf8"))) {
    return `${lockPath} has no hermes-engine pod`;
  }
  return null;
}

export function isReactNativeVersionAtLeast(minimumVersion: string): boolean {
  const version = coerce(getReactNativeVersion());
  return !!version && compare(version.version, minimumVersion) >= 0;
}

// First react-native version whose Android gradle plugin and Podfile default to Hermes when nothing says otherwise.
export const MODERN_HERMES_DEFAULT_MIN_VERSION = "0.71.0";

export interface HermesDecision {
  enabled: boolean;
  forced: boolean; // true only for --useHermes: a missing compiler is then an error, not a warning
  reason: string; // one line for the release log
}

function decide(enabled: boolean, reason: string, forced: boolean = false): HermesDecision {
  return { enabled, forced, reason };
}

export async function getHermesDecision(
  platform: string,
  useHermes: boolean | undefined,
  gradleFile: string,
  podFile: string
): Promise<HermesDecision> {
  if (useHermes === true) {
    return decide(true, "--useHermes was passed, automatic checks skipped", /*forced*/ true);
  }
  if (useHermes === false) {
    return decide(false, "--useHermes false was passed, automatic checks skipped");
  }

  if (platform === "android") {
    const legacy = await getAndroidLegacyHermesMarker(gradleFile);
    if (legacy === "on") {
      return decide(true, "build.gradle sets project.ext.react enableHermes: true");
    }
    if (legacy === "off") {
      return decide(false, "build.gradle sets project.ext.react enableHermes: false");
    }
    const reactNativeVersion = getReactNativeVersion();
    if (!isReactNativeVersionAtLeast(MODERN_HERMES_DEFAULT_MIN_VERSION)) {
      return decide(false, `react-native ${reactNativeVersion} is below ${MODERN_HERMES_DEFAULT_MIN_VERSION} and build.gradle has no enableHermes marker`);
    }
    const propertiesPath = getGradlePropertiesPath(gradleFile);
    switch (getAndroidGradlePropertiesHermesMarker(gradleFile)) {
      case "off":
        return decide(false, `${propertiesPath} sets hermesEnabled=false`);
      case "on":
        return decide(true, `${propertiesPath} sets hermesEnabled=true`);
      default:
        return decide(true, `${propertiesPath} has no hermesEnabled, default is true for react-native ${reactNativeVersion}`);
    }
  }

  if (platform === "ios") {
    const marker = getiOSPodfileHermesMarker(podFile);
    if (marker === "on") {
      return decide(true, "Podfile sets :hermes_enabled => true");
    }
    if (marker === "off") {
      return decide(false, "Podfile sets :hermes_enabled => false");
    }
    const reactNativeVersion = getReactNativeVersion();
    if (!isReactNativeVersionAtLeast(MODERN_HERMES_DEFAULT_MIN_VERSION)) {
      return decide(false, `react-native ${reactNativeVersion} is below ${MODERN_HERMES_DEFAULT_MIN_VERSION} and the Podfile has no :hermes_enabled marker`);
    }
    const noHermesEvidence = getiOSNoHermesEvidence(podFile);
    if (noHermesEvidence) {
      return decide(false, noHermesEvidence);
    }
    return decide(true, `Podfile has no :hermes_enabled => false, default is true for react-native ${reactNativeVersion}`);
  }

  return decide(false, `Hermes is not used for platform "${platform}"`);
}

function getHermesOSBin(): string {
  switch (process.platform) {
    case "win32":
      return "win64-bin";
    case "darwin":
      return "osx-bin";
    case "freebsd":
    case "linux":
    case "sunos":
    default:
      return "linux64-bin";
  }
}

function getHermesOSExe(): string {
  const react63orAbove = compare(coerce(getReactNativeVersion()).version, "0.63.0") !== -1;
  const hermesExecutableName = react63orAbove ? "hermesc" : "hermes";
  switch (process.platform) {
    case "win32":
      return hermesExecutableName + ".exe";
    default:
      return hermesExecutableName;
  }
}

export interface HermesCommandLookup {
  command: string | null;
  searched: string[]; // every candidate path, in lookup order, for the warning / error message
}

// Lookup order (first existing file wins):
//   1. react-native/sdks/hermesc      – bundled with react-native 0.69 … 0.82; also the customer's copy workaround
//   2. project.ext.react hermesCommand – explicit legacy gradle config (Android only); honoured before any package lookup,
//                                        like the react-native gradle plugin does
//   3. hermes-compiler/hermesc         – separate npm package since react-native 0.83, version pinned by react-native
//   4. hermes-engine                   – npm package used before 0.69
//   5. hermesvm                        – npm package used before 0.60
// Candidates are computed lazily: resolving a package spawns a node process and the gradle candidate parses
// build.gradle, both skipped once an earlier candidate matches (so --useHermes with sdks/hermesc never reads gradle).
export async function findHermesCommand(platform: string, gradleFile: string): Promise<HermesCommandLookup> {
  const candidates: Array<() => Promise<string | null>> = [
    async () => path.join(getReactNativePackagePath(), "sdks", "hermesc", getHermesOSBin(), getHermesOSExe()),
  ];
  if (platform === "android") {
    candidates.push(async () => {
      const gradleHermesCommand = await getHermesCommandFromGradle(gradleFile);
      return gradleHermesCommand ? path.join("android", "app", gradleHermesCommand.replace("%OS-BIN%", getHermesOSBin())) : null;
    });
  }
  // hermes-compiler is a dependency of react-native: resolve it from the react-native package first so isolated
  // layouts (pnpm, nested node_modules) work, then from the project root.
  candidates.push(async () =>
    path.join(resolvePackageDirectory("hermes-compiler", [getReactNativePackagePath()]), "hermesc", getHermesOSBin(), getHermesOSExe())
  );
  candidates.push(async () => path.join("node_modules", "hermes-engine", getHermesOSBin(), getHermesOSExe()));
  candidates.push(async () => path.join("node_modules", "hermesvm", getHermesOSBin(), "hermes"));

  const searched: string[] = [];
  for (const candidate of candidates) {
    const candidatePath = await candidate();
    if (candidatePath === null) {
      continue;
    }
    searched.push(candidatePath);
    if (fileExists(candidatePath)) {
      return { command: candidatePath, searched };
    }
  }
  return { command: null, searched };
}

function getComposeSourceMapsPath(): string {
  // detect if compose-source-maps.js script exists
  const composeSourceMaps = path.join(getReactNativePackagePath(), "scripts", "compose-source-maps.js");
  if (fs.existsSync(composeSourceMaps)) {
    return composeSourceMaps;
  }
  return null;
}

function getReactNativePackagePath(): string {
  return resolvePackageDirectory("react-native");
}

// Resolves an npm package the way the project would: node resolution from the given directories, then from the CWD;
// falls back to node_modules/<name>.
function resolvePackageDirectory(packageName: string, fromDirectories: string[] = []): string {
  const paths = JSON.stringify([...fromDirectories.map((directory: string) => path.resolve(directory)), process.cwd()]);
  const result = childProcess.spawnSync("node", ["--print", `require.resolve('${packageName}/package.json', { paths: ${paths} })`]);
  const packagePath = path.dirname(result.stdout.toString().trim());
  if (result.status === 0 && directoryExistsSync(packagePath)) {
    return packagePath;
  }

  return path.join("node_modules", packageName);
}

export function directoryExistsSync(dirname: string): boolean {
  try {
    return fs.statSync(dirname).isDirectory();
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
  return false;
}

export function getReactNativeVersion(): string {
  let packageJsonFilename;
  let projectPackageJson;
  try {
    packageJsonFilename = path.join(process.cwd(), "package.json");
    projectPackageJson = JSON.parse(fs.readFileSync(packageJsonFilename, "utf-8"));
  } catch (error) {
    throw new Error(
      `Unable to find or read "package.json" in the CWD. The "release-react" command must be executed in a React Native project folder.`
    );
  }

  const projectName: string = projectPackageJson.name;
  if (!projectName) {
    throw new Error(`The "package.json" file in the CWD does not have the "name" field set.`);
  }

  return (
    (projectPackageJson.dependencies && projectPackageJson.dependencies["react-native"]) ||
    (projectPackageJson.devDependencies && projectPackageJson.devDependencies["react-native"])
  );
}