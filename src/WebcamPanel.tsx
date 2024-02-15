import { fromDate } from "@foxglove/rostime";
import { CameraCalibration, CompressedImage, RawImage } from "@foxglove/schemas";
import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import { Buffer } from "buffer";
import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";

import { Config, buildSettingsTree, settingsActionReducer } from "./panelSettings";

function WebcamPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [image, setImage] = useState<RawImage | undefined>();
  const [imageC, setImageC] = useState<CompressedImage | undefined>();
  const [pubTopic, setPubTopic] = useState<string | undefined>();
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const [count, setCount] = useState(0);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [config, setConfig] = useState<Config>(() => {
    const partialConfig = context.initialState as Partial<Config>;
    partialConfig.width ??= 800;
    partialConfig.height ??= 600;
    partialConfig.frameRate ??= 20;
    partialConfig.pubTopic ??= "/image";
    partialConfig.publishMode ??= false;
    partialConfig.publishFrameId ??= "";
    partialConfig.compressed ??= true;
    partialConfig.pubRate ??= 10;
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
      nodes: buildSettingsTree(config, videoDevices),
    });
  }, [config, context, settingsActionHandler, videoDevices]);

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

  // On Startup, update the list of available devices
  useEffect(() => {
    async function fetchMediaDevices() {
      const rawDevices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(rawDevices.filter((v) => v.kind === "videoinput"));
    }

    fetchMediaDevices().catch((reason: any) => {
      console.log(reason);
    });
  }, []);

  // Debug when changing device
  useEffect(() => {
    console.log(`Using device with id ${config.deviceName}`);
  }, [config.deviceName]);

  // Get the media stream and attach it to a video element
  useEffect(() => {
    // Declare the constraints we want
    const constraints = {
      audio: false,
      video: {
        width: config.width,
        height: config.height,
        frameRate: config.frameRate,
        deviceId: config.deviceName,
      },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream: MediaStream) => {
        const video = document.querySelector("video");
        if (!video) {
          return;
        }
        video.onloadedmetadata = () => {
          video.play();
        };
        // video.oncanplay = () => {
        //   console.log("On play");
        // };
        video.srcObject = stream;
      })
      .catch((reason: any) => {
        console.log(reason);
      });
  }, [config]);

  // Create a timer to poll the video
  useEffect(() => {
    const interval = setInterval(() => {
      setCount(count + 1);
    }, 1000 / config.pubRate);

    return () => {
      clearInterval(interval);
    };
  }, [count, config.pubRate]);

  // Take a snapshot of the video and publish it
  useEffect(() => {
    const video = document.querySelector("video");
    if (!video) {
      return;
    }

    // Not sure if normal or offscreen canvas is better?
    // const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    if (!canvasRef.current) {
      return;
    }
    const canvas = canvasRef.current;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.log("no context");
      return;
    }
    ctx.drawImage(video, 0, 0);

    if (canvas.width === 0 || canvas.height === 0) {
      return;
    }

    if (config.compressed) {
      const base64Canvas = canvas.toDataURL("image/jpeg").split(";base64,")[1];

      const tmpMsg = {
        timestamp: fromDate(new Date()),
        frame_id: config.publishFrameId,
        format: "jpeg",
        data: Buffer.from(base64Canvas ? base64Canvas : "", "base64"),
      };

      setImageC(tmpMsg);
    } else {
      const myImageData: Uint8ClampedArray = ctx.getImageData(
        0,
        0,
        config.width,
        config.height,
      ).data;

      if (myImageData.length === 0) {
        console.log("no data");
        return;
      }

      const tmpMsg = {
        timestamp: fromDate(new Date()),
        frame_id: config.publishFrameId,
        width: canvas.width,
        height: canvas.height,
        encoding: "rgba8",
        step: canvas.width * 4,
        data: new Uint8Array(myImageData),
      };

      if (tmpMsg.width === 0 || tmpMsg.height === 0) {
        return;
      }

      setImage(tmpMsg);
    }
  }, [count, config]);

  // Advertise the topic to publish
  useEffect(() => {
    if (config.publishMode) {
      setPubTopic((oldTopic) => {
        if (config.publishMode) {
          if (oldTopic) {
            context.unadvertise?.(oldTopic);
          }
          context.advertise?.(
            config.pubTopic,
            config.compressed ? "sensor_msgs/CompressedImage" : "sensor_msgs/Image",
          );
          return config.pubTopic;
        } else {
          if (oldTopic) {
            context.unadvertise?.(oldTopic);
          }
          return "";
        }
      });
    }
  }, [config.pubTopic, config.publishMode, config.compressed, context]);

  // Publish the image message
  useEffect(() => {
    if (!config.publishMode) {
      return;
    }

    if (pubTopic && pubTopic === config.pubTopic) {
      if (config.compressed) {
        if (imageC && imageC.data.length > 0) {
          context.publish?.(pubTopic, imageC);
        }
      } else {
        if (image && image.data.length > 0 && image.width > 0) {
          context.publish?.(pubTopic, image);
        }
      }
    }
  }, [context, config.pubTopic, config.publishMode, config.compressed, image, imageC, pubTopic]);

  // Invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  useEffect(() => {
    context.saveState(config);
  }, [context, config]);

  return (
    <div>
      <video></video>
      <canvas ref={canvasRef} width={config.width} height={config.height}></canvas>
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
