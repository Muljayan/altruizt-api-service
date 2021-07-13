import express from 'express';

import * as authenticate from './middleware/authenticate';

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

router.get('/dashboards', authenticate.all, dashboardController.getDashboardData);
router.get('/dashboards/approvals', authenticate.superadmin, dashboardController.getUnapprovedOrganizations);
router.get('/dashboards/organizations/:type', authenticate.superadmin, dashboardController.getOrganizationByType);
router.get('/dashboards/individuals', authenticate.superadmin, dashboardController.getIndividuals);
router.get('/dashboards/events', authenticate.moderator, dashboardController.getEvents);
router.get('/dashboards/resources', authenticate.superadmin, dashboardController.getResources);
router.get('/dashboards/categories', authenticate.superadmin, dashboardController.getCategories);

router.post('/events/', eventsController.searchEvents);
router.post('/events/create', authenticate.organization, eventsController.createEvent);
router.get('/events/profile/:id', eventsController.getEventProfile);
router.put('/events/profile/:id/update', authenticate.organization, eventsController.updateEventProfile);
router.get('/events/profile/:id/closure', authenticate.organization, eventsController.getClosingData);
router.post('/events/profile/:id/complete', authenticate.organization, eventsController.completeEvent);
router.get('/events/profile/:id/pledges', authenticate.organization, eventsController.getEventPledges);
router.post('/events/followings', authenticate.all, eventsController.searchEventsFollowed);
router.put('/events/profile/:id/pledge', authenticate.all, eventsController.toggleEventPledge);
router.put('/events/profile/:id/follow', authenticate.all, eventsController.toggleEventFollow);
router.put('/events/profile/:id/upvote', authenticate.all, eventsController.upvote);
router.put('/events/profile/:id/downvote', authenticate.all, eventsController.downvote);
router.put('/events/profile/:id/toggle-activation-status', authenticate.moderator, eventsController.toggleActivationStatus);

router.post('/organizations', organizationsController.searchOrganizations);
router.get('/organizations/profile/:id', organizationsController.getOrganizationProfile);
router.put('/organizations/profile/:id/toggle-activation-status', authenticate.superadmin, organizationsController.toggleActivationStatus);

router.get('/profile', authenticate.all, profilesController.getProfile);
// TODO change to put
router.post('/profile/edit', authenticate.all, profilesController.editProfile);
router.get('/profile/sidebar', authenticate.all, profilesController.getSidebar);

router.get('/selectors/categories', selectorsProfile.getCategories);
router.get('/selectors/organization-types', selectorsProfile.getOrganizationTypes);
router.get('/selectors/organizers', selectorsProfile.getOrganizations);
router.get('/selectors/beneficiaries', selectorsProfile.getBeneficiaries);
router.get('/selectors/resources', selectorsProfile.getResources);

export default router;
