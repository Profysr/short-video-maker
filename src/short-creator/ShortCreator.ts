/* eslint-disable @remotion/deterministic-randomness */
import fs from "fs-extra";
import cuid from "cuid";
import path from "path";

import { Kokoro } from "./libraries/Kokoro";
import { Remotion } from "./libraries/Remotion";
import { Whisper } from "./libraries/Whisper";
import { FFMpeg } from "./libraries/FFmpeg";
import { PexelsAPI } from "./libraries/Pexels";
import { Config } from "../config";
import { logger } from "../logger";
import { MusicManager } from "./music";
import { type Music } from "../types/shorts";
import type {
  SceneInput,
  RenderConfig,
  Scene,
  VideoStatus,
  MusicMoodEnum,
  MusicTag,
} from "../types/shorts";

export class ShortCreator {
  private queue: {
    sceneInput: SceneInput[];
    config: RenderConfig;
    id: string;
  }[] = [];
  constructor(
    private config: Config,
    private remotion: Remotion,
    private kokoro: Kokoro,
    private whisper: Whisper,
    private ffmpeg: FFMpeg,
    private pexelsApi: PexelsAPI,
    private musicManager: MusicManager,
  ) {}

  public status(id: string): VideoStatus {
    const videoPath = this.getVideoPath(id);
    if (this.queue.find((item) => item.id === id)) {
      return "processing";
    }
    if (fs.existsSync(videoPath)) {
      return "ready";
    }
    return "failed";
  }

  public addToQueue(sceneInput: SceneInput[], config: RenderConfig): string {
    // todo add mutex lock
    const id = cuid();
    this.queue.push({
      sceneInput,
      config,
      id,
    });
    if (this.queue.length === 1) {
      this.processQueue();
    }
    return id;
  }

  private async processQueue(): Promise<void> {
    // todo add a semaphore
    if (this.queue.length === 0) {
      return;
    }
    const { sceneInput, config, id } = this.queue[0];
    logger.debug(
      { sceneInput, config, id },
      "Processing video item in the queue",
    );
    try {
      await this.createShort(id, sceneInput, config);
      logger.debug({ id }, "Video created successfully");
    } catch (error) {
      logger.error({ error }, "Error creating video");
    } finally {
      this.queue.shift();
      this.processQueue();
    }
  }

  private async createShort(
    videoId: string,
    inputScenes: SceneInput[],
    config: RenderConfig,
  ): Promise<string> {
    try {
      logger.debug(
        {
          inputScenes,
        },
        "Creating short video",
      );
      const scenes: Scene[] = [];
      let totalDuration = 0;
      const excludeVideoIds = [];
      const tempFiles = [];

      let index = 0;
      for (const scene of inputScenes) {
        const audio = await this.kokoro.generate(scene.text, "af_heart");
        let { audioLength } = audio;
        const { audio: audioStream } = audio;

        // add the paddingBack in seconds to the last scene
        if (index + 1 === inputScenes.length && config.paddingBack) {
          audioLength += config.paddingBack / 1000;
        }

        const tempId = cuid();
        const tempWavFileName = `${tempId}.wav`;
        const tempMp3FileName = `${tempId}.mp3`;
        const tempWavPath = path.join(this.config.tempDirPath, tempWavFileName);
        const tempMp3Path = path.join(this.config.tempDirPath, tempMp3FileName);
        tempFiles.push(tempWavPath, tempMp3Path);

        await this.ffmpeg.saveNormalizedAudio(audioStream, tempWavPath);
        const captions = await this.whisper.CreateCaption(tempWavPath);

        await this.ffmpeg.saveToMp3(audioStream, tempMp3Path);
        const video = await this.pexelsApi.findVideo(
          scene.searchTerms,
          audioLength,
          excludeVideoIds,
        );
        excludeVideoIds.push(video.id);

        scenes.push({
          captions,
          video: video.url,
          audio: {
            url: `http://localhost:${this.config.port}/api/tmp/${tempMp3FileName}`,
            duration: audioLength,
          },
        });

        totalDuration += audioLength;
        index++;
      }
      if (config.paddingBack) {
        totalDuration += config.paddingBack / 1000;
      }

      const selectedMusic = this.findMusic(totalDuration, config.music);
      logger.debug({ selectedMusic }, "Selected music for the video");

      await this.remotion.render(
        {
          music: selectedMusic,
          scenes,
          config: {
            durationMs: totalDuration * 1000,
            paddingBack: config.paddingBack,
          },
        },
        videoId,
      );

      for (const file of tempFiles) {
        fs.removeSync(file);
      }

      return videoId;
    } catch (error) {
      logger.error({ error: error }, "Error creating short video");
      throw error;
    }
  }

  public getVideoPath(videoId: string): string {
    return path.join(this.config.videosDirPath, `${videoId}.mp4`);
  }

  public deleteVideo(videoId: string): void {
    const videoPath = this.getVideoPath(videoId);
    fs.removeSync(videoPath);
    logger.debug({ videoId }, "Deleted video file");
  }

  public getVideo(videoId: string): Buffer {
    const videoPath = this.getVideoPath(videoId);
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video ${videoId} not found`);
    }
    return fs.readFileSync(videoPath);
  }

  private findMusic(videoDuration: number, tag?: MusicMoodEnum): Music {
    const musicFiles = this.musicManager.musicList().filter((music) => {
      if (tag) {
        return music.mood === tag;
      }
      return true;
    });
    return musicFiles[Math.floor(Math.random() * musicFiles.length)];
  }

  public ListAvailableMusicTags(): MusicTag[] {
    const tags = new Set<MusicTag>();
    this.musicManager.musicList().forEach((music) => {
      tags.add(music.mood as MusicTag);
    });
    return Array.from(tags.values());
  }
}
