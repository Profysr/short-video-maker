import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
} from "@remotion/install-whisper-cpp";
import fs from "fs-extra";
import path from "path";
import { Config } from "../../config";
import type { Caption } from "../../types/shorts";

async function checkWritePermission(folderPath: string): Promise<boolean> {
  try {
    await fs.access(folderPath, fs.constants.W_OK);
    return true; // Write permission is granted
  } catch (err: any) {
    if (err.code === "EACCES") {
      return false; // Write permission is denied (Access Denied)
    } else {
      // Other errors during access check
      console.error(`Error checking write permission for ${folderPath}:`, err);
      return false; // Assume no permission in case of other errors
    }
  }
}
async function verifyPermissions(installPath: string, cwd: string) {
  const canWriteInstallPath = await checkWritePermission(installPath);
  const canWriteCwd = await checkWritePermission(cwd);

  if (!canWriteInstallPath) {
    console.error(
      `Error: Your application does not have write permission to the installation directory: ${installPath}`,
    );
    // You might want to throw an error or handle this situation appropriately
    return false;
  }

  if (!canWriteCwd) {
    console.warn(
      `Warning: Your application might not have optimal write permission in the current working directory: ${cwd}. This could affect temporary file operations.`,
    );
    // Decide how to handle this warning
  }

  return true; // Permissions seem okay
}

export class Whisper {
  constructor(private config: Config) {}

  static async init(config: Config): Promise<Whisper> {
    const cwd = process.cwd();
    if (!config.runningInDocker) {
      try {
        await installWhisperCpp({
          to: config.whisperInstallPath,
          version: "1.5.5",
          printOutput: true,
        });
        if (!(await verifyPermissions(config.whisperInstallPath, cwd))) {
          throw new Error("Insufficient file system permissions.");
        }
        console.log("WhisperCpp installed");
      } catch (error) {
        console.log("Error installing WhisperCpp", error);
      }

      const downloadPath = path.join(config.whisperInstallPath, "models");
      if (!fs.existsSync(downloadPath)) {
        console.log("Creating models directory");

        fs.mkdirSync(downloadPath, { recursive: true });
      }
      try {
        // model: config.whisperModel,
        await downloadWhisperModel({
          model: "base.en",
          folder: downloadPath,
          printOutput: config.whisperVerbose,
        });

        if (!(await verifyPermissions(downloadPath, cwd))) {
          throw new Error("Insufficient file system permissions.");
        }
        console.log("Whisper model downloaded");
      } catch (error) {
        console.error("Error downloading Whisper model", error);
      }
    }
    return new Whisper(config);
  }

  // todo shall we extract it to a Caption class?
  async CreateCaption(audioPath: string): Promise<Caption[]> {
    console.log({ audioPath }, "Starting to transcribe audio");
    const { transcription } = await transcribe({
      model: this.config.whisperModel,
      whisperPath: this.config.whisperInstallPath,
      modelFolder: path.join(this.config.whisperInstallPath, "models"),
      whisperCppVersion: this.config.whisperVersion,
      inputPath: audioPath,
      tokenLevelTimestamps: true,
      printOutput: this.config.whisperVerbose,
      onProgress: (progress) => {
        console.log({ audioPath }, `Transcribing is ${progress} complete`);
      },
    });
    console.log({ audioPath }, "Transcription finished, creating captions");

    const captions: Caption[] = [];
    transcription.forEach((record) => {
      if (record.text === "") {
        return;
      }

      record.tokens.forEach((token) => {
        if (token.text.startsWith("[_TT")) {
          return;
        }
        // if token starts without space and the previous node didn't have space either, merge them
        if (
          captions.length > 0 &&
          !token.text.startsWith(" ") &&
          !captions[captions.length - 1].text.endsWith(" ")
        ) {
          captions[captions.length - 1].text += record.text;
          captions[captions.length - 1].endMs = record.offsets.to;
          return;
        }
        captions.push({
          text: token.text,
          startMs: record.offsets.from,
          endMs: record.offsets.to,
        });
      });
    });
    console.log({ audioPath }, "Captions created");
    return captions;
  }
}
