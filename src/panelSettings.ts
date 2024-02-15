import { SettingsTreeNodes, SettingsTreeFields, SettingsTreeAction } from "@foxglove/studio";
import { produce } from "immer";
import * as _ from "lodash-es";

interface DeviceLabel {
  label: string;
  value: string;
}

export type Config = {
  deviceName: string;
  publishMode: boolean;
  compressed: boolean;
  pubTopic: string;
  publishFrameId: string;
  pubRate: number;
  width: number;
  height: number;
  frameRate: number;
};

export function settingsActionReducer(prevConfig: Config, action: SettingsTreeAction): Config {
  return produce(prevConfig, (draft) => {
    if (action.action === "update") {
      const { path, value } = action.payload;
      _.set(draft, path.slice(1), value);
    }
  });
}

export function buildSettingsTree(
  config: Config,
  videoDevices: MediaDeviceInfo[],
): SettingsTreeNodes {
  const deviceLabels = videoDevices.map((v) => {
    return {
      label: v.label,
      value: v.deviceId,
    } as DeviceLabel;
  });

  const dataSourceFields: SettingsTreeFields = {
    deviceName: {
      label: "Device Name",
      input: "select",
      value: config.deviceName,
      options: deviceLabels,
    },
    width: {
      label: "Width",
      input: "number",
      value: config.width,
    },
    height: {
      label: "Height",
      input: "number",
      value: config.height,
    },
    frameRate: {
      label: "Frame Rate",
      input: "number",
      value: config.frameRate,
    },
  };
  const publishFields: SettingsTreeFields = {
    publishMode: {
      label: "Publish Mode",
      input: "boolean",
      value: config.publishMode,
    },
    compressed: {
      label: "Compression",
      input: "boolean",
      value: config.compressed,
    },
    pubTopic: {
      label: "Pub Topic",
      input: "string",
      value: config.pubTopic,
    },
    publishFrameId: {
      label: "Image Frame ID",
      input: "string",
      value: config.publishFrameId,
    },
    pubRate: {
      label: "Publish Rate",
      input: "number",
      value: config.pubRate,
    },
  };

  const settings: SettingsTreeNodes = {
    dataSource: {
      label: "Data Source",
      fields: dataSourceFields,
    },
    publish: {
      label: "Publish",
      fields: publishFields,
    },
  };

  return settings;
}
