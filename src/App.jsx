import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import ScrollToTop from '@/components/ScrollToTop';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AuthCallback from '@/pages/AuthCallback';
import EmbedPlayer from '@/pages/EmbedPlayer';

import MainLayout from '@/components/layout/MainLayout';
import Home from '@/pages/Home';
import Collection from '@/pages/Collection';
import SpeciesDetail from '@/pages/SpeciesDetail';
import BiophonyMap from '@/pages/BiophonyMap';
import About from '@/pages/About';
import Blog from '@/pages/Blog';
import BlogPost from '@/pages/BlogPost';
import Concepts from '@/pages/Concepts';
import ConceptDetail from '@/pages/ConceptDetail';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminSpecies from '@/pages/admin/AdminSpecies';
import AdminRecordings from '@/pages/admin/AdminRecordings';
import AdminBlog from '@/pages/admin/AdminBlog';
import AdminConcepts from '@/pages/admin/AdminConcepts';

const AppRoutes = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/coleccion" element={<Collection />} />
        <Route path="/especie/:id" element={<SpeciesDetail />} />
        <Route path="/mapa" element={<BiophonyMap />} />
        <Route path="/nosotros" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/conceptos" element={<Concepts />} />
        <Route path="/conceptos/:slug" element={<ConceptDetail />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/embed/:id" element={<EmbedPlayer />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminSpecies />} />
          <Route path="/admin/grabaciones" element={<AdminRecordings />} />
          <Route path="/admin/blog" element={<AdminBlog />} />
          <Route path="/admin/conceptos" element={<AdminConcepts />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AppRoutes />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
