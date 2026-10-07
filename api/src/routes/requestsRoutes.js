import { Router } from 'express';
import {
	createRequest,
	getRequest,
	listRequests,
} from '../controllers/requestController.js';
import {
	approveRequest,
	editRequestDraft,
	rejectRequest,
	updateRequestStatus,
} from '../controllers/statusController.js';

const router = Router();

router.get('/requests', listRequests);
router.post('/requests', createRequest);
router.get('/requests/:id', getRequest);
router.post('/requests/:id/approve', approveRequest);
router.patch('/requests/:id/draft', editRequestDraft);
router.post('/requests/:id/reject', rejectRequest);
router.patch('/requests/:id/status', updateRequestStatus);

export default router;