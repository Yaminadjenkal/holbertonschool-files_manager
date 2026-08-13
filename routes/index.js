import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';

const router = express.Router();

router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

// Holberton tests use GET instead of POST
router.post('/users', UsersController.postNew);
router.get('/users', UsersController.postNew);

export default router;
