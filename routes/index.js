import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = express.Router();

// App
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);

// Users
router.post('/users', UsersController.postNew);
router.get('/users/me', UsersController.getMe);

// Auth
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);

// Files
router.post('/files', FilesController.postUpload);
router.get('/files', FilesController.getIndex);
router.get('/files/:id', FilesController.getShow);

// Task 8 — GET file data
router.get('/files/:id/data', FilesController.getFile);

// Task 7 — publish / unpublish
router.put('/files/:id/publish', FilesController.putPublish);
router.put('/files/:id/unpublish', FilesController.putUnpublish);

export default router;
