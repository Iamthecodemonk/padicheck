import React, { lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemedToaster } from './components/ThemedToaster';
import { ConsumerShell } from './components/consumer/ConsumerShell';
import { AdminShell } from './components/admin/AdminShell';
import { PublicLayout } from './components/public/PublicLayout';
import { BusinessLayout } from './components/business/BusinessLayout';
import { DeveloperLayout } from './components/developer/DeveloperLayout';
import { PlatformProvider } from './contexts/PlatformContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { TrustProvider } from './contexts/TrustContext';

type PlatformPreview = 'auto' | 'ios' | 'android' | 'desktop';
type AdminRole = 'superAdmin' | 'support' | 'finance';

interface AppProps {
  platformPreview?: PlatformPreview;
  simulateOffline?: boolean;
  adminRole?: AdminRole;
}

const named = <T extends string,>(loader: () => Promise<Record<T, React.ComponentType>>, name: T) => lazy(() => loader().then((m) => ({ default: m[name] })));

// Route-level code splitting keeps the first load small on low-end devices.
const Home = named(() => import('./pages/consumer/Home'), 'Home');
const CheckFlow = named(() => import('./pages/consumer/CheckFlow'), 'CheckFlow');
const Result = named(() => import('./pages/consumer/Result'), 'Result');
const History = named(() => import('./pages/consumer/History'), 'History');
const Saved = named(() => import('./pages/consumer/Saved'), 'Saved');
const Credits = named(() => import('./pages/consumer/Credits'), 'Credits');
const Account = named(() => import('./pages/consumer/Account'), 'Account');
const Security = named(() => import('./pages/consumer/Security'), 'Security');
const Billing = named(() => import('./pages/consumer/Billing'), 'Billing');
const SignIn = named(() => import('./pages/consumer/SignIn'), 'SignIn');
const ShareTarget = named(() => import('./pages/consumer/ShareTarget'), 'ShareTarget');
const Talent = named(() => import('./pages/consumer/Talent'), 'Talent');
const Legal = named(() => import('./pages/consumer/Legal'), 'Legal');

const SignUp = named(() => import('./pages/auth/SignUp'), 'SignUp');
const ForgotPassword = named(() => import('./pages/auth/ForgotPassword'), 'ForgotPassword');
const ResetPassword = named(() => import('./pages/auth/ResetPassword'), 'ResetPassword');
const VerifyCode = named(() => import('./pages/auth/VerifyCode'), 'VerifyCode');
const AccountRecovery = named(() => import('./pages/auth/AccountRecovery'), 'AccountRecovery');

const Verify = named(() => import('./pages/trust/Verify'), 'Verify');
const VerifyCheck = named(() => import('./pages/trust/VerifyCheck'), 'VerifyCheck');
const TrustReport = named(() => import('./pages/trust/TrustReport'), 'TrustReport');
const ReportIssue = named(() => import('./pages/trust/ReportIssue'), 'ReportIssue');
const MyReports = named(() => import('./pages/trust/MyReports'), 'MyReports');
const Notifications = named(() => import('./pages/trust/Notifications'), 'Notifications');
const Search = named(() => import('./pages/trust/Search'), 'Search');

const Landing = named(() => import('./pages/public/Landing'), 'Landing');
const About = named(() => import('./pages/public/About'), 'About');
const HowItWorks = named(() => import('./pages/public/HowItWorks'), 'HowItWorks');
const Pricing = named(() => import('./pages/public/Pricing'), 'Pricing');
const ForBusiness = named(() => import('./pages/public/ForBusiness'), 'ForBusiness');
const Contact = named(() => import('./pages/public/Contact'), 'Contact');
const HelpCentre = named(() => import('./pages/public/HelpCentre'), 'HelpCentre');
const BusinessProfile = named(() => import('./pages/public/BusinessProfile'), 'BusinessProfile');
const Certificate = named(() => import('./pages/public/Certificate'), 'Certificate');
const Directory = named(() => import('./pages/public/Directory'), 'Directory');
const DirectoryRegister = named(() => import('./pages/public/DirectoryRegister'), 'DirectoryRegister');
const BusinessListing = named(() => import('./pages/business/BusinessListing'), 'BusinessListing');
const AdminDirectory = named(() => import('./pages/admin/AdminDirectory'), 'AdminDirectory');

const BusinessDashboard = named(() => import('./pages/business/BusinessDashboard'), 'BusinessDashboard');
const BusinessProfileEdit = named(() => import('./pages/business/BusinessProfileEdit'), 'BusinessProfileEdit');
const BusinessVerification = named(() => import('./pages/business/BusinessVerification'), 'BusinessVerification');
const BusinessReviews = named(() => import('./pages/business/BusinessReviews'), 'BusinessReviews');
const BusinessReports = named(() => import('./pages/business/BusinessReports'), 'BusinessReports');
const BusinessCertificate = named(() => import('./pages/business/BusinessCertificate'), 'BusinessCertificate');
const BusinessTeam = named(() => import('./pages/business/BusinessTeam'), 'BusinessTeam');
const BusinessBilling = named(() => import('./pages/business/BusinessBilling'), 'BusinessBilling');

const DevOverview = named(() => import('./pages/developer/DevOverview'), 'DevOverview');
const DevKeys = named(() => import('./pages/developer/DevKeys'), 'DevKeys');
const DevSandbox = named(() => import('./pages/developer/DevSandbox'), 'DevSandbox');
const DevRequests = named(() => import('./pages/developer/DevRequests'), 'DevRequests');
const DevWebhooks = named(() => import('./pages/developer/DevWebhooks'), 'DevWebhooks');
const DevDocs = named(() => import('./pages/developer/DevDocs'), 'DevDocs');

const AdminLogin = named(() => import('./pages/admin/AdminLogin'), 'AdminLogin');
const AdminDashboard = named(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const AdminAnalytics = named(() => import('./pages/admin/AdminAnalytics'), 'AdminAnalytics');
const AdminUsers = named(() => import('./pages/admin/AdminUsers'), 'AdminUsers');
const AdminUserDetail = named(() => import('./pages/admin/AdminUserDetail'), 'AdminUserDetail');
const AdminSupport = named(() => import('./pages/admin/AdminSupport'), 'AdminSupport');
const AdminCredits = named(() => import('./pages/admin/AdminCredits'), 'AdminCredits');
const AdminPayments = named(() => import('./pages/admin/AdminPayments'), 'AdminPayments');
const AdminAnalyzers = named(() => import('./pages/admin/AdminAnalyzers'), 'AdminAnalyzers');
const AdminProviders = named(() => import('./pages/admin/AdminProviders'), 'AdminProviders');
const AdminDataSources = named(() => import('./pages/admin/AdminDataSources'), 'AdminDataSources');
const AdminHealth = named(() => import('./pages/admin/AdminHealth'), 'AdminHealth');
const AdminContent = named(() => import('./pages/admin/AdminContent'), 'AdminContent');
const AdminContentEditor = named(() => import('./pages/admin/AdminContentEditor'), 'AdminContentEditor');
const AdminNotifications = named(() => import('./pages/admin/AdminNotifications'), 'AdminNotifications');
const AdminTeam = named(() => import('./pages/admin/AdminTeam'), 'AdminTeam');
const AdminAuditLogs = named(() => import('./pages/admin/AdminAuditLogs'), 'AdminAuditLogs');
const AdminSettings = named(() => import('./pages/admin/AdminSettings'), 'AdminSettings');
const AdminBusinesses = named(() => import('./pages/admin/AdminBusinesses'), 'AdminBusinesses');
const AdminReports = named(() => import('./pages/admin/AdminReports'), 'AdminReports');
const AdminDisputes = named(() => import('./pages/admin/AdminDisputes'), 'AdminDisputes');
const AdminReviews = named(() => import('./pages/admin/AdminReviews'), 'AdminReviews');
const AdminTrustScores = named(() => import('./pages/admin/AdminTrustScores'), 'AdminTrustScores');
const AdminAiAnalysis = named(() => import('./pages/admin/AdminAiAnalysis'), 'AdminAiAnalysis');
const AdminApi = named(() => import('./pages/admin/AdminApi'), 'AdminApi');

export function App({ platformPreview = 'auto', simulateOffline = false, adminRole = 'superAdmin' }: AppProps) {
  return (
    <ThemeProvider>
      <PlatformProvider>
        <TrustProvider>
          <BrowserRouter>
            <ThemedToaster />
            <Routes>
              <Route path="admin" element={<AdminShell platformPreview={platformPreview} simulateOffline={simulateOffline} adminRole={adminRole} />}>
                <Route index element={<AdminDashboard />} />
                <Route path="login" element={<AdminLogin />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:id" element={<AdminUserDetail />} />
                <Route path="support" element={<AdminSupport />} />
                <Route path="support/:id" element={<AdminSupport />} />
                <Route path="credits" element={<AdminCredits />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="analyzers" element={<AdminAnalyzers />} />
                <Route path="providers" element={<AdminProviders />} />
                <Route path="data-sources" element={<AdminDataSources />} />
                <Route path="health" element={<AdminHealth />} />
                <Route path="cms" element={<AdminContent />} />
                <Route path="cms/:id" element={<AdminContentEditor />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="team" element={<AdminTeam />} />
                <Route path="audit-logs" element={<AdminAuditLogs />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="businesses" element={<AdminBusinesses />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="disputes" element={<AdminDisputes />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="trust-scores" element={<AdminTrustScores />} />
                <Route path="ai-analysis" element={<AdminAiAnalysis />} />
                <Route path="api" element={<AdminApi />} />
                <Route path="directory" element={<AdminDirectory />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>

              <Route element={<ConsumerShell platformPreview={platformPreview} simulateOffline={simulateOffline} />}>
                <Route element={<PublicLayout />}>
                  <Route path="welcome" element={<Landing />} />
                  <Route path="about" element={<About />} />
                  <Route path="how-it-works" element={<HowItWorks />} />
                  <Route path="pricing" element={<Pricing />} />
                  <Route path="for-business" element={<ForBusiness />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="help" element={<HelpCentre />} />
                  <Route path="legal/:slug" element={<Legal />} />
                  <Route path="b/:slug" element={<BusinessProfile />} />
                  <Route path="directory" element={<Directory />} />
                  <Route path="directory/register" element={<DirectoryRegister />} />
                  <Route path="directory/:category" element={<Directory />} />
                  <Route path="certificate" element={<Certificate />} />
                  <Route path="certificate/:id" element={<Certificate />} />
                  <Route path="developers/docs" element={<div className="px-4 pt-6 lg:px-10"><DevDocs /></div>} />
                </Route>

                <Route path="signin" element={<SignIn />} />
                <Route path="signup" element={<SignUp />} />
                <Route path="forgot-password" element={<ForgotPassword />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="verify-code" element={<VerifyCode />} />
                <Route path="recover" element={<AccountRecovery />} />

                <Route index element={<Home />} />
                <Route path="padi-check" element={<Home />} />
                <Route path="check/:type" element={<CheckFlow />} />
                <Route path="result/:id" element={<Result />} />
                <Route path="history" element={<History />} />
                <Route path="saved" element={<Saved />} />
                <Route path="credits" element={<Credits />} />
                <Route path="account" element={<Account />} />
                <Route path="account/security" element={<Security />} />
                <Route path="account/billing" element={<Billing />} />
                <Route path="talent" element={<Talent />} />
                <Route path="share-target" element={<ShareTarget />} />

                <Route path="verify" element={<Verify />} />
                <Route path="verify/:type" element={<VerifyCheck />} />
                <Route path="report/:id" element={<TrustReport />} />
                <Route path="report-issue" element={<ReportIssue />} />
                <Route path="my-reports" element={<MyReports />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="search" element={<Search />} />

                <Route path="business" element={<BusinessLayout />}>
                  <Route index element={<BusinessDashboard />} />
                  <Route path="profile" element={<BusinessProfileEdit />} />
                  <Route path="verification" element={<BusinessVerification />} />
                  <Route path="listing" element={<BusinessListing />} />
                  <Route path="reviews" element={<BusinessReviews />} />
                  <Route path="reports" element={<BusinessReports />} />
                  <Route path="certificate" element={<BusinessCertificate />} />
                  <Route path="team" element={<BusinessTeam />} />
                  <Route path="billing" element={<BusinessBilling />} />
                </Route>

                <Route path="developers" element={<DeveloperLayout />}>
                  <Route index element={<DevOverview />} />
                  <Route path="keys" element={<DevKeys />} />
                  <Route path="sandbox" element={<DevSandbox />} />
                  <Route path="requests" element={<DevRequests />} />
                  <Route path="webhooks" element={<DevWebhooks />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TrustProvider>
      </PlatformProvider>
    </ThemeProvider>);

}