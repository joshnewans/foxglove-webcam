import { fromDate } from "@foxglove/rostime";
import { CameraCalibration, CompressedImage, RawImage } from "@foxglove/schemas";
import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";

import { Config, buildSettingsTree, settingsActionReducer } from "./panelSettings";

function WebcamPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [image, setImage] = useState<RawImage | undefined>();
  const [pubTopic, setPubTopic] = useState<string | undefined>();
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const [count, setCount] = useState(0);

  const [config, setConfig] = useState<Config>(() => {
    const partialConfig = context.initialState as Partial<Config>;
    partialConfig.pubTopic ??= "/image";
    partialConfig.publishMode ??= false;
    partialConfig.publishFrameId ??= "";
    return partialConfig as Config;
  });

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
    },
    [setConfig],
  );

  // Register the settings tree
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: buildSettingsTree(config),
    });
  }, [config, context, settingsActionHandler]);

  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  useLayoutEffect(() => {
    // The render handler is run by the broader studio system during playback when your panel
    // needs to render because the fields it is watching have changed. How you handle rendering depends on your framework.
    // You can only setup one render handler - usually early on in setting up your panel.
    //
    // Without a render handler your panel will never receive updates.
    //
    // The render handler could be invoked as often as 60hz during playback if fields are changing often.
    context.onRender = (renderState, done) => {
      // render functions receive a _done_ callback. You MUST call this callback to indicate your panel has finished rendering.
      // Your panel will not receive another render callback until _done_ is called from a prior render. If your panel is not done
      // rendering before the next render call, studio shows a notification to the user that your panel is delayed.
      //
      // Set the done callback into a state variable to trigger a re-render.
      setRenderDone(() => done);
    };

    // After adding a render handler, you must indicate which fields from RenderState will trigger updates.
    // If you do not watch any fields then your panel will never render since the panel context will assume you do not want any updates.

    // tell the panel context that we care about any update to the _topic_ field of RenderState
    context.watch("topics");

    // tell the panel context we want messages for the current frame for topics we've subscribed to
    // This corresponds to the _currentFrame_ field of render state.
    context.watch("currentFrame");
  }, [context]);

  useEffect(() => {
    //Implementing the setInterval method
    const interval = setInterval(() => {
      setCount(count + 1);
    }, 150);

    //Clearing the interval
    return () => {
      clearInterval(interval);
    };
  }, [count]);

  useEffect(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((value) => {
        const constraints = {
          audio: false,
          video: { facingMode: "environment", width: 1024, height: 768 },
        };
        return navigator.mediaDevices
          .getUserMedia(constraints)
          .then((stream: MediaStream) => {
            const video = document.querySelector("video");
            if (!video) {
              return;
            }
            video.onloadedmetadata = () => { video.play(); };
            video.oncanplay = () => { console.log("On play"); }
            video.srcObject = stream;
        }).catch((reason: any) => {
            console.log(reason);
        });
      })
      .catch((reason: any) => {
        console.log(reason);
      });
  }, []);

  useEffect(() => {
    const video = document.querySelector("video");
    if (!video) {
      return;
    }

    const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.log("no context");
      return;
    }
    ctx.drawImage(video, 0, 0);

    const myImageData: Uint8ClampedArray = ctx.getImageData(0, 0, 1024, 768).data;

    if (myImageData.length === 0) {
      console.log("no data");
      return;
    }

    const tmpMsg = {
      timestamp: fromDate(new Date()),
      frame_id: "test_frame",
      width: canvas.width,
      height: canvas.height,
      encoding: "rgba8",
      step: canvas.width * 4,
      data: new Uint8Array(myImageData),
    };

    setImage(tmpMsg);
  }, [count]);

  // Advertise the topic to publish
  useEffect(() => {
    if (config.publishMode) {
      setPubTopic((oldTopic) => {
        if (config.publishMode) {
          if (oldTopic) {
            context.unadvertise?.(oldTopic);
          }
          context.advertise?.(config.pubTopic, "sensor_msgs/Image");
          return config.pubTopic;
        } else {
          if (oldTopic) {
            context.unadvertise?.(oldTopic);
          }
          return "";
        }
      });
    }
  }, [config.pubTopic, config.publishMode, context]);

  // Publish the image message
  useEffect(() => {
    if (!config.publishMode) {
      return;
    }

    if (pubTopic && pubTopic === config.pubTopic) {
      context.publish?.(pubTopic, image);
    }
  }, [context, config.pubTopic, config.publishMode, image, pubTopic]);

  // Invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  useEffect(() => {
    context.saveState(config);
  }, [context, config]);

  return (
    <div>
      {count}
      <video></video>
    </div>
  );
}

export function initWebcamPanel(context: PanelExtensionContext): () => void {
  ReactDOM.render(<WebcamPanel context={context} />, context.panelElement);

  // Return a function to run when the panel is removed
  return () => {
    ReactDOM.unmountComponentAtNode(context.panelElement);
  };
}
