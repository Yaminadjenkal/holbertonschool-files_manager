import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import sha1 from 'sha1';

class UsersController {
  static async postNew(req, res) {
    const email = req.body?.email || req.query?.email;
    const password = req.body?.password || req.query?.password;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const userExists = await dbClient.db.collection('users').findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = sha1(password);

    const result = await dbClient.db.collection('users').insertOne({
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      id: result.insertedId,
      email,
    });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({
      _id: dbClient.objectId(userId),
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({
      id: user._id.toString(),
      email: user.email,
    });
  }
}

export default UsersController;
