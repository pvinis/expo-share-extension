import { ConfigPlugin } from "@expo/config-plugins";
import plist from "@expo/plist";
import { withEntitlementsPlist } from "expo/config-plugins";
import fs from "fs";
import path from "path";

import {
  getAppGroups,
  getShareExtensionBundleIdentifier,
  getShareExtensionEntitlementsFilePath,
} from "./index";

export const withShareExtensionEntitlements: ConfigPlugin = (config) => {
  return withEntitlementsPlist(config, (config) => {
    const filePath = getShareExtensionEntitlementsFilePath(config);

    const bundleIdentifier = getShareExtensionBundleIdentifier(config);

    const shareExtensionEntitlements = {
      "com.apple.security.application-groups": getAppGroups(bundleIdentifier),
    };

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, plist.build(shareExtensionEntitlements));

    return config;
  });
};
