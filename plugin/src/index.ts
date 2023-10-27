import { type ExpoConfig } from "@expo/config-types";
import {
  ConfigPlugin,
  ExportedConfigWithProps,
  IOSConfig,
  InfoPlist,
  XcodeProject,
  withPlugins,
} from "expo/config-plugins";
import path from "path";

import { withAppEntitlements } from "./withAppEntitlements";
import { withExpoConfig } from "./withExpoConfig";
import { withPodfile } from "./withPodfile";
import { withShareExtensionEntitlements } from "./withShareExtensionEntitlements";
import { withShareExtensionInfoPlist } from "./withShareExtensionInfoPlist";
import { withShareExtensionTarget } from "./withShareExtensionTarget";

export const getAppGroups = (identifier: string) => [`group.${identifier}`];

export const getShareExtensionBundleIdentifier = (config: ExpoConfig) => {
  if (!config.ios?.bundleIdentifier) {
    throw new Error("No bundle identifier");
  }
  return `${config.ios?.bundleIdentifier}.ShareExtension`;
};

export const getShareExtensionName = (config: ExpoConfig) => {
  return `${IOSConfig.XcodeUtils.sanitizedName(config.name)}ShareExtension`;
};

export const getShareExtensionEntitlementsFileName = (config: ExpoConfig) => {
  const name = getShareExtensionName(config);
  return `${name}.entitlements`;
};

export const getShareExtensionEntitlementsFilePath = (
  config: ExportedConfigWithProps<XcodeProject | InfoPlist>
) => {
  const name = getShareExtensionName(config);
  const targetPath = path.join(config.modRequest.platformProjectRoot, name);
  return path.join(targetPath, `${name}.entitlements`);
};

export const getInfoPlistFilePath = (
  config: ExportedConfigWithProps<XcodeProject | InfoPlist>
) => {
  const name = getShareExtensionName(config);
  const targetPath = path.join(config.modRequest.platformProjectRoot, name);
  return path.join(targetPath, "Info.plist");
};

const withShareExtension: ConfigPlugin = (config) => {
  return withPlugins(config, [
    withExpoConfig,
    withAppEntitlements,
    withShareExtensionTarget,
    // [withPodfile, { excludePackages: [] }],
    withShareExtensionInfoPlist,
    withShareExtensionEntitlements,
  ]);
};

export default withShareExtension;
