import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type) return res.status(400).json({ error: 'Missing type' });
    if (type !== 'folder' && !data) return res.status(400).json({ error: 'Missing data' });

    if (parentId !== 0) {
      const parent = await dbClient.db.collection('files').findOne({
        _id: dbClient.objectId(parentId),
      });
      if (!parent) return res.status(400).json({ error: 'Parent not found' });
      if (parent.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const newFile = {
      userId: dbClient.objectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : dbClient.objectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(newFile);
      return res.status(201).json({
        id: result.insertedId.toString(),
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const localPath = path.join(folderPath, uuidv4());
    await fs.promises.writeFile(localPath, Buffer.from(data, 'base64'));

    newFile.localPath = localPath;

    const result = await dbClient.db.collection('files').insertOne(newFile);

    return res.status(201).json({
      id: result.insertedId.toString(),
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.objectId(req.params.id),
      userId: dbClient.objectId(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id.toString(),
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page || 0, 10);

    const match = {
      userId: dbClient.objectId(userId),
      parentId: parentId === '0' || parentId === 0 ? 0 : dbClient.objectId(parentId),
    };

    const files = await dbClient.db.collection('files').aggregate([
      { $match: match },
      { $skip: page * 20 },
      { $limit: 20 },
    ]).toArray();

    return res.status(200).json(files.map((f) => ({
      id: f._id.toString(),
      userId,
      name: f.name,
      type: f.type,
      isPublic: f.isPublic,
      parentId: f.parentId,
    })));
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.objectId(req.params.id),
      userId: dbClient.objectId(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne(
      { _id: dbClient.objectId(req.params.id) },
      { $set: { isPublic: true } },
    );

    return res.status(200).json({
      id: file._id.toString(),
      userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.objectId(req.params.id),
      userId: dbClient.objectId(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne(
      { _id: dbClient.objectId(req.params.id) },
      { $set: { isPublic: false } },
    );

    return res.status(200).json({
      id: file._id.toString(),
      userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId,
    });
  }

  static async getFile(req, res) {
    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.objectId(req.params.id),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    const token = req.headers['x-token'];
    let userId = null;

    if (token) {
      const key = `auth_${token}`;
      userId = await redisClient.get(key);
    }

    const isOwner = userId && file.userId.toString() === userId;

    if (!file.isPublic && !isOwner) return res.status(404).json({ error: 'Not found' });

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (!file.localPath || !fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name) || 'application/octet-stream';
    const data = await fs.promises.readFile(file.localPath);

    res.setHeader('Content-Type', mimeType);
    return res.status(200).send(data);
  }
}

export default FilesController;
