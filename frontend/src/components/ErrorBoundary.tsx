import { Component } from 'react';
import type { ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* Never log customer payloads or credentials. */
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-panel" role="alert">
        <span className="eyebrow">ECOMMERCE AI</span>
        <h1>Giao diện cần được tải lại</h1>
        <p>Đã xảy ra lỗi hiển thị. Không có dữ liệu nào được gửi lại tự động.</p>
        <a className="button button-primary" href="/">
          Về trang tổng quan
        </a>
      </main>
    ) : (
      this.props.children
    );
  }
}
