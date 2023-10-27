import { ConfigPlugin } from "@expo/config-plugins";
import { withXcodeProject } from "expo/config-plugins";
import fs from "fs";
import path from "path";

import {
  getInfoPlistFilePath,
  getShareExtensionBundleIdentifier,
  getShareExtensionEntitlementsFilePath,
  getShareExtensionName,
} from "./index";

export const withShareExtensionTarget: ConfigPlugin = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;

    const { projectName, platformProjectRoot } = config.modRequest;

    const targetName = getShareExtensionName(config);
    const bundleIdentifier = getShareExtensionBundleIdentifier(config);
    const marketingVersion = config.version;

    const targetPath = path.join(platformProjectRoot, targetName);

    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    const filesToCopy = [
      "SplashScreen.storyboard",
      "AppDelegate.h",
      "AppDelegate.mm",
      "main.m",
    ];

    filesToCopy.forEach((file) => {
      const source = path.join(platformProjectRoot, projectName ?? "bla", file);
      copyFileSync(source, targetPath);
    });

    // Copy Images.xcassets
    const imagesXcassetsSource = path.join(
      platformProjectRoot,
      projectName ?? "bla",
      "Images.xcassets"
    );
    copyFolderRecursiveSync(imagesXcassetsSource, targetPath);

    const target = xcodeProject.addTarget(
      targetName,
      "app_extension",
      targetName
    );

    // Add shell script build phase "Start Packager"
    xcodeProject.addBuildPhase(
      [],
      "PBXShellScriptBuildPhase",
      "Start Packager",
      target.uuid,
      {
        shellPath: "/bin/sh",
        shellScript:
          'if [[ -f "$PODS_ROOT/../.xcode.env" ]]; then\n  source "$PODS_ROOT/../.xcode.env"\nfi\nif [[ -f "$PODS_ROOT/../.xcode.env.local" ]]; then\n  source "$PODS_ROOT/../.xcode.env.local"\nfi\n\nexport RCT_METRO_PORT="${RCT_METRO_PORT:=8081}"\necho "export RCT_METRO_PORT=${RCT_METRO_PORT}" > `$NODE_BINARY --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/.packager.env\'"`\nif [ -z "${RCT_NO_LAUNCH_PACKAGER+xxx}" ] ; then\n  if nc -w 5 -z localhost ${RCT_METRO_PORT} ; then\n    if ! curl -s "http://localhost:${RCT_METRO_PORT}/status" | grep -q "packager-status:running" ; then\n      echo "Port ${RCT_METRO_PORT} already in use, packager is either not running or not running correctly"\n      exit 2\n    fi\n  else\n    open `$NODE_BINARY --print "require(\'path\').dirname(require.resolve(\'expo/package.json\')) + \'/scripts/launchPackager.command\'"` || echo "Can\'t start packager automatically"\n  fi\nfi\n',
      }
    );

    xcodeProject.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Sources",
      target.uuid
    );

    // Add shell script build phase
    xcodeProject.addBuildPhase(
      [],
      "PBXShellScriptBuildPhase",
      "Bundle React Native code and images",
      target.uuid,
      {
        shellPath: "/bin/sh",
        shellScript:
          'if [[ -f "$PODS_ROOT/../.xcode.env" ]]; then\n  source "$PODS_ROOT/../.xcode.env"\nfi\nif [[ -f "$PODS_ROOT/../.xcode.env.local" ]]; then\n  source "$PODS_ROOT/../.xcode.env.local"\nfi\n\n# The project root by default is one level up from the ios directory\nexport PROJECT_ROOT="$PROJECT_DIR"/..\n\nif [[ "$CONFIGURATION" = *Debug* ]]; then\n  export SKIP_BUNDLING=1\nfi\nif [[ -z "$ENTRY_FILE" ]]; then\n  # Set the entry JS file using the bundler\'s entry resolution.\n  export ENTRY_FILE="$("$NODE_BINARY" -e "require(\'expo/scripts/resolveAppEntry\')" "$PROJECT_ROOT" ios relative | tail -n 1)"\nfi\n\nif [[ -z "$CLI_PATH" ]]; then\n  # Use Expo CLI\n  export CLI_PATH="$("$NODE_BINARY" --print "require.resolve(\'@expo/cli\')")"\nfi\nif [[ -z "$BUNDLE_COMMAND" ]]; then\n  # Default Expo CLI command for bundling\n  export BUNDLE_COMMAND="export:embed"\nfi\n\n`"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"`\n\n',
      }
    );

    // Add a new PBXSourcesBuildPhase for our ShareViewController
    // (we can't add it to the existing one because an extension is kind of an extra app)
    xcodeProject.addBuildPhase(
      ["AppDelegate.mm", "main.m"],
      "PBXSourcesBuildPhase",
      "Sources",
      target.uuid
    );

    // Add a new PBXResourcesBuildPhase for the Resources used by the Share Extension
    // (MainInterface.storyboard)
    xcodeProject.addBuildPhase(
      ["SplashScreen.storyboard", "Images.xcassets"],
      "PBXResourcesBuildPhase",
      "Resources",
      target.uuid
    );

    // Create a separate PBXGroup for the shareExtension's files
    const pbxGroupKey = xcodeProject.pbxCreateGroup(targetName, targetName);

    const infoPlistFilePath = getInfoPlistFilePath(config);

    // Add files which are not part of any build phase (plist)
    xcodeProject.addFile(infoPlistFilePath, pbxGroupKey);
    xcodeProject.addFile(
      path.join(targetPath, "Supporting/Expo.plist"),
      pbxGroupKey
    );
    xcodeProject.addFile(
      path.join(targetPath, `${targetName}.entitlements`),
      pbxGroupKey
    );
    xcodeProject.addFile(path.join(targetPath, "AppDelegate.h"), pbxGroupKey);

    const entitlementsFilePath = getShareExtensionEntitlementsFilePath(config);

    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      if (typeof configurations[key].buildSettings !== "undefined") {
        const buildSettingsObj = configurations[key].buildSettings;
        if (
          typeof buildSettingsObj["PRODUCT_NAME"] !== "undefined" &&
          buildSettingsObj["PRODUCT_NAME"] === `"${targetName}"`
        ) {
          buildSettingsObj["CLANG_ENABLE_MODULES"] = "YES";
          buildSettingsObj["INFOPLIST_FILE"] = `"${infoPlistFilePath}"`;
          buildSettingsObj[
            "CODE_SIGN_ENTITLEMENTS"
          ] = `"${entitlementsFilePath}"`;
          buildSettingsObj["CODE_SIGN_STYLE"] = "Automatic";
          buildSettingsObj["CURRENT_PROJECT_VERSION"] = `"${
            config.ios!.buildNumber || "1"
          }"`;
          buildSettingsObj["GENERATE_INFOPLIST_FILE"] = "YES";
          buildSettingsObj["MARKETING_VERSION"] = `"${marketingVersion}"`;
          buildSettingsObj[
            "PRODUCT_BUNDLE_IDENTIFIER"
          ] = `"${bundleIdentifier}"`;
          buildSettingsObj["SWIFT_EMIT_LOC_STRINGS"] = "YES";
          buildSettingsObj["SWIFT_VERSION"] = "5.0";
          buildSettingsObj["TARGETED_DEVICE_FAMILY"] = `"1,2"`;
        }
      }
    }

    return config;
  });
};

function copyFileSync(source: string, target: string) {
  let targetFile = target;

  if (fs.existsSync(target) && fs.lstatSync(target).isDirectory()) {
    targetFile = path.join(target, path.basename(source));
  }
  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source: string, target: string) {
  const targetPath = path.join(target, path.basename(source));
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach((file) => {
      const currentPath = path.join(source, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        copyFolderRecursiveSync(currentPath, targetPath);
      } else {
        copyFileSync(currentPath, targetPath);
      }
    });
  }
}
