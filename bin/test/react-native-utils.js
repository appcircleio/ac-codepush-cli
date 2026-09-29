"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const childProcess = require("child_process");
const path = require("path");
const rnUtils = require("../script/react-native-utils");
const hermes_fixture_1 = require("./hermes-fixture");
// Every test runs inside a generated project (the code under test reads process.cwd()).
describe("react-native-utils Hermes", () => {
    const originalCwd = process.cwd();
    let root;
    afterEach(() => {
        process.chdir(originalCwd);
        if (root)
            (0, hermes_fixture_1.removeFixtureProject)(root);
        root = undefined;
    });
    function enter(opts) {
        root = (0, hermes_fixture_1.createFixtureProject)(opts);
        process.chdir(root);
    }
    // re-enter a second project inside one test
    function reenter(opts) {
        process.chdir(originalCwd);
        (0, hermes_fixture_1.removeFixtureProject)(root);
        enter(opts);
    }
    describe("markers", () => {
        describe("getAndroidLegacyHermesMarker", () => {
            it("is on for project.ext.react enableHermes: true", async () => {
                enter({ reactNativeVersion: "0.70.15", buildGradle: hermes_fixture_1.LEGACY_GRADLE_HERMES_ON });
                assert.strictEqual(await rnUtils.getAndroidLegacyHermesMarker(undefined), "on");
            });
            it("is off for project.ext.react enableHermes: false", async () => {
                enter({ reactNativeVersion: "0.64.4", buildGradle: hermes_fixture_1.LEGACY_GRADLE_HERMES_OFF });
                assert.strictEqual(await rnUtils.getAndroidLegacyHermesMarker(undefined), "off");
            });
            it("is absent for the modern gradle file", async () => {
                enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE });
                assert.strictEqual(await rnUtils.getAndroidLegacyHermesMarker(undefined), "absent");
            });
            it("keeps getAndroidHermesEnabled's answer", async () => {
                enter({ reactNativeVersion: "0.70.15", buildGradle: hermes_fixture_1.LEGACY_GRADLE_HERMES_ON });
                assert.strictEqual(await rnUtils.getAndroidHermesEnabled(undefined), true);
            });
        });
        describe("getiOSPodfileHermesMarker", () => {
            it("is on for :hermes_enabled => true", () => {
                enter({ reactNativeVersion: "0.70.15", podfile: hermes_fixture_1.PODFILE_TRUE });
                assert.strictEqual(rnUtils.getiOSPodfileHermesMarker(undefined), "on");
            });
            it("is off for :hermes_enabled => false", () => {
                enter({ reactNativeVersion: "0.64.4", podfile: hermes_fixture_1.PODFILE_FALSE });
                assert.strictEqual(rnUtils.getiOSPodfileHermesMarker(undefined), "off");
            });
            it("is absent for flags[:hermes_enabled]", () => {
                enter({ reactNativeVersion: "0.72.0", podfile: hermes_fixture_1.PODFILE_FLAGS });
                assert.strictEqual(rnUtils.getiOSPodfileHermesMarker(undefined), "absent");
            });
            it("is absent for the modern Podfile", () => {
                enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_MODERN });
                assert.strictEqual(rnUtils.getiOSPodfileHermesMarker(undefined), "absent");
            });
            it("ignores a commented-out :hermes_enabled => false", () => {
                enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_COMMENTED_FALSE });
                assert.strictEqual(rnUtils.getiOSPodfileHermesMarker(undefined), "absent");
            });
            it("keeps :hermes_enabled => false on a single line with Ruby interpolation", () => {
                enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_ONE_LINE_FALSE });
                assert.strictEqual(rnUtils.getiOSPodfileHermesMarker(undefined), "off");
            });
            it("ignores a commented-out :hermes_enabled => false in a CRLF Podfile", () => {
                enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_COMMENTED_FALSE.replace(/\n/g, "\r\n") });
                assert.strictEqual(rnUtils.getiOSPodfileHermesMarker(undefined), "absent");
            });
            it("honours --podFile", () => {
                enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_MODERN });
                assert.strictEqual(rnUtils.getiOSPodfileHermesMarker(path.join("ios", "Podfile")), "absent");
            });
        });
        describe("getAndroidGradlePropertiesHermesMarker", () => {
            it("is absent when gradle.properties does not exist", () => {
                enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE });
                assert.strictEqual(rnUtils.getAndroidGradlePropertiesHermesMarker(undefined), "absent");
            });
            it("is on for hermesEnabled=true", () => {
                enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, gradleProperties: "org.gradle.jvmargs=-Xmx2g\nhermesEnabled=true\n" });
                assert.strictEqual(rnUtils.getAndroidGradlePropertiesHermesMarker(undefined), "on");
            });
            it("is off for hermesEnabled=false, case-insensitive and trimmed", () => {
                enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, gradleProperties: "hermesEnabled = False \n" });
                assert.strictEqual(rnUtils.getAndroidGradlePropertiesHermesMarker(undefined), "off");
            });
            it("is off for react.hermesEnabled=false", () => {
                enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, gradleProperties: "react.hermesEnabled=false\n" });
                assert.strictEqual(rnUtils.getAndroidGradlePropertiesHermesMarker(undefined), "off");
            });
            it("prefers hermesEnabled over react.hermesEnabled", () => {
                enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, gradleProperties: "react.hermesEnabled=false\nhermesEnabled=true\n" });
                assert.strictEqual(rnUtils.getAndroidGradlePropertiesHermesMarker(undefined), "on");
            });
            it("ignores comments and unknown values", () => {
                enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, gradleProperties: "# hermesEnabled=false\nhermesEnabled=maybe\n" });
                assert.strictEqual(rnUtils.getAndroidGradlePropertiesHermesMarker(undefined), "absent");
            });
            it("resolves gradle.properties next to a custom --gradleFile directory", () => {
                enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, gradleProperties: "hermesEnabled=false\n" });
                assert.strictEqual(rnUtils.getGradlePropertiesPath(path.join("android", "app")), path.join("android", "gradle.properties"));
                assert.strictEqual(rnUtils.getGradlePropertiesPath(path.join("android", "app", "build.gradle")), path.join("android", "gradle.properties"));
                assert.strictEqual(rnUtils.getAndroidGradlePropertiesHermesMarker(path.join("android", "app", "build.gradle")), "off");
            });
            it("reads gradle.properties from the settings.gradle folder for a nested app module", () => {
                enter({
                    reactNativeVersion: "0.84.1",
                    buildGradle: hermes_fixture_1.MODERN_GRADLE,
                    appDirectory: path.join("android", "apps", "mobile"),
                    settingsGradle: true,
                    gradleProperties: "hermesEnabled=false\n",
                });
                assert.strictEqual(rnUtils.getGradlePropertiesPath(path.join("android", "apps", "mobile")), path.join("android", "gradle.properties"));
                assert.strictEqual(rnUtils.getAndroidGradlePropertiesHermesMarker(path.join("android", "apps", "mobile")), "off");
            });
        });
        describe("isReactNativeVersionAtLeast", () => {
            it("is false for 0.70.15 against 0.71.0", () => {
                enter({ reactNativeVersion: "0.70.15" });
                assert.strictEqual(rnUtils.isReactNativeVersionAtLeast("0.71.0"), false);
            });
            it("is true for 0.71.0 and for a caret range", () => {
                enter({ reactNativeVersion: "0.71.0" });
                assert.strictEqual(rnUtils.isReactNativeVersionAtLeast("0.71.0"), true);
                reenter({ reactNativeVersion: "^0.84.1" });
                assert.strictEqual(rnUtils.isReactNativeVersionAtLeast("0.71.0"), true);
            });
            it("is false when the version cannot be parsed", () => {
                enter({ reactNativeVersion: "github:facebook/react-native" });
                assert.strictEqual(rnUtils.isReactNativeVersionAtLeast("0.71.0"), false);
            });
        });
    });
    describe("getHermesDecision", () => {
        it("--useHermes forces Hermes without reading any file", async () => {
            enter({ reactNativeVersion: "0.64.4" }); // no android/, no ios/
            const decision = await rnUtils.getHermesDecision("android", true, undefined, undefined);
            assert.deepStrictEqual({ enabled: decision.enabled, forced: decision.forced }, { enabled: true, forced: true });
        });
        it("--useHermes false disables Hermes without reading any file", async () => {
            enter({ reactNativeVersion: "0.84.1" });
            const decision = await rnUtils.getHermesDecision("ios", false, undefined, undefined);
            assert.deepStrictEqual({ enabled: decision.enabled, forced: decision.forced }, { enabled: false, forced: false });
        });
        it("android legacy enableHermes: true → enabled (0.70)", async () => {
            enter({ reactNativeVersion: "0.70.15", buildGradle: hermes_fixture_1.LEGACY_GRADLE_HERMES_ON });
            const decision = await rnUtils.getHermesDecision("android", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, true);
            assert.strictEqual(decision.forced, false);
            assert.ok(/enableHermes: true/.test(decision.reason), decision.reason);
        });
        it("android legacy enableHermes: false → disabled even on 0.84", async () => {
            enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.LEGACY_GRADLE_HERMES_OFF, gradleProperties: "hermesEnabled=true\n" });
            const decision = await rnUtils.getHermesDecision("android", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, false);
        });
        it("android 0.70 with no marker → disabled, and the reason names the version gate", async () => {
            enter({ reactNativeVersion: "0.70.15", buildGradle: hermes_fixture_1.MODERN_GRADLE });
            const decision = await rnUtils.getHermesDecision("android", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, false);
            assert.ok(/0\.70\.15 is below 0\.71\.0/.test(decision.reason), decision.reason);
        });
        it("android 0.71 with no marker → enabled by default", async () => {
            enter({ reactNativeVersion: "0.71.0", buildGradle: hermes_fixture_1.MODERN_GRADLE });
            const decision = await rnUtils.getHermesDecision("android", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, true);
            assert.ok(/default is true/.test(decision.reason), decision.reason);
        });
        it("android 0.84 hermesEnabled=false → disabled", async () => {
            enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, gradleProperties: "hermesEnabled=false\n" });
            const decision = await rnUtils.getHermesDecision("android", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, false);
            assert.ok(/hermesEnabled=false/.test(decision.reason), decision.reason);
        });
        it("android 0.84 hermesEnabled=true → enabled", async () => {
            enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, gradleProperties: "hermesEnabled=true\n" });
            const decision = await rnUtils.getHermesDecision("android", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, true);
        });
        it("android still requires the gradle file", async () => {
            enter({ reactNativeVersion: "0.84.1" }); // no android/ folder
            // pre-existing behaviour: parseBuildGradleFile lstat()s android/app before its own existence check → raw ENOENT
            await assert.rejects(() => rnUtils.getHermesDecision("android", undefined, undefined, undefined), /android[\\/]app|Unable to find gradle file/);
        });
        it("ios legacy :hermes_enabled => true → enabled (0.70)", async () => {
            enter({ reactNativeVersion: "0.70.15", podfile: hermes_fixture_1.PODFILE_TRUE });
            assert.strictEqual((await rnUtils.getHermesDecision("ios", undefined, undefined, undefined)).enabled, true);
        });
        it("ios :hermes_enabled => false → disabled even on 0.84", async () => {
            enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_FALSE });
            assert.strictEqual((await rnUtils.getHermesDecision("ios", undefined, undefined, undefined)).enabled, false);
        });
        it("ios 0.70 with no marker → disabled", async () => {
            enter({ reactNativeVersion: "0.70.15", podfile: hermes_fixture_1.PODFILE_MODERN });
            assert.strictEqual((await rnUtils.getHermesDecision("ios", undefined, undefined, undefined)).enabled, false);
        });
        it("ios 0.72 with flags[:hermes_enabled] → enabled by default", async () => {
            enter({ reactNativeVersion: "0.72.0", podfile: hermes_fixture_1.PODFILE_FLAGS });
            assert.strictEqual((await rnUtils.getHermesDecision("ios", undefined, undefined, undefined)).enabled, true);
        });
        it("ios 0.84 modern Podfile → enabled by default", async () => {
            enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_MODERN });
            const decision = await rnUtils.getHermesDecision("ios", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, true);
            assert.ok(/default is true/.test(decision.reason), decision.reason);
        });
        it("ios Expo Podfile with expo.jsEngine=jsc → disabled", async () => {
            enter({ reactNativeVersion: "0.76.0", podfile: hermes_fixture_1.PODFILE_EXPO, podfileProperties: JSON.stringify({ "expo.jsEngine": "jsc" }) });
            const decision = await rnUtils.getHermesDecision("ios", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, false);
            assert.ok(/expo\.jsEngine/.test(decision.reason), decision.reason);
        });
        it("ios Expo Podfile with expo.jsEngine=hermes → enabled", async () => {
            enter({ reactNativeVersion: "0.76.0", podfile: hermes_fixture_1.PODFILE_EXPO, podfileProperties: JSON.stringify({ "expo.jsEngine": "hermes" }), podfileLock: hermes_fixture_1.PODFILE_LOCK_HERMES });
            assert.strictEqual((await rnUtils.getHermesDecision("ios", undefined, undefined, undefined)).enabled, true);
        });
        it("ios Podfile.lock without hermes-engine → disabled", async () => {
            enter({ reactNativeVersion: "0.76.0", podfile: hermes_fixture_1.PODFILE_MODERN, podfileLock: hermes_fixture_1.PODFILE_LOCK_JSC });
            const decision = await rnUtils.getHermesDecision("ios", undefined, undefined, undefined);
            assert.strictEqual(decision.enabled, false);
            assert.ok(/Podfile\.lock/.test(decision.reason), decision.reason);
        });
        it("ios Podfile.lock with hermes-engine → enabled", async () => {
            enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_MODERN, podfileLock: hermes_fixture_1.PODFILE_LOCK_HERMES });
            assert.strictEqual((await rnUtils.getHermesDecision("ios", undefined, undefined, undefined)).enabled, true);
        });
        it("ios explicit :hermes_enabled => true wins over a JSC Podfile.lock (legacy check first)", async () => {
            enter({ reactNativeVersion: "0.76.0", podfile: hermes_fixture_1.PODFILE_TRUE, podfileLock: hermes_fixture_1.PODFILE_LOCK_JSC });
            assert.strictEqual((await rnUtils.getHermesDecision("ios", undefined, undefined, undefined)).enabled, true);
        });
        it("ios never reads the android folder", async () => {
            enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_MODERN }); // no android/
            assert.strictEqual((await rnUtils.getHermesDecision("ios", undefined, undefined, undefined)).enabled, true);
        });
        it("windows → disabled unless forced", async () => {
            enter({ reactNativeVersion: "0.84.1" });
            assert.strictEqual((await rnUtils.getHermesDecision("windows", undefined, undefined, undefined)).enabled, false);
        });
    });
    describe("findHermesCommand", () => {
        const suffix = (...parts) => path.join(...parts, (0, hermes_fixture_1.osBin)(), (0, hermes_fixture_1.hermescExe)());
        it("prefers react-native/sdks/hermesc (keeps the copy workaround working)", async () => {
            enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, hermesc: ["sdks", "compiler", "engine", "vm"] });
            const lookup = await rnUtils.findHermesCommand("android", undefined);
            assert.ok(lookup.command.endsWith(suffix("react-native", "sdks", "hermesc")), lookup.command);
        });
        it("does not read the gradle file when sdks/hermesc exists (--useHermes on a kts-only or android-less layout)", async () => {
            enter({ reactNativeVersion: "0.82.1", hermesc: ["sdks"] }); // no android/ folder at all
            const lookup = await rnUtils.findHermesCommand("android", undefined);
            assert.ok(lookup.command.endsWith(suffix("react-native", "sdks", "hermesc")), lookup.command);
        });
        it("finds hermes-compiler nested under react-native (isolated / pnpm layout)", async () => {
            enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, hermesc: ["compiler-nested"] });
            const lookup = await rnUtils.findHermesCommand("android", undefined);
            assert.ok(lookup.command.endsWith(path.join("react-native", "node_modules", "hermes-compiler", "hermesc", (0, hermes_fixture_1.osBin)(), (0, hermes_fixture_1.hermescExe)())), lookup.command);
        });
        it("falls back to hermes-compiler (react-native >= 0.83)", async () => {
            enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE, hermesc: ["compiler", "engine", "vm"] });
            const lookup = await rnUtils.findHermesCommand("android", undefined);
            assert.ok(lookup.command.endsWith(suffix("hermes-compiler", "hermesc")), lookup.command);
        });
        it("honours an explicit gradle hermesCommand before hermes-compiler on android", async () => {
            enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.LEGACY_GRADLE_HERMES_COMMAND, hermesc: ["custom", "compiler", "engine", "vm"] });
            const lookup = await rnUtils.findHermesCommand("android", undefined);
            // path.join normalises android/app/../../custom-hermes/… to custom-hermes/…
            assert.strictEqual(lookup.command, path.join("custom-hermes", (0, hermes_fixture_1.osBin)(), (0, hermes_fixture_1.hermescExe)()));
        });
        it("then hermes-engine, then hermesvm", async () => {
            enter({ reactNativeVersion: "0.64.4", buildGradle: hermes_fixture_1.LEGACY_GRADLE_HERMES_ON, hermesc: ["engine", "vm"] });
            assert.strictEqual((await rnUtils.findHermesCommand("android", undefined)).command, path.join("node_modules", "hermes-engine", (0, hermes_fixture_1.osBin)(), (0, hermes_fixture_1.hermescExe)()));
            reenter({ reactNativeVersion: "0.64.4", buildGradle: hermes_fixture_1.LEGACY_GRADLE_HERMES_ON, hermesc: ["vm"] });
            assert.strictEqual((await rnUtils.findHermesCommand("android", undefined)).command, path.join("node_modules", "hermesvm", (0, hermes_fixture_1.osBin)(), "hermes"));
        });
        it("never touches the gradle file on ios", async () => {
            enter({ reactNativeVersion: "0.84.1", podfile: hermes_fixture_1.PODFILE_MODERN, hermesc: ["compiler"] }); // no android/
            const lookup = await rnUtils.findHermesCommand("ios", undefined);
            assert.ok(lookup.command.endsWith(suffix("hermes-compiler", "hermesc")), lookup.command);
        });
        it("returns null and every searched path when nothing exists", async () => {
            enter({ reactNativeVersion: "0.84.1", buildGradle: hermes_fixture_1.MODERN_GRADLE });
            const lookup = await rnUtils.findHermesCommand("android", undefined);
            assert.strictEqual(lookup.command, null);
            assert.strictEqual(lookup.searched.length, 4);
            assert.ok(lookup.searched.some((p) => p.endsWith(suffix("react-native", "sdks", "hermesc"))));
            assert.ok(lookup.searched.some((p) => p.endsWith(suffix("hermes-compiler", "hermesc"))));
            assert.ok(lookup.searched.some((p) => p.endsWith(suffix("hermes-engine"))));
            assert.ok(lookup.searched.some((p) => p.endsWith(path.join("hermesvm", (0, hermes_fixture_1.osBin)(), "hermes"))));
        });
    });
    describe("release-react --useHermes parsing", () => {
        // command-parser parses process.argv when the module is loaded, so each case runs in a fresh node process.
        function parseUseHermes(...extraArgs) {
            const script = `process.argv = ${JSON.stringify(["node", "code-push", "release-react", "App", "android", ...extraArgs])};` +
                `const parser = require(${JSON.stringify(path.resolve(__dirname, "../script/command-parser.js"))});` +
                `process.stdout.write(String(JSON.stringify(parser.createCommand().useHermes)));`;
            const result = childProcess.spawnSync(process.execPath, ["-e", script], { encoding: "utf8" });
            assert.strictEqual(result.status, 0, result.stderr);
            return result.stdout;
        }
        it("absent → undefined (automatic detection)", () => assert.strictEqual(parseUseHermes(), "undefined"));
        it("--useHermes → true", () => assert.strictEqual(parseUseHermes("--useHermes"), "true"));
        it("--useHermes false → false", () => assert.strictEqual(parseUseHermes("--useHermes", "false"), "false"));
        it("--no-useHermes → false", () => assert.strictEqual(parseUseHermes("--no-useHermes"), "false"));
    });
});
