 // routes/emailEntry.js
 import express from 'express';
 import {
   createEmailEntry,
   listEmailEntries,
   getEmailEntryById,
   pushEmailEntryToClio
 } from '../controllers/emailEntryController.js';

 const router = express.Router();

 // LIST: GET /api/email-entry
 router.get('/', listEmailEntries);

 // GET ONE: GET /api/email-entry/:id
 router.get('/:id', getEmailEntryById);

 // CREATE: POST /api/email-entry
 router.post('/', createEmailEntry);

 router.post('/:id/push-to-clio', pushEmailEntryToClio);

 export default router;