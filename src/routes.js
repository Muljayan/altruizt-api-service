import express from 'express';

import * as authController from './controllers/auth';
import * as autoCompleteController from './controllers/autocomplete';
import * as dashboardController from './controllers/dashboards';
import * as eventsController from './controllers/events';
import * as organizationsController from './controllers/organizations';
import * as profilesController from './controllers/profile';
import * as selectorsProfile from './controllers/selectors';

const router = express.Router();

router.get('/', (req, res) => res.status(200).send({ works: true }));

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

router.post('/autocomplete/resources', autoCompleteController.getResources);

router.get('/dashboards/approvals', dashboardController.getUnapprovedOrganizations);
router.get('/dashboards/organizations/:type', dashboardController.getOrganizationByType);
router.get('/dashboards/individuals', dashboardController.getIndividuals);
router.get('/dashboards/events', dashboardController.getEvents);

router.post('/events/', eventsController.searchEvents);
router.post('/events/create', eventsController.createEvent);
router.get('/events/profile/:id', eventsController.getEventProfile);
router.put('/events/profile/:id/update', eventsController.updateEventProfile);
router.get('/events/profile/:id/pledges', eventsController.getEventPledges);
router.post('/events/followings', eventsController.searchEventsFollowed);
router.get('/events/suggestions', eventsController.getEventSuggestions);
router.put('/events/profile/:id/pledge', eventsController.toggleEventPledge);
router.put('/events/profile/:id/follow', eventsController.toggleEventFollow);

router.post('/organizations', organizationsController.searchOrganizations);
router.get('/organizations/profile/:id', organizationsController.getOrganizationProfile);
router.put('/organizations/profile/:id/toggle-activation-status', organizationsController.toggleActivationStatus);

router.get('/profile', profilesController.getProfile);
// TODO change to put
router.post('/profile/edit', profilesController.editProfile);

router.get('/selectors/categories', selectorsProfile.getCategories);
router.get('/selectors/organization-types', selectorsProfile.getOrganizationTypes);
router.get('/selectors/organizers', selectorsProfile.getOrganizations);
router.get('/selectors/beneficiaries', selectorsProfile.getBeneficiaries);
router.get('/selectors/resources', selectorsProfile.getResources);

export default router;
