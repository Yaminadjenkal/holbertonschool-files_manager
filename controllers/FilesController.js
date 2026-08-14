import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  // … tes autres méthodes ici …

  static async getFile(req, res) {
    const fileId = req.params.id;

    // 1. Vérifier si le fichier existe
    const file = await dbClient.db.collection('files').findOne({
      _id: dbClient.objectId(fileId),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // 2. Vérifier si le fichier est public ou si l'utilisateur est autorisé
    const token = req.headers['x-token'];
    let userId = null;

    if (token) {
      const key = `auth_${token}`;
      userId = await redisClient.get(key);
    }

    const isOwner = userId && file.userId.toString() === userId;

    if (!file.isPublic && !isOwner) {
      return res.status(404).json({ error: 'Not found' });
    }

    // 3. Vérifier si c'est un dossier
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // 4. Vérifier si le fichier existe localement
    if (!file.localPath || !fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // 5. Lire le fichier et renvoyer son contenu avec le bon MIME-type
    const mimeType = mime.lookup(file.name) || 'application/octet-stream';
    const data = await fs.promises.readFile(file.localPath);

    res.setHeader('Content-Type', mimeType);
    return res.status(200).send(data);
  }
}

export default FilesController;
