import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Shell } from '../app/Shell';
import { LoadingState } from '../components/states';
import { AccountPage, LoginPage, PasswordPage } from '../features/auth/AccountPages';
import { AccountBootstrap, AccountsGate } from '../features/auth/AccountsGate';
import { useWorkspace } from '../app/context';

const DashboardPage = lazy(() => import('../features/dashboard/OverviewDashboard'));
const ModulePage = lazy(() => import('../features/foundation/ModulePage'));
const SystemPage = lazy(() => import('../features/system/SystemPage'));
const ConnectPage = lazy(() => import('../features/auth/ConnectPage'));
const CustomersPage = lazy(() => import('../features/customers/CustomersPage'));
const CustomerDetailPage = lazy(() => import('../features/customers/CustomerDetailPage'));
const CustomerAnalysisPage = lazy(
  () => import('../features/customer-analysis/CustomerAnalysisPage'),
);
const PredictionsPage = lazy(() => import('../features/predictions/PredictionsPage'));
const SegmentationPage = lazy(() => import('../features/segmentation/SegmentationPage'));
const WhatIfPage = lazy(() => import('../features/what-if/WhatIfPage'));
const AdminUsersPage = lazy(() => import('../features/auth/AdminUsersPage'));
const AdminAuditPage = lazy(() => import('../features/auth/AdminAuditPage'));
const AdminOverviewPage = lazy(() => import('../features/auth/AdminOverviewPage'));
const AdminSessionsPage = lazy(() => import('../features/auth/AdminSessionsPage'));
const AssistantPage = lazy(() => import('../features/assistant/AssistantPage'));
const BulkPage = lazy(() => import('../features/bulk/BulkPage'));
const BatchAnalyticsPage = lazy(() => import('../features/bulk-analytics/BatchAnalyticsPage'));
const InsightsPage = lazy(() => import('../features/insights/InsightsPage'));
const ModelReportPage = lazy(() => import('../features/insights/ModelReportPage'));
const EdaPage = lazy(() => import('../features/explorer/EdaPage'));
const ClusterReportPage = lazy(() => import('../features/explorer/ClusterReportPage'));
const ChurnReportPage = lazy(() => import('../features/churn/ChurnReportPage'));
const ChurnWatchPage = lazy(() => import('../features/churn/ChurnWatchPage'));
const ModelsPage = lazy(() => import('../features/models/ModelsPage'));

export function AppRoutes() {
  const { session } = useWorkspace();
  const location = useLocation();
  useEffect(() => {
    document.getElementById('main-content')?.focus();
  }, [location.pathname]);
  return (
    <Suspense fallback={<LoadingState label="Đang mở không gian làm việc…" />}>
      <AccountBootstrap />
      <Routes>
        <Route element={<Shell />}>
          <Route path="login" element={<LoginPage />} />
          <Route
            path="connect"
            element={session.accountMode ? <Navigate to="/login" replace /> : <ConnectPage />}
          />
          <Route element={<AccountsGate />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:customerId" element={<CustomerDetailPage />} />
            <Route path="customers/:customerId/analysis" element={<CustomerAnalysisPage />} />
            <Route path="customers/:customerId/prediction" element={<CustomerDetailPage />} />
            <Route path="predictions" element={<PredictionsPage />} />
            <Route path="segmentation" element={<SegmentationPage />} />
            <Route path="what-if" element={<WhatIfPage />} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="bulk-import" element={<BulkPage />} />
            <Route path="batch-analytics" element={<BatchAnalyticsPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="model-report" element={<ModelReportPage />} />
            <Route path="eda" element={<EdaPage />} />
            <Route path="cluster-report" element={<ClusterReportPage />} />
            <Route path="churn-report" element={<ChurnReportPage />} />
            <Route path="churn" element={<ChurnWatchPage />} />
            <Route path="history" element={<ModulePage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route
              path="account"
              element={session.accountMode ? <AccountPage /> : <Navigate to="/connect" replace />}
            />
            <Route
              path="change-password"
              element={session.accountMode ? <PasswordPage /> : <Navigate to="/connect" replace />}
            />
            <Route
              path="admin/overview"
              element={
                session.accountMode ? <AdminOverviewPage /> : <Navigate to="/connect" replace />
              }
            />
            <Route
              path="admin/users"
              element={
                session.accountMode ? <AdminUsersPage /> : <Navigate to="/connect" replace />
              }
            />
            <Route
              path="admin/sessions"
              element={
                session.accountMode ? <AdminSessionsPage /> : <Navigate to="/connect" replace />
              }
            />
            <Route
              path="admin/audit"
              element={
                session.accountMode ? <AdminAuditPage /> : <Navigate to="/connect" replace />
              }
            />
            <Route
              path="*"
              element={
                <div className="not-found">
                  <span className="error-number">404</span>
                  <h1>Trang này chưa có trong workspace</h1>
                  <p>Đường dẫn có thể đã thay đổi. Hãy quay về không gian tổng quan.</p>
                  <Link className="button button-primary" to="/dashboard">
                    Về trang tổng quan
                  </Link>
                </div>
              }
            />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
