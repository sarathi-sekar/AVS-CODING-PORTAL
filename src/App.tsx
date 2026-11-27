import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { RequireAuth, RequireRole } from './components/Guards';
import { FullScreenSpinner } from './components/ui';
const Login = lazy(() => import('./pages/Login'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));
const StaffOverview = lazy(() => import('./pages/StaffOverview'));
const Students = lazy(() => import('./pages/Students'));
const Profile = lazy(() => import('./pages/Profile'));
const Users = lazy(() => import('./pages/admin/Users'));
const Departments = lazy(() => import('./pages/admin/Departments'));
const Announcements = lazy(() => import('./pages/admin/Announcements'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Setup = lazy(() => import('./pages/Setup'));
const Saved = lazy(() => import('./pages/Saved'));
const Library = lazy(() => import('./pages/Library'));
const Jobs = lazy(() => import('./pages/Jobs'));
const Schedule = lazy(() => import('./pages/Schedule'));
const ManageJobs = lazy(() => import('./pages/manage/ManageJobs'));
const ManageEvents = lazy(() => import('./pages/manage/ManageEvents'));
const ManageLibrary = lazy(() => import('./pages/manage/ManageLibrary'));
const Certificate = lazy(() => import('./pages/Certificate'));
const ManageChallenges = lazy(() => import('./pages/manage/ManageChallenges'));
const Courses = lazy(() => import('./pages/Courses'));
const CoursePlayer = lazy(() => import('./pages/CoursePlayer'));
const Practice = lazy(() => import('./pages/Practice'));
const QuestionPage = lazy(() => import('./pages/QuestionPage'));
const Tests = lazy(() => import('./pages/Tests'));
const TakeTest = lazy(() => import('./pages/TakeTest'));
const TestResult = lazy(() => import('./pages/TestResult'));
const Placement = lazy(() => import('./pages/Placement'));
const Skills = lazy(() => import('./pages/Skills'));
const Achievements = lazy(() => import('./pages/Achievements'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const StudentDetail = lazy(() => import('./pages/StudentDetail'));
const ManageContent = lazy(() => import('./pages/manage/ManageContent'));
const ManageQuestions = lazy(() => import('./pages/manage/ManageQuestions'));
const ManageAssessments = lazy(() => import('./pages/manage/ManageAssessments'));


function Home() {
  const { profile } = useAuth();
  return profile?.role === 'student' ? <StudentDashboard /> : <StaffOverview />;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="profile" element={<Profile />} />
        <Route path="students" element={<RequireRole roles={['admin', 'faculty', 'placement_coordinator']}><Students /></RequireRole>} />
        <Route path="admin/users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
        <Route path="admin/departments" element={<RequireRole roles={['admin']}><Departments /></RequireRole>} />
        <Route path="admin/announcements" element={<RequireRole roles={['admin']}><Announcements /></RequireRole>} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:courseId/certificate" element={<Certificate />} />
        <Route path="courses/:courseId/:lessonId?" element={<CoursePlayer />} />
        <Route path="practice" element={<Practice />} />
        <Route path="practice/:id" element={<QuestionPage />} />
        <Route path="tests" element={<Tests />} />
        <Route path="tests/attempt/:attemptId" element={<TakeTest />} />
        <Route path="tests/result/:attemptId" element={<TestResult />} />
        <Route path="placement" element={<Placement />} />
        <Route path="skills" element={<Skills />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="students/:uid" element={<RequireRole roles={['admin', 'faculty', 'placement_coordinator']}><StudentDetail /></RequireRole>} />
        <Route path="manage/content" element={<RequireRole roles={['admin', 'faculty']}><ManageContent /></RequireRole>} />
        <Route path="manage/questions" element={<RequireRole roles={['admin', 'faculty']}><ManageQuestions /></RequireRole>} />
        <Route path="manage/assessments" element={<RequireRole roles={['admin', 'faculty', 'placement_coordinator']}><ManageAssessments /></RequireRole>} />
        <Route path="saved" element={<Saved />} />
        <Route path="library" element={<Library />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="manage/jobs" element={<RequireRole roles={['admin', 'faculty', 'placement_coordinator']}><ManageJobs /></RequireRole>} />
        <Route path="manage/schedule" element={<RequireRole roles={['admin', 'faculty']}><ManageEvents /></RequireRole>} />
        <Route path="manage/library" element={<RequireRole roles={['admin', 'faculty', 'placement_coordinator']}><ManageLibrary /></RequireRole>} />
        <Route path="manage/challenges" element={<RequireRole roles={['admin', 'faculty']}><ManageChallenges /></RequireRole>} />
        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
