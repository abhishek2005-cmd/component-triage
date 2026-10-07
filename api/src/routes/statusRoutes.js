import { Router } from 'express';
import { listStatuses } from '../controllers/statusController.js';

const router = Router();

router.get('/statuses', listStatuses);

export default router;