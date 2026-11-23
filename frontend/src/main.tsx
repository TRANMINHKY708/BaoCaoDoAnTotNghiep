import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceContext } from './app/context';
import { createQueryClient } from './api/query';
import { publicApiBase, publicAuthOptions } from './api/config';
import { WorkspaceSession } from './features/auth/session';
import { AppRoutes } from './routes/AppRoutes';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErrorState } from './components/states';
import { initTheme } from './app/theme';
import './styles.css';
import './theme-dark.css';
import './theme-dark-manual.css';

initTheme();

const root = createRoot(document.getElementById('root')!, {
  onCaughtError: () => {},
  onUncaughtError: () => {},
});
try {
  const queryClient = createQueryClient();
  const session = new WorkspaceSession(
    publicApiBase(),
    () => {
      void queryClient.cancelQueries();
      queryClient.clear();
    },
    fetch,
    publicAuthOptions(),
  );
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <WorkspaceContext.Provider value={session}>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </WorkspaceContext.Provider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (error) {
  root.render(
    <div className="fatal-panel">
      <h1>Thiết lập kết nối API</h1>
      <ErrorState error={error} />
      <p>
        Cấu hình VITE_API_BASE_URL công khai trước khi build. Không thêm token vào biến môi trường
        Vite.
      </p>
    </div>,
  );
}
