# foxglove-webcam

This is an extension for [Foxglove Studio](https://github.com/foxglove/studio) that adds functionality for receiving webcam data on the device running Foxglove and publishing it.

## Overview

Use the panel settings to select your webcam and change settings. Image compression is recommended for performance.

## Why do I want this?

For many people there will be a "better" way to get webcam data into ROS (and similar systems), either directly through a node, or some sort of dedicated server.
But for some people this may be useful, if for no other reason than it uses tools you already have.
Most usage scenarios would be where:
- You can't have the camera directly communicate with ROS
- You are already using Foxglove

Some examples are:
- Developing on Windows with ROS in a Linux container and you can't map the webcam device through
- ROS is running on a remote server or robot but you want to use the camera feed from a non-ROS client (e.g. monitoring the operator's face)
- Accessing the camera feed on a mobile device
- Educational/development contexts where it is easier to have this in a tool you're already using


(TODO Example of ball demo)

## Installation

### Foxglove Studio Extension Marketplace

*Currently unavailable*
In the Foxglove Studio Desktop app, use the Extension Marketplace (Profile menu in top-right -> Extensions) to find and install the Webcam panel.

### Releases

Download the latest `.foxe` release [here](https://github.com/joshnewans/foxglove-webcam/releases/latest) and drag-and-drop it onto the window of Foxglove Studio (Desktop or Web).

### Compile from source

With Node and Foxglove installed
 - `npm install` to install dependencies
 - `npm run local-install` to build and install for a local copy of the Foxglove Studio Desktop App
 - `npm run package` to package it up into a `.foxe` file


## To Do
- Make it faster
- Make it drop frames instead of falling behind
- Add more control over camera parameters (and make the existing controls work better)
- Microphone support
- OffscreenCanvas (has some issues)
- Fix time/frame not working

## Useful links
https://webrtchacks.com/still-image-from-webcam-stream-approaches/
