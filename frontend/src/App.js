import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LandingPage } from "@/pages/LandingPage";
import { AuthPage } from "@/pages/AuthPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CharacterBuilderPage } from "@/pages/CharacterBuilderPage";
import { StorySetupPage } from "@/pages/StorySetupPage";
import { StoryGenerationPage } from "@/pages/StoryGenerationPage";
import { SceneEditorPage } from "@/pages/SceneEditorPage";
import { SceneGridEditor } from "@/pages/SceneGridEditor";
import { VideoEditorPage } from "@/pages/VideoEditorPage";
import { FriendsPage } from "@/pages/FriendsPage";
import { CollaborationPage } from "@/pages/CollaborationPage";
import { CollaborationReportPage } from "@/pages/CollaborationReportPage";
import { CollabChatPage } from "@/pages/CollabChatPage";
import { AdStudioPage } from "@/pages/AdStudioPage";
import { TaskHistoryPage } from "@/pages/TaskHistoryPage";
import { DoodleToStoryPage } from "@/pages/DoodleToStoryPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ParentDashboardPage from "@/pages/ParentDashboardPage";
import { TimelinePage } from "@/pages/TimelinePage";
import { FriendChatWidget } from "@/components/FriendChatWidget";

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen theme-page-bg">
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
            <Route path="/stories/:storyId/edit" element={<ProtectedRoute><SceneGridEditor /></ProtectedRoute>} />
            <Route path="/stories/:storyId/edit-old" element={<ProtectedRoute><SceneEditorPage /></ProtectedRoute>} />
            <Route path="/stories/:storyId/video-editor" element={<ProtectedRoute><VideoEditorPage /></ProtectedRoute>} />
            <Route path="/stories/:storyId/ads" element={<ProtectedRoute><AdStudioPage /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><TaskHistoryPage /></ProtectedRoute>} />
            <Route path="/parent-dashboard" element={<ProtectedRoute><ParentDashboardPage /></ProtectedRoute>} />
            <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
            <Route path="/collab/new" element={<ProtectedRoute><CollabChatPage /></ProtectedRoute>} />
            <Route path="/collab/chat/:sessionId" element={<ProtectedRoute><CollabChatPage /></ProtectedRoute>} />
            <Route path="/collab/:sessionId" element={<ProtectedRoute><CollaborationPage /></ProtectedRoute>} />
            <Route path="/collab/report/:sessionId" element={<ProtectedRoute><CollaborationReportPage /></ProtectedRoute>} />
            <Route path="/timeline" element={<ProtectedRoute><TimelinePage /></ProtectedRoute>} />
          </Routes>
          <FriendChatWidget />
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </div>
    </ThemeProvider>
  );
}

export default App;
