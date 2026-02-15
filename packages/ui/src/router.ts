import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import Apps from '@/screens/apps.vue';

import AdminUsers from './screens/admin/users.vue';
import AdminVcsIntegrations from './screens/admin/vcs-integrations.vue';
import Builds from './screens/builds.vue';
import Login from './screens/login.vue';
import Screens from './screens/screens.vue';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/apps'
    },
    {
        path: '/login',
        component: Login
    },
    {
        path: '/apps',
        name: 'apps',
        component: Apps
    },
    {
        path: '/apps/:id',
        name: 'builds',
        component: Builds
    },
    {
        path: '/apps/:id/builds/:buildId',
        name: 'screens',
        component: Screens
    },
    {
        path: '/admin/vcs-integrations',
        name: 'admin-vcs-integrations',
        component: AdminVcsIntegrations
    },
    {
        path: '/admin/users',
        name: 'admin-users',
        component: AdminUsers
    }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
});

export default router;
