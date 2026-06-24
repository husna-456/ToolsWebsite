import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import ShareViewerPage from '@/pages/ShareViewerPage';

import MainLayout      from '@/layouts/MainLayout';
import AdminLayout     from '@/layouts/AdminLayout';

import HomePage        from '@/pages/HomePage';
import ToolPage        from '@/pages/ToolPage';
import TextToPdfPage   from '@/pages/tools/TextToPdfPage';
import CategoryPage    from '@/pages/CategoryPage';
import BlogPage        from '@/pages/BlogPage';
import BlogPostPage    from '@/pages/BlogPostPage';
import StaticPage      from '@/pages/StaticPage';
import ContactPage     from '@/pages/ContactPage';
import PrivacyPage     from '@/pages/PrivacyPage';
import TermsPage       from '@/pages/TermsPage';
import NotFound        from '@/pages/NotFound';

import AdminLogin              from '@/pages/admin/AdminLogin';
import AdminDashboard          from '@/pages/admin/AdminDashboard';
import AdminTools              from '@/pages/admin/AdminTools';
import AdminUsers              from '@/pages/admin/AdminUsers';
import AdminGeneralSettings    from '@/pages/admin/AdminGeneralSettings';
import AdminSmtpSettings       from '@/pages/admin/AdminSmtpSettings';
import AdminWebToolsSettings   from '@/pages/admin/AdminWebToolsSettings';
import AdminAdSettings         from '@/pages/admin/AdminAdSettings';
import AdminSaasSettings       from '@/pages/admin/AdminSaasSettings';
import AdminToolPageSettings   from '@/pages/admin/AdminToolPageSettings';
import AdminToolSlugs          from '@/pages/admin/AdminToolSlugs';
import AdminSecurity           from '@/pages/admin/AdminSecurity';
import AdminBlogPosts          from '@/pages/admin/AdminBlogPosts';
import AdminPages              from '@/pages/admin/AdminPages';
import AdminContact            from '@/pages/admin/AdminContact';
import AdminSubscribers        from '@/pages/admin/AdminSubscribers';
import AdminProfile            from '@/pages/admin/AdminProfile';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public routes ── */}
          <Route element={<MainLayout />}>
            <Route path="/"                   element={<HomePage />} />
            <Route path="/tools/text-to-pdf"   element={<TextToPdfPage />} />
            <Route path="/tools/:slug"        element={<ToolPage />} />
            <Route path="/category/:category" element={<CategoryPage />} />
            <Route path="/blog"               element={<BlogPage />} />
            <Route path="/blog/:slug"         element={<BlogPostPage />} />
            <Route path="/page/:slug"         element={<StaticPage />} />
            <Route path="/contact"            element={<ContactPage />} />
            <Route path="/privacy"            element={<PrivacyPage />} />
            <Route path="/terms"              element={<TermsPage />} />
            <Route path="*"                   element={<NotFound />} />
          </Route>

          {/* ── Live Share viewer (fullscreen, no layout) ── */}
          <Route path="/share/:sessionId" element={<ShareViewerPage />} />

          {/* ── Admin login (no layout) ── */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* ── Admin panel (protected by AdminLayout) ── */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard"          element={<AdminDashboard />} />
            <Route path="tools"              element={<AdminTools />} />
            <Route path="users"              element={<AdminUsers />} />
            {/* Administration group */}
            <Route path="general-settings"   element={<AdminGeneralSettings />} />
            <Route path="smtp-settings"      element={<AdminSmtpSettings />} />
            <Route path="web-tools-settings" element={<AdminWebToolsSettings />} />
            <Route path="ad-settings"        element={<AdminAdSettings />} />
            <Route path="saas-settings"      element={<AdminSaasSettings />} />
            <Route path="tool-page-settings" element={<AdminToolPageSettings />} />
            <Route path="tool-slugs"         element={<AdminToolSlugs />} />
            <Route path="security"           element={<AdminSecurity />} />
            {/* Content group */}
            <Route path="blog-posts"         element={<AdminBlogPosts />} />
            <Route path="pages"              element={<AdminPages />} />
            <Route path="contact"            element={<AdminContact />} />
            <Route path="subscribers"        element={<AdminSubscribers />} />
            {/* Account group */}
            <Route path="profile"            element={<AdminProfile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
