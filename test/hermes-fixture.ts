// Builds a throw-away React Native project skeleton in os.tmpdir() for the Hermes tests.
// Real fixtures cannot be committed: they need a node_modules/ tree, which .gitignore excludes.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type HermescLocation = "sdks" | "compiler" | "compiler-nested" | "engine" | "vm" | "custom";

export interface FixtureOptions {
  reactNativeVersion: string; // exact version written to package.json, e.g. "0.84.1"
  buildGradle?: string; // contents of <appDirectory>/build.gradle; omit → no android/ folder
  appDirectory?: string; // where build.gradle goes, default android/app
  settingsGradle?: boolean; // also write android/settings.gradle (marks the Gradle root project)
  gradleProperties?: string; // contents of android/gradle.properties; omit → file absent
  podfile?: string; // contents of ios/Podfile; omit → no ios/ folder
  podfileLock?: string; // contents of ios/Podfile.lock; omit → absent
  podfileProperties?: string; // contents of ios/Podfile.properties.json (Expo prebuild); omit → absent
  hermesc?: HermescLocation[]; // which hermesc candidates exist as executable stubs
}

export function osBin(): string {
  switch (process.platform) {
    case "win32":
      return "win64-bin";
    case "darwin":
      return "osx-bin";
    default:
      return "linux64-bin";
  }
}

export function hermescExe(): string {
  return process.platform === "win32" ? "hermesc.exe" : "hermesc";
}

export function createFixtureProject(opts: FixtureOptions): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codepush-hermes-"));
  write(root, "package.json", JSON.stringify({ name: "fixture", dependencies: { "react-native": opts.reactNativeVersion } }));
  write(root, "node_modules/react-native/package.json", JSON.stringify({ name: "react-native", version: opts.reactNativeVersion }));
  if (opts.buildGradle !== undefined) write(root, path.join(opts.appDirectory || path.join("android", "app"), "build.gradle"), opts.buildGradle);
  if (opts.settingsGradle) write(root, "android/settings.gradle", "rootProject.name = 'fixture'\n");
  if (opts.gradleProperties !== undefined) write(root, "android/gradle.properties", opts.gradleProperties);
  if (opts.podfile !== undefined) write(root, "ios/Podfile", opts.podfile);
  if (opts.podfileLock !== undefined) write(root, "ios/Podfile.lock", opts.podfileLock);
  if (opts.podfileProperties !== undefined) write(root, "ios/Podfile.properties.json", opts.podfileProperties);
  for (const location of opts.hermesc || []) {
    switch (location) {
      case "sdks":
        writeExe(root, path.join("node_modules", "react-native", "sdks", "hermesc", osBin(), hermescExe()));
        break;
      case "compiler":
        write(root, "node_modules/hermes-compiler/package.json", JSON.stringify({ name: "hermes-compiler", version: "250829098.0.9" }));
        writeExe(root, path.join("node_modules", "hermes-compiler", "hermesc", osBin(), hermescExe()));
        break;
      case "compiler-nested": // isolated layout (pnpm): hermes-compiler lives under react-native's own node_modules
        write(root, "node_modules/react-native/node_modules/hermes-compiler/package.json", JSON.stringify({ name: "hermes-compiler", version: "250829098.0.9" }));
        writeExe(root, path.join("node_modules", "react-native", "node_modules", "hermes-compiler", "hermesc", osBin(), hermescExe()));
        break;
      case "engine":
        writeExe(root, path.join("node_modules", "hermes-engine", osBin(), hermescExe()));
        break;
      case "vm":
        writeExe(root, path.join("node_modules", "hermesvm", osBin(), "hermes"));
        break;
      case "custom": // referenced by LEGACY_GRADLE_HERMES_COMMAND
        writeExe(root, path.join("custom-hermes", osBin(), hermescExe()));
        break;
    }
  }
  return root;
}

export function removeFixtureProject(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}

// Gradle / Podfile snippets reused by the tests
export const LEGACY_GRADLE_HERMES_ON = `apply plugin: "com.android.application"\nproject.ext.react = [\n    enableHermes: true,  // clean and rebuild if changing\n]\n`;
export const LEGACY_GRADLE_HERMES_OFF = `apply plugin: "com.android.application"\nproject.ext.react = [\n    enableHermes: false,  // clean and rebuild if changing\n]\n`;
export const LEGACY_GRADLE_HERMES_COMMAND = `apply plugin: "com.android.application"\nproject.ext.react = [\n    enableHermes: true,\n    hermesCommand: "../../custom-hermes/%OS-BIN%/hermesc",\n]\n`;
export const MODERN_GRADLE = `apply plugin: "com.android.application"\napply plugin: "com.facebook.react"\nreact {\n    autolinkLibrariesWithApp()\n}\n`;
export const PODFILE_TRUE = `use_react_native!(\n  :path => config[:reactNativePath],\n  :hermes_enabled => true,\n)\n`;
export const PODFILE_FALSE = `use_react_native!(\n  :path => config[:reactNativePath],\n  # to enable hermes on iOS, change \`false\` to \`true\` and then install pods\n  :hermes_enabled => false\n)\n`;
export const PODFILE_FLAGS = `use_react_native!(\n  :path => config[:reactNativePath],\n  :hermes_enabled => flags[:hermes_enabled],\n)\n`;
export const PODFILE_MODERN = `use_react_native!(\n  :path => config[:reactNativePath],\n  :app_path => "#{Pod::Config.instance.installation_root}/.."\n)\n`;
export const PODFILE_ONE_LINE_FALSE = `use_react_native!(:path => config[:reactNativePath], :app_path => "#{Pod::Config.instance.installation_root}/..", :hermes_enabled => false)\n`;
export const PODFILE_EXPO = `use_react_native!(\n  :path => config[:reactNativePath],\n  :hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',\n)\n`;
export const PODFILE_LOCK_HERMES = `PODS:\n  - boost (1.84.0)\n  - hermes-engine (0.84.1):\n    - hermes-engine/Pre-built (= 0.84.1)\n  - React-Core (0.84.1)\n`;
export const PODFILE_LOCK_JSC = `PODS:\n  - boost (1.84.0)\n  - React-Core (0.76.0)\n  - React-jsc (0.76.0)\n`;
export const PODFILE_COMMENTED_FALSE = `use_react_native!(\n  :path => config[:reactNativePath],\n  # :hermes_enabled => false\n)\n`;

function write(root: string, relative: string, contents: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function writeExe(root: string, relative: string): void {
  write(root, relative, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(path.join(root, relative), 0o755);
}
