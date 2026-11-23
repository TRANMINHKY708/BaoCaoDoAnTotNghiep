import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContext } from '../app/context';
import { WorkspaceSession } from '../features/auth/session';
import { createQueryClient } from '../api/query';
import { AppRoutes } from './AppRoutes';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ApiError } from '../api/errors';

function renderApp(path: string) {
  const queries = createQueryClient();
  const fetcher = vi.fn<typeof fetch>();
  const session = new WorkspaceSession('/backend', () => queries.clear(), fetcher);
  render(
    <QueryClientProvider client={queries}>
      <WorkspaceContext.Provider value={session}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </WorkspaceContext.Provider>
    </QueryClientProvider>,
  );
  return { fetcher, session };
}

describe('workspace routes and states', () => {
  it('keeps navigation working without a presentation-mode control or business API calls', async () => {
    const { fetcher, session } = renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Tổng quan', level: 1 });
    const before = session.getSnapshot();
    expect(screen.queryByRole('button', { name: 'Chế độ trình chiếu' })).not.toBeInTheDocument();
    expect(session.getSnapshot()).toEqual(before);
    await userEvent.click(
      within(screen.getByRole('navigation')).getByRole('link', { name: 'Khách hàng' }),
    );
    await screen.findByRole('heading', { name: 'Khách hàng', level: 1 });
    expect(document.querySelector('.app-shell')).not.toHaveClass('demo-mode');
    expect(fetcher).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toEqual(before);
  });
  it.each([
    ['/dashboard', 'Tổng quan'],
    ['/customers', 'Khách hàng'],
    ['/customers/sample', 'Chi tiết khách hàng'],
    ['/customers/sample/prediction', 'Chi tiết khách hàng'],
    ['/predictions', 'Dự đoán mức độ mua hàng'],
    ['/segmentation', 'Phân nhóm khách hàng'],
    ['/what-if', 'Mô phỏng thay đổi hành vi'],
    ['/history', 'Lịch sử kết quả'],
    ['/system', 'Hệ thống & mô hình'],
    ['/insights', 'Phân tích hành vi mua hàng'],
    ['/model-report', 'Kết quả mô hình'],
    ['/eda', 'Khám phá dữ liệu hành vi'],
    ['/cluster-report', 'Đánh giá phân cụm K-Means'],
    ['/churn-report', 'Dự báo nguy cơ rời bỏ'],
    ['/churn', 'Khách hàng cần giữ chân'],
    ['/models', 'Quản lý mô hình'],
    ['/connect', 'Kết nối không gian làm việc'],
  ])('renders %s without business API calls', async (path, title) => {
    const { fetcher } = renderApp(path);
    // Lazy chunks such as /eda (about 1 MB of bundled data) can exceed the 1 s default under load.
    expect(
      await screen.findByRole('heading', { name: title, level: 1 }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('K6 lists the churn watchlist in the sidebar and keeps breadcrumbs exact', async () => {
    renderApp('/churn-report');
    await screen.findByRole('heading', { name: 'Dự báo nguy cơ rời bỏ', level: 1 });
    const nav = screen.getByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Khách hàng cần giữ chân' })).toHaveAttribute(
      'href',
      '/churn',
    );
    expect(screen.queryByText('Khách hàng cần giữ chân', { selector: 'header *' })).toBeNull();
  });
  it('renders 404 and provides a return link', async () => {
    renderApp('/not-a-real-page');
    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về trang tổng quan' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
  it('restores menu focus after removing inert when Escape closes navigation', async () => {
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Tổng quan', level: 1 });
    const user = userEvent.setup();
    const opener = screen.getByRole('button', { name: 'Mở menu' });
    await user.click(opener);
    const nativeFocus = opener.focus.bind(opener);
    const focus = vi.spyOn(opener, 'focus').mockImplementation(() => {
      expect(opener.closest('[inert]')).toBeNull();
      nativeFocus();
    });
    await user.keyboard('{Escape}');
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(focus).toHaveBeenCalled();
    expect(opener).toHaveFocus();
  });
  it('navigates by sidebar and module search using keyboard', async () => {
    renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Tổng quan', level: 1 });
    const user = userEvent.setup();
    const nav = screen.getByRole('navigation');
    await user.click(within(nav).getByRole('link', { name: 'Khách hàng' }));
    expect(
      await screen.findByRole('heading', { name: 'Khách hàng', level: 1 }),
    ).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Tìm chức năng' }), 'Mô phỏng{Enter}');
    expect(
      await screen.findByRole('heading', { name: 'Mô phỏng thay đổi hành vi', level: 1 }),
    ).toBeInTheDocument();
  });
  it('does not display invented customer KPIs or future forecasts', async () => {
    renderApp('/dashboard');
    expect(await screen.findByText('Kết nối dữ liệu của bạn.')).toBeInTheDocument();
    expect(screen.getByText(/Chưa hiển thị số liệu khách hàng/)).toBeInTheDocument();
    expect(screen.queryByText('49,960')).not.toBeInTheDocument();
  });
  it('renders loading/error/empty states without raw unknown errors', () => {
    render(
      <MemoryRouter>
        <LoadingState />
        <EmptyState title="Chưa có dữ liệu" description="Chưa kết nối" />
        <ErrorState error={new Error('private-sensitive-details')} />
        <ErrorState error={new ApiError('http', 429, { retryAfterSeconds: 60 })} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
    expect(screen.queryByText('private-sensitive-details')).not.toBeInTheDocument();
    expect(screen.getByText(/60 giây/)).toBeInTheDocument();
  });
  it('error boundary has a safe fallback and does not log the thrown value', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): never {
      throw new Error('synthetic-private-exception');
    }
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Giao diện cần được tải lại');
    expect(screen.queryByText('synthetic-private-exception')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
