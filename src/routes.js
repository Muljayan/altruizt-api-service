import express from 'express';

import * as authController from './controllers/authx';
import * as autoCompleteController from './controllers/autocompletex';
import * as dashboardController from './controllers/dashboardsx';
import * as eventsController from './controllers/eventsx';
import * as organizationsController from './controllers/organizationsx';
import * as profilesController from './controllers/profilex';
import * as selectorsProfile from './controllers/selectorsx';

const router = express.Router();

router.get('/', (req, res) => res.status(200).send({ works: true }));

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

router.post('/autocomplete/resources', autoCompleteController.getResources);

router.post('/dashboards/approvals', dashboardController.getUnapprovedOrganizations);

router.post('/events/', eventsController.searchEvents);
router.post('/events/create', eventsController.createEvent);
router.get('/events/profile/:id', eventsController.getEventProfile);
router.put('/events/profile/:id/update', eventsController.updateEventProfile);
router.post('/events/followings', eventsController.searchEventsFollowed);
router.get('/events/suggestions', eventsController.getEventSuggestions);

router.post('/organizations', organizationsController.searchOrganizations);
router.get('/organizations/profile/:id', organizationsController.getOrganizationProfile);
router.put('/organizations/profile/:id/toggle-activation-status', organizationsController.toggleActivationStatus);

router.get('/profiles', profilesController.getProfile);
// TODO change to put
router.post('/profiles/edit', profilesController.editProfile);

router.post('/selectors/categories', selectorsProfile.getCategories);
router.post('/selectors/organization-types', selectorsProfile.getOrganizationTypes);
router.post('/selectors/organizers', selectorsProfile.getOrganizations);
router.post('/selectors/beneficiaries', selectorsProfile.getBeneficiaries);
router.post('/selectors/resources', selectorsProfile.getResources);

export default router;
