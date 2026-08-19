import Queue from 'bull';
import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db.mjs';
import redisClient from './utils/redis.mjs';

const fileQueue = new Queue('fileQueue');

fileQueue.process(async (job, done) => {
  const { fileId, userId } = job.data;

  if (!fileId) {
    done(new Error('Missing fileId'));
    return;
  }

  if (!userId) {
    done(new Error('Missing userId'));
    return;
  }

  const file = await dbClient.db.collection('files').findOne({
    _id: dbClient.objectId(fileId),
    userId: dbClient.objectId(userId),
  });

  if (!file) {
    done(new Error('File not found'));
    return;
  }

  if (!file.localPath || !fs.existsSync(file.localPath)) {
    done(new Error('File not found'));
    return;
  }

  try {
    const sizes = [500, 250, 100];

    for (const size of sizes) {
      const thumbnail = await imageThumbnail(file.localPath, { width: size });
      const thumbPath = `${file.localPath}_${size}`;
      await fs.promises.writeFile(thumbPath, thumbnail);
    }

    done();
  } catch (err) {
    done(err);
  }
});
