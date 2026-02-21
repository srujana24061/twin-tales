import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { LandingPage } from "@/pages/LandingPage";
import { AuthPage } from "@/pages/AuthPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CharacterBuilderPage } from "@/pages/CharacterBuilderPage";
import { StorySetupPage } from "@/pages/StorySetupPage";
import { StoryGenerationPage } from "@/pages/StoryGenerationPage";
import { SceneEditorPage } from "@/pages/SceneEditorPage";
import { VideoEditorPage } from "@/pages/VideoEditorPage";
import { AdStudioPage } from "@/pages/AdStudioPage";
import { TaskHistoryPage } from "@/pages/TaskHistoryPage";
import { DoodleToStoryPage } from "@/pages/DoodleToStoryPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function App() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="noise-overlay" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/characters" element={<ProtectedRoute><CharacterBuilderPage /></ProtectedRoute>} />
          <Route path="/doodle-to-story" element={<ProtectedRoute><DoodleToStoryPage /></ProtectedRoute>} />
          <Route path="/stories/new" element={<ProtectedRoute><StorySetupPage /></ProtectedRoute>} />
          <Route path="/stories/:storyId/generate" element={<ProtectedRoute><StoryGenerationPage /></ProtectedRoute>} />
          <Route path="/stories/:storyId/edit" element={<ProtectedRoute><SceneEditorPage /></ProtectedRoute>} />
          <Route path="/stories/:storyId/video-editor" element={<ProtectedRoute><VideoEditorPage /></ProtectedRoute>} />
          <Route path="/stories/:storyId/ads" element={<ProtectedRoute><AdStudioPage /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><TaskHistoryPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
