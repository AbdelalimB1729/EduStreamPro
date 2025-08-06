import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth-store';
import { UserRole } from '@/types/user-types';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/courses',
    name: 'CourseList',
    component: () => import('@/views/courses/CourseList.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/courses/create',
    name: 'CourseCreate',
    component: () => import('@/views/instructor/CourseBuilder.vue'),
    meta: { requiresAuth: true, roles: [UserRole.INSTRUCTOR] },
  },
  {
    path: '/courses/:id',
    name: 'CourseDetail',
    component: () => import('@/views/courses/CourseDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/courses/:id/edit',
    name: 'CourseEdit',
    component: () => import('@/views/instructor/CourseBuilder.vue'),
    meta: { requiresAuth: true, roles: [UserRole.INSTRUCTOR] },
  },
  {
    path: '/courses/:courseId/learn',
    name: 'CoursePlayer',
    component: () => import('@/views/student/CoursePlayer.vue'),
    meta: { requiresAuth: true, roles: [UserRole.STUDENT] },
  },
  {
    path: '/quizzes/:id/start',
    name: 'QuizSession',
    component: () => import('@/views/student/QuizSession.vue'),
    meta: { requiresAuth: true, roles: [UserRole.STUDENT] },
  },
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('@/views/instructor/AnalyticsDashboard.vue'),
    meta: { requiresAuth: true, roles: [UserRole.INSTRUCTOR] },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/Profile.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0 };
  },
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const isAuthenticated = authStore.isAuthenticated;
  const userRole = authStore.userRole;

  // Handle routes that require guest access
  if (to.meta.requiresGuest && isAuthenticated) {
    return next('/dashboard');
  }

  // Handle routes that require authentication
  if (to.meta.requiresAuth) {
    if (!isAuthenticated) {
      return next('/login');
    }

    // Check role requirements
    if (to.meta.roles && !to.meta.roles.includes(userRole)) {
      return next('/dashboard');
    }
  }

  next();
});

export default router;