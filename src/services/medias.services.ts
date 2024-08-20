import { Request } from "express";
import path from "path";
import sharp from "sharp";
import { UPLOAD_IMAGE_DIR } from "~/constants/dir";
import {
  getNameFromFullName,
  handleUploadImage,
  handleUploadVideo,
} from "~/utils/files";
import fs from "fs";
import { isProduction } from "~/constants/config";
import { MediaType } from "~/constants/enums";
import { Media } from "~/models/other";
class MediasService {
  async uploadImage(req: Request) {
    const files = await handleUploadImage(req);
    const result: Media[] = await Promise.all(
      files.map(async (file) => {
        const newName = getNameFromFullName(file.newFilename);
        const newPath = path.resolve(UPLOAD_IMAGE_DIR, `${newName}.jpg`);
        await sharp(file.filepath).jpeg().toFile(newPath);
        fs.unlinkSync(file.filepath);
        return {
          url: isProduction
            ? `${process.env.HOST}/static/image/${newName}.jpg`
            : `http://localhost:${process.env.PORT}/static/image/${newName}.jpg`,
          type: MediaType.Image,
        };
      })
    );
    return result;
  }

  async uploadVideo(req: Request) {
    const files = await handleUploadVideo(req);
    const { newFilename } = files[0];
    return {
      url: isProduction
        ? `${process.env.HOST}/static/video/${newFilename}`
        : `http://localhost:${process.env.PORT}/static/video/${newFilename}`,
      type: MediaType.Video,
    };
  }
}

const mediasService = new MediasService();

export default mediasService;
