/* eslint-disable @typescript-eslint/no-unused-vars */
import { Kokoro } from "./short-creator/libraries/Kokoro";
import { Remotion } from "./short-creator/libraries/Remotion";
import { Whisper } from "./short-creator/libraries/Whisper";
import { FFMpeg } from "./short-creator/libraries/FFmpeg";
import { PexelsAPI } from "./short-creator/libraries/Pexels";
import { Config } from "./config";
import { ShortCreator } from "./short-creator/ShortCreator";
import { logger } from "./logger";
import { Server } from "./server/server";
import { MusicManager } from "./short-creator/music";

async function main() {
  const config = new Config();
  try {
    config.ensureConfig();
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.error(err.message, "Error in config");
    } else if (typeof err === "string") {
      logger.error(err, "Error in config");
    } else {
      logger.error("Unknown error", "Error in config");
    }

    process.exit(1);
  }

  const musicManager = new MusicManager(config);
  try {
    console.log("checking music files");
    musicManager.ensureMusicFilesExist();
  } catch (err) {
    logger.error(err, "Missing music files");
    process.exit(1);
  }

  console.log("initializing remotion");
  const remotion = await Remotion.init(config);
  console.log("initializing kokoro");
  const kokoro = await Kokoro.init();
  console.log("initializing whisper");
  const whisper = await Whisper.init(config);
  console.log("initializing ffmpeg");
  const ffmpeg = await FFMpeg.init();
  const pexelsApi = new PexelsAPI(config.pexelsApiKey);

  console.log("initializing the short creator");
  const shortCreator = new ShortCreator(
    config,
    remotion,
    kokoro,
    whisper,
    ffmpeg,
    pexelsApi,
    musicManager,
  );

  console.log("initializing the server");
  const server = new Server(config, shortCreator);
  const app = server.start();

  // todo add shutdown handler
}

main().catch((err) => {
  logger.error(err.message, "Error starting server");
});
