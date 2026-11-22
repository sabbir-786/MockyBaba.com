import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import SubjectDashboard from "./pages/SubjectDashboard";
import ChapterDashboard from "./pages/ChapterDashboard";
import TopicDashboard from "./pages/TopicDashboard";
import PracticeSetup from "./pages/PracticeSetup";
import PracticeSheet from "./pages/PracticeSheet";
import PracticeGrading from "./pages/PracticeGrading";
import PracticeResult from "./pages/PracticeResult";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

export default function App() {
  return (
    <div className="app-container">
      
      <ScrollToTop />

      <div id="main-content" className="app-main" tabIndex={-1}>
        <Routes>
          {/* Unified Google Login/Signup */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* Navigation */}
          <Route path="/" element={protect(<Home />)} />
          <Route path="/subject/:subjectId" element={protect(<SubjectDashboard />)} />
          <Route path="/chapter/:chapterId" element={protect(<ChapterDashboard />)} />
          <Route path="/chapter/:chapterId/:level/topics" element={protect(<TopicDashboard />)} />

          {/* Book Practice Flow: Setup -> Sheet -> Grading -> Result */}
          <Route path="/practice/setup" element={protect(<PracticeSetup />)} />
          <Route path="/practice/sheet" element={protect(<PracticeSheet />)} />
          <Route path="/practice/grading" element={protect(<PracticeGrading />)} />
          <Route path="/practice/result" element={protect(<PracticeResult />)} />

          {/* Later phases (uncomment as each file is created)
          <Route path="/statistics" element={protect(<Statistics />)} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          */}

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}