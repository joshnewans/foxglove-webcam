import { SettingsTreeNodes, SettingsTreeFields, SettingsTreeAction } from "@foxglove/studio";
import { produce } from "immer";
import * as _ from "lodash-es";

export type Config = {
  publishMode: boolean;
  pubTopic: string;
  publishFrameId: string;
};

export function settingsActionReducer(prevConfig: Config, action: SettingsTreeAction): Config {
  return produce(prevConfig, (draft) => {
    if (action.action === "update") {
      const { path, value } = action.payload;
      _.set(draft, path.slice(1), value);
    }
  });
}

export function buildSettingsTree(config: Config): SettingsTreeNodes {
  const dataSourceFields: SettingsTreeFields = {};
  const publishFields: SettingsTreeFields = {
    publishMode: {
      label: "Publish Mode",
      input: "boolean",
      value: config.publishMode,
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
