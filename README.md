# Short Video Maker

An open source automated video creation tool for generating short-form video content. Short Video Maker combines text-to-speech, automatic captions, background videos, and music to create engaging short videos from simple text inputs.

## Hardware requirements

- CPU: at least 2 cores are recommended
- RAM: at least 2 GB is required, but 4 GB is recommended.
- GPU: optional, makes the caption generation a lot faster (whisper.cpp) and the video rendering somewhat faster

## Software requirements

When running with npx

- ffmpeg
- build-essential, git, cmake, wget to build Whisper.cpp

## Install Chocolatey

Open PowerShell as Administrator.
Run the following command to install Chocolatey:

- Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

## How to run

You need to install ffmpeg, build-essential, git, cmake, wget to build Whisper.cpp. It can be done using chocolaty

```bash
choco install ffmpeg git cmake wget mingw
```

```bash
pnpm install
```

```bash
pnpm dev
```

## How to preview the videos and debug the rendering process

You can use Remotion Studio to preview videos. Make sure to update the template if the underlying data structure changes.

```bash
npx remotion studio
```

## Environment Variables

| Variable                  | Description                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PEXELS_API_KEY            | Your Pexels API key for background video sourcing                                                                                                                                                                |
| PORT                      | Port for the API/MCP server (default: 3123)                                                                                                                                                                      |
| LOG_LEVEL                 | Log level for the server (default: info, options: trace, debug, info, warn, error)                                                                                                                               |
| WHISPER_VERBOSE           | Verbose mode for Whisper (default: false)                                                                                                                                                                        |
| CONCURRENCY               | [Number of Chrome tabs to use to render the video.](https://www.remotion.dev/docs/terminology/concurrency) Used to limit the memory usage in the Docker containers (default: undefined)                          |
| VIDEO_CACHE_SIZE_IN_BYTES | [cache for <OffthreadVideo> frames](https://www.remotion.dev/docs/renderer/select-composition#offthreadvideocachesizeinbytes) - used to prevent memory related crashes in the Docker images (default: undefined) |

### Model Context Protocol (MCP)

The service also implements the Model Context Protocol:

1. `GET /mcp/sse` - Server-sent events for MCP
2. `POST /mcp/messages` - Send messages to MCP server

Available MCP tools:

1. `create-short-video` - Create a video from a list of scenes
2. `get-video-status` - Check video creation status
