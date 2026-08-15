import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { RequireAuth } from "./components/layout/RequireAuth";
import { AppShell } from "./components/layout/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { MatchesPage } from "./pages/MatchesPage";
import { ChatPage } from "./pages/ChatPage";
import { ProfilePage } from "./pages/ProfilePage";
import { StepPhotos } from "./pages/onboarding/StepPhotos";
import { StepSchool } from "./pages/onboarding/StepSchool";
import { StepGoal } from "./pages/onboarding/StepGoal";
import { StepInterests } from "./pages/onboarding/StepInterests";
import { StepPersonality } from "./pages/onboarding/StepPersonality";
import { StepLifestyle } from "./pages/onboarding/StepLifestyle";
import { StepAvailability } from "./pages/onboarding/StepAvailability";
import { StepDistance } from "./pages/onboarding/StepDistance";
import { CommunitiesPage } from "./pages/communities/CommunitiesPage";
import { CommunityDetailPage } from "./pages/communities/CommunityDetailPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { RequireRole } from "./components/layout/RequireRole";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<RequireAuth />}>
              <Route path="/onboarding/photos" element={<StepPhotos />} />
              <Route path="/onboarding/school" element={<StepSchool />} />
              <Route path="/onboarding/goal" element={<StepGoal />} />
              <Route path="/onboarding/interests" element={<StepInterests />} />
              <Route path="/onboarding/personality" element={<StepPersonality />} />
              <Route path="/onboarding/lifestyle" element={<StepLifestyle />} />
              <Route path="/onboarding/availability" element={<StepAvailability />} />
              <Route path="/onboarding/distance" element={<StepDistance />} />

              <Route element={<AppShell />}>
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:matchId" element={<ChatPage />} />
                <Route path="/communities" element={<CommunitiesPage />} />
                <Route path="/communities/:id" element={<CommunityDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route element={<RequireRole roles={["moderator", "admin", "super_admin"]} />}>
                  <Route path="/admin" element={<AdminDashboardPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
