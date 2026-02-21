import { Navigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';

export const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('storycraft_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      <Navbar />
      <main className="pt-20 relative z-10">
        {children}
      </main>
    </>
  );
};
