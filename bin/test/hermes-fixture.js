"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PODFILE_COMMENTED_FALSE = exports.PODFILE_LOCK_JSC = exports.PODFILE_LOCK_HERMES = exports.PODFILE_EXPO = exports.PODFILE_ONE_LINE_FALSE = exports.PODFILE_MODERN = exports.PODFILE_FLAGS = exports.PODFILE_FALSE = exports.PODFILE_TRUE = exports.MODERN_GRADLE = exports.LEGACY_GRADLE_HERMES_COMMAND = exports.LEGACY_GRADLE_HERMES_OFF = exports.LEGACY_GRADLE_HERMES_ON = exports.removeFixtureProject = exports.createFixtureProject = exports.hermescExe = exports.osBin = void 0;
// Builds a throw-away React Native project skeleton in os.tmpdir() for the Hermes tests.
// Real fixtures cannot be committed: they need a node_modules/ tree, which .gitignore excludes.
const fs = require("fs");
const os = require("os");
const path = require("path");
function osBin() {
    switch (process.platform) {
        case "win32":
            return "win64-bin";
        case "darwin":
            return "osx-bin";
        default:
            return "linux64-bin";
    }
}
exports.osBin = osBin;
function hermescExe() {
    return process.platform === "win32" ? "hermesc.exe" : "hermesc";
}
exports.hermescExe = hermescExe;
function createFixtureProject(opts) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "codepush-hermes-"));
    write(root, "package.json", JSON.stringify({ name: "fixture", dependencies: { "react-native": opts.reactNativeVersion } }));
    write(root, "node_modules/react-native/package.json", JSON.stringify({ name: "react-native", version: opts.reactNativeVersion }));
    if (opts.buildGradle !== undefined)
        write(root, path.join(opts.appDirectory || path.join("android", "app"), "build.gradle"), opts.buildGradle);
    if (opts.settingsGradle)
        write(root, "android/settings.gradle", "rootProject.name = 'fixture'\n");
    if (opts.gradleProperties !== undefined)
        write(root, "android/gradle.properties", opts.gradleProperties);
    if (opts.podfile !== undefined)
        write(root, "ios/Podfile", opts.podfile);
    if (opts.podfileLock !== undefined)
        write(root, "ios/Podfile.lock", opts.podfileLock);
    if (opts.podfileProperties !== undefined)
        write(root, "ios/Podfile.properties.json", opts.podfileProperties);
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
exports.createFixtureProject = createFixtureProject;
function removeFixtureProject(root) {
    fs.rmSync(root, { recursive: true, force: true });
}
exports.removeFixtureProject = removeFixtureProject;
// Gradle / Podfile snippets reused by the tests
exports.LEGACY_GRADLE_HERMES_ON = `apply plugin: "com.android.application"\nproject.ext.react = [\n    enableHermes: true,  // clean and rebuild if changing\n]\n`;
exports.LEGACY_GRADLE_HERMES_OFF = `apply plugin: "com.android.application"\nproject.ext.react = [\n    enableHermes: false,  // clean and rebuild if changing\n]\n`;
exports.LEGACY_GRADLE_HERMES_COMMAND = `apply plugin: "com.android.application"\nproject.ext.react = [\n    enableHermes: true,\n    hermesCommand: "../../custom-hermes/%OS-BIN%/hermesc",\n]\n`;
exports.MODERN_GRADLE = `apply plugin: "com.android.application"\napply plugin: "com.facebook.react"\nreact {\n    autolinkLibrariesWithApp()\n}\n`;
exports.PODFILE_TRUE = `use_react_native!(\n  :path => config[:reactNativePath],\n  :hermes_enabled => true,\n)\n`;
exports.PODFILE_FALSE = `use_react_native!(\n  :path => config[:reactNativePath],\n  # to enable hermes on iOS, change \`false\` to \`true\` and then install pods\n  :hermes_enabled => false\n)\n`;
exports.PODFILE_FLAGS = `use_react_native!(\n  :path => config[:reactNativePath],\n  :hermes_enabled => flags[:hermes_enabled],\n)\n`;
exports.PODFILE_MODERN = `use_react_native!(\n  :path => config[:reactNativePath],\n  :app_path => "#{Pod::Config.instance.installation_root}/.."\n)\n`;
exports.PODFILE_ONE_LINE_FALSE = `use_react_native!(:path => config[:reactNativePath], :app_path => "#{Pod::Config.instance.installation_root}/..", :hermes_enabled => false)\n`;
exports.PODFILE_EXPO = `use_react_native!(\n  :path => config[:reactNativePath],\n  :hermes_enabled => podfile_properties['expo.jsEngine'] == nil || podfile_properties['expo.jsEngine'] == 'hermes',\n)\n`;
exports.PODFILE_LOCK_HERMES = `PODS:\n  - boost (1.84.0)\n  - hermes-engine (0.84.1):\n    - hermes-engine/Pre-built (= 0.84.1)\n  - React-Core (0.84.1)\n`;
exports.PODFILE_LOCK_JSC = `PODS:\n  - boost (1.84.0)\n  - React-Core (0.76.0)\n  - React-jsc (0.76.0)\n`;
exports.PODFILE_COMMENTED_FALSE = `use_react_native!(\n  :path => config[:reactNativePath],\n  # :hermes_enabled => false\n)\n`;
function write(root, relative, contents) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
}
function writeExe(root, relative) {
    write(root, relative, "#!/bin/sh\nexit 0\n");
    fs.chmodSync(path.join(root, relative), 0o755);
}
